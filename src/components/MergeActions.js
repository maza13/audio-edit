/**
 * @param {{ isMerging: boolean; canDownload: boolean; resultSize: string | null }} state
 * @returns {string}
 */
export function MergeActions({ isMerging, canDownload, resultSize }) {
  return `
    <section class="card result-card" aria-labelledby="merge-title">
      <div class="section-heading">
        <p class="eyebrow">Paso 3</p>
        <h2 id="merge-title">Unir y exportar</h2>
      </div>

      <div class="wav-note">
        <strong>Exportación WAV para el MVP</strong>
        <p>
          Primero se aplican los recortes de inicio/fin por audio. Después se une todo y se exporta
          WAV: es directo de generar en el navegador, pero puede crear archivos mucho más pesados que MP3.
        </p>
      </div>

      <button
        class="primary-button"
        type="button"
        data-action="merge"
        ${isMerging ? "disabled" : ""}
      >
        ${isMerging ? "Uniendo audios..." : "Unir audios"}
      </button>

      <a
        class="secondary-button ${canDownload ? "" : "is-disabled"}"
        data-testid="download-link"
        data-action="download"
        ${canDownload ? "" : "aria-disabled=\"true\""}
      >
        Descargar WAV${resultSize ? ` · ${resultSize}` : ""}
      </a>
    </section>
  `;
}
