/**
 * Multi-resolution peak pyramid used to render clip waveforms without scanning
 * AudioBuffer samples on every canvas redraw.
 *
 * Each level stores min/max visual peaks for a fixed number of source samples.
 * Rendering still performs a final min/max reduction per canvas pixel so the
 * visible waveform remains faithful to the current pixel width.
 *
 * @typedef {{ scale: number; length: number; min: Float32Array; max: Float32Array }} WaveformPeakLevel
 * @typedef {{ sampleRate: number; sourceLength: number; levels: WaveformPeakLevel[] }} WaveformPeakPyramid
 */

const PEAK_SCALES = [64, 256, 1024, 4096, 16384];
const BASE_SCALE = PEAK_SCALES[0];
const DOWNSAMPLE_FACTOR = 4;
const waveformCache = new WeakMap();

/**
 * @param {{ buffer: AudioBuffer }} clip
 * @returns {WaveformPeakPyramid}
 */
export function getClipWaveformPyramid(clip) {
  return getWaveformPeakPyramid(clip.buffer);
}

/**
 * @param {AudioBuffer} buffer
 * @returns {WaveformPeakPyramid}
 */
export function getWaveformPeakPyramid(buffer) {
  const cached = waveformCache.get(buffer);
  if (cached) return cached;

  const pyramid = createWaveformPeakPyramid(buffer);
  waveformCache.set(buffer, pyramid);
  return pyramid;
}

/**
 * @param {{ buffer: AudioBuffer }} clip
 */
export function invalidateClipWaveform(clip) {
  waveformCache.delete(clip.buffer);
}

/**
 * @param {AudioBuffer} buffer
 * @returns {WaveformPeakPyramid}
 */
export function createWaveformPeakPyramid(buffer) {
  const levels = [createPeakLevelFromAudioBuffer(buffer, BASE_SCALE)];

  while (levels.length < PEAK_SCALES.length) {
    const previous = levels[levels.length - 1];
    const nextScale = previous.scale * DOWNSAMPLE_FACTOR;
    levels.push(downsamplePeakLevel(previous, DOWNSAMPLE_FACTOR, nextScale));
  }

  return {
    sampleRate: buffer.sampleRate,
    sourceLength: buffer.length,
    levels
  };
}

/**
 * @param {AudioBuffer} buffer
 * @param {number} scale source samples per peak
 * @returns {WaveformPeakLevel}
 */
export function createPeakLevelFromAudioBuffer(buffer, scale) {
  const length = Math.max(1, Math.ceil(buffer.length / scale));
  const min = new Float32Array(length);
  const max = new Float32Array(length);
  const channelData = Array.from(
    { length: buffer.numberOfChannels },
    (_, channel) => buffer.getChannelData(channel)
  );

  for (let peakIndex = 0; peakIndex < length; peakIndex += 1) {
    const start = peakIndex * scale;
    const end = Math.min(buffer.length, start + scale);
    let minSample = 1;
    let maxSample = -1;

    for (let frame = start; frame < end; frame += 1) {
      for (let channel = 0; channel < channelData.length; channel += 1) {
        const sample = channelData[channel][frame];
        if (sample < minSample) minSample = sample;
        if (sample > maxSample) maxSample = sample;
      }
    }

    min[peakIndex] = minSample === 1 ? 0 : minSample;
    max[peakIndex] = maxSample === -1 ? 0 : maxSample;
  }

  return { scale, length, min, max };
}

/**
 * @param {WaveformPeakLevel} level
 * @param {number} factor
 * @param {number} nextScale
 * @returns {WaveformPeakLevel}
 */
export function downsamplePeakLevel(level, factor, nextScale = level.scale * factor) {
  const length = Math.max(1, Math.ceil(level.length / factor));
  const min = new Float32Array(length);
  const max = new Float32Array(length);

  for (let peakIndex = 0; peakIndex < length; peakIndex += 1) {
    const start = peakIndex * factor;
    const end = Math.min(level.length, start + factor);
    let minSample = 1;
    let maxSample = -1;

    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      if (level.min[sourceIndex] < minSample) minSample = level.min[sourceIndex];
      if (level.max[sourceIndex] > maxSample) maxSample = level.max[sourceIndex];
    }

    min[peakIndex] = minSample === 1 ? 0 : minSample;
    max[peakIndex] = maxSample === -1 ? 0 : maxSample;
  }

  return { scale: nextScale, length, min, max };
}

/**
 * Choose the most detailed level that does not exceed the visible source
 * samples per pixel. If every level is coarser than the target, use the most
 * detailed level and let final per-pixel reduction handle the oversampling.
 *
 * @param {WaveformPeakPyramid} pyramid
 * @param {number} samplesPerPixel
 * @returns {WaveformPeakLevel}
 */
export function choosePeakLevel(pyramid, samplesPerPixel) {
  const safeSamplesPerPixel = Math.max(1, samplesPerPixel);
  let selected = pyramid.levels[0];

  for (const level of pyramid.levels) {
    if (level.scale <= safeSamplesPerPixel) {
      selected = level;
    } else {
      break;
    }
  }

  return selected;
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {WaveformPeakLevel} level
 * @param {{ x: number; y: number; width: number; height: number }} rect
 * @param {string} [color]
 */
export function drawWaveformPeakLevel(context, level, rect, color = "#a8d8dc") {
  const top = rect.y;
  const height = Math.max(1, rect.height);
  const centerY = top + height / 2;
  const width = Math.max(1, Math.floor(rect.width));
  const amplitudeScale = height / 2;
  const peaksPerPixel = level.length / width;

  context.strokeStyle = "rgba(168, 216, 220, 0.18)";
  context.beginPath();
  context.moveTo(rect.x, centerY);
  context.lineTo(rect.x + rect.width, centerY);
  context.stroke();

  context.fillStyle = color;

  for (let column = 0; column < width; column += 1) {
    const start = Math.floor(column * peaksPerPixel);
    const end = Math.min(level.length, Math.max(start + 1, Math.ceil((column + 1) * peaksPerPixel)));
    let minSample = 1;
    let maxSample = -1;

    for (let peakIndex = start; peakIndex < end; peakIndex += 1) {
      if (level.min[peakIndex] < minSample) minSample = level.min[peakIndex];
      if (level.max[peakIndex] > maxSample) maxSample = level.max[peakIndex];
    }

    if (minSample === 1) minSample = 0;
    if (maxSample === -1) maxSample = 0;

    const y1 = centerY + minSample * amplitudeScale;
    const y2 = centerY + maxSample * amplitudeScale;
    context.fillRect(rect.x + column, y1, 1, Math.max(1, y2 - y1));
  }
}
