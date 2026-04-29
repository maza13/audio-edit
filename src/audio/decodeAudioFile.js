/**
 * @param {AudioContext} audioContext
 * @param {File} file
 * @returns {Promise<AudioBuffer>}
 */
export async function decodeAudioFile(audioContext, file) {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    throw new Error(
      `No se pudo decodificar "${file.name}". Probá con otro formato de audio.`
    );
  }
}
