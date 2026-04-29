import { concatenateBuffers } from "./timelineOperations.js?v=20260429-cycle1";

/**
 * Concatenates decoded buffers into a single AudioBuffer.
 *
 * @param {AudioContext} audioContext
 * @param {AudioBuffer[]} buffers
 * @returns {AudioBuffer}
 */
export function concatenateAudioBuffers(audioContext, buffers) {
  if (buffers.length < 2) {
    throw new Error("Necesitás al menos 2 audios para unir.");
  }

  return concatenateBuffers(audioContext, buffers);
}
