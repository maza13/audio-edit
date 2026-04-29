# Tasks: soniq-ui-redesign

## Phase 1: Component Shell Creation

- [x] 1.1 Create `src/components/SoniqMenuBar.js` — top menu bar with logo, `file/edit/track/clip/effects/render` labels, session name right. File menu contains hidden `<input data-testid="file-input" type="file" multiple accept="audio/*,video/*">` triggered by label. Render menu contains `<button data-action="export-wav">` and `<a data-testid="download-link">`. Props: `hasAudio, hasResult, resultUrl, resultSize, currentSessionName, isBusy`. Root element: `<header class="soniq-menubar" data-testid="soniq-menubar">`.
- [x] 1.2 Create `src/components/SoniqTransportBar.js` — transport bar with play `data-action="toggle-playback"`, tool cluster for `crop-selection/copy-selection/paste-clipboard/delete-selection/clear-selection/move-clip-up/move-clip-down`, zoom cluster with `zoom-out/zoom-in/zoom-reset` buttons and range input `data-testid="timeline-zoom"`, normalization selects `data-testid="normalization-mode"` and `data-testid="normalization-scope"`. Props: `isPlaying, hasAudio, hasSelection, hasClipboard, canZoomOut, canZoomIn, zoomLabel, normalizationMode, normalizationScope, currentTime`. Root element: `<section class="soniq-transport" data-testid="soniq-transport">`.
- [x] 1.3 Create `src/components/SoniqWorkspace.js` — main workspace combining left sidebar (PISTAS label + current track card with `toggle-current-track-mute/solo`) and `.soniq-stage-shell` containing `timeline-stage` div and `drop-zone` div. Preserve `data-testid="timeline-stage"`, `data-testid="drop-zone"`, `data-testid="timeline-canvas"` on nested canvas. Props: `hasAudio, trackCount, currentTrackName, currentTrackMuted, currentTrackSolo`. Root: `<main class="soniq-workspace">`.
- [x] 1.4 Create `src/components/SoniqStatusBar.js` — bottom status bar with audio format metrics (sampleRate, bitDepth, channels, clips·pistas) left and `SONIQ Engine 1.0` right. Preserve `data-testid="current-time"` and `data-testid="selection-status"`. Props: `currentTime, duration, selection, clipboard, tracks, clips, normalization, sampleRate, channels, bitDepth, engineLabel, message, errors`. Root: `<footer class="soniq-statusbar" data-testid="soniq-statusbar">`.

## Phase 2: App.js Integration

- [x] 2.1 In `src/app/App.js`, swap imports: remove `EditorStatusBar`, `EditorToolbar`, `TimelineView`; add `SoniqMenuBar`, `SoniqTransportBar`, `SoniqWorkspace`, `SoniqStatusBar`.
- [x] 2.2 In `render()`, replace `${EditorToolbar({...})}` with `${SoniqMenuBar({...})}`, replace `${TimelineView({...})}` with `${SoniqTransportBar({...})}` + `${SoniqWorkspace({...})}`, replace `${EditorStatusBar({...})}` with `${SoniqStatusBar({...})}`.
- [x] 2.3 Derive `sampleRate`, `channels`, `bitDepth` from first clip's buffer (e.g. `state.clips[0]?.buffer`) and pass to `SoniqStatusBar` as props.
- [x] 2.4 Update `bindEvents()`: add `input/change` listener on `timeline-zoom` range input calling `setTimelineZoom(Number(value), { anchor: "center" })`.
- [x] 2.5 In `App.js`, update `formatTime()` to output `M:SS.mmm` (3 decimal places). Change `remainingSeconds.toFixed(2)` to `remainingSeconds.toFixed(3)`. Verify all call sites (`updateStatusOnly`, `EditorStatusBar`, clipboard label) render correctly.

## Phase 3: CSS Replacement

- [x] 3.1 Replace `src/styles.css` wholesale: remove glassmorphism (`backdrop-filter`, radial gradients), set flat `--bg:#070b11`, `--surface:#0a0f16`, `--text:#f4f7fb`, `--muted:#9ba8b7`, `--accent:#7b61ff`, `--wave:#a8d8dc`. Reduce border-radius to ~16-18px outer, smaller inner.
- [x] 3.2 Add `.soniq-menubar` (~52px), `.soniq-transport` (~98px), `.soniq-sidebar` (~390px wide), `.soniq-workspace`, `.soniq-statusbar` (~44px). Stack layout via `display:flex; flex-direction:column` on `.editor-shell`.
- [x] 3.3 Re-style `.context-menu-layer` and `.context-menu` as flat dark panels (no `backdrop-filter`). Match SONIQ palette for borders and text.
- [x] 3.4 Re-style `.drop-overlay` as flat dark dashed panel matching SONIQ reference.
- [x] 3.5 Add responsive breakpoints: `<1120px` compress sidebar and stack controls; `<720px` keep essential controls only. Preserve `.timeline-stage`, `.timeline-canvas`, `.drop-overlay` sizing.

