import { getProjectDuration, getTrackClips } from "./multitrackOperations.js?v=20260429-cycle1";
import {
  choosePeakLevel,
  drawWaveformPeakLevel,
  getClipWaveformPyramid
} from "./waveformPeaks.js?v=20260429-cycle1";

const RULER_HEIGHT = 42;
const TRACK_HEIGHT = 96;
const TRACK_GAP = 10;
const LEFT_GUTTER = 0;
const RIGHT_PADDING = 24;
const BOTTOM_PADDING = 24;
const CLIP_HEADER_HEIGHT = 22;
const MIN_DURATION = 8;

/**
 * @typedef {import("./multitrackOperations.js").EditorTrack} EditorTrack
 * @typedef {import("./multitrackOperations.js").EditorClip} EditorClip
 * @typedef {import("./multitrackOperations.js").EditorSelection} EditorSelection
 */

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ tracks: EditorTrack[]; clips: EditorClip[]; playheadTime: number; selection: EditorSelection | null; currentTrackId: string | null; movingClipId: string | null; durationOverride: number | null; zoom: number }} state
 */
export function drawTimelineWaveform(canvas, state) {
  const parentWidth = canvas.parentElement?.clientWidth ?? 1000;
  const parentHeight = canvas.parentElement?.clientHeight ?? 560;
  const zoom = Math.max(1, state.zoom ?? 1);
  const cssWidth = Math.max(720, parentWidth * zoom);
  const cssHeight = Math.max(
    parentHeight,
    RULER_HEIGHT + state.tracks.length * (TRACK_HEIGHT + TRACK_GAP) + BOTTOM_PADDING
  );
  const pixelRatio = window.devicePixelRatio || 1;

  const nextCanvasWidth = Math.floor(cssWidth * pixelRatio);
  const nextCanvasHeight = Math.floor(cssHeight * pixelRatio);

  if (canvas.width !== nextCanvasWidth || canvas.height !== nextCanvasHeight) {
    canvas.width = nextCanvasWidth;
    canvas.height = nextCanvasHeight;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
  }

  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  const duration = state.durationOverride ?? getDrawDuration(state.tracks, state.clips);
  const layout = getTimelineLayout(cssWidth, cssHeight, state.tracks.length);

  drawBackground(context, cssWidth, cssHeight);
  drawRuler(context, layout, duration);

  for (let index = 0; index < state.tracks.length; index += 1) {
    const track = state.tracks[index];
    const rect = getTrackRect(layout, index);
    drawTrackLane(context, rect, track, state.currentTrackId === track.id);
    drawTrackClips(context, rect, track, state.clips, duration, state);
  }

  drawSelection(context, layout, state.tracks, state.selection, duration);
  drawPlayhead(context, layout, state.playheadTime, duration);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {PointerEvent | MouseEvent} event
 * @param {{ tracks: EditorTrack[]; clips: EditorClip[]; durationOverride: number | null }} project
 * @returns {{ time: number; trackId: string | null; clipId: string | null; area: "ruler" | "clip-header" | "clip-body" | "track" | "outside" }}
 */
export function getTimelinePointerInfo(canvas, event, project) {
  const rect = canvas.getBoundingClientRect();
  const layout = getTimelineLayout(rect.width, rect.height, project.tracks.length);
  const duration = project.durationOverride ?? getDrawDuration(project.tracks, project.clips);
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const time = xToTime(x, layout, duration);

  if (y < RULER_HEIGHT) {
    return { time, trackId: null, clipId: null, area: "ruler" };
  }

  const trackIndex = Math.floor((y - RULER_HEIGHT) / (TRACK_HEIGHT + TRACK_GAP));
  if (trackIndex < 0 || trackIndex >= project.tracks.length) {
    return { time, trackId: null, clipId: null, area: "outside" };
  }

  const track = project.tracks[trackIndex];
  const trackRect = getTrackRect(layout, trackIndex);
  if (y < trackRect.y || y > trackRect.y + trackRect.height) {
    return { time, trackId: track.id, clipId: null, area: "outside" };
  }

  const clip = getTrackClips(track.id, project.clips)
    .slice()
    .reverse()
    .find((candidate) => {
      const clipRect = getClipRect(trackRect, candidate, duration);
      return x >= clipRect.x && x <= clipRect.x + clipRect.width;
    });

  if (!clip) return { time, trackId: track.id, clipId: null, area: "track" };

  const clipRect = getClipRect(trackRect, clip, duration);
  const isHeader = y <= clipRect.y + CLIP_HEADER_HEIGHT;
  return {
    time,
    trackId: track.id,
    clipId: clip.id,
    area: isHeader ? "clip-header" : "clip-body"
  };
}

/**
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @returns {number}
 */
function getDrawDuration(tracks, clips) {
  return Math.max(MIN_DURATION, getProjectDuration(tracks, clips));
}

/**
 * @param {number} width
 * @param {number} height
 * @param {number} trackCount
 * @returns {{ x: number; y: number; width: number; height: number; trackCount: number }}
 */
function getTimelineLayout(width, height, trackCount) {
  return {
    x: LEFT_GUTTER,
    y: RULER_HEIGHT,
    width: Math.max(1, width - LEFT_GUTTER - RIGHT_PADDING),
    height: Math.max(1, height - RULER_HEIGHT - BOTTOM_PADDING),
    trackCount
  };
}

/**
 * @param {{ x: number; y: number; width: number }} layout
 * @param {number} trackIndex
 * @returns {{ x: number; y: number; width: number; height: number }}
 */
function getTrackRect(layout, trackIndex) {
  return {
    x: layout.x,
    y: RULER_HEIGHT + trackIndex * (TRACK_HEIGHT + TRACK_GAP),
    width: layout.width,
    height: TRACK_HEIGHT
  };
}

/**
 * @param {{ x: number; width: number }} layout
 * @param {number} time
 * @param {number} duration
 * @returns {number}
 */
function timeToX(layout, time, duration) {
  return layout.x + (time / duration) * layout.width;
}

/**
 * @param {number} x
 * @param {{ x: number; width: number }} layout
 * @param {number} duration
 * @returns {number}
 */
function xToTime(x, layout, duration) {
  const localX = clamp(x - layout.x, 0, layout.width);
  return duration > 0 ? (localX / layout.width) * duration : 0;
}

/**
 * @param {{ x: number; y: number; width: number; height: number }} trackRect
 * @param {EditorClip} clip
 * @param {number} duration
 * @returns {{ x: number; y: number; width: number; height: number }}
 */
function getClipRect(trackRect, clip, duration) {
  const x = trackRect.x + (clip.startTime / duration) * trackRect.width;
  const width = Math.max(8, (clip.duration / duration) * trackRect.width);
  return {
    x,
    y: trackRect.y + 8,
    width,
    height: trackRect.height - 16
  };
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 */
function drawBackground(context, width, height) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#05070a");
  gradient.addColorStop(1, "#081113");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number; width: number }} layout
 * @param {number} duration
 */
