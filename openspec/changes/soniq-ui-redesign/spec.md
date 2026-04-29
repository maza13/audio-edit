# Delta Spec: soniq-ui-redesign

## Overview

Replace the full application shell with the SONIQ dark DAW visual style. All existing functionality, data-action contracts, event binding, and waveform rendering MUST remain functionally equivalent. Only the CSS palette, layout structure, and component HTML change.

---

## ADDED Requirements

### Requirement: SONIQ Visual Shell

The system SHALL render a full-viewport rounded application frame with a flat dark DAW palette (`#070b11` / `#0a0f16`) and no glassmorphism (`backdrop-filter` MUST NOT be used on shell containers).

The shell MUST be organized into four visible regions:
1. **Top menu bar** (~52 px): `S O N I Q` logo left, menu labels center, session name right
2. **Transport bar** (~98 px): transport buttons, time card, BPM/compás text, tool buttons, zoom slider
3. **Main workspace**: left `PISTAS` sidebar (~390 px), vertical divider, timeline canvas area
4. **Bottom status bar** (~44 px): audio format metrics left, `SONIQ Engine 1.0` right

All new shell components MUST be imported and rendered inside `App.js`'s `render()` function, replacing the current `EditorToolbar`, `TimelineView`, and `EditorStatusBar` imports only.

#### Scenario: Empty project shell loads correctly

- GIVEN the application starts with no audio loaded
- WHEN the page renders
- THEN the SONIQ shell is visible with all four regions (menu bar, transport bar, workspace with empty drop overlay, status bar)
- AND no console errors occur

#### Scenario: File import via menu

- GIVEN the SONIQ shell is rendered
- WHEN the user clicks the `file` menu label
- THEN a file input is triggered and the file picker opens
- WHEN the user selects an audio file
- THEN the audio is decoded and tracks are created

---

### Requirement: File Input Access

The system MUST provide an accessible file input for adding audio/video files. The input MUST retain `data-testid='file-input'` and accept `audio/*,video/*` via a hidden `<input type="file" multiple>` triggered by a label in the `file` menu. Keyboard and click activation MUST remain functional.

#### Scenario: Keyboard-accessible file input

- GIVEN the SONIQ shell is rendered
- WHEN the user focuses the `file` menu label via Tab key
- THEN pressing Enter activates the hidden file input
- AND the file picker dialog opens

---

### Requirement: Waveform Constants Update

`drawTimelineWaveform.js` MAY change `LEFT_GUTTER` from `150` to a value matching the SONIQ sidebar width, and MAY change the canvas background color in `drawBackground()`. The waveform peak extraction algorithm, `drawWaveform()`, pyramid data structure, canvas resizing path, and all pointer event handlers MUST NOT be modified.

#### Scenario: Wider sidebar does not break hit testing

- GIVEN audio is loaded and timeline is rendered with wider sidebar
- WHEN the user clicks on a clip header
- THEN the clip is selected and `move` mode activates
- AND no hit-testing anomalies occur

---

### Requirement: Playhead Time Format

`formatTime()` in `App.js` MUST output `M:SS.mmm` (three decimal places, milliseconds) instead of the current `M:SS.mm` (two decimal places).

#### Scenario: Time display shows milliseconds

- GIVEN audio is loaded and playhead is at 1 minute 30.5 seconds
- WHEN the status bar or transport time card is displayed
- THEN the time shows `1:30.500` (three decimal places)

---

## MODIFIED Requirements

### Requirement: Shell Layout Structure (Previously: 3-row grid with EditorToolbar + TimelineView + EditorStatusBar)

The root `.editor-shell` grid MUST be replaced with a vertical stack: `SoniqMenuBar` → `SoniqTransportBar` → `SoniqWorkspace` → `SoniqStatusBar`. The `grid-template-rows` layout MUST be replaced with a vertical flex-like stack (`display: flex; flex-direction: column`). The new layout MUST NOT break `data-action` delegation, `data-testid` queries, or `bindEvents()`.

(Previously: `grid-template-rows: auto minmax(0, 1fr) auto` with `.editor-topbar`, `.timeline-card`, `.editor-statusbar`)

