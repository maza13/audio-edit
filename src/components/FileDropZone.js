export function FileDropZone() {
  return `
    <section class="card drop-card" aria-labelledby="upload-title">
      <div class="section-heading">
        <p class="eyebrow">Paso 1</p>
        <h2 id="upload-title">Cargar audios</h2>
      </div>

      <label class="drop-zone" data-testid="drop-zone">
        <input
          data-testid="file-input"
          class="file-input"
          type="file"
          accept="audio/*,.wav,.mp3,.m4a,.ogg,.oga,.flac,.aac,.webm"
          multiple
        />
        <span class="drop-icon" aria-hidden="true">＋</span>
        <strong>Arrastrá audios acá</strong>
        <span>o hacé clic para seleccionarlos</span>
      </label>

      <p class="hint">
        MVP: exporta WAV porque es más fácil de generar localmente. Ojo: WAV conserva calidad,
        pero suele pesar bastante más que MP3. La waveform se calcula en tu navegador.
      </p>
    </section>
  `;
}
