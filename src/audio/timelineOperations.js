/**
 * Creates a new AudioBuffer with only the selected time range.
 *
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} source
 * @param {number} startSeconds
 * @param {number} endSeconds
 * @returns {AudioBuffer}
 */
export function sliceAudioBuffer(audioContext, source, startSeconds, endSeconds) {
  const safeStart = clamp(startSeconds, 0, source.duration);
  const safeEnd = clamp(endSeconds, safeStart, source.duration);
  const startSample = Math.floor(safeStart * source.sampleRate);
  const endSample = Math.floor(safeEnd * source.sampleRate);
  const frameCount = Math.max(1, endSample - startSample);

  const output = audioContext.createBuffer(
    source.numberOfChannels,
    frameCount,
    source.sampleRate
  );

  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    output
      .getChannelData(channel)
      .set(source.getChannelData(channel).subarray(startSample, endSample));
  }

  return output;
}

/**
 * @param {AudioContext} audioContext
 * @param {import("../domain/AudioSegment.js").AudioSegment[]} segments
 * @returns {AudioBuffer | null}
 */
export function concatTimelineSegments(audioContext, segments) {
  if (!segments.length) return null;
  return concatenateBuffers(
    audioContext,
    segments.map((segment) => segment.buffer)
  );
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} timelineBuffer
 * @param {AudioBuffer} insertBuffer
 * @param {number} time
 * @returns {AudioBuffer}
 */
export function insertAudioBufferAtTime(
  audioContext,
  timelineBuffer,
  insertBuffer,
  time
) {
  const insertTime = clamp(time, 0, timelineBuffer.duration);
  const before = insertTime > 0
    ? sliceAudioBuffer(audioContext, timelineBuffer, 0, insertTime)
    : null;
  const after = insertTime < timelineBuffer.duration
    ? sliceAudioBuffer(audioContext, timelineBuffer, insertTime, timelineBuffer.duration)
    : null;

  return concatenateBuffers(audioContext, [before, insertBuffer, after].filter(Boolean));
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} timelineBuffer
 * @param {number} start
 * @param {number} end
 * @returns {AudioBuffer | null}
 */
export function deleteAudioRange(audioContext, timelineBuffer, start, end) {
  const range = normalizeRange(start, end, timelineBuffer.duration);
  const before = range.start > 0
    ? sliceAudioBuffer(audioContext, timelineBuffer, 0, range.start)
    : null;
  const after = range.end < timelineBuffer.duration
    ? sliceAudioBuffer(audioContext, timelineBuffer, range.end, timelineBuffer.duration)
    : null;
  const pieces = [before, after].filter(Boolean);

  return pieces.length ? concatenateBuffers(audioContext, pieces) : null;
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} timelineBuffer
 * @param {number} start
 * @param {number} end
 * @returns {AudioBuffer}
 */
export function copyAudioRange(audioContext, timelineBuffer, start, end) {
  const range = normalizeRange(start, end, timelineBuffer.duration);
  return sliceAudioBuffer(audioContext, timelineBuffer, range.start, range.end);
}

/**
 * Recortar means: keep only the selected range.
 *
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} timelineBuffer
 * @param {number} start
 * @param {number} end
 * @returns {AudioBuffer}
 */
export function cropAudioRange(audioContext, timelineBuffer, start, end) {
  const range = normalizeRange(start, end, timelineBuffer.duration);
  return sliceAudioBuffer(audioContext, timelineBuffer, range.start, range.end);
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer[]} buffers
 * @returns {AudioBuffer}
 */
export function concatenateBuffers(audioContext, buffers) {
  const validBuffers = buffers.filter(Boolean);

  if (!validBuffers.length) {
    throw new Error("No hay audio para procesar.");
  }

  if (validBuffers.length === 1) {
    return cloneAudioBuffer(audioContext, validBuffers[0]);
  }

  const sampleRate = validBuffers[0].sampleRate;
  const numberOfChannels = Math.max(
    ...validBuffers.map((buffer) => buffer.numberOfChannels)
  );
  const totalLength = validBuffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const output = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;

  for (const buffer of validBuffers) {
    for (let channel = 0; channel < numberOfChannels; channel += 1) {
      const outputData = output.getChannelData(channel);
      const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
      outputData.set(buffer.getChannelData(sourceChannel), offset);
    }

    offset += buffer.length;
  }

  return output;
}

/**
 * @param {AudioContext} audioContext
 * @param {AudioBuffer} source
 * @returns {AudioBuffer}
 */
export function cloneAudioBuffer(audioContext, source) {
  const output = audioContext.createBuffer(
    source.numberOfChannels,
    source.length,
    source.sampleRate
  );

  for (let channel = 0; channel < source.numberOfChannels; channel += 1) {
    output.getChannelData(channel).set(source.getChannelData(channel));
  }

  return output;
}

/**
 * @param {AudioBuffer} buffer
 * @returns {import("../domain/AudioSegment.js").AudioSegment[]}
 */
export function createEditedSegment(buffer) {
  return [
    {
      id: crypto.randomUUID(),
      name: "Edición actual",
      buffer,
      startTime: 0,
      duration: buffer.duration,
      numberOfChannels: buffer.numberOfChannels
    }
  ];
}

/**
 * @param {import("../domain/AudioSegment.js").AudioSegment[]} segments
 * @returns {import("../domain/AudioSegment.js").AudioSegment[]}
 */
export function layoutSegments(segments) {
  let cursor = 0;

  return segments.map((segment) => {
    const next = {
      ...segment,
      startTime: cursor,
      duration: segment.buffer.duration,
      numberOfChannels: segment.buffer.numberOfChannels
    };
    cursor += next.duration;
    return next;
  });
}

/**
 * @param {number} start
 * @param {number} end
 * @param {number} duration
 * @returns {{ start: number; end: number }}
 */
export function normalizeRange(start, end, duration) {
  const safeStart = clamp(Math.min(start, end), 0, duration);
  const safeEnd = clamp(Math.max(start, end), safeStart, duration);

  return { start: safeStart, end: safeEnd };
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
