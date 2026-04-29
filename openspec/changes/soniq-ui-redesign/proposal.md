# Proposal: SONIQ UI Redesign

## Intent

The app MUST adopt the reference SONIQ visual shell across the full viewport while preserving current editing, decoding, waveform rendering, export, and interaction performance. This change SHALL restyle the UI only; audio behavior MUST remain functionally equivalent.

## Scope

### In Scope
- Replace the full shell with SONIQ-style menu, transport, workspace, sidebar, and status bar.
- Reorganize existing controls into new visible locations while preserving current `data-action` and `data-testid` contracts.
- Restyle context menu, drag/drop affordances, timeline framing, and status metrics.

### Out of Scope
- Changing decode, normalization, render, export, or waveform algorithms.
- Adding dependencies, frameworks, or new audio features.

## Capabilities

### New Capabilities
- `soniq-ui-shell`: SONIQ menu/transport/status layout that preserves all current editor commands.
- `soniq-timeline-workspace`: SONIQ sidebar + timeline presentation with unchanged canvas interactions and drag/drop.

### Modified Capabilities
- None.

## Approach

`App.js` SHOULD keep the current full-render + `bindEvents()` pattern. New components (`SoniqMenuBar.js`, `SoniqTransportBar.js`, `SoniqWorkspace.js`, `SoniqStatusBar.js`) SHALL replace old imports in render only. `drawTimelineWaveform.js` MAY change layout constants such as left gutter/colors, but its rendering pipeline MUST stay intact.

## Functional Preservation Map

| Function | New Location |
|---|---|
| Add audio/video | `file` menu or transport hidden input |
| Play/pause | blue transport play button |
| Crop/copy/paste/delete/clear | transport tools + context menu |
| Move clip up/down | sidebar/context menu |
| Zoom in/out/reset/current zoom | transport zoom cluster/slider |
| Mute/solo | `PISTAS` sidebar track controls |
| Normalization mode/scope | transport controls |
| Export WAV/download | `render` menu |
| Context menu / drag-drop / timeline | same workspace surface |
| Status messages/metrics | bottom SONIQ status bar |

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `src/app/App.js` | Modified | swap rendered shell/imports, preserve handlers |
| `src/styles.css` | Modified | full SONIQ visual replacement |
| `src/components/Soniq*.js` | New | new shell components |
| `src/components/Editor*.js`, `TimelineView.js` | Removed/retired | no longer imported by App |
| `src/audio/drawTimelineWaveform.js` | Modified | layout constants only if approved |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| CSS replacement breaks layout | High | replace shell styles coherently, not incrementally |
| Wider gutter affects hit testing | Med | limit canvas edits to constants and verify pointer flows |
| Hidden controls reduce discoverability | Med | keep actions visible in menus/transport with preserved contracts |
| Accessibility/manual regression | Med | retain semantic buttons/labels and perform manual checks |
| No automated tests | High | use explicit manual verification checklist in spec/design |

## Rollback Plan

Revert `src/app/App.js`, `src/styles.css`, and any new `src/components/Soniq*.js`; restore previous imports of `EditorToolbar`, `TimelineView`, and `EditorStatusBar`; revert `src/audio/drawTimelineWaveform.js` only if layout constants changed.

## Dependencies

- Exploration artifact `sdd/soniq-ui-redesign/explore`; no external packages.

## Success Criteria

- [ ] SONIQ shell matches the reference composition closely across menu, transport, workspace, and status areas.
- [ ] All current actions, drag/drop, context menu behavior, playback, export, normalization, and waveform performance still work.
