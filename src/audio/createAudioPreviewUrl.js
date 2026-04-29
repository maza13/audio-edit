/**
 * @param {Blob} blob
 * @returns {string}
 */
export function createAudioPreviewUrl(blob) {
  return URL.createObjectURL(blob);
}
