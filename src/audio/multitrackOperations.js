import {
  cloneAudioBuffer,
  concatenateBuffers,
  normalizeRange,
  sliceAudioBuffer
} from "./timelineOperations.js?v=20260429-cycle1";

const MIN_CLIP_DURATION = 0.01;
const DEFAULT_TRACK_GAIN = 1;
const DEFAULT_CLIP_GAIN = 1;
const PEAK_TARGET = 0.95;
const RMS_TARGET = 0.18;
const MAX_NORMALIZATION_GAIN = 8;

/**
 * @typedef {Object} EditorTrack
 * @property {string} id
 * @property {string} name
 * @property {string[]} clipIds
 * @property {boolean} muted
 * @property {boolean} solo
 * @property {number} gain
 * @property {boolean} isEmptyLane
 */

/**
 * @typedef {Object} EditorClip
 * @property {string} id
 * @property {string} trackId
 * @property {string} name
 * @property {AudioBuffer} buffer
 * @property {number} startTime
 * @property {number} duration
 * @property {number} gain
 * @property {number} sourceOffset
 * @property {number} sourceDuration
 */

/**
 * @typedef {{ kind: "clip", clipId: string } | { kind: "clip-range", clipId: string, startTime: number, endTime: number } | { kind: "track-range", trackId: string, startTime: number, endTime: number } | { kind: "global-range", startTime: number, endTime: number }} EditorSelection
 */

/**
 * @param {string} name
 * @param {boolean} [isEmptyLane]
 * @returns {EditorTrack}
 */
export function createTrack(name, isEmptyLane = false) {
  return {
    id: crypto.randomUUID(),
    name,
    clipIds: [],
    muted: false,
    solo: false,
    gain: DEFAULT_TRACK_GAIN,
    isEmptyLane
  };
}

/**
 * @param {string} trackId
 * @param {string} name
 * @param {AudioBuffer} buffer
 * @param {number} startTime
 * @returns {EditorClip}
 */
export function createClip(trackId, name, buffer, startTime) {
  return {
    id: crypto.randomUUID(),
    trackId,
    name,
    buffer,
    startTime: Math.max(0, startTime),
    duration: buffer.duration,
    gain: DEFAULT_CLIP_GAIN,
    sourceOffset: 0,
    sourceDuration: buffer.duration
  };
}

/**
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @returns {number}
 */
export function getProjectDuration(tracks, clips) {
  void tracks;
  return clips.reduce(
    (max, clip) => Math.max(max, clip.startTime + clip.duration),
    0
  );
}

/**
 * @param {string} trackId
 * @param {EditorClip[]} clips
 * @returns {EditorClip[]}
 */
export function getTrackClips(trackId, clips) {
  return clips
    .filter((clip) => clip.trackId === trackId)
    .sort((a, b) => a.startTime - b.startTime);
}

/**
 * Keeps exactly one trailing empty lane available.
 *
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @returns {EditorTrack[]}
 */
export function ensureTrailingEmptyTrack(tracks, clips) {
  const usedTrackIds = new Set(clips.map((clip) => clip.trackId));
  const normalizedTracks = tracks
    .filter((track) => usedTrackIds.has(track.id) || track.isEmptyLane)
    .map((track) => ({
      ...track,
      clipIds: clips
        .filter((clip) => clip.trackId === track.id)
        .map((clip) => clip.id),
      isEmptyLane: !usedTrackIds.has(track.id)
    }));

  const realTracks = normalizedTracks.filter((track) => !track.isEmptyLane);
  const emptyTracks = normalizedTracks.filter((track) => track.isEmptyLane);
  const trailingEmpty = emptyTracks[0] ?? createTrack("Pista vacía", true);

  return [
    ...realTracks,
    {
      ...trailingEmpty,
      name: "Pista vacía",
      clipIds: [],
      muted: false,
      solo: false,
      gain: DEFAULT_TRACK_GAIN,
      isEmptyLane: true
    }
  ];
}

/**
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @returns {{ tracks: EditorTrack[]; clips: EditorClip[] }}
 */
export function normalizeProjectStructure(tracks, clips) {
  const knownTrackIds = new Set(tracks.map((track) => track.id));
  const safeClips = clips.filter((clip) => knownTrackIds.has(clip.trackId));
  return {
    tracks: ensureTrailingEmptyTrack(tracks, safeClips),
    clips: safeClips
  };
}

