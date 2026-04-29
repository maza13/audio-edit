# Exploration: soniq-ui-redesign — Full UI Redesign to SONIQ Dark DAW Style

## 1. Current UI Architecture

### Shell Layout (App.js + styles.css)

The app uses a single `render()` function that builds the entire DOM via `.innerHTML` and template literals. The shell structure is:

```
.editor-shell (grid, 3 rows)
  ├── EditorToolbar (rendered as static string inside render())
  ├── TimelineView  (rendered as static string inside render())
  └── EditorStatusBar (rendered as static string inside render())
```

**Grid rows:** `grid-template-rows: auto minmax(0, 1fr) auto` — toolbar auto-height, timeline flex-grow, status bar auto-height.

**Current layout specs (styles.css):**
- Top bar: `--radius-xl: 28px`, glassmorphism (`backdrop-filter: blur(18px)`, `box-shadow: var(--shadow)`), radial gradient background on body
- Timeline card: `--radius-xl: 28px`, same glassmorphism treatment
- Status bar: `--radius-lg: 20px`
- Colors: dark blue-purple (`--bg: #080b0f`) with purple accent (`--accent: #7b61ff`), teal wave color (`--wave: #a8d8dc`)

### Component responsibilities

| Component | File | Role |
|---|---|---|
| `EditorToolbar` | `src/components/EditorToolbar.js` | Renders top bar HTML string; receives all state as props; 100+ lines of button/select markup |
| `TimelineView` | `src/components/TimelineView.js` | Renders timeline card with zoom controls + canvas stage + drop overlay |
| `EditorStatusBar` | `src/components/EditorStatusBar.js` | Renders footer metrics bar + status message |
| `App.js` | `src/app/App.js` | Holds all state; builds full markup string; calls render() on every state change; handles ALL event logic |

**Event binding pattern:** `bindEvents()` called after every `render()` — queries DOM via `root.querySelector("[data-action]")`, `root.querySelector("[data-testid='...']")`, attaches listeners imperatively. No framework, no virtual DOM.

**data-action contracts (all actions):**
```
toggle-playback | crop-selection | copy-selection | paste-clipboard |
delete-selection | clear-selection | move-clip-up | move-clip-down |
zoom-out | zoom-in | zoom-reset | toggle-current-track-mute |
toggle-current-track-solo | export-wav
```

### CSS classes controlling layout

- `.editor-shell` — main grid container
- `.editor-topbar` — toolbar wrapper (grid 2-column with brand + actions)
- `.editor-brand` — brand/logo area
- `.editor-actions` — toolbar button cluster (flex wrap, right-aligned)
- `.toolbar-button` — every button in toolbar
- `.toolbar-sep` — vertical separator between button groups
- `.toolbar-zoom` — zoom button group inside pill container
- `.toolbar-select-label` — label+select pair
- `.toolbar-select` — the select element
- `.timeline-workspace` — flex-grow wrapper for timeline card
- `.timeline-card` — timeline grid container
- `.timeline-controls` — zoom label + zoom group row
- `.timeline-stage` — scrollable div containing canvas
- `.timeline-canvas` — the actual waveform canvas
- `.editor-statusbar` — footer grid

---

## 2. Functionality Preservation Map

### All current user-visible functions:

| Function | Current location | Target SONIQ UI location |
|---|---|---|
| **Add audio/video file** | `EditorToolbar` — label wrapping file input | SONIQ top menu bar (`file` menu) or transport bar hidden input |
| **Play / Pause** | `EditorToolbar` button | SONIQ transport bar — large blue Play button |
| **Stop** (pause) | Same as above | SONIQ transport bar — stop icon (skip back) |
| **Rewind / Forward** | Not present (can scrub via ruler) | SONIQ transport bar — rewind/forward buttons |
| **Skip back/forward** | Not present | SONIQ transport bar |
| **Crop selection** | `EditorToolbar` "Recortar" button | SONIQ transport bar tool `cortar` button OR context menu |
| **Copy selection** | Context menu | Context menu |
| **Paste clipboard** | Context menu | Context menu |
| **Delete selection** | Context menu | Context menu |
| **Clear selection** | `EditorToolbar` "Limpiar" | Context menu |
| **Move clip up** | `EditorToolbar` "↑ línea" | Context menu or context menu |
| **Move clip down** | `EditorToolbar` "↓ línea" | Context menu |
| **Zoom in/out/reset** | Both `EditorToolbar` and `TimelineView` | SONIQ transport bar zoom slider + tool buttons |
| **Mute current track** | `EditorToolbar` "Mute/Unmute" | Track sidebar (left panel "PISTAS") |
| **Solo current track** | `EditorToolbar` "Solo/Unsolo" | Track sidebar |
| **Normalization mode** | `EditorToolbar` select | SONIQ transport bar center card metadata area or context menu |
| **Normalization scope** | `EditorToolbar` select | Same |
| **Export WAV** | `EditorToolbar` "Exportar WAV" | SONIQ top menu bar (`render` menu) |
| **Download link** | `EditorToolbar` download `a` tag | SONIQ top menu bar or `render` menu |
| **Context menu** | Right-click on canvas | Same (right-click still opens) |
| **Drag/drop files** | Drop overlay on timeline + `dragover/drop` on timelineStage | SONIQ accepts drag/drop anywhere |
| **Playhead scrubbing** | Click/drag on canvas | Same |
| **Status messages** | `EditorStatusBar` right side | SONIQ bottom status bar — same location |
| **Metrics (time, tracks, clips)** | `EditorStatusBar` left side | SONIQ bottom status bar |

