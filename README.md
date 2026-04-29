# Audio Stitch

Editor visual avanzado para trabajar audios localmente en el navegador y exportar una mezcla como WAV.

## Qué hace

- Carga uno o varios archivos de audio o video.
- Extrae audio de archivos de video (MP4, MKV, AVI, MOV, etc.) usando FFmpeg.wasm.
- Crea una pista por audio importado.
- Dibuja una waveform mono por pista, preservando stereo internamente.
- Permite reproducir desde cualquier punto del proyecto.
- Permite mover clips horizontalmente desde la cabecera del clip.
- Permite cambiar un clip de línea con botones `↑ línea` / `↓ línea`.
- Bloquea solapes dentro de la misma pista.
- Permite solapes entre pistas diferentes.
- Permite seleccionar rangos dentro de clips.
- Permite copiar, pegar, recortar y eliminar clips o rangos de clip.
- Mantiene una pista vacía al final para pegar o crear nuevos clips.
- Permite mute/solo de la pista activa.
- Aplica normalización live reversible: sin normalizar, peak o RMS; scope proyecto, pista o selección.
- Exporta el mixdown actual como `.wav`.

## Qué NO hace todavía

- No exporta MP3.
- No tiene login.
- No tiene backend.
- No sube audios a un servidor.
- No usa IA ni limpieza de ruido.
- No tiene LUFS.
- No tiene zoom avanzado ni snapping.
- No guarda proyectos.
- No intenta ser Audacity completo.

## WAV vs MP3

La app exporta WAV porque es más simple de generar directamente en el navegador y mantiene calidad.
El tradeoff es importante: WAV normalmente pesa bastante más que MP3 porque no usa compresión con pérdida.

## Ejecutar

Desde `C:\My_Projects\Tests\audio-edit`:

```bash
npm run dev
```

Luego abrir:

```txt
http://localhost:5173
```

También podés servir la carpeta con cualquier servidor estático.

## Arquitectura

La lógica de audio está separada de la UI:

- `src/audio/multitrackOperations.js` — modelo multipista, edición de clips, mixdown y normalización.
- `src/audio/drawTimelineWaveform.js` — render de waveform mono por pista, grilla, playhead, selección y hit-testing.
- `src/app/App.js` — orquestación del editor: estado, reproducción, carga, edición y exportación.
- `src/components/EditorToolbar.js` — toolbar principal.
- `src/components/TimelineView.js` — superficie full-screen multipista.
- `src/components/EditorStatusBar.js` — estado, duración, selección y mensajes.

Todo el procesamiento ocurre localmente con Web Audio API.

## Soporte de video (MP4, MKV, AVI, MOV)

La app acepta archivos de video y extrae la pista de audio usando **FFmpeg.wasm** (WebAssembly). El core de FFmpeg (~25 MB) se descarga desde CDN solo la primera vez que subís un archivo de video y se cachea en el navegador. Los archivos de audio puro (WAV, MP3, FLAC, etc.) no usan FFmpeg — siguen decodificándose instantáneamente con Web Audio API.

Formatos de video soportados: MP4, MKV, AVI, MOV, WMV, FLV, M4V, MPG, MPEG, 3GP, TS, WEBM.