/**
 * @param {EditorClip[]} clips
 * @param {string} trackId
 * @param {string | null} clipId
 * @param {number} startTime
 * @param {number} duration
 * @returns {{ valid: true } | { valid: false; reason: string }}
 */
export function validateNoSameTrackOverlap(
  clips,
  trackId,
  clipId,
  startTime,
  duration
) {
  const nextStart = Math.max(0, startTime);
  const nextEnd = nextStart + Math.max(MIN_CLIP_DURATION, duration);

  for (const clip of clips) {
    if (clip.trackId !== trackId || clip.id === clipId) continue;

    const clipStart = clip.startTime;
    const clipEnd = clip.startTime + clip.duration;
    const overlaps = nextStart < clipEnd - 0.001 && nextEnd > clipStart + 0.001;

    if (overlaps) {
      return {
        valid: false,
        reason: `No se puede solapar con "${clip.name}" en la misma pista.`
      };
    }
  }

  return { valid: true };
}

/**
 * @param {EditorClip[]} clips
 * @param {string} clipId
 * @param {number} nextStartTime
 * @returns {{ clips: EditorClip[]; error: string | null }}
 */
export function moveClipToTime(clips, clipId, nextStartTime) {
  const clip = clips.find((item) => item.id === clipId);
  if (!clip) return { clips, error: "No se encontró el clip." };

  const validation = validateNoSameTrackOverlap(
    clips,
    clip.trackId,
    clip.id,
    nextStartTime,
    clip.duration
  );

  if (!validation.valid) return { clips, error: validation.reason };

  return {
    clips: clips.map((item) =>
      item.id === clipId ? { ...item, startTime: Math.max(0, nextStartTime) } : item
    ),
    error: null
  };
}

/**
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @param {string} clipId
 * @param {string} nextTrackId
 * @returns {{ tracks: EditorTrack[]; clips: EditorClip[]; error: string | null }}
 */
export function moveClipToTrack(tracks, clips, clipId, nextTrackId) {
  const clip = clips.find((item) => item.id === clipId);
  const nextTrack = tracks.find((track) => track.id === nextTrackId);

  if (!clip) return { tracks, clips, error: "No se encontró el clip." };
  if (!nextTrack) return { tracks, clips, error: "No se encontró la pista destino." };

  const validation = validateNoSameTrackOverlap(
    clips,
    nextTrackId,
    clip.id,
    clip.startTime,
    clip.duration
  );

  if (!validation.valid) return { tracks, clips, error: validation.reason };

  const nextClips = clips.map((item) =>
    item.id === clipId ? { ...item, trackId: nextTrackId } : item
  );
  const nextTracks = tracks.map((track) => ({
    ...track,
    isEmptyLane: track.id === nextTrackId ? false : track.isEmptyLane
  }));

  return {
    tracks: ensureTrailingEmptyTrack(nextTracks, nextClips),
    clips: nextClips,
    error: null
  };
}

/**
 * @param {AudioBuffer} buffer
 * @returns {Float32Array}
 */
export function downmixBufferForWaveform(buffer) {
  const output = new Float32Array(buffer.length);

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      output[index] += data[index] / buffer.numberOfChannels;
    }
  }

  return output;
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} source
 * @param {number} startSeconds
 * @param {number} endSeconds
 * @returns {AudioBuffer}
 */
export function copyAudioBufferRange(audioContext, source, startSeconds, endSeconds) {
  const range = normalizeRange(startSeconds, endSeconds, source.duration);
  return sliceAudioBuffer(audioContext, source, range.start, range.end);
}

/**
 * @param {AudioContext} audioContext
 * @param {EditorClip} clip
 * @param {number} absoluteStart
 * @param {number} absoluteEnd
 * @returns {AudioBuffer}
 */
export function copyClipRange(audioContext, clip, absoluteStart, absoluteEnd) {
  const localStart = Math.max(0, absoluteStart - clip.startTime);
  const localEnd = Math.min(clip.duration, absoluteEnd - clip.startTime);
  return copyAudioBufferRange(audioContext, clip.buffer, localStart, localEnd);
}

/**
 * @param {AudioContext} audioContext
 * @param {EditorClip} clip
 * @param {number} absoluteStart
 * @param {number} absoluteEnd
 * @returns {EditorClip | null}
 */
