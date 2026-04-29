/**
 * Draws a stereo-style waveform. If the source is mono, the same channel is
 * shown in both lanes so the visual model remains consistent.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {AudioBuffer} audioBuffer
 * @param {{ trimStart: number; trimEnd: number }} trim
 */
export function drawStereoWaveform(canvas, audioBuffer, trim) {
  const parentWidth = canvas.parentElement?.clientWidth ?? 720;
  const cssWidth = Math.max(320, parentWidth);
  const cssHeight = 210;
  const pixelRatio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(cssWidth * pixelRatio);
  canvas.height = Math.floor(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) return;

  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  drawBackground(context, cssWidth, cssHeight);

  const laneGap = 18;
  const laneHeight = (cssHeight - laneGap) / 2;
  const rightChannelIndex = Math.min(1, audioBuffer.numberOfChannels - 1);
  const channels = [
    audioBuffer.getChannelData(0),
    audioBuffer.getChannelData(rightChannelIndex)
  ];

  drawChannel(context, channels[0], 0, laneHeight, cssWidth, "#a8d8dc");
  drawChannel(
    context,
    channels[1],
    laneHeight + laneGap,
    laneHeight,
    cssWidth,
    "#a8d8dc"
  );

  drawTrimOverlay(context, cssWidth, cssHeight, audioBuffer.duration, trim);
  drawLaneLabel(context, "L", 10, 20);
  drawLaneLabel(
    context,
    audioBuffer.numberOfChannels > 1 ? "R" : "M",
    10,
    laneHeight + laneGap + 20
  );
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 */
function drawBackground(context, width, height) {
  context.fillStyle = "#050707";
  context.fillRect(0, 0, width, height);

  context.strokeStyle = "rgba(168, 216, 220, 0.18)";
  context.lineWidth = 1;

  for (let x = 0; x < width; x += 72) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.stroke();
  }

  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.stroke();
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {Float32Array} samples
 * @param {number} top
 * @param {number} height
 * @param {number} width
 * @param {string} color
 */
function drawChannel(context, samples, top, height, width, color) {
  const centerY = top + height / 2;
  const step = Math.max(1, Math.floor(samples.length / width));
  const amplitudeScale = height / 2;

  context.strokeStyle = "rgba(168, 216, 220, 0.18)";
  context.beginPath();
  context.moveTo(0, centerY);
  context.lineTo(width, centerY);
  context.stroke();

  context.fillStyle = color;

  for (let x = 0; x < width; x += 1) {
    const start = x * step;
    if (start >= samples.length) continue;

    let min = 1;
    let max = -1;

    for (let index = 0; index < step && start + index < samples.length; index += 1) {
      const sample = samples[start + index];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }

    const y1 = centerY + min * amplitudeScale;
    const y2 = centerY + max * amplitudeScale;
    context.fillRect(x, y1, 1, Math.max(1, y2 - y1));
  }
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {number} width
 * @param {number} height
 * @param {number} duration
 * @param {{ trimStart: number; trimEnd: number }} trim
 */
function drawTrimOverlay(context, width, height, duration, trim) {
  const startX = duration > 0 ? (trim.trimStart / duration) * width : 0;
  const endX = duration > 0 ? (trim.trimEnd / duration) * width : width;

  context.fillStyle = "rgba(0, 0, 0, 0.62)";
  context.fillRect(0, 0, Math.max(0, startX), height);
  context.fillRect(endX, 0, Math.max(0, width - endX), height);

  context.strokeStyle = "#ffb000";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(startX, 0);
  context.lineTo(startX, height);
  context.moveTo(endX, 0);
  context.lineTo(endX, height);
  context.stroke();
}

/**
 * @param {CanvasRenderingContext2D} context
 * @param {string} label
 * @param {number} x
 * @param {number} y
 */
function drawLaneLabel(context, label, x, y) {
  context.fillStyle = "rgba(168, 216, 220, 0.88)";
  context.font = "700 11px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillText(label, x, y);
}
