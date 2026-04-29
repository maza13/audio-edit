import { validateAudioFile } from "../utils/fileValidation.js?v=20260429-cycle1";

/**
 * @param {File[]} files
 * @returns {{ tracks: import("../domain/AudioTrack.js").AudioTrack[]; errors: string[] }}
 */
export function readAudioFiles(files) {
  const errors = [];
  const tracks = [];

  for (const file of files) {
    const validation = validateAudioFile(file);

    if (!validation.valid) {
      errors.push(validation.reason);
      continue;
    }

    tracks.push({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      size: file.size,
      type: file.type || "audio/desconocido",
      buffer: null,
      duration: null,
      numberOfChannels: null,
      trimStart: 0,
      trimEnd: null,
      decodeStatus: "pending",
      decodeError: null,
      isVideo: validation.isVideo
    });
  }

  return { tracks, errors };
}