export function deleteClipRange(audioContext, clip, absoluteStart, absoluteEnd) {
  const local = normalizeRange(
    absoluteStart - clip.startTime,
    absoluteEnd - clip.startTime,
    clip.duration
  );
  const before = local.start > 0
    ? sliceAudioBuffer(audioContext, clip.buffer, 0, local.start)
    : null;
  const after = local.end < clip.duration
    ? sliceAudioBuffer(audioContext, clip.buffer, local.end, clip.duration)
    : null;
  const parts = [before, after].filter(Boolean);

  if (!parts.length) return null;

  const nextBuffer = concatenateBuffers(audioContext, parts);
  return {
    ...clip,
    buffer: nextBuffer,
    duration: nextBuffer.duration,
    sourceOffset: 0,
    sourceDuration: nextBuffer.duration
  };
}

/**
 * @param {AudioContext} audioContext
 * @param {EditorClip} clip
 * @param {number} absoluteStart
 * @param {number} absoluteEnd
 * @returns {EditorClip}
 */
export function cropClipRange(audioContext, clip, absoluteStart, absoluteEnd) {
  const nextBuffer = copyClipRange(audioContext, clip, absoluteStart, absoluteEnd);
  return {
    ...clip,
    buffer: nextBuffer,
    startTime: Math.max(0, Math.min(absoluteStart, absoluteEnd)),
    duration: nextBuffer.duration,
    sourceOffset: 0,
    sourceDuration: nextBuffer.duration
  };
}

/**
 * Applies a simple destructive edge fade inside a clip or clip range.
 *
 * @param {AudioContext} audioContext
 * @param {EditorClip} clip
 * @param {number} absoluteStart
 * @param {number} absoluteEnd
 * @param {number} [fadeSeconds]
 * @returns {EditorClip}
 */
export function fadeClipRange(audioContext, clip, absoluteStart, absoluteEnd, fadeSeconds = 0.15) {
  const local = normalizeRange(
    absoluteStart - clip.startTime,
    absoluteEnd - clip.startTime,
    clip.duration
  );
  const output = cloneAudioBuffer(audioContext, clip.buffer);
  const startSample = Math.floor(local.start * output.sampleRate);
  const endSample = Math.min(output.length, Math.ceil(local.end * output.sampleRate));
  const frameCount = Math.max(0, endSample - startSample);
  const fadeFrames = Math.max(1, Math.min(
    Math.floor(fadeSeconds * output.sampleRate),
    Math.floor(frameCount / 2)
  ));

  if (frameCount <= 1 || fadeFrames <= 0) return { ...clip, buffer: output };

  for (let channel = 0; channel < output.numberOfChannels; channel += 1) {
    const channelData = output.getChannelData(channel);
    for (let frame = 0; frame < fadeFrames; frame += 1) {
      const fadeInGain = frame / fadeFrames;
      const fadeOutGain = (fadeFrames - frame) / fadeFrames;
      channelData[startSample + frame] *= fadeInGain;
      channelData[endSample - 1 - frame] *= fadeOutGain;
    }
  }

  return {
    ...clip,
    buffer: output,
    duration: output.duration,
    sourceDuration: output.duration
  };
}

/**
 * @param {AudioContext} audioContext
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @param {{ mode: "none" | "peak" | "rms"; scope: "selection" | "track" | "project"; selection: EditorSelection | null; currentTrackId: string | null }} normalizationState
 * @returns {AudioBuffer | null}
 */
export function renderProjectToBuffer(audioContext, tracks, clips, normalizationState) {
  const duration = getProjectDuration(tracks, clips);
  if (duration <= 0 || !clips.length) return null;

  const sampleRate = clips[0]?.buffer.sampleRate ?? audioContext.sampleRate;
  const numberOfChannels = Math.max(1, ...clips.map((clip) => clip.buffer.numberOfChannels));
  const frameCount = Math.max(1, Math.ceil(duration * sampleRate));
  const output = audioContext.createBuffer(numberOfChannels, frameCount, sampleRate);
  const outputChannels = Array.from(
    { length: numberOfChannels },
    (_, channel) => output.getChannelData(channel)
  );

  const activeTrackIds = getAudibleTrackIds(tracks);
  const gainByClip = getNormalizationGainByClip(tracks, clips, normalizationState);
  const trackById = new Map(tracks.map((track) => [track.id, track]));

  for (const clip of clips) {
    if (!activeTrackIds.has(clip.trackId)) continue;

    const track = trackById.get(clip.trackId);
    const baseGain = (track?.gain ?? DEFAULT_TRACK_GAIN) * clip.gain;
    const normalizationGain = gainByClip.get(clip.id) ?? 1;
    const totalGain = baseGain * normalizationGain;
    const outputOffset = Math.round(clip.startTime * sampleRate);

    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const sourceChannel = Math.min(channel, clip.buffer.numberOfChannels - 1);
      const sourceData = clip.buffer.getChannelData(sourceChannel);
      const outputData = outputChannels[channel];
      const maxLength = Math.min(sourceData.length, outputData.length - outputOffset);

      for (let index = 0; index < maxLength; index += 1) {
        outputData[outputOffset + index] += sourceData[index] * totalGain;
      }
    }
  }

  preventClipping(output);
  return output;
}

