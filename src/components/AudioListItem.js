import { formatFileSize } from "../utils/fileValidation.js?v=20260429-ui-check7";

/**
 * @param {import("../domain/AudioTrack.js").AudioTrack} track
 * @param {number} index
 * @param {number} total
 * @returns {string}
 */
export function AudioListItem(track, index, total) {
  const duration = track.duration ?? 0;
  const trimEnd = track.trimEnd ?? duration;
  const canTrim = track.decodeStatus === "ready" && duration > 0;
  const statusLabel = getStatusLabel(track);

  return `
    <article
      class="audio-item"
      draggable="true"
      data-track-id="${track.id}"
      data-testid="audio-item"
    >
      <div class="track-row">
        <div class="track-position">${index + 1}</div>
        <div class="track-meta">
          <strong title="${escapeHtml(track.name)}">${escapeHtml(track.name)}</strong>
          <span>
            ${formatFileSize(track.size)} · ${escapeHtml(track.type)}
            ${track.numberOfChannels ? ` · ${track.numberOfChannels} canal${track.numberOfChannels === 1 ? "" : "es"}` : ""}
            ${track.duration ? ` · ${formatSeconds(track.duration)}` : ""}
          </span>
        </div>
        <div class="track-actions" aria-label="Acciones de ${escapeHtml(track.name)}">
          <button
            class="icon-button"
            type="button"
            data-action="move-up"
            data-track-id="${track.id}"
            ${index === 0 ? "disabled" : ""}
            aria-label="Mover ${escapeHtml(track.name)} hacia arriba"
          >↑</button>
          <button
            class="icon-button"
            type="button"
            data-action="move-down"
            data-track-id="${track.id}"
            ${index === total - 1 ? "disabled" : ""}
            aria-label="Mover ${escapeHtml(track.name)} hacia abajo"
          >↓</button>
          <button
            class="icon-button danger"
            type="button"
            data-action="remove"
            data-track-id="${track.id}"
            aria-label="Quitar ${escapeHtml(track.name)}"
          >×</button>
        </div>
      </div>

      <div class="waveform-panel">
        ${
          canTrim
            ? `
              <div class="waveform-shell">
                <canvas
                  class="waveform-canvas"
                  data-testid="waveform-canvas"
                  data-track-id="${track.id}"
                  aria-label="Waveform estéreo de ${escapeHtml(track.name)}"
                ></canvas>
              </div>
              <div class="trim-controls">
                <label>
                  Inicio
                  <input
                    type="number"
                    min="0"
                    max="${duration.toFixed(3)}"
                    step="0.01"
                    value="${track.trimStart.toFixed(2)}"
                    data-trim-field="start"
                    data-track-id="${track.id}"
                  />
                </label>
                <label>
                  Fin
                  <input
                    type="number"
                    min="0"
                    max="${duration.toFixed(3)}"
                    step="0.01"
                    value="${trimEnd.toFixed(2)}"
                    data-trim-field="end"
                    data-track-id="${track.id}"
                  />
                </label>
                <span class="trim-duration">
                  Selección: ${formatSeconds(Math.max(0, trimEnd - track.trimStart))}
                </span>
              </div>
            `
            : `
              <div class="waveform-placeholder ${track.decodeStatus === "error" ? "is-error" : ""}">
                ${escapeHtml(statusLabel)}
              </div>
            `
        }
      </div>
    </article>
  `;
}

/**
 * @param {import("../domain/AudioTrack.js").AudioTrack} track
 * @returns {string}
 */
function getStatusLabel(track) {
  if (track.decodeStatus === "decoding") return "Decodificando waveform localmente...";
  if (track.decodeStatus === "error") {
    return track.decodeError ?? "No se pudo leer este audio.";
  }
  return "Waveform pendiente.";
}

/**
 * @param {number} seconds
 * @returns {string}
 */
function formatSeconds(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds - minutes * 60;
  return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, "0")}`;
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
