export function Header() {
  return `
    <header class="app-header">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span><span></span>
        </div>
        <div>
          <p class="eyebrow">Procesamiento local en navegador</p>
          <h1>Audio Stitch</h1>
        </div>
      </div>
      <p class="header-copy">
        Uní varios audios en un único WAV sin login, sin backend y sin subir tus archivos.
      </p>
    </header>
  `;
}
