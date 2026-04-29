# Apply Progress: soniq-ui-redesign — Fix Pass 1

## Status: COMPLETE

## Zoom Fixes Applied ✅

### 1. SoniqTransportBar zoom slider now receives actual zoom value
- Changed hardcoded `value="1"` to `value="${props.zoomValue}"`
- Added `zoomValue: number` to props type
- Slider now displays current zoom from `state.timelineZoom`

### 2. App.js passes zoomValue to SoniqTransportBar
- Added `zoomValue: state.timelineZoom` to SoniqTransportBar props in render()

### 3. formatZoom() corrected to show "Nx" format
- Changed from `${Math.round(zoom * 100)}%` (e.g., "100%") to `${zoom.toFixed(1)}x` (e.g., "1.0x", "2.0x")
- This matches the spec example "2.0x"

### 4. formatTime() bug fixed
- Changed `padStart(7, "0")` to `padStart(6, "0")` 
- The bug: `padStart(7)` on `"30.500"` gave `"030.500"`, producing `1:030.500` instead of `1:30.500`
- Correct output is `M:SS.mmm` format (e.g., `1:30.500`)

### 5. App.js bindEvents() already binds zoom slider events
- `zoomSlider?.addEventListener("input", ...)` at line 340
- Calls `setTimelineZoom(Number(input.value), { anchor: "center" })`
- This updates state.timelineZoom, clamps, redraws timeline, and re-renders

### 6. Zoom buttons (zoom-in/out/reset) still work
- data-actions preserved exactly: `zoom-out`, `zoom-in`, `zoom-reset`
- All map to correct handlers in handleActionClick switch

## Secondary Fixes Applied ✅

### 7. download-link always present
- SoniqMenuBar now always renders `data-testid="download-link"`
- When no result: renders `<span class="menu-download disabled" data-testid="download-link">↓</span>`
- When result exists: renders `<a data-testid="download-link" href="...">↓</a>`

### 8. File input keyboard accessibility improved
- Added `data-testid="file-input-label"` to the label
- Added `id="file-input-trigger"` to the input
- Added keyboard handler in App.js bindEvents() for Enter/Space on label

### 9. No-op transport buttons disabled
- skip-back, rewind, forward, skip-forward buttons now have `disabled` attribute
- These had `data-action` values but no handlers in handleActionClick

### 10. clear-selection, move-clip-up, move-clip-down now rendered
- Added `.sidebar-clip-actions` container to SoniqWorkspace
- Three buttons with correct `data-action` values:
  - `data-action="clear-selection"` — "✕ limpiar"
  - `data-action="move-clip-up"` — "↑ mover"
  - `data-action="move-clip-down"` — "↓ mover"
- CSS added for `.sidebar-clip-actions` and `.sidebar-action-btn`
- These map to existing handlers in handleActionClick switch

## Files Modified
| File | Change |
|------|--------|
| src/app/App.js | formatTime fix, formatZoom fix, zoomValue prop pass, file label keyboard handler |
| src/components/SoniqTransportBar.js | zoomValue prop, hardcoded value removed, no-op buttons disabled |
| src/components/SoniqMenuBar.js | download-link always present, file input label id added |
| src/components/SoniqWorkspace.js | clear-selection, move-clip-up, move-clip-down buttons added |
| src/styles.css | sidebar-clip-actions, sidebar-action-btn CSS added |

## Syntax Verification
All JS files passed `node --check`:
- App.js: PASS
- SoniqTransportBar.js: PASS  
- SoniqMenuBar.js: PASS
- SoniqWorkspace.js: PASS

## Static Contract Verification
- `data-testid="timeline-zoom"` exists and gets value from props.zoomValue (not hardcoded)
- App.js binds slider events via `zoomSlider?.addEventListener("input", ...)`
- `zoom-in`, `zoom-out`, `zoom-reset` data-actions preserved in SoniqTransportBar
- `download-link` always exists (both conditional <a> and fallback <span>)
- `clear-selection`, `move-clip-up`, `move-clip-down` exist in SoniqWorkspace
- No `console.log` found in any JS files

## Known Limitations
- Browser testing required to verify zoom slider drag interaction
- Browser testing required to verify file input keyboard activation
- Browser testing required to verify clip move buttons
- formatTime now outputs 3 decimal places (milliseconds) — needs visual verification

## Root Cause: Zoom Bad
The zoom slider was hardcoded to `value="1"` in SoniqTransportBar, so even when state.timelineZoom changed (via zoom buttons or wheel), the slider thumb always snapped back to 1. The App.js correctly bound the slider event and called setTimelineZoom, but after render() the slider would reset to 1 because the HTML had `value="1"`.

## Root Cause: formatTime
`remainingSeconds.toFixed(3).padStart(7, "0")` on `1:30.500`:
- `remainingSeconds.toFixed(3)` = `"30.500"` (6 chars)
- `"30.500".padStart(7, "0")` = `"030.500"` (pads to 7 by prepending "0")
- Result: `1:030.500` instead of `1:30.500`
