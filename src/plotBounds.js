export const PLOT_LEFT = 72;
export const PLOT_RIGHT_MARGIN = 78;

export function getPlotBounds(track) {
  const width = Math.max(1, Number(track?.dimensions?.[0]) || 1);
  return {
    left: PLOT_LEFT,
    right: Math.max(PLOT_LEFT + 1, width - PLOT_RIGHT_MARGIN),
  };
}

export function mapTrackX(track, absPosition) {
  const { left, right } = getPlotBounds(track);
  const rawScale = track._xScale;
  const rawRange = typeof rawScale.range === "function"
    ? rawScale.range()
    : [0, Math.max(1, Number(track?.dimensions?.[0]) || 1)];
  const rawLeft = Number(rawRange[0]) || 0;
  const rawWidth = Math.max(1, Number(rawRange[1]) - rawLeft);
  return left + ((rawScale(absPosition) - rawLeft) / rawWidth) * (right - left);
}

export function unmapTrackX(track, plotX) {
  const { left, right } = getPlotBounds(track);
  const rawScale = track._xScale;
  const rawRange = typeof rawScale.range === "function"
    ? rawScale.range()
    : [0, Math.max(1, Number(track?.dimensions?.[0]) || 1)];
  const rawLeft = Number(rawRange[0]) || 0;
  const rawWidth = Math.max(1, Number(rawRange[1]) - rawLeft);
  return rawScale.invert(rawLeft + ((plotX - left) / Math.max(1, right - left)) * rawWidth);
}