#### Scenario: Shell renders with all data-action buttons functional

- GIVEN the SONIQ shell is rendered
- WHEN the user clicks any `data-action` button (play/pause, zoom, crop, etc.)
- THEN the correct handler in `handleActionClick` is invoked

---

### Requirement: CSS Palette (Previously: glassmorphism dark blue-purple with radial gradients)

The `styles.css` color variables and body background MUST be replaced with the SONIQ flat dark palette:
- `--bg: #070b11`, `--surface: #0a0f16`, `--text: #f4f7fb`, `--muted: #9ba8b7`
- Wave/accent colors MAY remain similar but backgrounds MUST be flat (no radial gradients, no `backdrop-filter`)
- All border-radius values MUST be reduced to match the SONIQ reference (~16–18 px outer, smaller inner)

(Previously: glassmorphism with `backdrop-filter: blur(18px)`, radial gradient body, `--accent: #7b61ff`)

#### Scenario: No glassmorphism visible

- GIVEN the SONIQ shell is rendered
- THEN no element has `backdrop-filter: blur(...)` applied
- AND body background is a flat `#070b11` or `#0a0f16` solid color

---

### Requirement: Context Menu Styling (Previously: glassmorphism context menu matching old palette)

The context menu `.context-menu` class MUST be updated to match SONIQ dark palette with flat styling (no `backdrop-filter`). Action routing via `handleActionClick` and keyboard navigation (`ArrowUp`, `ArrowDown`, `Enter`, `Escape`, `Tab`) MUST remain unchanged.

(Previously: `backdrop-filter: blur(18px)`, accent purple border)

#### Scenario: Context menu keyboard navigation

- GIVEN a clip is selected
- WHEN the user right-clicks the timeline canvas
- THEN the context menu opens and the first item is focused
- WHEN the user presses ArrowDown
- THEN focus moves to the next enabled item
- WHEN the user presses Escape
- THEN the context menu closes

---

## NON-GOALS

- Changing any audio algorithm (decode, normalization, render, export, waveform drawing)
- Adding dependencies or frameworks
- Modifying event handler logic in `handleActionClick`
- Changing `data-action` values or adding new ones
- Changing `data-testid` values on canvas/stage/file-input elements

---

## Acceptance Checklist

- [ ] Empty project loads with SONIQ shell (no audio → drop overlay visible)
- [ ] File input adds audio via `file` menu label click
- [ ] Drag/drop audio onto timeline creates tracks
- [ ] Play/pause toggles via big blue transport button
- [ ] All `data-action` buttons execute correct handlers
- [ ] Context menu appears on canvas right-click with correct actions
- [ ] Crop/copy/paste/delete via context menu or transport tools
- [ ] Move clip up/down via sidebar or context menu
- [ ] Zoom in/out/reset via transport zoom slider and buttons
- [ ] Mute/solo toggles via sidebar track controls
- [ ] Normalization mode/scope selects in transport bar
- [ ] Export WAV + download link functional via `render` menu
- [ ] Status bar shows audio format metrics and `SONIQ Engine 1.0`
- [ ] Playhead time shows `M:SS.mmm` format
- [ ] `LEFT_GUTTER` updated in `drawTimelineWaveform.js`
- [ ] Canvas waveform renders with wider sidebar gutter
- [ ] No `backdrop-filter` on shell containers
- [ ] Responsive at <1120 px: sidebar collapses partially, controls remain accessible
- [ ] Responsive at <720 px: essential controls visible, no core function broken
- [ ] No console errors on load or during interaction

---

## Risks / Assumptions

| Risk | Likelihood | Mitigation |
|---|---|---|
| Full CSS replacement causes layout breakage | High | Replace `styles.css` atomically; verify render before next phase |
| `LEFT_GUTTER` change breaks canvas hit-testing | Med | Change only layout constants; verify pointer events post-change |
| Hidden file input reduces discoverability | Med | Ensure `file` menu item triggers input via label; keep accessible |
| No automated tests for regression | High | Manual verification checklist in spec; use explicit test scenarios |
| `formatTime` change breaks status bar display | Low | Verify `formatTime` output shows 3 decimal places post-change |
