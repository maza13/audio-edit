import { decodeAudioFile } from "../audio/decodeAudioFile.js?v=20260504-cycle7";
import { decodeVideoFile } from "../audio/decodeVideoFile.js?v=20260504-cycle7";
import { createAudioPreviewUrl } from "../audio/createAudioPreviewUrl.js?v=20260504-cycle7";
import {
  copyAudioBufferRange,
  copyClipRange,
  createClip,
  createTrack,
  cropClipRange,
  deleteClipRange,
  duplicateBuffer,
  ensureTrailingEmptyTrack,
  fadeClipRange,
  getProjectDuration,
  moveClipToTime,
  moveClipToTrack,
  normalizeProjectStructure,
  renderProjectToBuffer,
  validateNoSameTrackOverlap
} from "../audio/multitrackOperations.js?v=20260504-cycle7";
import {
  drawTimelineWaveform,
  getTimelinePointerInfo
} from "../audio/drawTimelineWaveform.js?v=20260504-cycle7";
import { normalizeRange } from "../audio/timelineOperations.js?v=20260504-cycle7";
import { encodeWav } from "../audio/encodeWav.js?v=20260504-cycle7";
import { readAudioFiles } from "../audio/readAudioFiles.js?v=20260504-cycle7";
import { SoniqMenuBar } from "../components/SoniqMenuBar.js?v=20260504-cycle7";
import { SoniqTransportBar } from "../components/SoniqTransportBar.js?v=20260504-cycle7";
import { SoniqWorkspace } from "../components/SoniqWorkspace.js?v=20260504-cycle7";
import { SoniqStatusBar } from "../components/SoniqStatusBar.js?v=20260504-cycle7";
import { formatFileSize } from "../utils/fileValidation.js?v=20260504-cycle7";

/**
 * @typedef {import("../audio/multitrackOperations.js?v=20260504-cycle7").EditorTrack} EditorTrack
 * @typedef {import("../audio/multitrackOperations.js?v=20260504-cycle7").EditorClip} EditorClip
 * @typedef {import("../audio/multitrackOperations.js?v=20260504-cycle7").EditorSelection} EditorSelection
 */

/**
 * @param {Element} root
 */
