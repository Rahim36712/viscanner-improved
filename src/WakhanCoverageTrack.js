import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo, chrToAbs } from "smaht-higlass-misc/es/chrom-utils";
import { format } from "d3-format";
import {
  getPlotBounds,
  mapTrackX,
  unmapTrackX,
  registerGlobalChromExtents,
  getGlobalMasterChromBounds,
  getDynamicChrAbs,
} from "./plotBounds";
import { createHighResBase64Extractor } from "./pdfExport";
import { LABELS, SV_CONFIG } from "./labelsConfig";
import {
  isFiniteNumber,
  isValidVariant,
  safeMoveTo,
  safeLineTo,
  safeDrawRect,
  logDevSkip,
} from "./safeRendering";

const HP1_COLOR = "#B23A48";
const HP1_POINT_COLOR = "#D95F65";
const HP2_COLOR = "#2D7DD2";
const HP2_POINT_COLOR = "#63A6D8";
const AXIS_COLOR = "#3f464d";
const GRID_COLOR = "#e5e8eb";
const CENTER_COLOR = "#222222";
const CHROM_BAND_COLOR = "#e7eaed";
const MASKED_REGION_COLOR = "#E8C766";
const MASKED_REGION_ALPHA = 0.3;
const MASKED_REGION_BORDER_COLOR = "#B58A2A";
const MASKED_REGION_BORDER_ALPHA = 0.7;
const LOH_REGION_COLOR = "#808080";
const LOH_REGION_ALPHA = 0.35;
const LOH_REGION_BORDER_COLOR = "#555555";
const LOH_REGION_BORDER_ALPHA = 0.7;
const COVERAGE_DOT_SIZE = 1.6;
const COVERAGE_TICK_STEP = 30;
const SV_MARKER_ALPHA = SV_CONFIG.MARKER_ALPHA;
const DEFAULT_SV_MODE = "matched";
const DEFAULT_VISIBLE_TYPES = {
  DEL: true,
  INV: true,
  INS: true,
  BND: true,
  DUP: true,
  sBND: true,
};
const SV_TYPE_COLORS = SV_CONFIG.TYPE_COLORS;

function clampCoverage(value, coverageMax) {
  if (!isFiniteNumber(value) || !isFiniteNumber(coverageMax) || coverageMax <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(value, coverageMax));
}

function clampCopyNumber(value, copyNumberMax) {
  if (!isFiniteNumber(value) || !isFiniteNumber(copyNumberMax) || copyNumberMax <= 0) {
    return null;
  }
  return Math.max(0, Math.min(value, copyNumberMax));
}

function sampleRows(rows, maxRows) {
  if (!Array.isArray(rows) || rows.length <= maxRows) {
    return rows || [];
  }
  const step = Math.ceil(rows.length / maxRows);
  const sampled = [];
  for (let i = 0; i < rows.length; i += step) {
    sampled.push(rows[i]);
  }
  return sampled;
}

function normalizeSvData(data) {
  if (Array.isArray(data)) {
    return { variants: data, matchedIds: [] };
  }
  return {
    variants: (data && data.variants) || [],
    matchedIds: (data && data.matchedIds) || [],
  };
}

function variantLength(variant) {
  if (isFiniteNumber(variant?.svlen)) {
    return Math.abs(variant.svlen);
  }
  if (isFiniteNumber(variant?.startAbs) && isFiniteNumber(variant?.endAbs)) {
    return Math.abs(variant.endAbs - variant.startAbs);
  }
  return 0;
}

