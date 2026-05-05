/**
 * @param {{
 *   hasAudio: boolean;
 *   tracks: Array<{ id: string; name: string; muted: boolean; solo: boolean; isEmptyLane: boolean; clipIds?: string[] }>;
 *   clips: Array<{ id: string; trackId: string }>;
 *   currentTrackId: string | null;
 *   hasSelection: boolean;
 *   canMoveSelectedClipUp: boolean;
 *   canMoveSelectedClipDown: boolean;
 * }} props
 * @returns {string}
 */
export function SoniqWorkspace(props) {
  const realTrackCount = props.tracks.filter((track) => !track.isEmptyLane).length;
  const trackCards = props.tracks.map((track, index) => {
    const isCurrent = track.id === props.currentTrackId;
    const clipCount = props.clips.filter((clip) => clip.trackId === track.id).length;
    const displayName = track.isEmptyLane ? "Pista vacía" : (track.name || `Pista ${index + 1}`);
    const disabledTrackControls = track.isEmptyLane ? "disabled" : "";

    return `
      <div class="sidebar-track-card ${isCurrent ? "is-selected" : ""} ${track.isEmptyLane ? "is-empty" : ""}">
        <button
          class="track-select-btn"
          type="button"
          data-action="select-track"
          data-track-id="${escapeAttribute(track.id)}"
          aria-pressed="${isCurrent}"
          title="Seleccionar ${escapeAttribute(displayName)}"
        >
          <span class="track-main">
            <span class="track-index">${String(index + 1).padStart(2, "0")}</span>
            <span class="track-copy">
              <span class="track-name">${escapeHtml(displayName)}</span>
              <span class="track-meta">${track.isEmptyLane ? "lista para pegar" : `${clipCount} clip${clipCount === 1 ? "" : "s"}`}</span>
            </span>
          </span>
        </button>
        <span class="track-controls" aria-label="Controles de ${escapeAttribute(displayName)}">
          <button
            class="track-ctrl-btn ${track.muted ? "is-active" : ""}"
            type="button"
            data-action="toggle-track-mute"
            data-track-id="${escapeAttribute(track.id)}"
            title="Silenciar pista"
            aria-label="Silenciar pista"
            aria-pressed="${track.muted}"
            ${disabledTrackControls}
          >M</button>
          <button
            class="track-ctrl-btn ${track.solo ? "is-active" : ""}"
            type="button"
            data-action="toggle-track-solo"
            data-track-id="${escapeAttribute(track.id)}"
            title="Solo pista"
            aria-label="Solo pista"
            aria-pressed="${track.solo}"
            ${disabledTrackControls}
          >S</button>
        </span>
      </div>
    `;
  }).join("");

  return `
    <main class="soniq-workspace">
      <aside class="soniq-sidebar" data-testid="track-sidebar" aria-label="Pistas">
        <div class="sidebar-header">
          <span class="sidebar-title">PISTAS</span>
          <span class="sidebar-count">${realTrackCount}</span>
        </div>
        <div class="sidebar-track-list" aria-label="Lista de pistas">
          ${trackCards}
        </div>
        <div class="sidebar-clip-actions" aria-label="Acciones de clip">
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="clear-selection"
            title="Limpiar selección"
            aria-label="Limpiar selección"
            ${props.hasSelection ? "" : "disabled"}
          >✕ limpiar</button>
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="move-clip-up"
            title="Mover clip arriba"
            aria-label="Mover clip arriba"
            ${props.canMoveSelectedClipUp ? "" : "disabled"}
          >↑ mover</button>
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="move-clip-down"
            title="Mover clip abajo"
            aria-label="Mover clip abajo"
            ${props.canMoveSelectedClipDown ? "" : "disabled"}
          >↓ mover</button>
        </div>
      </aside>
      <div class="soniq-stage-shell">
        <div class="timeline-stage soniq-stage" data-testid="timeline-stage">
          <canvas
            class="timeline-canvas"
            data-testid="timeline-canvas"
            tabindex="0"
            aria-label="Waveform multipista"
          ></canvas>
          ${props.hasAudio ? "" : `
            <div class="drop-overlay" data-testid="drop-zone">
              <strong>Arrastrá audios acá</strong>
              <span>Cada archivo crea una pista.</span>
            </div>
          `}
        </div>
      </div>
    </main>
  `;
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return escapeHtml(value);
}