export function createApp(root) {
  const firstEmptyTrack = createTrack("Pista vacía", true);

  const state = {
    tracks: [firstEmptyTrack],
    clips: [],
    playheadTime: 0,
    selection: null,
    currentTrackId: firstEmptyTrack.id,
    clipboardBuffer: null,
    clipboardLabel: null,
    normalization: { mode: "none", scope: "project" },
    mixdownBuffer: null,
    isPlaying: false,
    activeSource: null,
    playbackContext: null,
    playbackAnchorContextTime: 0,
    playbackAnchorTimelineTime: 0,
    playbackFrame: null,
    timelineDrawFrame: null,
    timelineZoom: 1,
    pointer: null,
    dragDuration: null,
    resultBlob: null,
    resultUrl: null,
    errors: [],
    infoMessage: null,
    isBusy: false,
    contextMenu: { isOpen: false, x: 0, y: 0 }
  };

  function render() {
    const firstClip = state.clips[0]?.buffer ?? null;
    const sampleRate = firstClip?.sampleRate ?? null;
    const channels = firstClip?.numberOfChannels ?? null;
    const bitDepth = firstClip ? "32-bit float" : "—";

    root.innerHTML = `
      <div class="editor-shell">
        ${SoniqMenuBar({
          hasAudio: hasAudio(),
          hasResult: Boolean(state.resultBlob && state.resultUrl),
          resultUrl: state.resultUrl,
          resultSize: state.resultBlob ? formatFileSize(state.resultBlob.size) : null,
          currentSessionName: "session_01.snq",
          isBusy: state.isBusy
        })}
        ${SoniqTransportBar({
          isPlaying: state.isPlaying,
          hasAudio: hasAudio(),
          hasSelection: hasValidSelection(),
          hasClipboard: Boolean(state.clipboardBuffer),
          canZoomOut: state.timelineZoom > MIN_TIMELINE_ZOOM,
          canZoomIn: state.timelineZoom < MAX_TIMELINE_ZOOM,
          zoomValue: state.timelineZoom,
          zoomLabel: formatZoom(state.timelineZoom),
          normalizationMode: state.normalization.mode,
          normalizationScope: state.normalization.scope,
          currentTime: formatTime(state.playheadTime)
        })}
        ${SoniqWorkspace({
          hasAudio: hasAudio(),
          tracks: state.tracks,
          clips: state.clips,
          currentTrackId: state.currentTrackId,
          hasSelection: hasValidSelection(),
          canMoveSelectedClipUp: canMoveSelectedClip(-1),
          canMoveSelectedClipDown: canMoveSelectedClip(1)
        })}
        ${SoniqStatusBar({
          currentTime: formatTime(state.playheadTime),
          duration: formatTime(getDuration()),
          selection: formatSelection(),
          clipboard: state.clipboardBuffer
            ? `${state.clipboardLabel ?? "audio"} · ${formatTime(state.clipboardBuffer.duration)}`
            : "vacío",
          tracks: state.tracks.filter((track) => !track.isEmptyLane).length,
          clips: state.clips.length,
          normalization: formatNormalization(),
          sampleRate,
          channels,
          bitDepth,
          engineLabel: "SONIQ Engine 1.0",
          message: state.infoMessage,
          errors: state.errors
        })}
      </div>
    `;

    bindEvents();
    drawTimeline();
  }

  function computeMenuItems() {
    const items = [];
    const hasSelection = hasValidSelection();
    const hasClip = Boolean(state.clipboardBuffer);
    const hasCurrentTrack = Boolean(getCurrentTrack() && !getCurrentTrack().isEmptyLane);
    const canZoomIn = state.timelineZoom < MAX_TIMELINE_ZOOM;
    const canZoomOut = state.timelineZoom > MIN_TIMELINE_ZOOM;
    const audioAvailable = hasAudio();

    // Playback
    items.push({ action: "toggle-playback", label: state.isPlaying ? "Pausar" : "Reproducir", enabled: audioAvailable });

    // Edit actions (always shown, disabled when no selection)
    items.push({ action: "crop-selection", label: "Recortar", enabled: hasSelection });
    items.push({ action: "fade-selection", label: "Fade in/out", enabled: hasSelection });
    items.push({ action: "copy-selection", label: "Copiar", enabled: hasSelection });
    items.push({ action: "delete-selection", label: "Eliminar", enabled: hasSelection });
    items.push({ separator: true });

    // Paste (always shown, disabled when no clipboard)
    items.push({ action: "paste-clipboard", label: "Pegar", enabled: hasClip });

    items.push({ separator: true });

    // Zoom
    items.push({ action: "zoom-in", label: "+ zoom", enabled: canZoomIn });
    items.push({ action: "zoom-out", label: "− zoom", enabled: canZoomOut });
    items.push({ action: "zoom-reset", label: "Restablecer zoom", enabled: true });

    // Track controls (if track selected)
    if (hasCurrentTrack) {
      items.push({ separator: true });
      const track = getCurrentTrack();
      items.push({ action: "toggle-current-track-mute", label: track?.muted ? "Unmute" : "Mute", enabled: true });
      items.push({ action: "toggle-current-track-solo", label: track?.solo ? "Unsolo" : "Solo", enabled: true });
    }

    return items;
  }

  function renderContextMenu() {
    document.getElementById("ctx-layer")?.remove();
    const items = computeMenuItems();
    let html = `<div class="context-menu-layer" id="ctx-layer"><nav class="context-menu" role="menu" style="left:${state.contextMenu.x}px;top:${state.contextMenu.y}px">`;

    for (const item of items) {
      if (item.separator) {
        html += `<div class="menu-sep" role="separator"></div>`;
      } else {
        const disabledAttr = item.enabled ? "" : "disabled";
        const ariaAttr = item.enabled ? "" : `aria-disabled="true"`;
        html += `<button class="menu-item" role="menuitem" data-action="${item.action}" ${disabledAttr} ${ariaAttr}>${item.label}</button>`;
      }
    }

    html += `</nav></div>`;
    document.body.insertAdjacentHTML("beforeend", html);

    // Clamp menu to viewport
    const menu = document.querySelector(".context-menu");
    if (menu) {
      const rect = menu.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let left = state.contextMenu.x;
      let top = state.contextMenu.y;
      if (left + rect.width > vw - 8) left = vw - rect.width - 8;
      if (top + rect.height > vh - 8) top = vh - rect.height - 8;
      if (left < 8) left = 8;
      if (top < 8) top = 8;
      menu.style.left = left + "px";
      menu.style.top = top + "px";

      // Focus first enabled item
      const firstItem = menu.querySelector(".menu-item:not(:disabled)");
      if (firstItem) firstItem.focus();
    }

    // Bind menu item clicks
    document.querySelectorAll(".context-menu .menu-item").forEach((el) => {
      el.addEventListener("click", (e) => {
        const action = /** @type {HTMLElement} */ (e.currentTarget).dataset.action;
        if (action) {
          const fakeEvent = { currentTarget: el };
          handleActionClick(fakeEvent);
        }
        closeContextMenu();
      });
    });
  }

  function openContextMenu(event) {
    event.preventDefault();
    const x = event.clientX;
    const y = event.clientY;
    state.contextMenu = { isOpen: true, x, y };
    renderContextMenu();

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleMenuKeydown);
  }

  function openCommandMenu(event) {
    const target = /** @type {HTMLElement} */ (event.currentTarget);
    const rect = target.getBoundingClientRect();
    event.preventDefault();
    state.contextMenu = {
      isOpen: true,
      x: rect.left,
      y: rect.bottom + 6
    };
    renderContextMenu();

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleMenuKeydown);
  }

  function closeContextMenu() {
    state.contextMenu.isOpen = false;
    const layer = document.getElementById("ctx-layer");
    if (layer) layer.remove();
    document.removeEventListener("pointerdown", handleOutsideClick);
    document.removeEventListener("keydown", handleMenuKeydown);
    // Return focus to canvas
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    if (canvas) canvas.focus();
  }

  function handleOutsideClick(event) {
    const layer = document.getElementById("ctx-layer");
    if (layer && !layer.contains(event.target)) {
      closeContextMenu();
    }
  }

  function handleMenuKeydown(event) {
    const menu = document.querySelector(".context-menu");
    if (!menu) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeContextMenu();
      return;
    }

    const items = Array.from(menu.querySelectorAll(".menu-item:not(:disabled)"));
    if (!items.length) return;

    const focused = menu.contains(document.activeElement) ? document.activeElement : items[0];
    const idx = items.indexOf(/** @type {HTMLElement} */ (focused));

    if (event.key === "Tab") {
      event.preventDefault();
      const next = event.shiftKey
        ? idx <= 0 ? items[items.length - 1] : items[idx - 1]
        : idx >= items.length - 1 ? items[0] : items[idx + 1];
      next?.focus();
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      let next;
      if (event.key === "ArrowDown") {
        next = idx >= items.length - 1 ? items[0] : items[idx + 1];
      } else if (event.key === "ArrowUp") {
        next = idx <= 0 ? items[items.length - 1] : items[idx - 1];
      } else if (event.key === "Home") {
        next = items[0];
      } else {
        next = items[items.length - 1];
      }
      next?.focus();
    } else if ((event.key === "Enter" || event.key === " ") && focused) {
      event.preventDefault();
      focused.click();
    }
  }

  function bindEvents() {
    const fileInput = root.querySelector("[data-testid='file-input']");
    const timelineStage = root.querySelector("[data-testid='timeline-stage']");
    const dropZone = root.querySelector("[data-testid='drop-zone']");
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    const normalizationMode = root.querySelector("[data-testid='normalization-mode']");
    const normalizationScope = root.querySelector("[data-testid='normalization-scope']");
    const zoomSlider = root.querySelector("[data-testid='timeline-zoom']");

    fileInput?.addEventListener("change", (event) => {
      const input = /** @type {HTMLInputElement} */ (event.currentTarget);
      void appendFiles(Array.from(input.files ?? []));
      input.value = "";
    });

    const fileInputLabel = root.querySelector("[data-testid='file-input-label']");
    fileInputLabel?.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const input = root.querySelector("[data-testid='file-input']");
        if (input instanceof HTMLInputElement) input.click();
      }
    });

    for (const dropTarget of [timelineStage, dropZone]) {
      dropTarget?.addEventListener("dragover", (event) => {
        event.preventDefault();
        timelineStage.classList.add("is-dragging");
      });
      dropTarget?.addEventListener("dragleave", () => {
        timelineStage.classList.remove("is-dragging");
      });
      dropTarget?.addEventListener("drop", (event) => {
        event.preventDefault();
        timelineStage.classList.remove("is-dragging");
        void appendFiles(Array.from(event.dataTransfer?.files ?? []));
      });
    }

    timelineStage?.addEventListener("wheel", handleTimelineWheel, { passive: false });

    root.querySelectorAll("[data-action]").forEach((element) => {
      element.addEventListener("click", handleActionClick);
    });

    normalizationMode?.addEventListener("change", handleNormalizationChange);
    normalizationScope?.addEventListener("change", handleNormalizationChange);
    window.onkeydown = handleKeyboardShortcut;

    zoomSlider?.addEventListener("input", (event) => {
      const input = /** @type {HTMLInputElement} */ (event.currentTarget);
      setTimelineZoom(Number(input.value), { anchor: "center" });
    });

    if (canvas instanceof HTMLCanvasElement) {
      canvas.addEventListener("pointerdown", handleTimelinePointerDown);
      canvas.addEventListener("pointermove", handleTimelinePointerMove);
      canvas.addEventListener("pointerup", handleTimelinePointerUp);
      canvas.addEventListener("pointercancel", handleTimelinePointerCancel);
      canvas.addEventListener("dblclick", handleTimelineDoubleClick);
      canvas.addEventListener("contextmenu", openContextMenu);
    }
  }

  function handleActionClick(event) {
    const target = /** @type {HTMLElement} */ (event.currentTarget);

    switch (target.dataset.action) {
      case "toggle-playback": togglePlayback(); break;
      case "crop-selection": void cropSelection(); break;
      case "fade-selection": void fadeSelection(); break;
      case "copy-selection": void copySelection(); break;
      case "paste-clipboard": void pasteClipboard(); break;
      case "delete-selection": void deleteSelection(); break;
      case "clear-selection": clearSelection(); break;
      case "select-track": selectTrack(target.dataset.trackId); break;
      case "toggle-track-mute": toggleTrackMute(target.dataset.trackId); break;
      case "toggle-track-solo": toggleTrackSolo(target.dataset.trackId); break;
      case "move-clip-up": moveSelectedClipToSiblingTrack(-1); break;
      case "move-clip-down": moveSelectedClipToSiblingTrack(1); break;
      case "zoom-out": setTimelineZoom(state.timelineZoom / TIMELINE_ZOOM_STEP, { anchor: "center" }); break;
      case "zoom-in": setTimelineZoom(state.timelineZoom * TIMELINE_ZOOM_STEP, { anchor: "center" }); break;
      case "zoom-reset": setTimelineZoom(1, { anchor: "center" }); break;
      case "toggle-current-track-mute": toggleCurrentTrackMute(); break;
      case "toggle-current-track-solo": toggleCurrentTrackSolo(); break;
      case "skip-back": jumpToStart(); break;
      case "rewind": jumpBySeconds(-TRANSPORT_JUMP_SECONDS); break;
      case "forward": jumpBySeconds(TRANSPORT_JUMP_SECONDS); break;
      case "skip-forward": jumpToEnd(); break;
      case "open-command-menu": openCommandMenu(event); break;
      case "export-wav": void exportWav(); break;
    }
  }

  function handleKeyboardShortcut(event) {
    const target = /** @type {HTMLElement | null} */ (event.target);
    const tagName = target?.tagName?.toLowerCase();
    const isTypingTarget = target?.isContentEditable || tagName === "input" || tagName === "textarea" || tagName === "select";
    if (isTypingTarget) return;

    const key = event.key.toLowerCase();
    const usesModifier = event.ctrlKey || event.metaKey;

    if (event.key === "Escape") {
      if (state.contextMenu.isOpen) closeContextMenu();
      else if (state.selection) clearSelection();
      return;
    }

    if (event.code === "Space" && hasAudio()) {
      event.preventDefault();
      togglePlayback();
      return;
    }

    if ((event.key === "Delete" || event.key === "Backspace") && hasValidSelection()) {
      event.preventDefault();
      void deleteSelection();
      return;
    }

    if (usesModifier && key === "c" && hasValidSelection()) {
      event.preventDefault();
      void copySelection();
      return;
    }

    if (usesModifier && key === "v" && state.clipboardBuffer) {
      event.preventDefault();
      void pasteClipboard();
      return;
    }

    if (event.key === "Home" && hasAudio()) {
      event.preventDefault();
      jumpToStart();
      return;
    }

    if (event.key === "End" && hasAudio()) {
      event.preventDefault();
      jumpToEnd();
      return;
    }

    if (event.key === "ArrowLeft" && hasAudio()) {
      event.preventDefault();
      jumpBySeconds(event.shiftKey ? -TRANSPORT_JUMP_SECONDS : -1);
      return;
    }

    if (event.key === "ArrowRight" && hasAudio()) {
      event.preventDefault();
      jumpBySeconds(event.shiftKey ? TRANSPORT_JUMP_SECONDS : 1);
      return;
    }

    if (usesModifier && (event.key === "+" || event.key === "=")) {
      event.preventDefault();
      setTimelineZoom(state.timelineZoom * TIMELINE_ZOOM_STEP, { anchor: "center" });
      return;
    }

    if (usesModifier && event.key === "-") {
      event.preventDefault();
      setTimelineZoom(state.timelineZoom / TIMELINE_ZOOM_STEP, { anchor: "center" });
      return;
    }

    if (usesModifier && event.key === "0") {
      event.preventDefault();
      setTimelineZoom(1, { anchor: "center" });
    }
  }

  function handleTimelineWheel(event) {
    if (!(event.currentTarget instanceof HTMLElement)) return;
    const stage = event.currentTarget;
    const canScrollX = stage.scrollWidth > stage.clientWidth + 1;
    const canScrollY = stage.scrollHeight > stage.clientHeight + 1;

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const zoomDirection = event.deltaY < 0 ? TIMELINE_ZOOM_STEP : 1 / TIMELINE_ZOOM_STEP;
      setTimelineZoom(state.timelineZoom * zoomDirection, {
        stage,
        clientX: event.clientX
      });
      return;
    }

    if (!canScrollX) return;

    const horizontalIntent = event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const shouldMapVerticalWheelToTimeline = !canScrollY && Math.abs(event.deltaY) > 0;
    if (!horizontalIntent && !shouldMapVerticalWheelToTimeline) return;

    event.preventDefault();
    const nextScrollLeft = stage.scrollLeft + (horizontalIntent ? event.deltaX + event.deltaY : event.deltaY);
    stage.scrollLeft = clamp(nextScrollLeft, 0, stage.scrollWidth - stage.clientWidth);
  }

  function handleNormalizationChange() {
    const modeInput = root.querySelector("[data-testid='normalization-mode']");
    const scopeInput = root.querySelector("[data-testid='normalization-scope']");

    if (modeInput instanceof HTMLSelectElement) {
      state.normalization.mode = /** @type {"none" | "peak" | "rms"} */ (modeInput.value);
    }
    if (scopeInput instanceof HTMLSelectElement) {
      state.normalization.scope = /** @type {"selection" | "track" | "project"} */ (scopeInput.value);
    }

    invalidateAudioResult("Normalización actualizada para preview y export.");
    if (state.isPlaying) void startPlayback();
    else render();
  }

  function handleTimelinePointerDown(event) {
    if (!(event.currentTarget instanceof HTMLCanvasElement)) return;
    const canvas = event.currentTarget;
    canvas.setPointerCapture(event.pointerId);
    state.dragDuration = Math.max(8, getDuration());
    const hit = getTimelinePointerInfo(canvas, event, {
      tracks: state.tracks,
      clips: state.clips,
      durationOverride: state.dragDuration
    });

    state.errors = [];
    setPlayhead(hit.time, { restartPlayback: state.isPlaying, renderAfter: false });
    if (hit.trackId) state.currentTrackId = hit.trackId;

    if (hit.area === "clip-header" && hit.clipId) {
      const clip = getClip(hit.clipId);
      state.selection = { kind: "clip", clipId: hit.clipId };
      clearExportResult();
      state.mixdownBuffer = null;
      state.pointer = { mode: "move", clipId: hit.clipId, trackId: hit.trackId, anchorTime: hit.time, originalStartTime: clip?.startTime ?? 0 };
    } else if (hit.area === "clip-body" && hit.clipId) {
      state.selection = { kind: "clip", clipId: hit.clipId };
      state.pointer = { mode: "clip-range", clipId: hit.clipId, trackId: hit.trackId, anchorTime: hit.time, originalStartTime: 0 };
    } else if (hit.area === "ruler") {
      state.selection = null;
      state.pointer = { mode: "global-range", clipId: null, trackId: null, anchorTime: hit.time, originalStartTime: 0 };
    } else if (hit.trackId) {
      state.selection = null;
      state.pointer = { mode: "track-range", clipId: null, trackId: hit.trackId, anchorTime: hit.time, originalStartTime: 0 };
    }

    render();
  }

  function handleTimelinePointerMove(event) {
    if (!state.pointer || !(event.currentTarget instanceof HTMLCanvasElement)) return;
    const hit = getTimelinePointerInfo(event.currentTarget, event, { tracks: state.tracks, clips: state.clips, durationOverride: state.dragDuration });

    if (state.pointer.mode === "move" && state.pointer.clipId) {
      const nextStartTime = Math.max(0, state.pointer.originalStartTime + (hit.time - state.pointer.anchorTime));
      const result = moveClipToTime(state.clips, state.pointer.clipId, nextStartTime);
      if (result.error) {
        state.errors = [result.error];
        state.infoMessage = null;
      } else {
        state.clips = result.clips;
        state.mixdownBuffer = null;
        state.infoMessage = "Moviendo clip...";
      }
    } else if (state.pointer.mode === "clip-range" && state.pointer.clipId) {
      state.selection = { kind: "clip-range", clipId: state.pointer.clipId, ...normalizeAbsoluteSelection(state.pointer.anchorTime, hit.time) };
    } else if (state.pointer.mode === "track-range" && state.pointer.trackId) {
      state.selection = { kind: "track-range", trackId: state.pointer.trackId, ...normalizeAbsoluteSelection(state.pointer.anchorTime, hit.time) };
    } else if (state.pointer.mode === "global-range") {
      state.selection = { kind: "global-range", ...normalizeAbsoluteSelection(state.pointer.anchorTime, hit.time) };
    }

    scheduleTimelineDraw();
    updateStatusOnly();
  }

  function handleTimelinePointerUp(event) {
    if (!(event.currentTarget instanceof HTMLCanvasElement)) {
      state.pointer = null;
      render();
      return;
    }

    const hit = getTimelinePointerInfo(event.currentTarget, event, { tracks: state.tracks, clips: state.clips, durationOverride: state.dragDuration });
    if (!state.pointer) {
      state.dragDuration = null;
      render();
      return;
    }

    if (state.pointer.mode !== "move" && state.selection && isTinySelection(state.selection)) {
      state.selection = state.pointer.clipId ? { kind: "clip", clipId: state.pointer.clipId } : null;
    }
    state.pointer = null;
    state.dragDuration = null;
    setPlayhead(hit.time, { restartPlayback: state.isPlaying, renderAfter: false });
    render();
  }

  function handleTimelinePointerCancel() {
    state.pointer = null;
    state.dragDuration = null;
    render();
  }

  function handleTimelineDoubleClick(event) {
    if (!(event.currentTarget instanceof HTMLCanvasElement)) return;
    const hit = getTimelinePointerInfo(event.currentTarget, event, { tracks: state.tracks, clips: state.clips, durationOverride: state.dragDuration });
    if (hit.clipId) {
      state.selection = { kind: "clip", clipId: hit.clipId };
      state.currentTrackId = hit.trackId;
      render();
    }
  }

  async function appendFiles(files) {
    if (!files.length) return;
    pausePlayback({ renderAfter: false });
    clearExportResult();

    const { tracks: inputTracks, errors } = readAudioFiles(files);
    state.errors = errors;
    if (!inputTracks.length) {
      state.infoMessage = null;
      render();
      return;
    }

    state.isBusy = true;
    state.infoMessage = `Decodificando ${inputTracks.length} archivo${inputTracks.length === 1 ? "" : "s"} localmente...`;
    render();

    const audioContext = createAudioContext();
    if (!audioContext) {
      state.errors = ["Este navegador no soporta AudioContext."];
      state.infoMessage = null;
      state.isBusy = false;
      render();
      return;
    }

    try {
      const newTracks = [];
      const newClips = [];
      let cursor = getDuration();
      const realTrackCount = state.tracks.filter((track) => !track.isEmptyLane).length;
      const hasVideoFiles = inputTracks.some((track) => track.isVideo);

      if (hasVideoFiles) {
        state.infoMessage = "Cargando FFmpeg.wasm para extraer audio de video (solo la primera vez, ~25 MB)...";
        render();
      }

      for (let index = 0; index < inputTracks.length; index += 1) {
        const inputTrack = inputTracks[index];

        if (inputTrack.isVideo) {
          state.infoMessage = `Extrayendo audio de "${inputTrack.name}" (${index + 1}/${inputTracks.length})...`;
          render();
        }

        const buffer = inputTrack.isVideo
          ? await decodeVideoFile(audioContext, inputTrack.file, (msg) => {
              state.infoMessage = msg;
              updateStatusOnly();
            })
          : await decodeAudioFile(audioContext, inputTrack.file);
        const track = createTrack(`Pista ${realTrackCount + index + 1}`);
        const clip = createClip(track.id, inputTrack.name, buffer, cursor);
        newTracks.push(track);
        newClips.push(clip);
        cursor += buffer.duration;
      }

      const withoutEmpty = state.tracks.filter((track) => !track.isEmptyLane);
      state.clips = [...state.clips, ...newClips];
      state.tracks = ensureTrailingEmptyTrack([...withoutEmpty, ...newTracks], state.clips);
      state.currentTrackId = newTracks[0]?.id ?? state.currentTrackId;
      state.playheadTime = clamp(state.playheadTime, 0, getDuration());
      state.selection = newClips[0] ? { kind: "clip", clipId: newClips[0].id } : null;
      state.mixdownBuffer = null;
      state.infoMessage = `${newClips.length} audio${newClips.length === 1 ? "" : "s"} agregado${newClips.length === 1 ? "" : "s"} como pistas nuevas.${hasVideoFiles ? " Audio extraído de video." : ""}`;
    } catch (error) {
      state.errors = [error instanceof Error ? error.message : "No se pudo decodificar uno de los archivos."];
      state.infoMessage = null;
    } finally {
      await audioContext.close();
      state.isBusy = false;
      render();
    }
  }

  function togglePlayback() {
    if (state.isPlaying) {
      pausePlayback({ renderAfter: true });
      return;
    }
    void startPlayback();
  }

  async function startPlayback() {
    if (!hasAudio()) {
      showError("Cargá un audio antes de reproducir.");
      return;
    }
    pausePlayback({ renderAfter: false });

    const audioContext = createAudioContext();
    if (!audioContext) {
      showError("Este navegador no soporta AudioContext.");
      return;
    }

    const mixdownBuffer = getMixdownBuffer(audioContext);

    if (!mixdownBuffer) {
      await audioContext.close();
      showError("No hay audio para reproducir.");
      return;
    }

    if (state.playheadTime >= mixdownBuffer.duration) state.playheadTime = 0;

    const source = audioContext.createBufferSource();
    source.buffer = mixdownBuffer;
    source.connect(audioContext.destination);
    source.onended = () => {
      if (state.activeSource === source) finishPlayback();
    };

    state.mixdownBuffer = mixdownBuffer;
    state.playbackContext = audioContext;
    state.activeSource = source;
    state.playbackAnchorContextTime = audioContext.currentTime;
    state.playbackAnchorTimelineTime = state.playheadTime;
    state.isPlaying = true;
    state.errors = [];
    state.infoMessage = "Reproduciendo mezcla multipista desde el playhead.";

    source.start(0, state.playheadTime);
    schedulePlaybackFrame();
    render();
  }

  function pausePlayback({ renderAfter }) {
    if (!state.isPlaying && !state.activeSource && !state.playbackContext) return;
    syncPlaybackTime();
    if (state.activeSource) {
      state.activeSource.onended = null;
      try { state.activeSource.stop(); } catch { /* source ya detenido */ }
    }
    cleanupPlayback();
    state.infoMessage = "Reproducción pausada.";
    if (renderAfter) render();
  }

  function finishPlayback() {
    syncPlaybackTime();
    state.playheadTime = clamp(state.playheadTime, 0, getDuration());
    if (state.playheadTime >= getDuration() - 0.02) state.playheadTime = getDuration();
    cleanupPlayback();
    state.infoMessage = "Reproducción finalizada.";
    render();
  }

  function cleanupPlayback() {
    if (state.playbackFrame !== null) cancelAnimationFrame(state.playbackFrame);
    if (state.playbackContext) void state.playbackContext.close();
    state.isPlaying = false;
    state.activeSource = null;
    state.playbackContext = null;
    state.playbackFrame = null;
  }

  function schedulePlaybackFrame() {
    if (!state.isPlaying) return;
    syncPlaybackTime();
    if (state.playheadTime >= getDuration()) {
      finishPlayback();
      return;
    }
    scheduleTimelineDraw();
    updateStatusOnly();
    state.playbackFrame = requestAnimationFrame(schedulePlaybackFrame);
  }

  function syncPlaybackTime() {
    if (!state.isPlaying || !state.playbackContext) return;
    const elapsed = state.playbackContext.currentTime - state.playbackAnchorContextTime;
    state.playheadTime = clamp(state.playbackAnchorTimelineTime + elapsed, 0, getDuration());
  }

  function setPlayhead(time, { restartPlayback, renderAfter = true }) {
    state.playheadTime = clamp(time, 0, Math.max(getDuration(), 0));
    if (restartPlayback) {
      void startPlayback();
      return;
    }
    if (renderAfter) render();
  }

  function jumpToStart() {
    if (!hasAudio()) return;
    setPlayhead(0, { restartPlayback: state.isPlaying });
  }

  function jumpToEnd() {
    if (!hasAudio()) return;
    setPlayhead(getDuration(), { restartPlayback: false });
    if (state.isPlaying) pausePlayback({ renderAfter: true });
  }

  function jumpBySeconds(deltaSeconds) {
    if (!hasAudio()) return;
    setPlayhead(state.playheadTime + deltaSeconds, { restartPlayback: state.isPlaying });
  }

  async function copySelection() {
    if (!hasValidSelection()) {
      showError("Seleccioná un clip o rango antes de copiar.");
      return;
    }

    const audioContext = createAudioContext();
    if (!audioContext) {
      showError("Este navegador no soporta AudioContext.");
      return;
    }

    try {
      const selection = state.selection;
      if (selection.kind === "clip") {
        const clip = requireClip(selection.clipId);
        state.clipboardBuffer = duplicateBuffer(audioContext, clip.buffer);
        state.clipboardLabel = clip.name;
      } else if (selection.kind === "clip-range") {
        const clip = requireClip(selection.clipId);
        state.clipboardBuffer = copyClipRange(audioContext, clip, selection.startTime, selection.endTime);
        state.clipboardLabel = `${clip.name} (rango)`;
      } else {
        const range = normalizeAbsoluteSelection(selection.startTime, selection.endTime);
        const scopedTracks = selection.kind === "track-range"
          ? state.tracks.filter((track) => track.id === selection.trackId)
          : state.tracks;
        const scopedTrackIds = new Set(scopedTracks.map((track) => track.id));
        const scopedClips = state.clips.filter((clip) =>
          scopedTrackIds.has(clip.trackId) && clip.startTime < range.endTime && clip.startTime + clip.duration > range.startTime
        );
        const mixed = renderProjectToBuffer(audioContext, scopedTracks, scopedClips, {
          ...state.normalization,
          selection: state.selection,
          currentTrackId: state.currentTrackId
        });
        if (!mixed) throw new Error("La selección no contiene audio.");
        state.clipboardBuffer = copyAudioBufferRange(audioContext, mixed, range.startTime, range.endTime);
        state.clipboardLabel = selection.kind === "track-range" ? "rango de pista" : "rango global";
      }

      state.errors = [];
      state.infoMessage = `Copiado al clipboard: ${formatTime(state.clipboardBuffer.duration)}.`;
    } catch (error) {
      state.errors = [error instanceof Error ? error.message : "No se pudo copiar."];
      state.infoMessage = null;
    } finally {
      await audioContext.close();
      render();
    }
  }

  async function pasteClipboard() {
    if (!state.clipboardBuffer) {
      showError("Copiá una selección antes de pegar.");
      return;
    }

    pausePlayback({ renderAfter: false });
    clearExportResult();
    const targetTrack = getPasteTargetTrack();
    if (!targetTrack) {
      showError("No hay una pista destino para pegar.");
      return;
    }

    const validation = validateNoSameTrackOverlap(state.clips, targetTrack.id, null, state.playheadTime, state.clipboardBuffer.duration);
    if (!validation.valid) {
      showError(validation.reason);
      return;
    }

    const audioContext = createAudioContext();
    if (!audioContext) {
      showError("Este navegador no soporta AudioContext.");
      return;
    }

    try {
      const buffer = duplicateBuffer(audioContext, state.clipboardBuffer);
      const clip = createClip(targetTrack.id, state.clipboardLabel ?? "Clipboard", buffer, state.playheadTime);
      const nextTracks = state.tracks.map((track) => track.id === targetTrack.id ? { ...track, isEmptyLane: false } : track);
      state.clips = [...state.clips, clip];
      state.tracks = ensureTrailingEmptyTrack(nextTracks, state.clips);
      state.currentTrackId = targetTrack.id;
      state.selection = { kind: "clip", clipId: clip.id };
      state.mixdownBuffer = null;
      state.errors = [];
      state.infoMessage = "Clipboard pegado como clip nuevo.";
    } finally {
      await audioContext.close();
      render();
    }
  }

  async function cropSelection() {
    if (!hasValidSelection()) {
      showError("Seleccioná un clip o rango de clip antes de recortar.");
      return;
    }
    const selection = state.selection;
    if (selection.kind !== "clip" && selection.kind !== "clip-range") {
      showError("Recortar es destructivo: en esta fase aplicalo sobre un clip o rango de clip.");
      return;
    }
    if (selection.kind === "clip") {
      state.infoMessage = "El clip completo ya está seleccionado; arrastrá dentro del clip para recortar un rango.";
      render();
      return;
    }
    pausePlayback({ renderAfter: false });
    state.infoMessage = "Recorte aplicado al clip seleccionado.";
    await runClipEdit(selection.clipId, (audioContext, clip) => cropClipRange(audioContext, clip, selection.startTime, selection.endTime));
  }

  async function fadeSelection() {
    if (!hasValidSelection()) {
      showError("Seleccioná un clip o rango de clip antes de aplicar fade.");
      return;
    }
    const selection = state.selection;
    if (selection.kind !== "clip" && selection.kind !== "clip-range") {
      showError("Fade es destructivo: aplicalo sobre un clip o rango de clip.");
      return;
    }

    pausePlayback({ renderAfter: false });
    state.infoMessage = "Fade in/out aplicado.";
    await runClipEdit(selection.clipId, (audioContext, clip) => {
      if (selection.kind === "clip") {
        return fadeClipRange(audioContext, clip, clip.startTime, clip.startTime + clip.duration);
      }
      return fadeClipRange(audioContext, clip, selection.startTime, selection.endTime);
    });
  }

  async function deleteSelection() {
    if (!hasValidSelection()) {
      showError("Seleccioná un clip o rango de clip antes de eliminar.");
      return;
    }
    const selection = state.selection;
    if (selection.kind !== "clip" && selection.kind !== "clip-range") {
      showError("Eliminar global/pista queda bloqueado para evitar borrar de más. Seleccioná un clip o rango de clip.");
      return;
    }
    pausePlayback({ renderAfter: false });
    if (selection.kind === "clip") {
      state.clips = state.clips.filter((clip) => clip.id !== selection.clipId);
      state.tracks = ensureTrailingEmptyTrack(state.tracks, state.clips);
      state.selection = null;
      invalidateAudioResult("Clip eliminado.");
      render();
      return;
    }
    state.infoMessage = "Rango eliminado del clip.";
    await runClipEdit(selection.clipId, (audioContext, clip) => deleteClipRange(audioContext, clip, selection.startTime, selection.endTime));
  }

  async function runClipEdit(clipId, operation) {
    const audioContext = createAudioContext();
    if (!audioContext) {
      showError("Este navegador no soporta AudioContext.");
      return;
    }
    try {
      const clip = requireClip(clipId);
      const nextClip = operation(audioContext, clip);
      state.clips = nextClip
        ? state.clips.map((item) => item.id === clipId ? nextClip : item)
        : state.clips.filter((item) => item.id !== clipId);
      state.tracks = ensureTrailingEmptyTrack(state.tracks, state.clips);
      state.selection = nextClip ? { kind: "clip", clipId: nextClip.id } : null;
      state.playheadTime = clamp(state.playheadTime, 0, getDuration());
      state.errors = [];
      invalidateAudioResult(state.infoMessage);
    } catch (error) {
      state.errors = [error instanceof Error ? error.message : "No se pudo aplicar la edición."];
      state.infoMessage = null;
    } finally {
      await audioContext.close();
      render();
    }
  }

  function moveSelectedClipToSiblingTrack(direction) {
    const clip = getSelectedClip();
    if (!clip) {
      showError("Seleccioná un clip para cambiarlo de línea.");
      return;
    }
    const currentIndex = state.tracks.findIndex((track) => track.id === clip.trackId);
    const targetIndex = currentIndex + direction;
    const targetTrack = state.tracks[targetIndex];
    if (!targetTrack) return;

    const result = moveClipToTrack(state.tracks, state.clips, clip.id, targetTrack.id);
    if (result.error) {
      showError(result.error);
      return;
    }
    state.tracks = result.tracks;
    state.clips = result.clips;
    state.currentTrackId = targetTrack.id;
    state.selection = { kind: "clip", clipId: clip.id };
    invalidateAudioResult(`Clip movido a ${targetTrack.isEmptyLane ? "pista nueva" : targetTrack.name}.`);
    render();
  }

  function selectTrack(trackId) {
    if (!trackId || !state.tracks.some((track) => track.id === trackId)) return;
    state.currentTrackId = trackId;
    const selectedClip = getSelectedClip();
    if (selectedClip && selectedClip.trackId !== trackId) {
      state.selection = null;
    }
    state.infoMessage = `${getCurrentTrack()?.name ?? "Pista"} seleccionada.`;
    render();
  }

  function toggleTrackMute(trackId) {
    const track = state.tracks.find((item) => item.id === trackId);
    if (!track || track.isEmptyLane) return;
    state.currentTrackId = track.id;
    state.tracks = state.tracks.map((item) => item.id === track.id ? { ...item, muted: !item.muted } : item);
    invalidateAudioResult(`${track.name}: mute ${track.muted ? "desactivado" : "activado"}.`);
    if (state.isPlaying) void startPlayback();
    else render();
  }

  function toggleTrackSolo(trackId) {
    const track = state.tracks.find((item) => item.id === trackId);
    if (!track || track.isEmptyLane) return;
    state.currentTrackId = track.id;
    state.tracks = state.tracks.map((item) => item.id === track.id ? { ...item, solo: !item.solo } : item);
    invalidateAudioResult(`${track.name}: solo ${track.solo ? "desactivado" : "activado"}.`);
    if (state.isPlaying) void startPlayback();
    else render();
  }

  function toggleCurrentTrackMute() {
    toggleTrackMute(state.currentTrackId);
  }

  function toggleCurrentTrackSolo() {
    toggleTrackSolo(state.currentTrackId);
  }

  function clearSelection() {
    state.selection = null;
    state.infoMessage = "Selección limpiada.";
    render();
  }

  function setTimelineZoom(nextZoom, options = {}) {
    const previousZoom = state.timelineZoom;
    const nextClampedZoom = clamp(nextZoom, MIN_TIMELINE_ZOOM, MAX_TIMELINE_ZOOM);
    if (previousZoom === nextClampedZoom) return;

    const scrollAnchor = getTimelineScrollAnchor(options);
    state.timelineZoom = nextClampedZoom;
    state.infoMessage = state.timelineZoom === 1
      ? "Zoom del timeline restablecido."
      : `Zoom del timeline: ${formatZoom(state.timelineZoom)}.`;

    render();
    restoreTimelineScrollAnchor(scrollAnchor);
    if (!scrollAnchor) keepPlayheadVisibleAfterZoom(previousZoom);
  }

  function getTimelineScrollAnchor(options = {}) {
    const stage = options.stage instanceof HTMLElement
      ? options.stage
      : root.querySelector("[data-testid='timeline-stage']");
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement) || canvas.clientWidth <= 0) {
      return null;
    }

    const stageRect = stage.getBoundingClientRect();
    const localX = typeof options.clientX === "number"
      ? clamp(options.clientX - stageRect.left, 0, stage.clientWidth)
      : stage.clientWidth / 2;
    return {
      localX,
      ratio: clamp((stage.scrollLeft + localX) / canvas.clientWidth, 0, 1)
    };
  }

  function restoreTimelineScrollAnchor(anchor) {
    if (!anchor) return;
    const stage = root.querySelector("[data-testid='timeline-stage']");
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) return;

    const maxScrollLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
    stage.scrollLeft = clamp(anchor.ratio * canvas.clientWidth - anchor.localX, 0, maxScrollLeft);
  }

  function keepPlayheadVisibleAfterZoom(previousZoom) {
    if (previousZoom === state.timelineZoom) return;
    const stage = root.querySelector("[data-testid='timeline-stage']");
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    if (!(stage instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) return;

    const duration = Math.max(getDuration(), 8);
    const relativeTime = duration > 0 ? state.playheadTime / duration : 0;
    const playheadX = relativeTime * canvas.clientWidth;
    const viewportPadding = Math.min(160, stage.clientWidth * 0.25);
    const viewportStart = stage.scrollLeft + viewportPadding;
    const viewportEnd = stage.scrollLeft + stage.clientWidth - viewportPadding;

    if (playheadX < viewportStart || playheadX > viewportEnd) {
      stage.scrollLeft = Math.max(0, playheadX - stage.clientWidth / 2);
    }
  }

  async function exportWav() {
    if (!hasAudio()) {
      showError("No hay audio para exportar.");
      return;
    }
    clearExportResult();
    const audioContext = createAudioContext();
    if (!audioContext) {
      showError("Este navegador no soporta AudioContext.");
      return;
    }
    try {
      const buffer = getMixdownBuffer(audioContext);
      if (!buffer) throw new Error("No hay audio para exportar.");
      state.mixdownBuffer = buffer;
      state.resultBlob = encodeWav(buffer);
      state.resultUrl = createAudioPreviewUrl(state.resultBlob);
      state.errors = [];
      state.infoMessage = "WAV exportado. WAV es simple localmente, pero pesa más que MP3.";
    } catch (error) {
      state.errors = [error instanceof Error ? error.message : "No se pudo exportar WAV."];
      state.infoMessage = null;
    } finally {
      await audioContext.close();
      render();
    }
  }

  function getMixdownBuffer(audioContext) {
    if (state.mixdownBuffer) return state.mixdownBuffer;

    state.mixdownBuffer = renderProjectToBuffer(audioContext, state.tracks, state.clips, {
      ...state.normalization,
      selection: state.selection,
      currentTrackId: state.currentTrackId
    });
    return state.mixdownBuffer;
  }

  function invalidateAudioResult(message) {
    state.mixdownBuffer = null;
    clearExportResult();
    if (message !== undefined) state.infoMessage = message;
  }

  function clearExportResult() {
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultBlob = null;
    state.resultUrl = null;
  }

  function showError(message) {
    state.errors = [message];
    state.infoMessage = null;
    render();
  }

  function scheduleTimelineDraw() {
    if (state.timelineDrawFrame !== null) return;

    state.timelineDrawFrame = requestAnimationFrame(() => {
      state.timelineDrawFrame = null;
      drawTimeline();
    });
  }

  function drawTimeline() {
    const canvas = root.querySelector("[data-testid='timeline-canvas']");
    if (!(canvas instanceof HTMLCanvasElement)) return;
    const normalized = normalizeProjectStructure(state.tracks, state.clips);
    state.tracks = normalized.tracks;
    state.clips = normalized.clips;
    if (!state.tracks.some((track) => track.id === state.currentTrackId)) {
      state.currentTrackId = state.tracks[0]?.id ?? null;
    }
    drawTimelineWaveform(canvas, {
      tracks: state.tracks,
      clips: state.clips,
      playheadTime: state.playheadTime,
      selection: state.selection,
      currentTrackId: state.currentTrackId,
      movingClipId: state.pointer?.mode === "move" ? state.pointer.clipId : null,
      durationOverride: state.dragDuration,
      zoom: state.timelineZoom
    });
  }

  function updateStatusOnly() {
    const currentTime = root.querySelector("[data-testid='current-time']");
    const selectionStatus = root.querySelector("[data-testid='selection-status']");
    if (currentTime) currentTime.textContent = formatTime(state.playheadTime);
    if (selectionStatus) selectionStatus.textContent = formatSelection();
  }

  function hasAudio() { return state.clips.length > 0; }

  function hasValidSelection() {
    if (!state.selection) return false;
    if (state.selection.kind === "clip") return true;
    return Math.abs(state.selection.endTime - state.selection.startTime) >= 0.05;
  }

  function isTinySelection(selection) {
    if (selection.kind === "clip") return false;
    return Math.abs(selection.endTime - selection.startTime) < 0.05;
  }

  function normalizeAbsoluteSelection(startTime, endTime) {
    const range = normalizeRange(startTime, endTime, Math.max(getDuration(), 8));
    return { startTime: range.start, endTime: range.end };
  }

  function formatSelection() {
    if (!hasValidSelection() || !state.selection) return "sin selección";
    if (state.selection.kind === "clip") {
      const clip = getClip(state.selection.clipId);
      return clip ? `clip: ${clip.name}` : "clip";
    }
    const selection = normalizeAbsoluteSelection(state.selection.startTime, state.selection.endTime);
    const rangeText = `${formatTime(selection.startTime)} – ${formatTime(selection.endTime)} (${formatTime(selection.endTime - selection.startTime)})`;
    if (state.selection.kind === "clip-range") return `rango de clip · ${rangeText}`;
    if (state.selection?.kind === "track-range") return `rango de pista · ${rangeText}`;
    return `rango global · ${rangeText}`;
  }

  function formatNormalization() {
    const modeLabels = { none: "sin normalizar", peak: "peak", rms: "RMS" };
    const scopeLabels = { selection: "selección", track: "pista", project: "proyecto" };
    return `${modeLabels[state.normalization.mode]} · ${scopeLabels[state.normalization.scope]}`;
  }

  function getDuration() { return getProjectDuration(state.tracks, state.clips); }
  function getClip(clipId) { return state.clips.find((clip) => clip.id === clipId) ?? null; }
  function requireClip(clipId) {
    const clip = getClip(clipId);
    if (!clip) throw new Error("No se encontró el clip seleccionado.");
    return clip;
  }
  function getSelectedClip() {
    if (!state.selection) return null;
    if (state.selection.kind !== "clip" && state.selection.kind !== "clip-range") return null;
    return getClip(state.selection.clipId);
  }
  function getCurrentTrack() { return state.tracks.find((track) => track.id === state.currentTrackId) ?? null; }
  function getPasteTargetTrack() {
    if (state.selection?.kind === "track-range") return state.tracks.find((track) => track.id === state.selection.trackId) ?? null;
    const selectedClip = getSelectedClip();
    if (selectedClip) return state.tracks.find((track) => track.id === selectedClip.trackId) ?? null;
    return getCurrentTrack() ?? state.tracks.find((track) => track.isEmptyLane) ?? null;
  }
  function canMoveSelectedClip(direction) {
    const clip = getSelectedClip();
    if (!clip) return false;
    const index = state.tracks.findIndex((track) => track.id === clip.trackId);
    return index >= 0 && Boolean(state.tracks[index + direction]);
  }

  render();
}

function createAudioContext() {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  return AudioContextConstructor ? new AudioContextConstructor() : null;
}

const MIN_TIMELINE_ZOOM = 1;
const MAX_TIMELINE_ZOOM = 8;
const TIMELINE_ZOOM_STEP = 1.5;
const TRANSPORT_JUMP_SECONDS = 5;

function formatZoom(zoom) {
  return `${zoom.toFixed(1)}x`;
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds - minutes * 60;
  return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, "0")}`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}



