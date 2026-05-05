/**
 * @param {{
 *   isPlaying: boolean;
 *   hasAudio: boolean;
 *   hasSelection: boolean;
 *   hasClipboard: boolean;
 *   canZoomOut: boolean;
 *   canZoomIn: boolean;
 *   zoomValue: number;
 *   zoomLabel: string;
 *   normalizationMode: "none" | "peak" | "rms";
 *   normalizationScope: "selection" | "track" | "project";
 *   currentTime: string;
 * }} props
 * @returns {string}
 */
export function SoniqTransportBar(props) {
  return `
    <section class="soniq-transport" data-testid="soniq-transport">
      <div class="transport-group transport-btns">
        <button class="transport-btn" type="button" data-action="skip-back" title="Ir al inicio" aria-label="Ir al inicio" ${props.hasAudio ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 6h2v12H6V6zm3.5 6 8.5 6V6l-8.5 6z"/></svg>
        </button>
        <button class="transport-btn" type="button" data-action="rewind" title="Retroceder 5 segundos" aria-label="Retroceder 5 segundos" ${props.hasAudio ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M11 18V6l-8.5 6 8.5 6zm.5-6 8.5 6V6l-8.5 6z"/></svg>
        </button>
        <button class="transport-btn play-btn ${props.isPlaying ? "is-active" : ""}" type="button" data-action="toggle-playback" ${props.hasAudio ? "" : "disabled"} aria-label="${props.isPlaying ? "Pausar" : "Reproducir"}">
          ${props.isPlaying
            ? `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
            : `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>`
          }
        </button>
        <button class="transport-btn" type="button" data-action="forward" title="Adelantar 5 segundos" aria-label="Adelantar 5 segundos" ${props.hasAudio ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
        </button>
        <button class="transport-btn" type="button" data-action="skip-forward" title="Ir al final" aria-label="Ir al final" ${props.hasAudio ? "" : "disabled"}>
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 18l8.5-6L6 6v12zm10-12v12h2V6h-2z"/></svg>
        </button>
        <div class="record-dot" title="Grabación" aria-label="Grabación deshabilitada">
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><circle cx="12" cy="12" r="8"/></svg>
        </div>
      </div>

      <div class="transport-divider" aria-hidden="true"></div>

      <div class="transport-timecard" aria-label="Tiempo actual">
        <span class="time-display" data-testid="current-time">${escapeHtml(props.currentTime)}</span>
        <span class="time-meta">BPM 120 · compás 1</span>
      </div>

      <div class="transport-divider" aria-hidden="true"></div>

      <div class="transport-group tool-cluster" aria-label="Herramientas de edición">
        <button class="tool-btn" type="button" data-action="cursor" title="Cursor (seleccionar)" aria-label="Cursor">cursor</button>
        <button class="tool-btn" type="button" data-action="crop-selection" ${props.hasSelection ? "" : "disabled"} title="Recortar selección" aria-label="Recortar">cortar</button>
        <button class="tool-btn" type="button" data-action="fade-selection" ${props.hasSelection ? "" : "disabled"} title="Aplicar fade in/out a la selección" aria-label="Fade">fade</button>
      </div>

      <div class="transport-divider" aria-hidden="true"></div>

      <div class="transport-group zoom-cluster" aria-label="Zoom del timeline">
        <button class="zoom-btn" type="button" data-action="zoom-out" ${props.canZoomOut ? "" : "disabled"} aria-label="Alejar zoom">−</button>
        <input
          class="zoom-slider"
          type="range"
          min="1"
          max="8"
          step="0.1"
          value="${props.zoomValue}"
          data-testid="timeline-zoom"
          aria-label="Nivel de zoom"
          title="Zoom: ${props.zoomLabel}"
        />
        <span class="zoom-label" aria-hidden="true">${escapeHtml(props.zoomLabel)}</span>
        <button class="zoom-btn" type="button" data-action="zoom-in" ${props.canZoomIn ? "" : "disabled"} aria-label="Acercar zoom">+</button>
        <button class="zoom-reset-btn" type="button" data-action="zoom-reset" title="Restablecer zoom" aria-label="Restablecer zoom">⟲</button>
      </div>

      <div class="transport-divider" aria-hidden="true"></div>

      <div class="transport-group norm-cluster" aria-label="Normalización">
        <select class="norm-select" data-testid="normalization-mode" aria-label="Modo de normalización">
          <option value="none" ${props.normalizationMode === "none" ? "selected" : ""}>Sin</option>
          <option value="peak" ${props.normalizationMode === "peak" ? "selected" : ""}>Peak</option>
          <option value="rms" ${props.normalizationMode === "rms" ? "selected" : ""}>RMS</option>
        </select>
        <select class="norm-select" data-testid="normalization-scope" aria-label="Alcance de normalización">
          <option value="project" ${props.normalizationScope === "project" ? "selected" : ""}>Proyecto</option>
          <option value="track" ${props.normalizationScope === "track" ? "selected" : ""}>Pista</option>
          <option value="selection" ${props.normalizationScope === "selection" ? "selected" : ""}>Selección</option>
        </select>
      </div>
    </section>
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