---

## 3. Target UI Mapping (SONIQ Style)

### Overall frame
- Background: `#070b11` / `#0a0f16` (darker, flatter than current)
- Rounded outer corners ~16-18px
- Thin borders in muted blue-gray — no glassmorphism glow, no gradient body background
- Flat, technical DAW aesthetic

### Top menu bar (~52px height)
- Left: `S O N I Q` logo — blue (`#7b61ff`-like), spaced letters, bold, ~24px
- Menu labels: `file`, `edit`, `track`, `clip`, `effects`, `render` — lowercase, muted gray
- Right: session name `session_01.snq` — very muted

**Mapping:** Replace `EditorToolbar` brand + actions with top menu bar. File/add input must remain accessible (either `file` menu item with `<input type="file">` hidden, or keeping a subtle "+ Agregar" in transport area). All current toolbar actions need to be reorganized into menus or transport bar.

**Risk:** The `+ Agregar audio` button is prominent in current UI. Hiding it in a menu may change UX. Consider placing it in transport bar as a discrete icon button, or keeping the file input accessible via the `file` menu.

### Transport/Control bar (~98px height)
- Left: transport group — square rounded dark buttons: skip/back, rewind, big blue Play (larger), forward, circular record-like dot
- Vertical divider
- Center: time display card — dark rounded rectangle with border
  - Large monospace time: `0:00.000`
  - Metadata: `BPM 120`, `compás 1` (BPM shown but not currently in app — may be static or ignored)
- Vertical divider
- Tool buttons: `cursor`, `cortar`, `fade` — dark rounded buttons
- Right: zoom area — label `zoom`, horizontal slider with blue thumb, text `2.0x`

**Mapping:**
- Transport buttons map to: `toggle-playback`, plus new skip/rewind (not currently in app)
- Time display card shows `0:00.000` — this is `currentTime` formatted as `M:SS.mmm` (needs different format than current `0:00.000` style)
- Tool buttons: `cursor` is default (select), `cortar` maps to `crop-selection`, `fade` is not implemented — could be a no-op or placeholder
- Zoom: maps to existing zoom controls (zoom-in/out/reset + slider)

**Risk:** The playhead time format in SONIQ shows `0:00.000` (minutes:seconds.milliseconds). Current app uses `0:00.000` as `M:SS.mmm` already. Need to confirm current `formatTime` outputs `0:00.000` or `0:00.0`. Current code: `formatTime` returns `${minutes}:${remainingSeconds.toFixed(2).padStart(5, "0")}` which is `M:SS.mm` (2 decimal places). Need 3 decimal places (milliseconds).

### Main workspace
- Track header row at top
- Left sidebar ~390px with `PISTAS` label, uppercase, letter-spaced, muted gray
- Vertical border separates left track list from main timeline
- Main timeline: large flat almost-black canvas area
- Playhead vertical line + tiny pink/red triangle marker at top at sidebar boundary

**Mapping:** The `LEFT_GUTTER = 150` in `drawTimelineWaveform.js` defines the left sidebar width. This must expand to ~390px to match SONIQ. This affects `drawTimelineWaveform.js` layout constants — but NOT the waveform rendering algorithm itself, just the gutter width.

**Risk:** `drawTimelineWaveform.js` has `LEFT_GUTTER = 150` hardcoded. Changing this to ~390 is a layout constant change, not a waveform algorithm change — acceptable per constraints.

### Bottom status bar (~44px height)
- Left: `44100 Hz | 32-bit float | stereo | 6 clips · 5 pistas`
- Right: `SONIQ Engine 1.0`

