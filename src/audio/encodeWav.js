/**
 * Encodes an AudioBuffer as 16-bit PCM WAV.
 *
 * @param {AudioBuffer} audioBuffer
 * @returns {Blob}
 */
export function encodeWav(audioBuffer) {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numberOfChannels * bytesPerSample;
  const dataSize = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  writeInterleavedPcm16(view, 44, audioBuffer);

  return new Blob([view], { type: "audio/wav" });
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {string} value
 */
function writeString(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @param {AudioBuffer} audioBuffer
 */
function writeInterleavedPcm16(view, offset, audioBuffer) {
  const channels = Array.from(
    { length: audioBuffer.numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel)
  );

  let position = offset;

  for (let sample = 0; sample < audioBuffer.length; sample += 1) {
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
      const clamped = Math.max(-1, Math.min(1, channels[channel][sample]));
      const pcmValue = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      view.setInt16(position, pcmValue, true);
      position += 2;
    }
  }
}
