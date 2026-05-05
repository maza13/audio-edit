/**
 * @param {{
 *   hasAudio: boolean;
 *   hasResult: boolean;
 *   resultUrl: string | null;
 *   resultSize: string | null;
 *   currentSessionName: string;
 *   isBusy: boolean;
 * }} props
 * @returns {string}
 */
export function SoniqMenuBar(props) {
  return `
    <header class="soniq-menubar" data-testid="soniq-menubar">
      <div class="soniq-logo" aria-label="SONIQ">
        <span class="logo-letter">S</span>
        <span class="logo-letter">O</span>
        <span class="logo-letter">N</span>
        <span class="logo-letter">I</span>
        <span class="logo-letter">Q</span>
      </div>
      <nav class="soniq-topmenu" aria-label="Menú principal">
        <label
          class="menu-item"
          data-testid="file-input-label"
          for="file-input-trigger"
          aria-label="Abrir archivo de audio"
        >
          file
          <input
            id="file-input-trigger"
            data-testid="file-input"
            class="file-input-hidden"
            type="file"
            accept="audio/*,video/*,.wav,.mp3,.m4a,.ogg,.oga,.flac,.aac,.webm,.mp4,.mkv,.avi,.mov,.wmv,.m4v,.mpg,.mpeg,.3gp,.ts"
            multiple
            ${props.isBusy ? "disabled" : ""}
          />
        </label>
        <button class="menu-item" type="button" data-action="open-command-menu" data-menu-kind="edit" aria-label="Menú editar">edit</button>
        <button class="menu-item" type="button" data-action="open-command-menu" data-menu-kind="track" aria-label="Menú pista">track</button>
        <button class="menu-item" type="button" data-action="open-command-menu" data-menu-kind="clip" aria-label="Menú clip">clip</button>
        <span class="menu-item disabled" aria-disabled="true" title="No implementado">effects</span>
        <div class="menu-item-group">
          <button class="menu-item-btn" type="button" data-action="export-wav" ${props.hasAudio ? "" : "disabled"}>render</button>
          ${props.hasResult && props.resultUrl ? `
            <a
              class="menu-download"
              data-testid="download-link"
              href="${props.resultUrl}"
              download="soniq-export.wav"
              aria-label="Descargar WAV"
            >↓</a>
          ` : `<span class="menu-download disabled" data-testid="download-link" aria-disabled="true" aria-label="Descarga no disponible">↓</span>`}
        </div>
      </nav>
      <div class="soniq-session" aria-label="Nombre de sesión">
        ${escapeHtml(props.currentSessionName || "session_01.snq")}
      </div>
    </header>
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
