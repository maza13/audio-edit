/**
 * @param {{
 *   hasAudio: boolean;
 *   trackCount: number;
 *   currentTrackName: string;
 *   currentTrackMuted: boolean;
 *   currentTrackSolo: boolean;
 * }} props
 * @returns {string}
 */
export function SoniqWorkspace(props) {
  return `
    <main class="soniq-workspace">
      <aside class="soniq-sidebar" data-testid="track-sidebar" aria-label="Pistas">
        <div class="sidebar-header">
          <span class="sidebar-title">PISTAS</span>
          <span class="sidebar-count">${props.trackCount}</span>
        </div>
        <div class="sidebar-track-card">
          <div class="track-name" title="${escapeHtml(props.currentTrackName)}">${escapeHtml(props.currentTrackName || "sin pista")}</div>
          <div class="track-controls">
            <button
              class="track-ctrl-btn ${props.currentTrackMuted ? "is-active" : ""}"
              type="button"
              data-action="toggle-current-track-mute"
              title="Silenciar pista"
              aria-label="Silenciar pista"
              aria-pressed="${props.currentTrackMuted}"
            >M</button>
            <button
              class="track-ctrl-btn ${props.currentTrackSolo ? "is-active" : ""}"
              type="button"
              data-action="toggle-current-track-solo"
              title="Solo pista"
              aria-label="Solo pista"
              aria-pressed="${props.currentTrackSolo}"
            >S</button>
          </div>
        </div>
        <div class="sidebar-clip-actions" aria-label="Acciones de clip">
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="clear-selection"
            title="Limpiar selección"
            aria-label="Limpiar selección"
          >✕ limpiar</button>
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="move-clip-up"
            title="Mover clip arriba"
            aria-label="Mover clip arriba"
          >↑ mover</button>
          <button
            class="sidebar-action-btn"
            type="button"
            data-action="move-clip-down"
            title="Mover clip abajo"
            aria-label="Mover clip abajo"
          >↓ mover</button>
        </div>
      </aside>
      <div class="soniq-stage-shell">
        <div class="timeline-stage soniq-stage" data-testid="timeline-stage">
          <canvas
            class="timeline-canvas"
            data-testid="timeline-canvas"
            tabindex="-1"
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