/**
 * @param {{ previewUrl: string | null }} props
 * @returns {string}
 */
export function ResultPlayer({ previewUrl }) {
  return `
    <section class="card preview-card" aria-labelledby="preview-title">
      <div class="section-heading">
        <p class="eyebrow">Paso 4</p>
        <h2 id="preview-title">Preview</h2>
      </div>

      ${
        previewUrl
          ? `<audio class="audio-player" controls src="${previewUrl}" data-testid="audio-player"></audio>`
          : `
            <div class="empty-state compact">
              <strong>Sin resultado todavía.</strong>
              <span>Cuando unas los audios, vas a poder escucharlos acá.</span>
            </div>
          `
      }
    </section>
  `;
}
