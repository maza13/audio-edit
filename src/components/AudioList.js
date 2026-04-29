import { AudioListItem } from "./AudioListItem.js?v=20260429-ui-check7";

/**
 * @param {import("../domain/AudioTrack.js").AudioTrack[]} tracks
 * @returns {string}
 */
export function AudioList(tracks) {
  const listContent = tracks.length
    ? tracks.map((track, index) => AudioListItem(track, index, tracks.length)).join("")
    : `
      <div class="empty-state">
        <strong>Todavía no cargaste audios.</strong>
        <span>Sumá 2 o más archivos para poder unirlos.</span>
      </div>
    `;

  return `
    <section class="card list-card" aria-labelledby="audio-list-title">
      <div class="section-heading inline-heading">
        <div>
          <p class="eyebrow">Paso 2</p>
          <h2 id="audio-list-title">Orden de unión</h2>
        </div>
        <span class="counter">${tracks.length} archivo${tracks.length === 1 ? "" : "s"}</span>
      </div>

      <div class="audio-list" data-testid="audio-list">
        ${listContent}
      </div>
    </section>
  `;
}
