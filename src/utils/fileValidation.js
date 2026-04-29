const AUDIO_EXTENSIONS = new Set([
  "aac",
  "aif",
  "aiff",
  "flac",
  "m4a",
  "mp3",
  "oga",
  "ogg",
  "opus",
  "wav",
  "webm"
]);

const VIDEO_EXTENSIONS = new Set([
  "mp4",
  "mkv",
  "avi",
  "mov",
  "wmv",
  "flv",
  "m4v",
  "mpg",
  "mpeg",
  "3gp",
  "ts"
]);

/**
 * @param {File} file
 * @returns {{ valid: true; isVideo: boolean } | { valid: false; reason: string }}
 */
export function validateAudioFile(file) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const hasAudioMime = file.type.startsWith("audio/");
  const hasVideoMime = file.type.startsWith("video/");
  const hasKnownAudioExtension = AUDIO_EXTENSIONS.has(extension);
  const hasKnownVideoExtension = VIDEO_EXTENSIONS.has(extension);

  if (!hasAudioMime && !hasVideoMime && !hasKnownAudioExtension && !hasKnownVideoExtension) {
    return {
      valid: false,
      reason: `"${file.name}" no parece ser un archivo de audio o video compatible.`
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      reason: `"${file.name}" está vacío.`
    };
  }

  const isVideo = hasVideoMime || hasKnownVideoExtension;
  return { valid: true, isVideo };
}

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

