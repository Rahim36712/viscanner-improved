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

export function resetGlobalChromExtents() {
  window._globalChromExtents = { min: new Map(), max: new Map() };
  window._globalMasterBoundsCache = null;
}

export function registerGlobalChromExtents(chrName, minStart, maxEnd) {
  if (!window._globalChromExtents) {
    window._globalChromExtents = { min: new Map(), max: new Map() };
  }
  const minMap = window._globalChromExtents.min;
  const maxMap = window._globalChromExtents.max;

  if (Number.isFinite(minStart)) {
    const curMin = minMap.get(chrName);
    if (curMin === undefined || minStart < curMin) minMap.set(chrName, minStart);
  }
  if (Number.isFinite(maxEnd)) {
    const curMax = maxMap.get(chrName);
    if (curMax === undefined || maxEnd > curMax) maxMap.set(chrName, maxEnd);
  }
  window._globalMasterBoundsCache = null;
}

export function getGlobalMasterChromBounds(chromInfo) {
  if (!chromInfo || !chromInfo.cumPositions) return null;
  if (window._globalMasterBoundsCache) {
    return window._globalMasterBoundsCache;
  }

  const cumPositions = chromInfo.cumPositions;
  const chromLengths = chromInfo.chromLengths;
  const extents = window._globalChromExtents || { min: new Map(), max: new Map() };

  const bounds = [];
  for (let i = 0; i < cumPositions.length; i++) {
    const cp = cumPositions[i];
    const chrName = cp.chr;
    const officialLen = Number(chromLengths[chrName]) || 0;
    const officialStart = cp.pos;
    const officialEnd = officialStart + officialLen;

    const dataStart = extents.min.get(chrName);
    const dataEnd = extents.max.get(chrName);

    let startPos = dataStart !== undefined ? Math.min(officialStart, dataStart) : officialStart;
    let endPos = dataEnd !== undefined ? Math.max(officialEnd, dataEnd) : officialEnd;

    if (i > 0) {
      startPos = bounds[i - 1].end;
    }

    bounds.push({ chr: chrName, start: startPos, end: endPos });
  }

  window._globalMasterBoundsCache = bounds;
  return bounds;
}

export function registerDatasetExtents(chromInfo, dataSets = {}) {
  if (!chromInfo || !chromInfo.chrPositions) return;

  const registerRow = (chr, start, end) => {
    const chrObj = chromInfo.chrPositions[chr];
    if (!chrObj) return;
    const basePos = chrObj.pos;
    const startAbs = Number.isFinite(start) ? basePos + start : basePos;
    const endAbs = Number.isFinite(end) ? basePos + end : startAbs;
    registerGlobalChromExtents(chr, startAbs, endAbs);
  };

  (dataSets.hp1Segments || []).forEach((row) => registerRow(row.chr, row.start, row.end));
  (dataSets.hp2Segments || []).forEach((row) => registerRow(row.chr, row.start, row.end));
  (dataSets.coverage || []).forEach((row) => registerRow(row.chr, row.start, row.end));
  (dataSets.bafData || dataSets.data || []).forEach((row) =>
    registerRow(row.chr, row.from || row.start || row.pos, row.to || row.end || row.pos)
  );
  (dataSets.snpData || []).forEach((row) => registerRow(row.chr, row.pos, row.pos));
}

export function getDynamicChrAbs(chrName, relPos, chromInfo, customBounds) {
  if (!chromInfo || !chromInfo.cumPositions) return Number(relPos) || 0;
  const bounds = customBounds || getGlobalMasterChromBounds(chromInfo);
  if (!bounds) return Number(relPos) || 0;

  const idx = chromInfo.cumPositions.findIndex((cp) => cp.chr === chrName);
  if (idx >= 0 && bounds[idx]) {
    return bounds[idx].start + (Number(relPos) || 0);
  }

  const chrObj = chromInfo.chrPositions ? chromInfo.chrPositions[chrName] : null;
  return (chrObj ? chrObj.pos : 0) + (Number(relPos) || 0);
}