function escapeHtml(value) {
  return String(value === undefined || value === null ? "-" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function nextMultiple(value, step) {
  if (!isFiniteNumber(value) || value <= 0 || !isFiniteNumber(step) || step <= 0) {
    return isFiniteNumber(step) && step > 0 ? step : 30;
  }
  return Math.ceil(value / step) * step;
}

function copyNumberEquivalent(rawCoverage, segment) {
  if (
    !segment ||
    !isFiniteNumber(rawCoverage) ||
    !isFiniteNumber(segment.coverage) ||
    !isFiniteNumber(segment.copyNumber) ||
    segment.coverage <= 0
  ) {
    return null;
  }
  return (rawCoverage / segment.coverage) * segment.copyNumber;
}

function maxCoverageFromSegments(segments, fallback) {
  if (!Array.isArray(segments)) {
    return isFiniteNumber(fallback) ? fallback : 180;
  }
  const maxCoverage = segments.reduce((maxValue, segment) => {
    if (!segment || !isFiniteNumber(segment.coverage)) {
      return maxValue;
    }
    return Math.max(maxValue, segment.coverage);
  }, 0);
  const fallbackVal = isFiniteNumber(fallback) ? fallback : 180;
  return Math.max(fallbackVal, nextMultiple(maxCoverage, COVERAGE_TICK_STEP));
}

function maxCopyNumberFromSegments(segments) {
  if (!Array.isArray(segments)) {
    return 4;
  }
  const maxCopyNumber = segments.reduce((maxValue, segment) => {
    if (!segment || !isFiniteNumber(segment.copyNumber)) {
      return maxValue;
    }
    return Math.max(maxValue, segment.copyNumber);
  }, 0);
  return Math.max(1, Math.ceil(maxCopyNumber));
}

function groupSegmentsByChr(segments) {
  const grouped = {};
  if (!Array.isArray(segments)) {
    return grouped;
  }
  segments.forEach((segment) => {
    if (segment && segment.chr) {
      if (!grouped[segment.chr]) {
        grouped[segment.chr] = [];
      }
      grouped[segment.chr].push(segment);
    }
  });
  Object.keys(grouped).forEach((chr) => {
    grouped[chr].sort((a, b) => (a.startAbs || 0) - (b.startAbs || 0));
  });
  return grouped;
}

function segmentForRow(row, segmentsByChr, pointersByChr) {
  if (!row || !row.chr || !segmentsByChr) {
    return null;
  }
  const rows = segmentsByChr[row.chr];
  if (!rows || !rows.length) {
    return null;
  }
  if (!isFiniteNumber(row.startAbs) || !isFiniteNumber(row.endAbs)) {
    return null;
  }
  const midpoint = (row.startAbs + row.endAbs) / 2;
  let pointer = pointersByChr[row.chr] || 0;
  while (pointer < rows.length - 1 && rows[pointer].endAbs < midpoint) {
    pointer += 1;
  }
  pointersByChr[row.chr] = pointer;
  const segment = rows[pointer];
  if (segment && segment.startAbs <= midpoint && segment.endAbs >= midpoint) {
    return segment;
  }
  return null;
}

function integerTicks(maxValue) {
  const ticks = [];
  if (!isFiniteNumber(maxValue) || maxValue < 0) {
    return ticks;
  }
  for (let tick = 0; tick <= maxValue; tick += 1) {
    ticks.push(tick);
  }
  return ticks;
}

function coverageTicks(maxValue) {
  const ticks = [];
  if (!isFiniteNumber(maxValue) || maxValue <= 0) {
    return [0, COVERAGE_TICK_STEP];
  }
  for (let tick = 0; tick <= maxValue; tick += COVERAGE_TICK_STEP) {
    ticks.push(tick);
  }
  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }
  return ticks;
}

function annotateCoverageRows(coverageRows, hp1Segments, hp2Segments) {
  if (!Array.isArray(coverageRows)) {
    return;
  }
  const hp1ByChr = groupSegmentsByChr(hp1Segments);
  const hp2ByChr = groupSegmentsByChr(hp2Segments);
  const hp1Pointers = {};
  const hp2Pointers = {};

  coverageRows.forEach((row) => {
    if (!row) return;
    const hp1Segment = segmentForRow(row, hp1ByChr, hp1Pointers);
    const hp2Segment = segmentForRow(row, hp2ByChr, hp2Pointers);
    row.hp1Segment = hp1Segment;
    row.hp2Segment = hp2Segment;
    row.hp1CopyNumberEquivalent = copyNumberEquivalent(row.hp1, hp1Segment);
    row.hp2CopyNumberEquivalent = copyNumberEquivalent(row.hp2, hp2Segment);
  });
}

function formatCopyNumber(value) {
  if (!isFiniteNumber(value)) {
    return "-";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return format(".2f")(value);
}

function formatCoverage(value) {
  if (!isFiniteNumber(value)) {
    return "-";
  }
  return format(".2f")(value);
}

function WakhanCoverageTrack(HGC, ...args) {
  class WakhanCoverageTrackClass extends BaseTrack(HGC, ...args) {
    constructor(context, options) {
      super(context, options);
      this.HGC = HGC;
      this.viewId = context.viewUid;
      this.trackId = this.id;
      this.coverage = [];
      this.hp1Segments = [];
      this.hp2Segments = [];
      this.maskedRegions = [];
      this.lohRegions = [];
      this.currentCoverage = [];
      this.currentHp1Segments = [];
      this.currentHp2Segments = [];
      this.currentMaskedRegions = [];
      this.currentLohRegions = [];
      this.currentSvMarkers = [];
      this.svData = this.options.svData || { variants: [], matchedIds: [] };
      this.svVariants = [];
      this.svMatchedIds = new Set();
      this.svHitRegions = [];
      this.showHp1 = this.options.showHp1 !== false;
      this.showHp2 = this.options.showHp2 !== false;
      this.showCoverage = this.showCoverage !== false;
      this.showSvBreakpoints = this.options.showSvBreakpoints !== false;
      this.showMaskedRegions = this.options.showMaskedRegions === true;
      this.showLohRegions = this.options.showLohRegions !== false;
      this.svMode = this.options.svMode || DEFAULT_SV_MODE;
      this.visibleSvTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...(this.options.visibleTypes || {}),
      };
      this.options.visibleTypes = { ...this.visibleSvTypes };
      this.maxVariantLength = this.options.maxVariantLength || null;
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
      this.coverageMax = this.options.coverageMax || 180;
      this.copyNumberMax = 4;
      this.chromSizes = {};

      this.initTrack();

      if (options.chromSizesUrl) {
        this.chromSizes[options.chromSizesUrl] =
          this.chromSizes[options.chromSizesUrl] ||
          new Promise((resolve) => {
            ChromosomeInfo(options.chromSizesUrl, resolve);
          });

        this.chromSizes[options.chromSizesUrl].then((chromInfo) => {
          this.chromInfo = chromInfo;
          this.parseData(this.options.data || {});
          this.rerender(this.options);
        });
      }
    }

    initTrack() {
      this.pForeground.removeChildren();
      this.pForeground.clear();
      this.pMain.removeChildren();
      this.pMain.clear();

      this.bgGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.maskedRegionGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.lohRegionGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.svGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.coverageGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.segmentGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.axisGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.labelContainer = new this.HGC.libraries.PIXI.Container();
      this.mouseOverGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.loadingText = new this.HGC.libraries.PIXI.Text("Loading...", {
        fontSize: "12px",
        fontFamily: "Arial",
        fill: "grey",
      });
      this.loadingText.x = 70;
      this.loadingText.y = 0;

      this.pMain.addChild(this.bgGraphics);
      this.pMain.addChild(this.maskedRegionGraphics);
      this.pMain.addChild(this.lohRegionGraphics);
      this.pMain.addChild(this.svGraphics);
      this.pMain.addChild(this.coverageGraphics);
      this.pMain.addChild(this.segmentGraphics);
      this.pMain.addChild(this.mouseOverGraphics);
      this.pForeground.addChild(this.axisGraphics);
      this.pForeground.addChild(this.labelContainer);
      this.pForeground.addChild(this.loadingText);
    }

    setData(data) {
      this.options.data = data;
      this.parseData(data);
      this.rerender(this.options);
    }

    setStructuralVariationData(data) {
      this.options.svData = data;
      this.svData = data || { variants: [], matchedIds: [] };
      this.parseStructuralVariationData(this.svData);
      this.resetCache();
      this.updateExistingGraphics();
      this.animate();
    }

    setVisibilityOptions(options = {}) {
      if (options.showHp1 !== undefined) {
        this.showHp1 = options.showHp1 !== false;
        this.options.showHp1 = this.showHp1;
      }
      if (options.showHp2 !== undefined) {
        this.showHp2 = options.showHp2 !== false;
        this.options.showHp2 = this.showHp2;
      }
      if (options.showCoverage !== undefined) {
        this.showCoverage = options.showCoverage !== false;
        this.options.showCoverage = this.showCoverage;
      }
      if (options.showSvBreakpoints !== undefined) {
        this.showSvBreakpoints = options.showSvBreakpoints !== false;
        this.options.showSvBreakpoints = this.showSvBreakpoints;
      }
      if (options.showMaskedRegions !== undefined) {
        this.showMaskedRegions = options.showMaskedRegions === true;
        this.options.showMaskedRegions = this.showMaskedRegions;
      }
      if (options.showLohRegions !== undefined) {
        this.showLohRegions = options.showLohRegions !== false;
        this.options.showLohRegions = this.showLohRegions;
      }
      if (options.svMode) {
        this.svMode = options.svMode;
        this.options.svMode = options.svMode;
      }
      if (options.visibleTypes) {
        this.visibleSvTypes = {
          ...this.visibleSvTypes,
          ...options.visibleTypes,
        };
        this.options.visibleTypes = {
          ...(this.options.visibleTypes || {}),
          ...this.visibleSvTypes,
        };
      }
      if (options.maxVariantLength !== undefined) {
        this.maxVariantLength = options.maxVariantLength || null;
        this.options.maxVariantLength = this.maxVariantLength;
      }
      this.resetCache();
      this.updateExistingGraphics();
      this.animate();
    }

    parseData(data) {
      this.coverage = [];
      this.hp1Segments = [];
      this.hp2Segments = [];
      this.maskedRegions = [];
      this.lohRegions = [];
      const hasCoveragePayload =
        data &&
        (Array.isArray(data.coverage) ||
          Array.isArray(data.hp1Segments) ||
          Array.isArray(data.hp2Segments) ||
          Array.isArray(data.maskedRegions) ||
          Array.isArray(data.lohRegions));
      if (data && data.svData) {
        this.parseStructuralVariationData(data.svData);
      } else if (!hasCoveragePayload) {
        this.parseStructuralVariationData({ variants: [], matchedIds: [] });
      } else {
        this.parseStructuralVariationData(this.svData);
      }
      if (!this.chromInfo || !data) {
        return;
      }

      const masterBounds = getGlobalMasterChromBounds(this.chromInfo);

      (data.coverage || []).forEach((row) => {
        if (!row || !this.chromInfo.chrPositions[row.chr]) {
          return;
        }
        const startAbs = getDynamicChrAbs(row.chr, row.start, this.chromInfo, masterBounds);
        const endAbs = getDynamicChrAbs(row.chr, row.end, this.chromInfo, masterBounds);
        if (isFiniteNumber(startAbs) && isFiniteNumber(endAbs)) {
          this.coverage.push({
            chr: row.chr,
            start: row.start,
            end: row.end,
            hp1: row.hp1,
            hp2: row.hp2,
            startAbs,
            endAbs,
          });
        }
      });

      const parseSegments = (rows, key) =>
        (rows || [])
          .filter((row) => row && this.chromInfo.chrPositions[row.chr])
          .map((row) => {
            const startAbs = getDynamicChrAbs(row.chr, row.start, this.chromInfo, masterBounds);
            const endAbs = getDynamicChrAbs(row.chr, row.end, this.chromInfo, masterBounds);
            return {
              chr: row.chr,
              start: row.start,
              end: row.end,
              coverage: row.coverage,
              copyNumber: row[key],
              confidence: row.confidence,
              startAbs,
              endAbs,
            };
          })
          .filter((row) => isFiniteNumber(row.startAbs) && isFiniteNumber(row.endAbs));

      this.hp1Segments = parseSegments(data.hp1Segments, "hp1");
      this.hp2Segments = parseSegments(data.hp2Segments, "hp2");
      this.maskedRegions = (data.maskedRegions || [])
        .filter((row) => row && this.chromInfo.chrPositions[row.chr])
        .map((row) => {
          const startAbs = getDynamicChrAbs(row.chr, row.start, this.chromInfo, masterBounds);
          const endAbs = getDynamicChrAbs(row.chr, row.end, this.chromInfo, masterBounds);
          return {
            chr: row.chr,
            start: row.start,
            end: row.end,
            startAbs,
            endAbs,
          };
        })
        .filter((row) => isFiniteNumber(row.startAbs) && isFiniteNumber(row.endAbs));

      this.lohRegions = (data.lohRegions || [])
        .filter((row) => row && this.chromInfo.chrPositions[row.chr])
        .map((row) => {
          const startAbs = getDynamicChrAbs(row.chr, row.start, this.chromInfo, masterBounds);
          const endAbs = getDynamicChrAbs(row.chr, row.end, this.chromInfo, masterBounds);
          return {
            chr: row.chr,
            start: row.start,
            end: row.end,
            startAbs,
            endAbs,
          };
        })
        .filter((row) => isFiniteNumber(row.startAbs) && isFiniteNumber(row.endAbs));

      this.coverageMax = maxCoverageFromSegments(
        this.hp1Segments.concat(this.hp2Segments),
        this.options.coverageMax || 180
      );
      this.copyNumberMax = maxCopyNumberFromSegments(
        this.hp1Segments.concat(this.hp2Segments)
      );
      annotateCoverageRows(this.coverage, this.hp1Segments, this.hp2Segments);

      const allSegs = (this.hp1Segments || []).concat(this.hp2Segments || []);
      for (let i = 0; i < allSegs.length; i++) {
        const seg = allSegs[i];
        if (seg?.chr) registerGlobalChromExtents(seg.chr, seg.startAbs, seg.endAbs);
      }
      for (let i = 0; i < (this.coverage || []).length; i++) {
        const cov = this.coverage[i];
        if (cov?.chr) registerGlobalChromExtents(cov.chr, cov.startAbs, cov.endAbs);
      }

      this.resetCache();
    }

    parseStructuralVariationData(data) {
      const normalizedData = normalizeSvData(data);
      this.svData = normalizedData;
      this.svVariants = [];
      this.svMatchedIds = new Set(normalizedData.matchedIds || []);
      if (!this.chromInfo || !Array.isArray(normalizedData.variants)) {
        return;
      }

      this.svVariants = normalizedData.variants
        .filter((variant) => variant && this.chromInfo.chrPositions[variant.chr])
        .map((variant) => {
          const startAbs = isFiniteNumber(variant.startAbs)
            ? variant.startAbs
            : chrToAbs(variant.chr, variant.pos, this.chromInfo);
          let endAbs = startAbs;
          if (isFiniteNumber(variant.endAbs)) {
            endAbs = variant.endAbs;
          } else if (variant.chr2 && this.chromInfo.chrPositions[variant.chr2]) {
            endAbs = chrToAbs(variant.chr2, variant.pos2 || variant.pos, this.chromInfo);
          } else if (isFiniteNumber(variant.pos2)) {
            endAbs = chrToAbs(variant.chr, variant.pos2, this.chromInfo);
          }
          return {
            ...variant,
            startAbs,
            endAbs,
          };
        })
        .filter((variant) => isFiniteNumber(variant.startAbs) && isFiniteNumber(variant.endAbs));
    }

    rerender(options) {
      super.rerender(options);
      const currentActiveTypes = this.visibleSvTypes ? { ...this.visibleSvTypes } : null;
      this.options = options || this.options || {};
      this.showHp1 = this.showHp1 === undefined ? this.options.showHp1 !== false : this.showHp1;
      this.showHp2 = this.showHp2 === undefined ? this.options.showHp2 !== false : this.showHp2;
      this.showCoverage = this.showCoverage === undefined ? this.options.showCoverage !== false : this.showCoverage;
      this.showSvBreakpoints = this.showSvBreakpoints === undefined ? this.options.showSvBreakpoints !== false : this.showSvBreakpoints;
      this.showMaskedRegions = this.showMaskedRegions === undefined ? this.options.showMaskedRegions === true : this.showMaskedRegions;
      this.showLohRegions = this.showLohRegions === undefined ? this.options.showLohRegions !== false : this.showLohRegions;
      this.svMode = this.svMode || this.options.svMode || DEFAULT_SV_MODE;
      this.visibleSvTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...(this.options.visibleTypes || {}),
        ...(currentActiveTypes || {}),
      };
      this.options.visibleTypes = { ...this.visibleSvTypes };
      if (this.options.data && !this.coverage.length) {
        this.parseData(this.options.data);
      }
      if (this.svData && !this.svVariants.length) {
        this.parseStructuralVariationData(this.svData);
      }
      this.updateExistingGraphics();
    }

    setDimensions(newDimensions) {
      super.setDimensions(newDimensions);
      this.updateExistingGraphics();
    }

    resetCache() {
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
    }

    metrics() {
      const top = 0;
      const bottom = 0;
      const { left: leftAxisX, right: rightAxisX } = getPlotBounds(this);
      const rawHeight = (this.dimensions && this.dimensions[1]) ? this.dimensions[1] - top - bottom : 100;
      const height = Math.max(1, isFiniteNumber(rawHeight) ? rawHeight : 100);
      const centerY = top + height / 2;
      const halfHeight = height / 2 - 1;
      return { top, bottom, leftAxisX, rightAxisX, height, centerY, halfHeight };
    }

    yCoverage(value, hp) {
      const { centerY, halfHeight } = this.metrics();
      if (!isFiniteNumber(this.coverageMax) || this.coverageMax <= 0 || !isFiniteNumber(halfHeight)) {
        return null;
      }
      const clampedVal = clampCoverage(value, this.coverageMax);
      if (!isFiniteNumber(clampedVal)) {
        return null;
      }
      const scaled = (clampedVal / this.coverageMax) * halfHeight;
      if (!isFiniteNumber(scaled)) {
        return null;
      }
      const y = hp === 1 ? centerY - scaled : centerY + scaled;
      return isFiniteNumber(y) ? y : null;
    }

    yCopyNumber(value, hp) {
      const clampedValue = clampCopyNumber(value, this.copyNumberMax);
      if (clampedValue === null || !isFiniteNumber(clampedValue)) {
        return null;
      }
      const { centerY, halfHeight } = this.metrics();
      if (!isFiniteNumber(this.copyNumberMax) || this.copyNumberMax <= 0 || !isFiniteNumber(halfHeight)) {
        return null;
      }
      const scaled = (clampedValue / this.copyNumberMax) * halfHeight;
      if (!isFiniteNumber(scaled)) {
        return null;
      }
      const y = hp === 1 ? centerY - scaled : centerY + scaled;
      return isFiniteNumber(y) ? y : null;
    }

    /**
     * Maps an absolute genomic position to track X coordinates.
     * UNCHANGED per engineering requirement #1.
     */
    plotX(absPosition) {
      const { leftAxisX, rightAxisX } = this.metrics();
      return mapTrackX(this, absPosition);
    }

    plotAbsFromX(trackX) {
      const { leftAxisX, rightAxisX } = this.metrics();
      return unmapTrackX(this, trackX);
    }

    addText(text, x, y, options = {}) {
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return;
      }
      const label = new this.HGC.libraries.PIXI.Text(text, {
        fontSize: options.fontSize || "11px",
        fontFamily: "Arial",
        fill: options.fill || AXIS_COLOR,
      });
      label.resolution = 4;
      label.x = x;
      label.y = y;
      label.anchor.x = options.anchorX === undefined ? 0.5 : options.anchorX;
      label.anchor.y = options.anchorY === undefined ? 0.5 : options.anchorY;
      if (options.rotation) {
        label.rotation = options.rotation;
      }
      this.labelContainer.addChild(label);
    }

    drawAxes() {
      const { top, leftAxisX, rightAxisX, centerY, height } = this.metrics();
      const bottomY = top + height;
      const width = (this.dimensions && this.dimensions[0]) ? this.dimensions[0] : 800;
      this.axisGraphics.clear();
      this.labelContainer.removeChildren();

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(GRID_COLOR), 0);
      coverageTicks(this.coverageMax).forEach((tick) => {
        const halves = tick === 0 ? [1] : [1, 2];
        halves.forEach((hp) => {
          const y = tick === 0 ? centerY : this.yCoverage(tick, hp);
          if (isFiniteNumber(y)) {
            safeMoveTo(this.axisGraphics, leftAxisX, y, "drawAxes:tickMove");
            safeLineTo(this.axisGraphics, rightAxisX, y, "drawAxes:tickLine");
            this.addText(String(tick), leftAxisX - 8, y, { anchorX: 1 });
          }
        });
      });

      this.axisGraphics.lineStyle(2, this.HGC.utils.colorToHex(CENTER_COLOR), 1);
      safeMoveTo(this.axisGraphics, leftAxisX, centerY, "drawAxes:centerMove");
      safeLineTo(this.axisGraphics, rightAxisX, centerY, "drawAxes:centerLine");

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
      safeMoveTo(this.axisGraphics, leftAxisX, top, "drawAxes:leftMove");
      safeLineTo(this.axisGraphics, leftAxisX, bottomY, "drawAxes:leftLine");
      safeMoveTo(this.axisGraphics, rightAxisX, top, "drawAxes:rightMove");
      safeLineTo(this.axisGraphics, rightAxisX, bottomY, "drawAxes:rightLine");

      this.addText(LABELS.tracks.coverageDepth, 20, centerY, {
        rotation: -Math.PI / 2,
        fontSize: "12px",
      });
      this.addText(LABELS.tracks.phasedCopyNumber, width - 18, centerY, {
        rotation: Math.PI / 2,
        fontSize: "12px",
      });
      if (this.showHp1) {
        this.addText(LABELS.tracks.hp1Label, rightAxisX + 26, top + 12, {
          anchorX: 0,
          fill: HP1_COLOR,
          fontSize: "12px",
        });
      }
      if (this.showHp2) {
        this.addText(LABELS.tracks.hp2Label, rightAxisX + 26, bottomY - 12, {
          anchorX: 0,
          fill: HP2_COLOR,
          fontSize: "12px",
        });
      }

      const drawCopyTicks = (hp) => {
        integerTicks(this.copyNumberMax).forEach((tick) => {
          const y = this.yCopyNumber(tick, hp);
          if (y === null || !isFiniteNumber(y)) {
            return;
          }
          this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
          safeMoveTo(this.axisGraphics, rightAxisX - 4, y, "drawCopyTicks:move");
          safeLineTo(this.axisGraphics, rightAxisX + 4, y, "drawCopyTicks:line");
          this.addText(String(tick), rightAxisX + 10, y, { anchorX: 0 });
        });
      };
      if (this.showHp1) {
        drawCopyTicks(1);
      }
      if (this.showHp2) {
        drawCopyTicks(2);
      }
    }

    drawChromosomeBackground() {
      const { top, leftAxisX, rightAxisX, height } = this.metrics();
      if (!this.chromInfo || !this.chromInfo.cumPositions) {
        return;
      }

      const bounds = getGlobalMasterChromBounds(this.chromInfo);
      const bandColor = this.HGC.utils.colorToHex(CHROM_BAND_COLOR);

      this.chromInfo.cumPositions.forEach((chromosome, index) => {
        if (index % 2 !== 0) {
          return;
        }

        let startPos, endPos;
        if (bounds && bounds[index]) {
          startPos = bounds[index].start;
          endPos = bounds[index].end;
        } else {
          const chrLength = Number(this.chromInfo.chromLengths[chromosome.chr]);
          if (!isFiniteNumber(chrLength)) {
            return;
          }
          startPos = chromosome.pos;
          endPos = chromosome.pos + chrLength;
        }

        if (!isFiniteNumber(startPos) || !isFiniteNumber(endPos)) {
          return;
        }

        const rawStartX = this.plotX(startPos);
        const rawEndX = this.plotX(endPos);
        if (!isFiniteNumber(rawStartX) || !isFiniteNumber(rawEndX)) {
          return;
        }

        const startX = Math.max(leftAxisX, rawStartX);
        const endX = Math.min(rightAxisX, rawEndX);
        if (endX <= leftAxisX || startX >= rightAxisX || endX <= startX) {
          return;
        }

        this.bgGraphics.beginFill(bandColor, 0.85);
        safeDrawRect(this.bgGraphics, startX, top, endX - startX, height, "drawChromosomeBackground");
        this.bgGraphics.endFill();
      });
    }

    updateVisibleData() {
      if (!this._xScale || typeof this._xScale.invert !== "function") {
        return;
      }
      const fromX = this._xScale.invert(0);
      const toX = this._xScale.invert(this.dimensions ? this.dimensions[0] : 0);

      if (!isFiniteNumber(fromX) || !isFiniteNumber(toX)) {
        return;
      }

      const refreshStep = 0.02;
      const prevSpan = Math.abs(this.previousToX - this.previousFromX);

      if (
        isFiniteNumber(prevSpan) &&
        prevSpan > 0 &&
        Math.abs((this.previousFromX - fromX) / prevSpan) <= refreshStep &&
        Math.abs((this.previousToX - toX) / prevSpan) <= refreshStep
      ) {
        return;
      }

      this.currentCoverage = (this.coverage || []).filter(
        (row) => row && isFiniteNumber(row.endAbs) && isFiniteNumber(row.startAbs) && row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentHp1Segments = (this.hp1Segments || []).filter(
        (row) => row && isFiniteNumber(row.endAbs) && isFiniteNumber(row.startAbs) && row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentHp2Segments = (this.hp2Segments || []).filter(
        (row) => row && isFiniteNumber(row.endAbs) && isFiniteNumber(row.startAbs) && row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentMaskedRegions = (this.maskedRegions || []).filter(
        (row) => row && isFiniteNumber(row.endAbs) && isFiniteNumber(row.startAbs) && row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentLohRegions = (this.lohRegions || []).filter(
        (row) => row && isFiniteNumber(row.endAbs) && isFiniteNumber(row.startAbs) && row.endAbs >= fromX && row.startAbs <= toX
      );

      const minLength = this.options.minVariantLength === undefined ? 50 : this.options.minVariantLength;
      const maxLength = this.maxVariantLength;
      this.currentSvMarkers = [];

      if (this.showSvBreakpoints && Array.isArray(this.svVariants)) {
        this.svVariants.forEach((variant) => {
          if (!isValidVariant(variant)) {
            return;
          }
          if (variantLength(variant) < minLength) {
            return;
          }
          if (maxLength && variant.chr === variant.chr2 && variantLength(variant) < maxLength) {
            return;
          }
          if (this.visibleSvTypes[variant.type] === false) {
            return;
          }
          if (
            this.svMode === "matched" &&
            this.svMatchedIds.size > 0 &&
            !this.svMatchedIds.has(variant.id) &&
            !this.svMatchedIds.has(variant.mateId)
          ) {
            return;
          }
          const endpoints = [{ abs: variant.startAbs, side: "From" }];
          if (
            isFiniteNumber(variant.endAbs) &&
            Math.abs(variant.endAbs - variant.startAbs) > 1
          ) {
            endpoints.push({ abs: variant.endAbs, side: "To" });
          }
          endpoints.forEach((endpoint) => {
            if (isFiniteNumber(endpoint.abs) && endpoint.abs >= fromX && endpoint.abs <= toX) {
              this.currentSvMarkers.push({ variant, ...endpoint });
            }
          });
        });
      }
      this.previousFromX = fromX;
      this.previousToX = toX;
    }

    drawMaskedRegions() {
      if (!this.showMaskedRegions || !this.currentMaskedRegions.length) {
        return;
      }
      const { top, leftAxisX, rightAxisX, height } = this.metrics();
      const color = this.HGC.utils.colorToHex(MASKED_REGION_COLOR);

      this.currentMaskedRegions.forEach((region) => {
        if (!region || !isFiniteNumber(region.startAbs) || !isFiniteNumber(region.endAbs)) {
          return;
        }
        const rawXStart = this.plotX(region.startAbs);
        const rawXEnd = this.plotX(region.endAbs);
        if (!isFiniteNumber(rawXStart) || !isFiniteNumber(rawXEnd)) {
          return;
        }

        const xStart = Math.max(leftAxisX, rawXStart);
        const xEnd = Math.min(rightAxisX, rawXEnd);
        const width = xEnd - xStart;
        if (width <= 0) {
          return;
        }
        this.maskedRegionGraphics.beginFill(color, MASKED_REGION_ALPHA);
        safeDrawRect(this.maskedRegionGraphics, xStart, top, Math.max(1, width), height, "drawMaskedRegions:fill");
        this.maskedRegionGraphics.endFill();

        this.maskedRegionGraphics.lineStyle(1, this.HGC.utils.colorToHex(MASKED_REGION_BORDER_COLOR), MASKED_REGION_BORDER_ALPHA);
        safeDrawRect(this.maskedRegionGraphics, xStart, top, Math.max(1, width), height, "drawMaskedRegions:border");
      });
    }

    drawLohRegions() {
      if (!this.showLohRegions || !this.currentLohRegions.length) {
        return;
      }
      const { top, leftAxisX, rightAxisX, height } = this.metrics();
      const color = this.HGC.utils.colorToHex(LOH_REGION_COLOR);

      this.currentLohRegions.forEach((region) => {
        if (!region || !isFiniteNumber(region.startAbs) || !isFiniteNumber(region.endAbs)) {
          return;
        }
        const rawXStart = this.plotX(region.startAbs);
        const rawXEnd = this.plotX(region.endAbs);
        if (!isFiniteNumber(rawXStart) || !isFiniteNumber(rawXEnd)) {
          return;
        }

        const xStart = Math.max(leftAxisX, rawXStart);
        const xEnd = Math.min(rightAxisX, rawXEnd);
        const width = xEnd - xStart;
        if (width <= 0) {
          return;
        }
        this.lohRegionGraphics.beginFill(color, LOH_REGION_ALPHA);
        safeDrawRect(this.lohRegionGraphics, xStart, top, Math.max(1, width), height, "drawLohRegions:fill");
        this.lohRegionGraphics.endFill();

        this.lohRegionGraphics.lineStyle(1, this.HGC.utils.colorToHex(LOH_REGION_BORDER_COLOR), LOH_REGION_BORDER_ALPHA);
        safeDrawRect(this.lohRegionGraphics, xStart, top, Math.max(1, width), height, "drawLohRegions:border");
      });
    }

    drawSvBreakpoints() {
      this.svHitRegions = [];
      if (!this.showSvBreakpoints || !this.currentSvMarkers.length) {
        return;
      }
      const { top, leftAxisX, rightAxisX, height, centerY } = this.metrics();
      const markers = sampleRows(
        this.currentSvMarkers,
        this.options.maxSvBreakpointMarkers || 1600
      );

      markers.forEach((marker) => {
        try {
          if (!marker || !isFiniteNumber(marker.abs) || !marker.variant) {
            return;
          }
          const x = this.plotX(marker.abs);
          if (!isFiniteNumber(x) || x < leftAxisX || x > rightAxisX) {
            return;
          }
          const color = this.HGC.utils.colorToHex(
            SV_TYPE_COLORS[marker.variant.type] || SV_TYPE_COLORS.BND
          );
          this.svGraphics.lineStyle(1, color, SV_MARKER_ALPHA);

          const hp = marker.variant.hp;
          let lineTop, lineBottom;
          if (hp === "1") {
            lineTop = top;
            lineBottom = centerY;
          } else if (hp === "2") {
            lineTop = centerY;
            lineBottom = top + height;
          } else {
            lineTop = top;
            lineBottom = top + height;
          }

          if (!isFiniteNumber(lineTop) || !isFiniteNumber(lineBottom)) {
            return;
          }

          safeMoveTo(this.svGraphics, x, lineTop, "drawSvBreakpoints:moveTo");
          safeLineTo(this.svGraphics, x, lineBottom, "drawSvBreakpoints:lineTo");

          this.svHitRegions.push({
            marker,
            x,
            top: lineTop,
            bottom: lineBottom,
          });
        } catch (err) {
          logDevSkip(marker?.variant, "Exception drawing breakpoint marker", { error: err?.message });
        }
      });
    }

    drawCoveragePoints() {
      if (!this.showCoverage || !Array.isArray(this.currentCoverage)) {
        return;
      }
      const hp1Color = this.HGC.utils.colorToHex(HP1_POINT_COLOR);
      const hp2Color = this.HGC.utils.colorToHex(HP2_POINT_COLOR);
      const halfDotSize = COVERAGE_DOT_SIZE / 2;
      const { leftAxisX, rightAxisX } = this.metrics();
      const rawWidth = Math.max(1, this.dimensions ? this.dimensions[0] : 1);
      const plotWidth = rightAxisX - leftAxisX;
      if (!isFiniteNumber(plotWidth) || plotWidth <= 0) {
        return;
      }

      const visibleRows = sampleRows(
        this.currentCoverage,
        this.options.maxCoveragePoints || 6000
      );

      // HP1 Points
      this.coverageGraphics.beginFill(hp1Color, 0.58);
      visibleRows.forEach((row) => {
        try {
          if (!row || !isFiniteNumber(row.startAbs) || !isFiniteNumber(row.endAbs)) {
            return;
          }
          const rawX = this._xScale((row.startAbs + row.endAbs) / 2);
          if (!isFiniteNumber(rawX)) {
            return;
          }
          const x = leftAxisX + (rawX / rawWidth) * plotWidth;
          if (!isFiniteNumber(x) || x < leftAxisX || x > rightAxisX) {
            return;
          }
          const y = this.yCopyNumber(row.hp1CopyNumberEquivalent, 1);
          if (y === null || !isFiniteNumber(y)) {
            return;
          }
          safeDrawRect(
            this.coverageGraphics,
            x - halfDotSize,
            y - halfDotSize,
            COVERAGE_DOT_SIZE,
            COVERAGE_DOT_SIZE,
            "drawCoveragePoints:hp1"
          );
        } catch (err) {
          logDevSkip(row, "Exception drawing HP1 coverage point", { error: err?.message });
        }
      });
      this.coverageGraphics.endFill();

      // HP2 Points
      this.coverageGraphics.beginFill(hp2Color, 0.58);
      visibleRows.forEach((row) => {
        try {
          if (!row || !isFiniteNumber(row.startAbs) || !isFiniteNumber(row.endAbs)) {
            return;
          }
          const rawX = this._xScale((row.startAbs + row.endAbs) / 2);
          if (!isFiniteNumber(rawX)) {
            return;
          }
          const x = leftAxisX + (rawX / rawWidth) * plotWidth;
          if (!isFiniteNumber(x) || x < leftAxisX || x > rightAxisX) {
            return;
          }
          const y = this.yCopyNumber(row.hp2CopyNumberEquivalent, 2);
          if (y === null || !isFiniteNumber(y)) {
            return;
          }
          safeDrawRect(
            this.coverageGraphics,
            x - halfDotSize,
            y - halfDotSize,
            COVERAGE_DOT_SIZE,
            COVERAGE_DOT_SIZE,
            "drawCoveragePoints:hp2"
          );
        } catch (err) {
          logDevSkip(row, "Exception drawing HP2 coverage point", { error: err?.message });
        }
      });
      this.coverageGraphics.endFill();
    }

    drawCoverageSegments() {
      const hp1Color = this.HGC.utils.colorToHex(HP1_COLOR);
      const hp2Color = this.HGC.utils.colorToHex(HP2_COLOR);

      const drawSegment = (segment, hp, color) => {
        try {
          if (!segment || !isFiniteNumber(segment.startAbs) || !isFiniteNumber(segment.endAbs)) {
            return;
          }
          const { leftAxisX, rightAxisX } = this.metrics();
          const rawStartX = this.plotX(segment.startAbs);
          const rawEndX = this.plotX(segment.endAbs);
          if (!isFiniteNumber(rawStartX) || !isFiniteNumber(rawEndX)) {
            return;
          }

          const xStart = Math.max(leftAxisX, rawStartX);
          const xEnd = Math.min(rightAxisX, rawEndX);
          const width = xEnd - xStart;
          if (width <= 0 || !isFiniteNumber(width)) {
            return;
          }

          const yCopyNumber = this.yCopyNumber(segment.copyNumber, hp);
          if (yCopyNumber === null || !isFiniteNumber(yCopyNumber)) {
            return;
          }
          const y = yCopyNumber - 2;
          this.segmentGraphics.beginFill(color, 0.95);
          safeDrawRect(this.segmentGraphics, xStart, y, Math.max(1, width), 4, "drawCoverageSegments");
          this.segmentGraphics.endFill();
        } catch (err) {
          logDevSkip(segment, "Exception drawing coverage segment", { error: err?.message });
        }
      };

      if (this.showHp1 && Array.isArray(this.currentHp1Segments)) {
        this.currentHp1Segments.forEach((segment) => drawSegment(segment, 1, hp1Color));
      }
      if (this.showHp2 && Array.isArray(this.currentHp2Segments)) {
        this.currentHp2Segments.forEach((segment) => drawSegment(segment, 2, hp2Color));
      }
    }

    updateExistingGraphics() {
      this.loadingText.text = "";
      this.bgGraphics.clear();
      this.maskedRegionGraphics.clear();
      this.lohRegionGraphics.clear();
      this.svGraphics.clear();
      this.coverageGraphics.clear();
      this.segmentGraphics.clear();
      this.mouseOverGraphics.clear();

      if (!this.chromInfo) {
        this.loadingText.text = "Loading chromosome sizes...";
        return;
      }

      // Sub-step isolated rendering calls
      try {
        this.updateVisibleData();
      } catch (err) {
        logDevSkip(null, "Error updating visible data in coverage track", { error: err?.message });
      }

      try {
        this.drawChromosomeBackground();
      } catch (err) {
        logDevSkip(null, "Error drawing chromosome background in coverage track", { error: err?.message });
      }

      try {
        this.drawMaskedRegions();
      } catch (err) {
        logDevSkip(null, "Error drawing masked regions in coverage track", { error: err?.message });
      }

      try {
        this.drawLohRegions();
      } catch (err) {
        logDevSkip(null, "Error drawing LOH regions in coverage track", { error: err?.message });
      }

      try {
        this.drawAxes();
      } catch (err) {
        logDevSkip(null, "Error drawing axes in coverage track", { error: err?.message });
      }

      try {
        this.drawSvBreakpoints();
      } catch (err) {
        logDevSkip(null, "Error drawing SV breakpoints in coverage track", { error: err?.message });
      }

      try {
        this.drawCoveragePoints();
      } catch (err) {
        logDevSkip(null, "Error drawing coverage points in coverage track", { error: err?.message });
      }

      try {
        this.drawCoverageSegments();
      } catch (err) {
        logDevSkip(null, "Error drawing coverage segments in coverage track", { error: err?.message });
      }
    }

    getMouseOverHtml(trackX, trackY) {
      if (!isFiniteNumber(trackX) || !isFiniteNumber(trackY)) {
        return "";
      }
      this.mouseOverGraphics.clear();
      const { leftAxisX, rightAxisX } = this.metrics();
      if (trackX < leftAxisX || trackX > rightAxisX) {
        return "";
      }
      const absX = this.plotAbsFromX(trackX);
      if (!isFiniteNumber(absX)) {
        return "";
      }

      const coverageHit = (this.currentCoverage || []).find((row) => {
        if (!this.showCoverage || !row) {
          return false;
        }
        if (absX < row.startAbs || absX > row.endAbs) {
          return false;
        }
        const hp1Y = this.yCopyNumber(row.hp1CopyNumberEquivalent, 1);
        const hp2Y = this.yCopyNumber(row.hp2CopyNumberEquivalent, 2);
        return (
          (hp1Y !== null && isFiniteNumber(hp1Y) && Math.abs(trackY - hp1Y) <= 6) ||
          (hp2Y !== null && isFiniteNumber(hp2Y) && Math.abs(trackY - hp2Y) <= 6)
        );
      });

      if (coverageHit) {
        const hp1Y = this.yCopyNumber(coverageHit.hp1CopyNumberEquivalent, 1);
        const hp2Y = this.yCopyNumber(coverageHit.hp2CopyNumberEquivalent, 2);
        const hp = hp1Y !== null && isFiniteNumber(hp1Y) && (
          hp2Y === null || !isFiniteNumber(hp2Y) ||
          Math.abs(trackY - hp1Y) <= Math.abs(trackY - hp2Y)
        ) ? "HP-1" : "HP-2";
        const coverage = hp === "HP-1" ? coverageHit.hp1 : coverageHit.hp2;
        const segment = hp === "HP-1" ? coverageHit.hp1Segment : coverageHit.hp2Segment;
        const copyNumberValue =
          hp === "HP-1"
            ? coverageHit.hp1CopyNumberEquivalent
            : coverageHit.hp2CopyNumberEquivalent;
        return `<table style="margin-top:3px;border:1px solid #333333;">
          <tr><td style="font-weight:bold;">Position</td><td>${coverageHit.chr}: ${format(",")(coverageHit.start)} - ${format(",")(coverageHit.end)}</td></tr>
          <tr><td style="font-weight:bold;">Haplotype</td><td>${hp}</td></tr>
          <tr><td style="font-weight:bold;">Raw coverage</td><td>${formatCoverage(coverage)}</td></tr>
          <tr><td style="font-weight:bold;">Copy-number equivalent</td><td>${formatCopyNumber(copyNumberValue)}</td></tr>
          <tr><td style="font-weight:bold;">BED copy number</td><td>${formatCopyNumber(segment && segment.copyNumber)}</td></tr>
          <tr><td style="font-weight:bold;">BED segment coverage</td><td>${formatCoverage(segment && segment.coverage)}</td></tr>
        </table>`;
      }

      const svHit = (this.svHitRegions || [])
        .map((region) => {
          if (
            region &&
            region.marker &&
            region.marker.variant &&
            this.showSvBreakpoints &&
            this.visibleSvTypes[region.marker.variant.type] !== false &&
            Math.abs(trackX - region.x) <= 5 &&
            trackY >= region.top &&
            trackY <= region.bottom
          ) {
            return { region, distance: Math.abs(trackX - region.x) };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance)[0];

      if (svHit) {
        const { marker } = svHit.region;
        const variant = marker.variant;
        const endpointText = marker.side === "From"
          ? `${variant.chr}: ${format(",")(variant.pos)}`
          : `${variant.chr2 || variant.chr}: ${format(",")(variant.pos2 || variant.pos)}`;
        return `<table style="margin-top:3px;border:1px solid #333333;">
          <tr><td style="font-weight:bold;">SV ID</td><td>${escapeHtml(variant.id)}</td></tr>
          <tr><td style="font-weight:bold;">Type</td><td>${escapeHtml(variant.type)}</td></tr>
          <tr><td style="font-weight:bold;">Endpoint</td><td>${escapeHtml(marker.side)}</td></tr>
          <tr><td style="font-weight:bold;">Position</td><td>${escapeHtml(endpointText)}</td></tr>
          <tr><td style="font-weight:bold;">Length</td><td>${format(",")(variantLength(variant))}</td></tr>
          <tr><td style="font-weight:bold;">HP</td><td>${escapeHtml(variant.hp)}</td></tr>
          <tr><td style="font-weight:bold;">VAF</td><td>${escapeHtml(variant.vaf)}</td></tr>
          <tr><td style="font-weight:bold;">DV</td><td>${escapeHtml(variant.dv)}</td></tr>
        </table>`;
      }

      const visibleSegments = []
        .concat(this.showHp1 ? (this.currentHp1Segments || []).map((segment) => ({ ...segment, hp: "HP-1", hpIndex: 1 })) : [])
        .concat(this.showHp2 ? (this.currentHp2Segments || []).map((segment) => ({ ...segment, hp: "HP-2", hpIndex: 2 })) : []);
      const segmentHit = visibleSegments
        .find((segment) => {
          if (!segment || absX < segment.startAbs || absX > segment.endAbs) {
            return false;
          }
          const y = this.yCopyNumber(segment.copyNumber, segment.hpIndex);
          return y !== null && isFiniteNumber(y) && Math.abs(trackY - y) <= 7;
        });

      if (!segmentHit) {
        return "";
      }

      return `<table style="margin-top:3px;border:1px solid #333333;">
        <tr><td style="font-weight:bold;">Position</td><td>${segmentHit.chr}: ${format(",")(segmentHit.start)} - ${format(",")(segmentHit.end)}</td></tr>
        <tr><td style="font-weight:bold;">Haplotype</td><td>${segmentHit.hp}</td></tr>
        <tr><td style="font-weight:bold;">BED segment coverage</td><td>${formatCoverage(segmentHit.coverage)}</td></tr>
        <tr><td style="font-weight:bold;">BED copy number</td><td>${formatCopyNumber(segmentHit.copyNumber)}</td></tr>
        <tr><td style="font-weight:bold;">Confidence</td><td>${format(".3f")(segmentHit.confidence)}</td></tr>
      </table>`;
    }

    exportSVG() {
      const HGC = this.HGC;
      const renderer = HGC?.services?.pixiRenderer;
      const extractor = renderer ? createHighResBase64Extractor(HGC, 6) : null;

      if (extractor) {
        renderer.plugins.extract.base64 = extractor.highResBase64;
      }

      let result;
      try {
        result = super.exportSVG();
      } finally {
        if (extractor) {
          renderer.plugins.extract.base64 = extractor.originalBase64;
        }
      }

      try {
        if (result && result[0]) {
          const image = result[0].querySelector("image");
          if (image && this.pMain && this.pMain.parent && this.pMain.parent.parent) {
            const bounds = this.pMain.parent.parent.getBounds();
            if (bounds && bounds.width && bounds.height) {
              image.setAttribute("width", bounds.width);
              image.setAttribute("height", bounds.height);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to set SVG image dimensions:", err);
      }

      return result;
    }

    zoomed(newXScale, newYScale) {
      super.zoomed(newXScale, newYScale);
      this.updateExistingGraphics();
      this.animate();
    }
  }

  return new WakhanCoverageTrackClass(...args);
}

const icon = new DOMParser().parseFromString(
  '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="14" height="12" fill="#fff" stroke="#777"/><circle cx="5" cy="5" r="1.5" fill="#B23A48"/><circle cx="10" cy="11" r="1.5" fill="#2D7DD2"/><line x1="2" y1="8" x2="14" y2="8" stroke="#333"/></svg>',
  "text/xml"
).documentElement;

WakhanCoverageTrack.config = {
  type: "wakhanCoverage",
  datatype: ["wakhan"],
  orientation: "1d-horizontal",
  name: "WAKHAN HP1/HP2 coverage",
  thumbnail: icon,
  availableOptions: [
    "coverageMax",
    "chromSizesUrl",
    "data",
    "maxCoveragePoints",
    "maxSvBreakpointMarkers",
    "minVariantLength",
    "showHp1",
    "showHp2",
    "showCoverage",
    "showSvBreakpoints",
    "showMaskedRegions",
    "showLohRegions",
    "svData",
    "svMode",
    "visibleTypes",
  ],
  defaultOptions: {
    coverageMax: 180,
    data: {},
    maxCoveragePoints: 6000,
    maxSvBreakpointMarkers: 1600,
    minVariantLength: 50,
    showHp1: true,
    showHp2: true,
    showCoverage: true,
    showSvBreakpoints: true,
    showMaskedRegions: false,
    showLohRegions: true,
    svData: { variants: [], matchedIds: [] },
    svMode: DEFAULT_SV_MODE,
    visibleTypes: DEFAULT_VISIBLE_TYPES,
  },
  optionsInfo: {},
};

export default WakhanCoverageTrack;
