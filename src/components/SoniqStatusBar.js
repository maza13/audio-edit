/**
 * @param {{
 *   currentTime: string;
 *   duration: string;
 *   selection: string;
 *   clipboard: string;
 *   tracks: number;
 *   clips: number;
 *   normalization: string;
 *   sampleRate: number | null;
 *   channels: number | null;
 *   bitDepth: string;
 *   engineLabel: string;
 *   message: string | null;
 *   errors: string[];
 * }} props
 * @returns {string}
 */
export function SoniqStatusBar(props) {
  const fmtRate = props.sampleRate ? `${props.sampleRate} Hz` : "—";
  const fmtCh = props.channels ? (props.channels === 1 ? "mono" : props.channels === 2 ? "stereo" : `${props.channels} ch`) : "—";
  const fmtClips = `${props.clips} clips`;
  const fmtPistas = `${props.tracks} pistas`;

  return `
    <footer class="soniq-statusbar" data-testid="soniq-statusbar">
      <div class="status-metrics" aria-label="Métricas de audio">
        <span class="metric-item">
          <span class="metric-label">${fmtRate}</span>
        </span>
        <span class="metric-sep" aria-hidden="true">|</span>
        <span class="metric-item">
          <span class="metric-label">${escapeHtml(props.bitDepth || "32-bit float")}</span>
        </span>
        <span class="metric-sep" aria-hidden="true">|</span>
        <span class="metric-item">
          <span class="metric-label">${fmtCh}</span>
        </span>
        <span class="metric-sep" aria-hidden="true">|</span>
        <span class="metric-item">
          <span class="metric-label">${fmtClips} · ${fmtPistas}</span>
        </span>
      </div>
      <div class="status-message" role="status" aria-live="polite">
        ${renderMessages(props.errors, props.message)}
      </div>
      <div class="status-engine" aria-label="Motor">
        ${escapeHtml(props.engineLabel || "SONIQ Engine 1.0")}
      </div>
    </footer>
  `;
}

/**
 * @param {string[]} errors
 * @param {string | null} message
 * @returns {string}
 */
function renderMessages(errors, message) {
  if (errors.length) {
    return `<span class="status-error">${errors.map(escapeHtml).join(" · ")}</span>`;
  }
  if (message) {
    return `<span class="status-success">${escapeHtml(message)}</span>`;
  }
  return `<span>Listo. Procesamiento 100% local.</span>`;
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