**Mapping:** Current `EditorStatusBar` shows time, duration, selection, clipboard, tracks, clips, normalization. SONIQ shows sample rate, bit depth, channel count, clips · pistas. This is metadata from the first clip's buffer properties. Must compute from `clips[0]?.buffer.sampleRate`, `numberOfChannels`, etc.

**Risk:** `EditorStatusBar` currently shows app-state info. SONIQ shows audio metadata. The format is different but the component can be replaced entirely.

---

## 4. Waveform / Performance Preservation

### MUST NOT TOUCH in `drawTimelineWaveform.js`:
- Waveform peak extraction algorithm (`waveformPeaks.js`)
- `drawWaveform()` — the actual waveform drawing inside each clip rect
- `getClipWaveformPyramid()` — pyramid data structure and selection
- `drawWaveformPeakLevel()` — peak level rendering
- `downmixBufferForWaveform()` — mono downmix for display
- Canvas resizing logic that respects `pixelRatio` and avoids unnecessary redraws

### CAN CHANGE (layout only):
- `RULER_HEIGHT` — may need adjustment if bar heights change
- `LEFT_GUTTER = 150` — should become ~390 to match SONIQ sidebar
- `TRACK_HEIGHT = 96` — may need adjustment
- Background color (`drawBackground()`) — should become `#070b11`
- Track lane colors, selection colors — should become SONIQ palette
- Playhead color — currently `#ffb000`, should stay or match SONIQ red
- Font family in canvas text — currently Inter for track names, monospace for ruler

### Canvas sizing risks:
- `drawTimelineWaveform.js` uses `canvas.parentElement?.clientWidth/Height` for sizing. If the parent container changes size (e.g., sidebar width changes), the canvas sizing will adapt automatically — BUT only if CSS doesn't break the parent sizing chain.
- The `timeline-stage` is `position: relative; overflow: auto`. Its clientWidth/clientHeight must remain stable.
- If `LEFT_GUTTER` increases, available width for waveforms decreases — but this is a layout change, not a break.

### Scroll/resize/event risks:
- `handleTimelineWheel` — wheel handling for zoom/scroll must remain functional
- `getTimelinePointerInfo` — hit testing must remain functional
- All pointer events on canvas must remain intact

---

## 5. Implementation Risks

### Risk 1: Full rerender pattern breaks during transient states
**Severity:** Medium
**Detail:** `render()` is called on EVERY state change — including during playback (`startPlayback` calls `schedulePlaybackFrame` which calls `updateStatusOnly`, but render() is called at end of playback transitions). If CSS changes cause re-layout during animation, flicker may occur. The current glassmorphism has no animation — SONIQ is flat, so reflow will be faster, but any `requestAnimationFrame` that calls `drawTimeline` must still work correctly.

### Risk 2: Event binding after full innerHTML replacement
**Severity:** Low
**Detail:** `bindEvents()` re-attaches all listeners after every `render()`. If a CSS class name changes (e.g., `.editor-topbar` → `.soniq-menubar`), the event delegation selector `[data-action]` still works. However, `normalizationMode` and `normalizationScope` selects are queried by `data-testid` — these won't change, so the normalization handler is safe.

### Risk 3: CSS conflicts during transition
**Severity:** High
**Detail:** The current CSS has `.editor-topbar`, `.timeline-card`, `.editor-statusbar` with glassmorphism styles (blur, radial gradients). SONIQ is flat, dark, no backdrop-filter. If both sets of styles coexist, visual glitches will appear. The entire `styles.css` must be replaced — not incrementally patched — to avoid bleed-through of old styles.

### Risk 4: File input accessibility
**Severity:** Medium
**Detail:** Currently `+ Agregar audio` is a large prominent button in the toolbar. SONIQ hides this in a `file` menu. If the file input is not properly accessible (hidden `input[type=file]` inside a menu item that triggers it), users cannot add files. Must ensure `<input type="file" multiple accept="audio/*,video/*">` remains clickable via a menu item label.

### Risk 5: Canvas layout constants hardcoded
**Severity:** Medium
**Detail:** `LEFT_GUTTER = 150` in `drawTimelineWaveform.js` must change to ~390. If this is the only change needed in that file, the waveform algorithm is preserved. But `getTimelinePointerInfo` also uses layout computed from canvas rect — this should still work correctly with wider gutter.

### Risk 6: Encoding/mojibake on special chars
**Severity:** Low
**Detail:** `escapeHtml()` is used in all components. The new UI has no new text content that might introduce mojibake — all labels are ASCII Spanish labels or SONIQ branding.

