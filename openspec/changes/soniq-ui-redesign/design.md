# Design: SONIQ UI Redesign

## Technical Approach
Replace the shell with four new template-string components and a rewritten flat stylesheet. Keep `App.js` as the state/handler owner, preserve `handleActionClick()` semantics, preserve `data-action`/`data-testid` contracts, and keep the waveform pipeline intact.

## Architecture Decisions
| Decision | Choice | Rationale |
|---|---|---|
| Components | Add `SoniqMenuBar.js`, `SoniqTransportBar.js`, `SoniqWorkspace.js`, `SoniqStatusBar.js` | Isolates the new SONIQ shell without changing audio logic. |
| Old components | Retire/delete `EditorToolbar.js`, `TimelineView.js`, `EditorStatusBar.js` after cutover | Avoids dead UI paths and style drift. |
| `styles.css` | Replace wholesale | Current glassmorphism rules conflict with the flat SONIQ palette. |
| `LEFT_GUTTER` | Change to `390` (shared sidebar width token) | Keeps canvas labels/hit-testing aligned with the new left rail. |
| Zoom slider | Add range input in transport; drive `setTimelineZoom()`; keep zoom buttons | Preserves existing zoom actions and keyboard/button workflows. |
| Action exposure | Put common actions in transport/sidebar/context menu; keep file/render in menu bar | Matches reference UI while avoiding a cluttered shell. |

## Component Design
**SoniqMenuBar(props)**: `hasAudio, hasResult, resultUrl, resultSize, currentSessionName, isBusy`. HTML: `<header class="soniq-menubar" data-testid="soniq-menubar">`; logo, menu labels (`file/edit/track/clip/effects/render`), right session label. `file` menu contains hidden `<input data-testid="file-input" type="file" multiple accept="audio/*,video/*">`; `render` menu contains `<button data-action="export-wav">` and `<a data-testid="download-link">`.

**SoniqTransportBar(props)**: `isPlaying, hasAudio, hasSelection, hasClipboard, canZoomOut, canZoomIn, zoomLabel, normalizationMode, normalizationScope, currentTime`. HTML: `<section class="soniq-transport" data-testid="soniq-transport">`; play button `data-action="toggle-playback"`; edit/tool buttons `crop-selection/copy-selection/paste-clipboard/delete-selection/clear-selection/move-clip-up/move-clip-down`; zoom cluster with `zoom-out/zoom-reset/zoom-in`; range input `data-testid="timeline-zoom"`; selects keep `data-testid="normalization-mode"` and `data-testid="normalization-scope"`.

**SoniqWorkspace(props)**: `hasAudio, trackCount, currentTrackName, currentTrackMuted, currentTrackSolo`. HTML: `<main class="soniq-workspace"> <aside class="soniq-sidebar" data-testid="track-sidebar">PISTAS + current-track card + `toggle-current-track-mute/solo`</aside> <div class="soniq-stage-shell">timeline-stage + canvas + drop-zone</div> </main>`.

**SoniqStatusBar(props)**: `currentTime, duration, selection, clipboard, tracks, clips, normalization, sampleRate, channels, bitDepth, engineLabel, message, errors`. HTML: `<footer class="soniq-statusbar" data-testid="soniq-statusbar">` with audio format metrics left and engine label right; keep `current-time` and `selection-status` test IDs.

## App.js Integration Plan
- Swap imports to new components; render order becomes MenuBar → TransportBar → Workspace → StatusBar.
- Derive props from current state; add `sampleRate/channels/bitDepth` from the first loaded buffer or current mixdown metadata (display only).
- `bindEvents()`: keep file input, normalization selects, existing `[data-action]` buttons, context menu, drag/drop, and canvas pointer handlers; add slider `input/change` listener to call `setTimelineZoom(Number(value), { anchor: "center" })`.
- Update `formatTime()` to `M:SS.mmm` (3 decimals). No `handleActionClick()` case changes.

## CSS Architecture
Use flat tokens: `--bg:#070b11`, `--surface:#0a0f16`, `--line`, `--text`, `--muted`, `--accent`, `--wave`. Regions: `soniq-menubar` (~52px), `soniq-transport` (~98px), `soniq-workspace` with `soniq-sidebar` (~390px), `soniq-statusbar` (~44px). Responsive: `<1120px` stack controls and compress sidebar; `<720px` keep only essential controls visible. Restyle `.context-menu`, `.context-menu-layer`, and `.drop-overlay` as flat dark panels; no `backdrop-filter` on shell containers.

## Canvas/Waveform Preservation
Do not change decoding/encoding, normalization, waveform peak generation, `drawWaveform()`, `getClipWaveformPyramid()`, pointer hit-testing, or canvas resize logic. Only adjust `LEFT_GUTTER`, background colors, and any label colors. Keep `LEFT_GUTTER` equal to the CSS sidebar width so the canvas gutter and DOM sidebar stay aligned; verify clip selection, drag move, ruler clicks, wheel zoom, and context-menu targeting after layout changes.

## Action Mapping
| Action / test id | New location |
|---|---|
| `file-input` | File menu in `SoniqMenuBar` |
| `toggle-playback` | Transport play button |
| `crop/copy/paste/delete/clear` | Transport tool cluster + context menu |
| `move-clip-up/down` | Sidebar track card + context menu |
| `zoom-out/reset/in` | Transport zoom cluster; slider drives same setter |
| `toggle-current-track-mute/solo` | Sidebar track card |
| `normalization-mode/scope` | Transport bar selects |
| `export-wav` / `download-link` | Render menu |

## Sequence Diagrams
**File import:** `click file menu -> hidden input opens -> change -> appendFiles() -> render() -> drawTimeline()`.

**Play/pause:** `play button -> togglePlayback() -> startPlayback()/pausePlayback() -> render/status refresh`.

**Zoom slider:** `drag slider -> bindEvents handler -> setTimelineZoom() -> render() -> restore anchor -> redraw canvas`.

**Context menu:** `right-click canvas -> openContextMenu() -> render menu -> click item -> handleActionClick() -> closeContextMenu()`.

**Layout change draw:** `render() -> canvas exists -> drawTimelineWaveform() uses new LEFT_GUTTER -> pointer math/hit-testing stays consistent`.

## Risk Mitigation
Manual verify: file import, playback, zoom buttons/slider, selection, drag/drop, context menu, mute/solo, normalization, export/download, and responsiveness. Rollback: revert `App.js`, `styles.css`, `drawTimelineWaveform.js`, and new `Soniq*.js` files. Accessibility: keep semantic buttons/labels, visible focus states, and keyboard-triggerable file input/menu items. Performance: preserve full-render pattern but keep slider/update handlers lightweight and avoid waveform algorithm changes.