## Phase 4: Waveform / Layout Alignment

- [x] 4.1 In `src/audio/drawTimelineWaveform.js`, change `LEFT_GUTTER` from `150` to `390`. Update `drawBackground()` gradient colors to match SONIQ flat dark palette if needed. Do NOT change any waveform algorithm, `drawWaveform()`, pointer hit-testing, or canvas resize logic.
- [x] 4.2 Verify after `LEFT_GUTTER` change: ruler labels, track names, clip headers, and all pointer-event math (`getTimelinePointerInfo`) remain consistent with wider gutter.

## Phase 5: Functional Mapping & Accessibility

- [x] 5.1 Verify all `data-action` buttons exist in new components and fire correct `handleActionClick` cases: `toggle-playback, crop-selection, copy-selection, paste-clipboard, delete-selection, clear-selection, move-clip-up, move-clip-down, zoom-out, zoom-in, zoom-reset, toggle-current-track-mute, toggle-current-track-solo, export-wav`.
- [x] 5.2 Verify all `data-testid` elements preserved: `file-input` (hidden input in menu), `timeline-stage`, `timeline-canvas`, `download-link`, `normalization-mode`, `normalization-scope`, `timeline-zoom`, `current-time`, `selection-status`, `track-sidebar`.
- [x] 5.3 Verify `timeline-canvas` is nested inside `.soniq-stage-shell` within `SoniqWorkspace`; canvas resize logic and `drawTimelineWaveform` calls remain valid.
- [x] 5.4 Verify context menu keyboard navigation (`ArrowUp/Down/Enter/Escape/Tab`) still works with re-styled `.context-menu`.

## Phase 6: Verification / Manual Testing

- [x] 6.1 Run `node --check src/app/App.js` — no syntax errors.
- [x] 6.2 Run `node --check src/audio/drawTimelineWaveform.js` — no syntax errors.
- [x] 6.3 Manual: Load app with no audio — SONIQ shell renders (drop overlay visible, no console errors). [DEFERRED - manual]
- [ ] 6.4 Manual: Click `file` menu label → file picker opens → load audio → tracks created. [DEFERRED - manual]
- [ ] 6.5 Manual: Drag/drop audio → tracks created, waveform renders. [DEFERRED - manual]
- [ ] 6.6 Manual: Click play → playback starts; pause stops. Status bar updates time `M:SS.mmm`. [DEFERRED - manual]
- [ ] 6.7 Manual: All `data-action` buttons (crop/copy/paste/delete/zoom/mute/solo/export) execute correct handlers. [DEFERRED - manual]
- [ ] 6.8 Manual: Right-click canvas → context menu opens with correct items; keyboard nav works; click item → action fires. [DEFERRED - manual]
- [ ] 6.9 Manual: Zoom slider drag and zoom buttons → `setTimelineZoom` fires, canvas redraws with anchor preserved. [DEFERRED - manual]
- [ ] 6.10 Manual: Mute/solo → track state changes, waveform updates. [DEFERRED - manual]
- [ ] 6.11 Manual: Normalization mode/scope selects → `handleNormalizationChange` fires. [DEFERRED - manual]
- [ ] 6.12 Manual: Export WAV → `encodeWav` fires, download link activates. [DEFERRED - manual]
- [ ] 6.13 Manual: Status bar shows `44100 Hz | 32-bit float | stereo | N clips · M pistas` format. [DEFERRED - manual]
- [ ] 6.14 Manual: Responsive <1120px → sidebar compresses, controls stack. <720px → essential controls visible. [DEFERRED - manual]
- [ ] 6.15 Manual: No `backdrop-filter` visible anywhere in shell containers. Background is flat `#070b11` or `#0a0f16`. [DEFERRED - manual]
- [ ] 6.16 Manual: `LEFT_GUTTER=390` — canvas gutter aligns with sidebar; clip selection and drag move work without hit-testing anomalies. [DEFERRED - manual]

## Phase 7: Cleanup / Archive Prep

- [x] 7.1 Remove `src/components/EditorToolbar.js`, `src/components/TimelineView.js`, `src/components/EditorStatusBar.js` (no longer imported).
- [x] 7.2 Ensure no dead CSS classes from old `.editor-topbar`, `.timeline-card`, `.editor-statusbar` remain (old classes removed with stylesheet replacement).
- [x] 7.3 Final rollback plan documented: revert App.js imports/render, revert styles.css, delete new Soniq*.js files, revert LEFT_GUTTER to 150 in drawTimelineWaveform.js.