/**
 * @param {EditorTrack[]} tracks
 * @returns {Set<string>}
 */
function getAudibleTrackIds(tracks) {
  const soloTracks = tracks.filter((track) => track.solo && !track.isEmptyLane);
  const audibleTracks = soloTracks.length
     soloTracks
    : tracks.filter((track) => !track.muted && !track.isEmptyLane);

  return new Set(audibleTracks.map((track) => track.id));
}

/**
 * @param {EditorTrack[]} tracks
 * @param {EditorClip[]} clips
 * @param {{ mode: "none" | "peak" | "rms"; scope: "selection" | "track" | "project"; selection: EditorSelection | null; currentTrackId: string | null }} normalizationState
 * @returns {Map<string, number>}
 */
function getNormalizationGainByClip(tracks, clips, normalizationState) {
  void tracks;
  const result = new Map();

  if (normalizationState.mode === "none") return result;

  if (normalizationState.scope === "project") {
    const gain = calculateNormalizationGain(
      clips.map((clip) => clip.buffer),
      normalizationState.mode
    );
    clips.forEach((clip) => result.set(clip.id, gain));
    return result;
  }

  if (normalizationState.scope === "track" && normalizationState.currentTrackId) {
    const trackClips = clips.filter(
      (clip) => clip.trackId === normalizationState.currentTrackId
    );
    const gain = calculateNormalizationGain(
      trackClips.map((clip) => clip.buffer),
      normalizationState.mode
    );
    trackClips.forEach((clip) => result.set(clip.id, gain));
    return result;
  }

  if (normalizationState.scope === "selection" && normalizationState.selection) {
    const selectedClipIds = getClipIdsInSelection(clips, normalizationState.selection);
    const selectedBuffers = clips
      .filter((clip) => selectedClipIds.has(clip.id))
      .map((clip) => clip.buffer);
    const gain = calculateNormalizationGain(selectedBuffers, normalizationState.mode);
    selectedClipIds.forEach((clipId) => result.set(clipId, gain));
  }

  return result;
}

/**
 * @param {EditorClip[]} clips
 * @param {EditorSelection} selection
 * @returns {Set<string>}
 */
function getClipIdsInSelection(clips, selection) {
  if (selection.kind === "clip" || selection.kind === "clip-range") {
    return new Set([selection.clipId]);
  }

  const start = selection.startTime;
  const end = selection.endTime;
  const trackId = selection.kind === "track-range" ? selection.trackId : null;

  return new Set(
    clips
      .filter((clip) => !trackId || clip.trackId === trackId)
      .filter((clip) => clip.startTime < end && clip.startTime + clip.duration > start)
      .map((clip) => clip.id)
  );
}

/**
 * @param {AudioBuffer[]} buffers
 * @param {"peak" | "rms"} mode
 * @returns {number}
 */
function calculateNormalizationGain(buffers, mode) {
  if (!buffers.length) return 1;

  let peak = 0;
  let sumSquares = 0;
  let sampleCount = 0;

  for (const buffer of buffers) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < data.length; index += 1) {
        const absolute = Math.abs(data[index]);
        peak = Math.max(peak, absolute);
        sumSquares += data[index] * data[index];
        sampleCount += 1;
      }
    }
  }

  if (mode === "peak") {
    return peak > 0 ? Math.min(MAX_NORMALIZATION_GAIN, PEAK_TARGET / peak) : 1;
  }

  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  return rms > 0 ? Math.min(MAX_NORMALIZATION_GAIN, RMS_TARGET / rms) : 1;
}

/**
 * @param {AudioBuffer} buffer
 */
function preventClipping(buffer) {
  let peak = 0;

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]));
    }
  }

  if (peak <= 1) return;

  const gain = 1 / peak;
  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      data[index] *= gain;
    }
  }
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} source
 * @returns {AudioBuffer}
 */
export function duplicateBuffer(audioContext, source) {
  return cloneAudioBuffer(audioContext, source);
}