function drawRuler(context, layout, duration) {
  context.fillStyle = "rgba(255, 255, 255, 0.035)";
  context.fillRect(0, 0, layout.x + layout.width + RIGHT_PADDING, RULER_HEIGHT);
  context.strokeStyle = "rgba(168, 216, 220, 0.2)";
  context.beginPath();
  context.moveTo(0, RULER_HEIGHT - 0.5);
  context.lineTo(layout.x + layout.width + RIGHT_PADDING, RULER_HEIGHT - 0.5);
  context.stroke();

  const targetTicks = Math.max(4, Math.floor(layout.width / 140));
  const interval = chooseTimeInterval(duration / targetTicks);

  context.font = "700 11px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
  context.fillStyle = "rgba(168, 216, 220, 0.72)";
  context.strokeStyle = "rgba(168, 216, 220, 0.12)";

  for (let time = 0; time <= duration + 0.0001; time += interval) {
    const x = timeToX(layout, time, duration);
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, 100000);
    context.stroke();
    context.fillText(formatTime(time), x + 4, 25);
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number; y: number; width: number; height: number }} rect
 * @param {EditorTrack} track
 * @param {boolean} isCurrent
 */
function drawTrackLane(context, rect, track, isCurrent) {
  context.fillStyle = isCurrent
    ? "rgba(123, 97, 255, 0.12)"
    : "rgba(255, 255, 255, 0.028)";
  context.fillRect(0, rect.y, rect.x + rect.width + RIGHT_PADDING, rect.height);

  context.strokeStyle = isCurrent
    ? "rgba(154, 134, 255, 0.58)"
    : "rgba(168, 216, 220, 0.13)";
  context.strokeRect(rect.x, rect.y, rect.width, rect.height);

  if (LEFT_GUTTER >= 80) {
    context.fillStyle = track.isEmptyLane
      ? "rgba(168, 216, 220, 0.44)"
      : "rgba(244, 247, 251, 0.92)";
    context.font = "800 12px Inter, ui-sans-serif, system-ui";
    context.fillText(track.name, 16, rect.y + 28);

    const badges = [
      track.muted ? "MUTE" : null,
      track.solo ? "SOLO" : null,
      track.isEmptyLane ? "PEGAR ACÁ" : null
    ].filter(Boolean);

    context.font = "800 10px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    badges.forEach((badge, index) => {
      context.fillStyle = badge === "PEGAR ACÁ"
        ? "rgba(168, 216, 220, 0.7)"
        : "rgba(255, 176, 0, 0.88)";
      context.fillText(badge, 16, rect.y + 50 + index * 14);
    });
  }

  if (track.isEmptyLane) {
    context.setLineDash([8, 7]);
    context.strokeStyle = "rgba(168, 216, 220, 0.22)";
    context.strokeRect(rect.x + 10, rect.y + 14, rect.width - 20, rect.height - 28);
    context.setLineDash([]);
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number; y: number; width: number; height: number }} trackRect
 * @param {EditorTrack} track
 * @param {EditorClip[]} clips
 * @param {number} duration
 * @param {{ selection: EditorSelection | null; movingClipId: string | null }} state
 */