### Risk 7: Timeline zoom/resize after layout change
**Severity:** Low
**Detail:** `timelineZoom` state and zoom step are unchanged. Zoom slider in SONIQ transport bar maps to `zoom-in` / `zoom-out` actions. The `setTimelineZoom` function, scroll anchor preservation, and `keepPlayheadVisibleAfterZoom` all work independently of CSS — they operate on DOM measurements that should remain valid.

### Risk 8: Context menu unchanged
**Severity:** Low
**Detail:** The context menu HTML/CSS is added to `document.body` dynamically, not inside the shell. It uses `.context-menu-layer` and `.context-menu` classes. The CSS for context menu is already defined at the bottom of `styles.css`. This should remain functional — no changes needed to context menu behavior, only possibly its styling to match SONIQ dark theme.

---

## 6. Recommended Implementation Approach

### Files to change:
1. **`src/styles.css`** — Replace entirely with SONIQ dark DAW styles. Key changes: remove glassmorphism, use flat `#070b11` background, update color palette, update border radius values, add `.soniq-menubar`, `.soniq-transport`, `.soniq-sidebar`, `.soniq-statusbar` classes.
2. **`src/components/EditorToolbar.js`** — Replace with `src/components/SoniqMenuBar.js` — top menu bar with SONIQ branding, menu labels, session name. File input must be accessible via `file` menu item.
3. **`src/components/TimelineView.js`** — Replace with `src/components/SoniqTransportBar.js` (transport + zoom controls) + `src/components/SoniqWorkspace.js` (sidebar + timeline area). Note: canvas component stays, only surrounding UI changes.
4. **`src/components/EditorStatusBar.js`** — Replace with `src/components/SoniqStatusBar.js` — shows audio metadata format.
5. **`src/audio/drawTimelineWaveform.js`** — Change `LEFT_GUTTER` from `150` to `390` (or appropriate value matching sidebar). Update background color in `drawBackground()`. These are constants only — no algorithm changes.
6. **`src/app/App.js`** — Update `render()` to use new component names. Everything else (state, handlers, event binding) remains the same. The `bindEvents()` pattern still works with new component class names as long as `data-action` attributes are preserved.

### New components to create:
- `src/components/SoniqMenuBar.js` — replaces `EditorToolbar`
- `src/components/SoniqTransportBar.js` — new transport/control bar with SONIQ styling
- `src/components/SoniqWorkspace.js` — combines track sidebar + main timeline canvas
- `src/components/SoniqStatusBar.js` — replaces `EditorStatusBar`

### Phasing (safe implementation order):
**Phase 1:** Replace `styles.css` with SONIQ base styles. Do NOT change component JS files yet. Verify the shell still renders (may look broken but should not crash). Run app, verify no JS errors.

**Phase 2:** Replace `EditorToolbar` → `SoniqMenuBar`. Import new component in `App.js`, update `render()` call. Verify file input still works, all `data-action` buttons still fire correct handlers. At this point SONIQ top bar should look correct.

**Phase 3:** Replace `TimelineView` → `SoniqTransportBar` + `SoniqWorkspace`. The canvas must remain inside `.timeline-stage[data-testid='timeline-stage']` with `data-testid='timeline-canvas'`. Verify drag/drop, zoom, playhead still work.

**Phase 4:** Replace `EditorStatusBar` → `SoniqStatusBar`. Verify metrics update correctly during playback.

**Phase 5:** Update `drawTimelineWaveform.js` constants (`LEFT_GUTTER`, background color). Update `App.js` formatTime to show milliseconds (3 decimal places). Verify canvas renders correctly with wider sidebar.

### Verification checklist:
- [ ] File input adds audio correctly
- [ ] Play/pause toggles correctly
- [ ] Transport skip/rewind (new) dispatch correct actions
- [ ] Zoom in/out/reset works via toolbar buttons AND scroll wheel
- [ ] Canvas drag for clip move still works
- [ ] Canvas drag for range selection still works
- [ ] Canvas right-click opens context menu
- [ ] Context menu actions all fire correctly
- [ ] Crop/copy/paste/delete still work
- [ ] Clip move up/down still works
- [ ] Mute/solo still works
- [ ] Normalization selects still work
- [ ] Export WAV produces valid file
- [ ] Download link works
- [ ] Drag/drop files onto window works
- [ ] Status bar updates (time, metrics)
- [ ] Playhead updates during playback
- [ ] No console errors
- [ ] Waveform renders correctly (not pixelated, correct colors)
- [ ] Timeline scrolls correctly
- [ ] Zoom preserves scroll anchor / playhead visibility