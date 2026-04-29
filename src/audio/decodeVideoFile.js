/**
 * Extracts audio from video files (MP4, MKV, AVI, MOV, etc.) using FFmpeg.wasm.
 * FFmpeg core is loaded lazily from CDN only when a video file is detected.
 */

let ffmpegInstance = null;
let ffmpegLoading = null;

const FFMPEG_CDN_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";
const FFMPEG_WRAPPER_CDN_BASE = "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.15/dist/esm";

/**
 * Returns true if the file looks like a video container that may need FFmpeg.
 *
 * @param {File} file
 * @returns {boolean}
 */
export function isVideoFile(file) {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const videoExtensions = new Set(["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "3gp", "ts"]);
  if (videoExtensions.has(ext)) return true;
  if (file.type.startsWith("video/")) return true;
  return false;
}

/**
 * Lazily loads FFmpeg.wasm core from CDN. Returns the same promise if already loading.
 *
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<import("@ffmpeg/ffmpeg").FFmpeg>}
 */
async function getFFmpeg(onProgress) {
  if (ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) return ffmpegLoading;

  ffmpegLoading = (async () => {
    onProgress?.("Cargando FFmpeg.wasm (~25 MB, se cachea en el navegador)...");

    const { FFmpeg } = await import(`${FFMPEG_WRAPPER_CDN_BASE}/index.js`);
    const { toBlobURL } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js");

    const ffmpeg = new FFmpeg();

    ffmpeg.on("log", ({ message }) => {
      console.debug("[ffmpeg]", message);
    });

    const coreURL = await toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.js`, "text/javascript");
    const wasmURL = await toBlobURL(`${FFMPEG_CDN_BASE}/ffmpeg-core.wasm`, "application/wasm");
    const classWorkerURL = await toBlobURL(`${FFMPEG_WRAPPER_CDN_BASE}/worker.js`, "text/javascript");

    await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });

    ffmpegInstance = ffmpeg;
    return ffmpeg;
  })();

  try {
    return await ffmpegLoading;
  } catch (error) {
    ffmpegLoading = null;
    throw error;
  }
}

/**
 * Extracts audio from a video file as a WAV ArrayBuffer using FFmpeg.wasm.
 * The WAV is then decoded into an AudioBuffer via the standard Web Audio API.
 *
 * @param {AudioContext} audioContext
 * @param {File} file
 * @param {(msg: string) => void} [onProgress]
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeVideoFile(audioContext, file, onProgress) {
  onProgress?.(`Intentando decodificar audio de "${file.name}" con Web Audio...`);

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    onProgress?.("Audio de video decodificado por el navegador.");
    return decoded;
  } catch {
    onProgress?.("El navegador no pudo decodificarlo directo. Probando FFmpeg.wasm...");
  }

  const ffmpeg = await getFFmpeg(onProgress);

  const safeName = `input_${Date.now()}.${file.name.split(".").pop() ?? "mp4"}`;
  const outputName = `output_${Date.now()}.wav`;

  onProgress?.(`Extrayendo audio de "${file.name}" con FFmpeg...`);

  try {
    const { fetchFile } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js");

    await ffmpeg.writeFile(safeName, await fetchFile(file));

    const exitCode = await ffmpeg.exec([
      "-i", safeName,
      "-vn",
      "-acodec", "pcm_s16le",
      "-ar", "44100",
      "-ac", "2",
      outputName
    ]);

    if (exitCode !== 0) {
      throw new Error(`FFmpeg no pudo extraer audio de "${file.name}". Verificá que el archivo tenga una pista de audio.`);
    }

    const data = await ffmpeg.readFile(outputName);
    const wavBuffer = data.buffer instanceof ArrayBuffer
      ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
      : new Uint8Array(/** @type {Uint8Array} */ (data)).buffer;

    onProgress?.("Audio extraído. Decodificando...");

    return await audioContext.decodeAudioData(wavBuffer);
  } finally {
    try { await ffmpeg.deleteFile(safeName); } catch { /* cleanup best-effort */ }
    try { await ffmpeg.deleteFile(outputName); } catch { /* cleanup best-effort */ }
  }
}