function drawTrackClips(context, trackRect, track, clips, duration, state) {
  for (const clip of getTrackClips(track.id, clips)) {
    const rect = getClipRect(trackRect, clip, duration);
    const isSelected = isClipSelected(state.selection, clip.id);
    const isMoving = state.movingClipId === clip.id;

    context.fillStyle = isSelected
      ? "rgba(123, 97, 255, 0.28)"
      : "rgba(10, 25, 29, 0.92)";
    context.strokeStyle = isSelected
      ? "rgba(154, 134, 255, 0.96)"
      : "rgba(168, 216, 220, 0.32)";
    context.lineWidth = isMoving ? 2 : 1;
    roundedRect(context, rect.x, rect.y, rect.width, rect.height, 12);
    context.fill();
    context.stroke();
    context.lineWidth = 1;

    context.fillStyle = "rgba(168, 216, 220, 0.1)";
    roundedRect(context, rect.x, rect.y, rect.width, CLIP_HEADER_HEIGHT, 12);
    context.fill();

    context.fillStyle = "rgba(244, 247, 251, 0.88)";
    context.font = "800 11px Inter, ui-sans-serif, system-ui";
    const maxTextWidth = Math.max(20, rect.width - 16);
    fillClippedText(context, clip.name, rect.x + 8, rect.y + 15, maxTextWidth);

    drawWaveform(context, clip, rect);
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {EditorClip} clip
 * @param {{ x: number; y: number; width: number; height: number }} rect
 */
function drawWaveform(context, clip, rect) {
  const waveformRect = {
    x: rect.x,
    y: rect.y + CLIP_HEADER_HEIGHT + 5,
    width: rect.width,
    height: Math.max(1, rect.height - CLIP_HEADER_HEIGHT - 12)
  };
  const pyramid = getClipWaveformPyramid(clip);
  const samplesPerPixel = clip.buffer.length / Math.max(1, waveformRect.width);
  const level = choosePeakLevel(pyramid, samplesPerPixel);
  drawWaveformPeakLevel(context, level, waveformRect);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number; y: number; width: number; trackCount: number }} layout
 * @param {EditorTrack[]} tracks
 * @param {EditorSelection | null} selection
 * @param {number} duration
 */
function drawSelection(context, layout, tracks, selection, duration) {
  if (!selection) return;

  if (selection.kind === "clip") return;

  const start = Math.min(selection.startTime, selection.endTime);
  const end = Math.max(selection.startTime, selection.endTime);
  if (Math.abs(end - start) < 0.01) return;

  const x = timeToX(layout, start, duration);
  const width = Math.max(2, timeToX(layout, end, duration) - x);
  let y = RULER_HEIGHT;
  let height = layout.trackCount * (TRACK_HEIGHT + TRACK_GAP) - TRACK_GAP;

  if (selection.kind === "track-range") {
    const trackIndex = tracks.findIndex((track) => track.id === selection.trackId);
    if (trackIndex < 0) return;
    const trackRect = getTrackRect(layout, trackIndex);
    y = trackRect.y;
    height = trackRect.height;
  }

  if (selection.kind === "clip-range") {
    const trackIndex = tracks.findIndex((track) => track.clipIds.includes(selection.clipId));
    if (trackIndex >= 0) {
      const trackRect = getTrackRect(layout, trackIndex);
      y = trackRect.y;
      height = trackRect.height;
    }
  }

  context.fillStyle = "rgba(123, 97, 255, 0.2)";
  context.fillRect(x, y, width, height);
  context.strokeStyle = "rgba(154, 134, 255, 0.9)";
  context.strokeRect(x, y, width, height);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {{ x: number; y: number; width: number; height: number }} layout
 * @param {number} playheadTime
 * @param {number} duration
 */
function drawPlayhead(context, layout, playheadTime, duration) {
  const x = timeToX(layout, clamp(playheadTime, 0, duration), duration);
  context.strokeStyle = "#ffb000";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(x, 0);
  context.lineTo(x, layout.y + layout.height);
  context.stroke();
  context.lineWidth = 1;
}

/**
 * @param {EditorSelection | null} selection
 * @param {string} clipId
 * @returns {boolean}
 */
function isClipSelected(selection, clipId) {
  return Boolean(
    selection &&
      (selection.kind === "clip" || selection.kind === "clip-range") &&
      selection.clipId === clipId
  );
}

/**
 * @param {number} roughInterval
 * @returns {number}
 */
function chooseTimeInterval(roughInterval) {
  const candidates = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
  return candidates.find((candidate) => candidate >= roughInterval) ?? 600;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {number} maxWidth
 */
function fillClippedText(context, text, x, y, maxWidth) {
  if (context.measureText(text).width <= maxWidth) {
    context.fillText(text, x, y);
    return;
  }

  let clipped = text;
  while (clipped.length > 1 && context.measureText(`${clipped}…`).width > maxWidth) {
    clipped = clipped.slice(0, -1);
  }
  context.fillText(`${clipped}…`, x, y);
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function roundedRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.arcTo(x + width, y, x + width, y + height, safeRadius);
  context.arcTo(x + width, y + height, x, y + height, safeRadius);
  context.arcTo(x, y + height, x, y, safeRadius);
  context.arcTo(x, y, x + width, y, safeRadius);
  context.closePath();
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${minutes}:${remainingSeconds.toFixed(1).padStart(4, "0")}`;
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

