import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo, chrToAbs } from "smaht-higlass-misc/es/chrom-utils";
import { format } from "d3-format";

const HP1_COLOR = "#B23A48";
const HP1_POINT_COLOR = "#D95F65";
const HP2_COLOR = "#2D7DD2";
const HP2_POINT_COLOR = "#63A6D8";
const AXIS_COLOR = "#3f464d";
const GRID_COLOR = "#e5e8eb";
const CENTER_COLOR = "#222222";
const CHROM_BAND_COLOR = "#e7eaed";
const COVERAGE_DOT_SIZE = 1.6;
const COVERAGE_TICK_STEP = 30;
const SV_MARKER_ALPHA = 0.34;
const DEFAULT_SV_MODE = "matched";
const DEFAULT_VISIBLE_TYPES = {
  DEL: true,
  INV: true,
  INS: true,
  BND: true,
  DUP: true,
  sBND: true,
};
const SV_TYPE_COLORS = {
  DEL: "#F27A9A",
  INV: "#7C83FF",
  INS: "#D9CB3E",
  BND: "#8F969E",
  sBND: "#A9B7BA",
  DUP: "#74C69D",
};

function clampCoverage(value, coverageMax) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(value, coverageMax));
}

function sampleRows(rows, maxRows) {
  if (rows.length <= maxRows) {
    return rows;
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
  if (Number.isFinite(variant.svlen)) {
    return Math.abs(variant.svlen);
  }
  if (Number.isFinite(variant.startAbs) && Number.isFinite(variant.endAbs)) {
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

function clampCopyNumber(value, copyNumberMax) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(value, copyNumberMax));
}

function nextMultiple(value, step) {
  if (!Number.isFinite(value) || value <= 0) {
    return step;
  }
  return Math.ceil(value / step) * step;
}

function copyNumberEquivalent(rawCoverage, segment) {
  if (
    !segment ||
    !Number.isFinite(rawCoverage) ||
    !Number.isFinite(segment.coverage) ||
    !Number.isFinite(segment.copyNumber) ||
    segment.coverage <= 0
  ) {
    return null;
  }
  return (rawCoverage / segment.coverage) * segment.copyNumber;
}

function maxCoverageFromSegments(segments, fallback) {
  const maxCoverage = segments.reduce((maxValue, segment) => {
    if (!Number.isFinite(segment.coverage)) {
      return maxValue;
    }
    return Math.max(maxValue, segment.coverage);
  }, 0);
  return Math.max(fallback, nextMultiple(maxCoverage, COVERAGE_TICK_STEP));
}

function maxCopyNumberFromSegments(segments) {
  const maxCopyNumber = segments.reduce((maxValue, segment) => {
    if (!Number.isFinite(segment.copyNumber)) {
      return maxValue;
    }
    return Math.max(maxValue, segment.copyNumber);
  }, 0);
  return Math.max(1, Math.ceil(maxCopyNumber));
}

function groupSegmentsByChr(segments) {
  const grouped = {};
  segments.forEach((segment) => {
    if (!grouped[segment.chr]) {
      grouped[segment.chr] = [];
    }
    grouped[segment.chr].push(segment);
  });
  Object.keys(grouped).forEach((chr) => {
    grouped[chr].sort((a, b) => a.startAbs - b.startAbs);
  });
  return grouped;
}

function segmentForRow(row, segmentsByChr, pointersByChr) {
  const rows = segmentsByChr[row.chr];
  if (!rows || !rows.length) {
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
  for (let tick = 0; tick <= maxValue; tick += 1) {
    ticks.push(tick);
  }
  return ticks;
}

function coverageTicks(maxValue) {
  const ticks = [];
  for (let tick = 0; tick <= maxValue; tick += COVERAGE_TICK_STEP) {
    ticks.push(tick);
  }
  if (ticks[ticks.length - 1] !== maxValue) {
    ticks.push(maxValue);
  }
  return ticks;
}

function annotateCoverageRows(coverageRows, hp1Segments, hp2Segments) {
  const hp1ByChr = groupSegmentsByChr(hp1Segments);
  const hp2ByChr = groupSegmentsByChr(hp2Segments);
  const hp1Pointers = {};
  const hp2Pointers = {};

  coverageRows.forEach((row) => {
    const hp1Segment = segmentForRow(row, hp1ByChr, hp1Pointers);
    const hp2Segment = segmentForRow(row, hp2ByChr, hp2Pointers);
    row.hp1Segment = hp1Segment;
    row.hp2Segment = hp2Segment;
    row.hp1CopyNumberEquivalent = copyNumberEquivalent(row.hp1, hp1Segment);
    row.hp2CopyNumberEquivalent = copyNumberEquivalent(row.hp2, hp2Segment);
  });
}

function formatCopyNumber(value) {
  if (!Number.isFinite(value)) {
    return "-";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return format(".2f")(value);
}

function formatCoverage(value) {
  if (!Number.isFinite(value)) {
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
      this.currentCoverage = [];
      this.currentHp1Segments = [];
      this.currentHp2Segments = [];
      this.currentSvMarkers = [];
      this.svData = this.options.svData || { variants: [], matchedIds: [] };
      this.svVariants = [];
      this.svMatchedIds = new Set();
      this.svHitRegions = [];
      this.showHp1 = this.options.showHp1 !== false;
      this.showHp2 = this.options.showHp2 !== false;
      this.showCoverage = this.options.showCoverage !== false;
      this.showSvBreakpoints = this.options.showSvBreakpoints !== false;
      this.svMode = this.options.svMode || DEFAULT_SV_MODE;
      this.visibleSvTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...(this.options.visibleTypes || {}),
      };
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
      this.pMain.addChild(this.svGraphics);
      this.pMain.addChild(this.coverageGraphics);
      this.pMain.addChild(this.segmentGraphics);
      this.pMain.addChild(this.mouseOverGraphics);
      this.pForeground.addChild(this.axisGraphics);
      this.pForeground.addChild(this.labelContainer);
      this.pForeground.addChild(this.loadingText);
    }

    setData(data) {
      this.parseData(data);
      this.rerender(this.options);
    }

    setStructuralVariationData(data) {
      this.svData = data || { variants: [], matchedIds: [] };
      this.parseStructuralVariationData(this.svData);
      this.resetCache();
      this.updateExistingGraphics();
      this.animate();
    }

    setVisibilityOptions(options = {}) {
      if (options.showHp1 !== undefined) {
        this.showHp1 = options.showHp1 !== false;
      }
      if (options.showHp2 !== undefined) {
        this.showHp2 = options.showHp2 !== false;
      }
      if (options.showCoverage !== undefined) {
        this.showCoverage = options.showCoverage !== false;
      }
      if (options.showSvBreakpoints !== undefined) {
        this.showSvBreakpoints = options.showSvBreakpoints !== false;
      }
      if (options.svMode) {
        this.svMode = options.svMode;
      }
      if (options.visibleTypes) {
        this.visibleSvTypes = {
          ...this.visibleSvTypes,
          ...options.visibleTypes,
        };
      }
      if (options.maxVariantLength !== undefined) {
        this.maxVariantLength = options.maxVariantLength || null;
      }
      this.resetCache();
      this.updateExistingGraphics();
      this.animate();
    }

    parseData(data) {
      this.coverage = [];
      this.hp1Segments = [];
      this.hp2Segments = [];
      const hasCoveragePayload =
        data &&
        (Array.isArray(data.coverage) ||
          Array.isArray(data.hp1Segments) ||
          Array.isArray(data.hp2Segments));
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

      (data.coverage || []).forEach((row) => {
        if (!this.chromInfo.chrPositions[row.chr]) {
          return;
        }
        this.coverage.push({
          chr: row.chr,
          start: row.start,
          end: row.end,
          hp1: row.hp1,
          hp2: row.hp2,
          startAbs: chrToAbs(row.chr, row.start, this.chromInfo),
          endAbs: chrToAbs(row.chr, row.end, this.chromInfo),
        });
      });

      const parseSegments = (rows, key) =>
        (rows || [])
          .filter((row) => this.chromInfo.chrPositions[row.chr])
          .map((row) => ({
            chr: row.chr,
            start: row.start,
            end: row.end,
            coverage: row.coverage,
            copyNumber: row[key],
            confidence: row.confidence,
            startAbs: chrToAbs(row.chr, row.start, this.chromInfo),
            endAbs: chrToAbs(row.chr, row.end, this.chromInfo),
          }));

      this.hp1Segments = parseSegments(data.hp1Segments, "hp1");
      this.hp2Segments = parseSegments(data.hp2Segments, "hp2");
      this.coverageMax = maxCoverageFromSegments(
        this.hp1Segments.concat(this.hp2Segments),
        this.options.coverageMax || 180
      );
      this.copyNumberMax = maxCopyNumberFromSegments(
        this.hp1Segments.concat(this.hp2Segments)
      );
      annotateCoverageRows(this.coverage, this.hp1Segments, this.hp2Segments);
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
        .filter((variant) => this.chromInfo.chrPositions[variant.chr])
        .map((variant) => {
          const startAbs = Number.isFinite(variant.startAbs)
            ? variant.startAbs
            : chrToAbs(variant.chr, variant.pos, this.chromInfo);
          let endAbs = startAbs;
          if (Number.isFinite(variant.endAbs)) {
            endAbs = variant.endAbs;
          } else if (variant.chr2 && this.chromInfo.chrPositions[variant.chr2]) {
            endAbs = chrToAbs(variant.chr2, variant.pos2 || variant.pos, this.chromInfo);
          } else if (Number.isFinite(variant.pos2)) {
            endAbs = chrToAbs(variant.chr, variant.pos2, this.chromInfo);
          }
          return {
            ...variant,
            startAbs,
            endAbs,
          };
        })
        .filter((variant) => Number.isFinite(variant.startAbs));
    }

    rerender(options) {
      super.rerender(options);
      this.options = options;
      this.showHp1 = this.showHp1 === undefined ? this.options.showHp1 !== false : this.showHp1;
      this.showHp2 = this.showHp2 === undefined ? this.options.showHp2 !== false : this.showHp2;
      this.showCoverage = this.showCoverage === undefined ? this.options.showCoverage !== false : this.showCoverage;
      this.showSvBreakpoints = this.showSvBreakpoints === undefined ? this.options.showSvBreakpoints !== false : this.showSvBreakpoints;
      this.svMode = this.svMode || this.options.svMode || DEFAULT_SV_MODE;
      this.visibleSvTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...this.visibleSvTypes,
        ...(this.options.visibleTypes || {}),
      };
      if (this.options.data && !this.coverage.length) {
        this.parseData(this.options.data);
      }
      if (this.svData && !this.svVariants.length) {
        this.parseStructuralVariationData(this.svData);
      }
      this.updateExistingGraphics();
    }

    resetCache() {
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
    }

    metrics() {
      const top = 0;
      const bottom = 0;
      const leftAxisX = 72;
      const rightAxisX = this.dimensions[0] - 78;
      const height = Math.max(1, this.dimensions[1] - top - bottom);
      const centerY = top + height / 2;
      const halfHeight = height / 2 - 1;
      return { top, bottom, leftAxisX, rightAxisX, height, centerY, halfHeight };
    }

    yCoverage(value, hp) {
      const { centerY, halfHeight } = this.metrics();
      const scaled = (clampCoverage(value, this.coverageMax) / this.coverageMax) * halfHeight;
      return hp === 1 ? centerY - scaled : centerY + scaled;
    }

    yCopyNumber(value, hp) {
      const clampedValue = clampCopyNumber(value, this.copyNumberMax);
      if (clampedValue === null) {
        return null;
      }
      const { centerY, halfHeight } = this.metrics();
      const scaled = (clampedValue / this.copyNumberMax) * halfHeight;
      return hp === 1 ? centerY - scaled : centerY + scaled;
    }

    plotX(absPosition) {
      const { leftAxisX, rightAxisX } = this.metrics();
      const rawX = this._xScale(absPosition);
      const rawWidth = Math.max(1, this.dimensions[0]);
      return leftAxisX + (rawX / rawWidth) * (rightAxisX - leftAxisX);
    }

    plotAbsFromX(trackX) {
      const { leftAxisX, rightAxisX } = this.metrics();
      const plotWidth = Math.max(1, rightAxisX - leftAxisX);
      const rawX = ((trackX - leftAxisX) / plotWidth) * this.dimensions[0];
      return this._xScale.invert(rawX);
    }

    addText(text, x, y, options = {}) {
      const label = new this.HGC.libraries.PIXI.Text(text, {
        fontSize: options.fontSize || "11px",
        fontFamily: "Arial",
        fill: options.fill || AXIS_COLOR,
      });
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
      const { top, leftAxisX, rightAxisX, centerY, halfHeight } = this.metrics();
      const bottomY = top + this.metrics().height;
      const width = this.dimensions[0];
      this.axisGraphics.clear();
      this.labelContainer.removeChildren();

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(GRID_COLOR), 1);
      coverageTicks(this.coverageMax).forEach((tick) => {
        const halves = tick === 0 ? [1] : [1, 2];
        halves.forEach((hp) => {
          const y = tick === 0 ? centerY : this.yCoverage(tick, hp);
          this.axisGraphics.moveTo(leftAxisX, y);
          this.axisGraphics.lineTo(rightAxisX, y);
          this.addText(String(tick), leftAxisX - 8, y, { anchorX: 1 });
        });
      });

      this.axisGraphics.lineStyle(2, this.HGC.utils.colorToHex(CENTER_COLOR), 1);
      this.axisGraphics.moveTo(leftAxisX, centerY);
      this.axisGraphics.lineTo(rightAxisX, centerY);

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
      this.axisGraphics.moveTo(leftAxisX, top);
      this.axisGraphics.lineTo(leftAxisX, bottomY);
      this.axisGraphics.moveTo(rightAxisX, top);
      this.axisGraphics.lineTo(rightAxisX, bottomY);

      this.addText("Coverage depth", 20, centerY, {
        rotation: -Math.PI / 2,
        fontSize: "12px",
      });
      this.addText("Copy number", width - 18, centerY, {
        rotation: Math.PI / 2,
        fontSize: "12px",
      });
      if (this.showHp1) {
        this.addText("HP-1", rightAxisX + 26, top + 12, {
          anchorX: 0,
          fill: HP1_COLOR,
          fontSize: "12px",
        });
      }
      if (this.showHp2) {
        this.addText("HP-2", rightAxisX + 26, bottomY - 12, {
          anchorX: 0,
          fill: HP2_COLOR,
          fontSize: "12px",
        });
      }

      const drawCopyTicks = (hp) => {
        integerTicks(this.copyNumberMax).forEach((tick) => {
          const y = this.yCopyNumber(tick, hp);
          if (y === null) {
            return;
          }
          this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
          this.axisGraphics.moveTo(rightAxisX - 4, y);
          this.axisGraphics.lineTo(rightAxisX + 4, y);
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

      const bandColor = this.HGC.utils.colorToHex(CHROM_BAND_COLOR);
      this.chromInfo.cumPositions.forEach((chromosome, index) => {
        if (index % 2 !== 0) {
          return;
        }

        const chrLength = Number(this.chromInfo.chromLengths[chromosome.chr]);
        if (!Number.isFinite(chrLength)) {
          return;
        }

        const startX = Math.max(leftAxisX, this.plotX(chromosome.pos));
        const endX = Math.min(rightAxisX, this.plotX(chromosome.pos + chrLength));
        if (endX <= leftAxisX || startX >= rightAxisX || endX <= startX) {
          return;
        }

        this.bgGraphics.beginFill(bandColor, 0.85);
        this.bgGraphics.drawRect(startX, top, endX - startX, height);
      });
    }

    updateVisibleData() {
      const fromX = this._xScale.invert(0);
      const toX = this._xScale.invert(this.dimensions[0]);
      const refreshStep = 0.02;
      if (
        Math.abs((this.previousFromX - fromX) / (this.previousToX - this.previousFromX)) <= refreshStep &&
        Math.abs((this.previousToX - toX) / (this.previousToX - this.previousFromX)) <= refreshStep
      ) {
        return;
      }

      this.currentCoverage = this.coverage.filter(
        (row) => row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentHp1Segments = this.hp1Segments.filter(
        (row) => row.endAbs >= fromX && row.startAbs <= toX
      );
      this.currentHp2Segments = this.hp2Segments.filter(
        (row) => row.endAbs >= fromX && row.startAbs <= toX
      );
      const minLength = this.options.minVariantLength === undefined ? 50 : this.options.minVariantLength;
      const maxLength = this.maxVariantLength;
      this.currentSvMarkers = [];
      if (this.showSvBreakpoints) {
        this.svVariants.forEach((variant) => {
          if (variantLength(variant) < minLength) {
            return;
          }
          if (maxLength && variant.chr === variant.chr2 && variantLength(variant) > maxLength) {
            return;
          }
          if (maxLength && variant.chr2 && variant.chr !== variant.chr2) {
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
            Number.isFinite(variant.endAbs) &&
            Math.abs(variant.endAbs - variant.startAbs) > 1
          ) {
            endpoints.push({ abs: variant.endAbs, side: "To" });
          }
          endpoints.forEach((endpoint) => {
            if (endpoint.abs >= fromX && endpoint.abs <= toX) {
              this.currentSvMarkers.push({ variant, ...endpoint });
            }
          });
        });
      }
      this.previousFromX = fromX;
      this.previousToX = toX;
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
        const x = this.plotX(marker.abs);
        if (x < leftAxisX || x > rightAxisX) {
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

        this.svGraphics.moveTo(x, lineTop);
        this.svGraphics.lineTo(x, lineBottom);
        this.svHitRegions.push({
          marker,
          x,
          top: lineTop,
          bottom: lineBottom,
        });
      });
    }

    drawCoveragePoints() {
      if (!this.showCoverage) {
        return;
      }
      const hp1Color = this.HGC.utils.colorToHex(HP1_POINT_COLOR);
      const hp2Color = this.HGC.utils.colorToHex(HP2_POINT_COLOR);
      const halfDotSize = COVERAGE_DOT_SIZE / 2;
      const { leftAxisX, rightAxisX } = this.metrics();
      const rawWidth = Math.max(1, this.dimensions[0]);
      const plotWidth = rightAxisX - leftAxisX;
      const visibleRows = sampleRows(
        this.currentCoverage,
        this.options.maxCoveragePoints || 6000
      );

      this.coverageGraphics.beginFill(hp1Color, 0.58);
      visibleRows.forEach((row) => {
        const rawX = this._xScale((row.startAbs + row.endAbs) / 2);
        const x = leftAxisX + (rawX / rawWidth) * plotWidth;
        if (x < leftAxisX || x > rightAxisX) {
          return;
        }
        const y = this.yCopyNumber(row.hp1CopyNumberEquivalent, 1);
        if (y === null) {
          return;
        }
        this.coverageGraphics.drawRect(
          x - halfDotSize,
          y - halfDotSize,
          COVERAGE_DOT_SIZE,
          COVERAGE_DOT_SIZE
        );
      });

      this.coverageGraphics.beginFill(hp2Color, 0.58);
      visibleRows.forEach((row) => {
        const rawX = this._xScale((row.startAbs + row.endAbs) / 2);
        const x = leftAxisX + (rawX / rawWidth) * plotWidth;
        if (x < leftAxisX || x > rightAxisX) {
          return;
        }
        const y = this.yCopyNumber(row.hp2CopyNumberEquivalent, 2);
        if (y === null) {
          return;
        }
        this.coverageGraphics.drawRect(
          x - halfDotSize,
          y - halfDotSize,
          COVERAGE_DOT_SIZE,
          COVERAGE_DOT_SIZE
        );
      });
    }

    drawCoverageSegments() {
      const hp1Color = this.HGC.utils.colorToHex(HP1_COLOR);
      const hp2Color = this.HGC.utils.colorToHex(HP2_COLOR);
      const drawSegment = (segment, hp, color) => {
        const { leftAxisX, rightAxisX } = this.metrics();
        const xStart = Math.max(leftAxisX, this.plotX(segment.startAbs));
        const xEnd = Math.min(rightAxisX, this.plotX(segment.endAbs));
        const width = xEnd - xStart;
        if (width <= 0) {
          return;
        }
        const yCopyNumber = this.yCopyNumber(segment.copyNumber, hp);
        if (yCopyNumber === null) {
          return;
        }
        const y = yCopyNumber - 2;
        this.segmentGraphics.beginFill(color, 0.95);
        this.segmentGraphics.drawRect(xStart, y, Math.max(1, width), 4);
      };
      if (this.showHp1) {
        this.currentHp1Segments.forEach((segment) => drawSegment(segment, 1, hp1Color));
      }
      if (this.showHp2) {
        this.currentHp2Segments.forEach((segment) => drawSegment(segment, 2, hp2Color));
      }
    }

    updateExistingGraphics() {
      this.loadingText.text = "";
      this.bgGraphics.clear();
      this.svGraphics.clear();
      this.coverageGraphics.clear();
      this.segmentGraphics.clear();
      this.mouseOverGraphics.clear();

      if (!this.chromInfo) {
        this.loadingText.text = "Loading chromosome sizes...";
        return;
      }

      this.updateVisibleData();
      this.drawChromosomeBackground();
      this.drawAxes();
      this.drawSvBreakpoints();
      this.drawCoveragePoints();
      this.drawCoverageSegments();
    }

    getMouseOverHtml(trackX, trackY) {
      this.mouseOverGraphics.clear();
      const { leftAxisX, rightAxisX } = this.metrics();
      if (trackX < leftAxisX || trackX > rightAxisX) {
        return "";
      }
      const absX = this.plotAbsFromX(trackX);
      const coverageHit = this.currentCoverage.find((row) => {
        if (!this.showCoverage) {
          return false;
        }
        if (absX < row.startAbs || absX > row.endAbs) {
          return false;
        }
        const hp1Y = this.yCopyNumber(row.hp1CopyNumberEquivalent, 1);
        const hp2Y = this.yCopyNumber(row.hp2CopyNumberEquivalent, 2);
        return (
          (hp1Y !== null && Math.abs(trackY - hp1Y) <= 6) ||
          (hp2Y !== null && Math.abs(trackY - hp2Y) <= 6)
        );
      });

      if (coverageHit) {
        const hp1Y = this.yCopyNumber(coverageHit.hp1CopyNumberEquivalent, 1);
        const hp2Y = this.yCopyNumber(coverageHit.hp2CopyNumberEquivalent, 2);
        const hp = hp1Y !== null && (
          hp2Y === null ||
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

      const svHit = this.svHitRegions
        .map((region) => {
          if (Math.abs(trackX - region.x) <= 5 && trackY >= region.top && trackY <= region.bottom) {
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
        .concat(this.showHp1 ? this.currentHp1Segments.map((segment) => ({ ...segment, hp: "HP-1", hpIndex: 1 })) : [])
        .concat(this.showHp2 ? this.currentHp2Segments.map((segment) => ({ ...segment, hp: "HP-2", hpIndex: 2 })) : []);
      const segmentHit = visibleSegments
        .find((segment) => {
          if (absX < segment.startAbs || absX > segment.endAbs) {
            return false;
          }
          const y = this.yCopyNumber(segment.copyNumber, segment.hpIndex);
          return y !== null && Math.abs(trackY - y) <= 7;
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
    svData: { variants: [], matchedIds: [] },
    svMode: DEFAULT_SV_MODE,
    visibleTypes: DEFAULT_VISIBLE_TYPES,
  },
  optionsInfo: {},
};

export default WakhanCoverageTrack;
