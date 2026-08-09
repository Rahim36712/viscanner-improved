import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo, chrToAbs } from "smaht-higlass-misc/es/chrom-utils";
import { format } from "d3-format";
import { getPlotBounds, mapTrackX, getGlobalMasterChromBounds } from "./plotBounds";
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

const TYPE_COLORS = SV_CONFIG.TYPE_COLORS;

const AXIS_COLOR = "#3f464d";
const GRID_COLOR = "#e5e8eb";
const CHROM_BAND_COLOR = "#e7eaed";
const ARC_ALPHA = SV_CONFIG.ARC_ALPHA;
const MARKER_ALPHA = SV_CONFIG.MARKER_ALPHA;
const DEFAULT_VISIBLE_TYPES = {
  DEL: true,
  INV: true,
  INS: true,
  BND: true,
  DUP: true,
  sBND: true,
};
const DEFAULT_SV_MODE = "matched";

export function normalizeHpFilter(value) {
  return value === "1" || value === "2" ? value : null;
}

export function normalizeTrackData(data) {
  if (Array.isArray(data)) {
    return { variants: data, matchedIds: [] };
  }
  return {
    variants: (data && data.variants) || [],
    matchedIds: (data && data.matchedIds) || [],
  };
}

export function variantLength(variant) {
  if (isFiniteNumber(variant?.svlen)) {
    return Math.abs(variant.svlen);
  }
  if (isFiniteNumber(variant?.startAbs) && isFiniteNumber(variant?.endAbs)) {
    return Math.abs(variant.endAbs - variant.startAbs);
  }
  return 0;
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

export function escapeHtml(value) {
  return String(value === undefined || value === null ? "-" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function WakhanStructuralVariationTrack(HGC, ...args) {
  class WakhanStructuralVariationTrackClass extends BaseTrack(HGC, ...args) {
    constructor(context, options) {
      super(context, options);
      this.HGC = HGC;
      this.rawData = this.options.data || [];
      this.matchedIds = new Set();
      this.variants = [];
      this.currentVariants = [];
      this.hitRegions = [];
      this.svMode = this.options.svMode || DEFAULT_SV_MODE;
      this.showTrack = this.options.showTrack !== false;
      this.hpLaneMode = this.options.hpLaneMode === true;
      this.hpFilter = normalizeHpFilter(this.options.hpFilter);
      this.visibleTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...(this.options.visibleTypes || {}),
      };
      this.options.visibleTypes = { ...this.visibleTypes };
      this.maxVariantLength = this.options.maxVariantLength || null;
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
      this.chromSizes = {};
      this.hp1Count = 0;
      this.hp2Count = 0;
      this.unphasedCount = 0;
      this.isOnlyUnphased = false;

      this.initTrack();

      if (options.chromSizesUrl) {
        this.chromSizes[options.chromSizesUrl] =
          this.chromSizes[options.chromSizesUrl] ||
          new Promise((resolve) => {
            ChromosomeInfo(options.chromSizesUrl, resolve);
          });

        this.chromSizes[options.chromSizesUrl].then((chromInfo) => {
          this.chromInfo = chromInfo;
          this.parseData(this.rawData);
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
      this.variantGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.axisGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.labelContainer = new this.HGC.libraries.PIXI.Container();
      this.loadingText = new this.HGC.libraries.PIXI.Text("Loading...", {
        fontSize: "12px",
        fontFamily: "Arial",
        fill: "grey",
      });
      this.loadingText.x = 70;
      this.loadingText.y = 0;

      this.pMain.addChild(this.bgGraphics);
      this.pMain.addChild(this.variantGraphics);
      this.pForeground.addChild(this.axisGraphics);
      this.pForeground.addChild(this.labelContainer);
      this.pForeground.addChild(this.loadingText);
    }

    setData(data) {
      this.options.data = data;
      this.rawData = data || [];
      this.parseData(this.rawData);
      this.rerender(this.options);
      this.animate();
    }

    setVisibilityOptions(options = {}) {
      if (options.visibleTypes) {
        this.visibleTypes = {
          ...this.visibleTypes,
          ...options.visibleTypes,
        };
        this.options.visibleTypes = {
          ...(this.options.visibleTypes || {}),
          ...this.visibleTypes,
        };
      }
      if (options.svMode) {
        this.svMode = options.svMode;
        this.options.svMode = options.svMode;
      }
      if (options.showTrack !== undefined) {
        this.showTrack = options.showTrack !== false;
        this.options.showTrack = this.showTrack;
      }
      if (options.hpFilter !== undefined) {
        this.hpFilter = normalizeHpFilter(options.hpFilter);
        this.options.hpFilter = this.hpFilter;
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
      const normalizedData = normalizeTrackData(data);
      this.variants = [];
      this.matchedIds = new Set(normalizedData.matchedIds || []);
      if (!this.chromInfo || !Array.isArray(normalizedData.variants)) {
        return;
      }

      this.variants = normalizedData.variants
        .filter((variant) => variant && this.chromInfo.chrPositions[variant.chr])
        .map((variant) => {
          const startAbs = chrToAbs(variant.chr, variant.pos, this.chromInfo);
          let endAbs = startAbs;
          if (variant.chr2 && this.chromInfo.chrPositions[variant.chr2]) {
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

      let hp1Count = 0;
      let hp2Count = 0;
      let unphasedCount = 0;
      this.variants.forEach((v) => {
        if (v.hp === "1") {
          hp1Count++;
        } else if (v.hp === "2") {
          hp2Count++;
        } else {
          unphasedCount++;
        }
      });
      this.hp1Count = hp1Count;
      this.hp2Count = hp2Count;
      this.unphasedCount = unphasedCount;
      this.isOnlyUnphased = hp1Count === 0 && hp2Count === 0 && unphasedCount > 0;

      this.resetCache();
    }

    setDimensions(newDimensions) {
      super.setDimensions(newDimensions);
      this.updateExistingGraphics();
    }

    resetCache() {
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
    }

    rerender(options) {
      super.rerender(options);
      const currentActiveTypes = this.visibleTypes ? { ...this.visibleTypes } : null;
      this.options = options || this.options || {};
      this.svMode = this.svMode || this.options.svMode || DEFAULT_SV_MODE;
      this.showTrack = this.showTrack === undefined ? this.options.showTrack !== false : this.showTrack;
      this.hpLaneMode = this.options.hpLaneMode === true;
      this.hpFilter =
        this.hpFilter === undefined ? normalizeHpFilter(this.options.hpFilter) : this.hpFilter;
      this.visibleTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...(this.options.visibleTypes || {}),
        ...(currentActiveTypes || {}),
      };
      this.options.visibleTypes = { ...this.visibleTypes };
      if (this.rawData && !this.variants.length) {
        this.parseData(this.rawData);
      }
      this.updateExistingGraphics();
    }

    metrics() {
      const top = this.hpLaneMode ? 4 : 0;
      const bottom = this.hpLaneMode ? 4 : 0;
      const { left: leftAxisX, right: rightAxisX } = getPlotBounds(this);
      const rawHeight = (this.dimensions && this.dimensions[1]) ? this.dimensions[1] - top - bottom : 100;
      const height = Math.max(1, isFiniteNumber(rawHeight) ? rawHeight : 100);
      const baselineY = this.hpFilter === "2" && !this.hpLaneMode
        ? top + 2
        : top + height - 2;
      const centerY = top + height / 2;
      return { top, bottom, leftAxisX, rightAxisX, height, baselineY, centerY };
    }

    /**
     * Maps an absolute genomic position to track X coordinates.
     * UNCHANGED per engineering requirement #1.
     */
    plotX(absPosition) {
      const { leftAxisX, rightAxisX } = this.metrics();
      return mapTrackX(this, absPosition);
    }

    addText(text, x, y, options = {}) {
      if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
        return;
      }
      const label = new this.HGC.libraries.PIXI.Text(text, {
        fontSize: options.fontSize || "11px",
        fontFamily: "Arial",
        fill: options.fill || AXIS_COLOR,
        fontWeight: options.fontWeight || "normal",
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

    drawAxes() {
      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();
      this.axisGraphics.clear();
      this.labelContainer.removeChildren();

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(GRID_COLOR), 0);
      if (this.hpLaneMode) {
        safeMoveTo(this.axisGraphics, leftAxisX, centerY, "drawAxes:gridMove");
        safeLineTo(this.axisGraphics, rightAxisX, centerY, "drawAxes:gridLine");
      } else {
        safeMoveTo(this.axisGraphics, leftAxisX, baselineY, "drawAxes:gridMove");
        safeLineTo(this.axisGraphics, rightAxisX, baselineY, "drawAxes:gridLine");
      }

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
      safeMoveTo(this.axisGraphics, leftAxisX, top, "drawAxes:leftMove");
      safeLineTo(this.axisGraphics, leftAxisX, top + height, "drawAxes:leftLine");
      safeMoveTo(this.axisGraphics, rightAxisX, top, "drawAxes:rightMove");
      safeLineTo(this.axisGraphics, rightAxisX, top + height, "drawAxes:rightLine");

      let axisLabel;
      if (this.isOnlyUnphased && this.hpFilter === "1") {
        axisLabel = LABELS.tracks.unphasedBreakpoints;
      } else if (this.hpFilter === "1") {
        axisLabel = LABELS.tracks.hp1Breakpoints;
      } else if (this.hpFilter === "2") {
        axisLabel = LABELS.tracks.hp2Breakpoints;
      } else if (this.hpFilter) {
        axisLabel = `HP-${this.hpFilter} breakpoints`;
      } else if (this.hpLaneMode) {
        axisLabel = LABELS.tracks.hpSvs;
      } else {
        axisLabel = LABELS.tracks.unphasedBreakpoints;
      }

      this.addText(axisLabel, 20, top + height / 2, {
        rotation: -Math.PI / 2,
        fontSize: "12px",
      });
      if (this.hpLaneMode) {
        if (!this.hpFilter || this.hpFilter === "1") {
          this.addText(LABELS.tracks.hp1Label, rightAxisX + 10, top + 15, {
            anchorX: 0,
            fill: TYPE_COLORS.DEL,
            fontSize: "12px",
          });
        }
        if (!this.hpFilter || this.hpFilter === "2") {
          this.addText(LABELS.tracks.hp2Label, rightAxisX + 10, top + height - 15, {
            anchorX: 0,
            fill: "#2D7DD2",
            fontSize: "12px",
          });
        }
      }
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

      const span = Math.abs(this.previousToX - this.previousFromX);
      const refreshStep = 0.02;
      if (
        isFiniteNumber(span) &&
        span > 0 &&
        Math.abs((this.previousFromX - fromX) / span) <= refreshStep &&
        Math.abs((this.previousToX - toX) / span) <= refreshStep
      ) {
        return;
      }

      const minLength = this.options.minVariantLength === undefined ? 50 : this.options.minVariantLength;
      const passOnly = this.options.passOnly !== false;
      const endpointPadding = Math.max(5000, Math.abs(toX - fromX) * 0.2);
      this.currentVariants = this.variants.filter((variant) => {
        if (!isValidVariant(variant)) {
          return false;
        }
        if (this.isOnlyUnphased) {
          if (this.hpFilter === "1") {
            // Track 1 renders all unphased variants (hp !== "1" and hp !== "2")
            if (variant.hp === "1" || variant.hp === "2") {
              return false;
            }
          } else if (this.hpFilter === "2") {
            // Track 2 renders no variants for unphased datasets
            return false;
          }
        } else {
          if (this.hpFilter && variant.hp !== this.hpFilter) {
            return false;
          }
          if (this.hpLaneMode && variant.hp !== "1" && variant.hp !== "2") {
            return false;
          }
        }
        if (passOnly && variant.filter !== "PASS") {
          return false;
        }
        if (variantLength(variant) < minLength) {
          return false;
        }
        const maxLength = this.maxVariantLength;
        if (maxLength && variant.chr === variant.chr2 && variantLength(variant) < maxLength) {
          return false;
        }
        if (this.visibleTypes[variant.type] === false) {
          return false;
        }
        if (
          this.svMode === "matched" &&
          this.matchedIds.size > 0 &&
          !this.matchedIds.has(variant.id) &&
          !this.matchedIds.has(variant.mateId)
        ) {
          return false;
        }

        // Viewport culling: skip if completely outside visible genomic range
        return (
          (variant.startAbs >= fromX - endpointPadding && variant.startAbs <= toX + endpointPadding) ||
          (variant.endAbs >= fromX - endpointPadding && variant.endAbs <= toX + endpointPadding)
        );
      });
      this.previousFromX = fromX;
      this.previousToX = toX;
    }

    drawArc(variant, color) {
      if (!isValidVariant(variant) || !isFiniteNumber(variant.startAbs) || !isFiniteNumber(variant.endAbs)) {
        logDevSkip(variant, "Invalid variant coordinates in drawArc");
        return;
      }

      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();

      // Immediately validate plotX returned values
      const rawX1 = this.plotX(variant.startAbs);
      if (!isFiniteNumber(rawX1)) {
        logDevSkip(variant, "plotX(startAbs) returned non-finite value", { rawX1 });
        return;
      }
      const x1 = Math.max(leftAxisX, Math.min(rightAxisX, rawX1));
      if (!isFiniteNumber(x1)) {
        logDevSkip(variant, "Bounded x1 is non-finite", { x1, rawX1, leftAxisX, rightAxisX });
        return;
      }

      const rawX2 = this.plotX(variant.endAbs);
      if (!isFiniteNumber(rawX2)) {
        logDevSkip(variant, "plotX(endAbs) returned non-finite value", { rawX2 });
        return;
      }
      const x2 = Math.max(leftAxisX, Math.min(rightAxisX, rawX2));
      if (!isFiniteNumber(x2)) {
        logDevSkip(variant, "Bounded x2 is non-finite", { x2, rawX2, leftAxisX, rightAxisX });
        return;
      }

      if (Math.abs(x2 - x1) < 1) {
        return this.drawMarker(variant, color);
      }

      const span = Math.abs(x2 - x1);
      const plotWidth = Math.max(1, rightAxisX - leftAxisX);
      let startY = baselineY;
      let endY = baselineY;
      let apexY;
      const multiplier = this.options.arcHeightMultiplier !== undefined ? Number(this.options.arcHeightMultiplier) : 1.0;

      if (this.hpLaneMode) {
        const laneHeight = Math.max(18, height / 2 - 6);
        const laneLift = (8 + Math.sqrt(Math.min(1, span / plotWidth)) * (laneHeight - 6)) * multiplier;
        if (variant.hp === "1") {
          startY = centerY - 4;
          endY = centerY - 4;
          const targetY = Math.max(top + 2, startY - Math.min(laneHeight - 2, laneLift));
          apexY = 2 * targetY - startY;
        } else {
          startY = centerY + 4;
          endY = centerY + 4;
          const targetY = Math.min(top + height - 2, startY + Math.min(laneHeight - 2, laneLift));
          apexY = 2 * targetY - startY;
        }
      } else {
        const arcLift = (10 + Math.sqrt(Math.min(1, span / plotWidth)) * (height - 14)) * multiplier;
        if (this.hpFilter === "2") {
          const targetY = Math.min(top + height - 2, baselineY + Math.min(height - 4, arcLift));
          apexY = 2 * targetY - baselineY;
        } else {
          const targetY = Math.max(top + 2, baselineY - Math.min(height - 4, arcLift));
          apexY = 2 * targetY - baselineY;
        }
      }

      // Immediately validate controlX and apexY
      const controlX = (x1 + x2) / 2;
      if (!isFiniteNumber(controlX)) {
        logDevSkip(variant, "controlX calculation produced non-finite value", { x1, x2, controlX });
        return;
      }
      if (!isFiniteNumber(apexY) || !isFiniteNumber(startY) || !isFiniteNumber(endY)) {
        logDevSkip(variant, "Y positions produced non-finite values", { startY, endY, apexY });
        return;
      }

      const steps = span > 280 ? 30 : 22;
      this.variantGraphics.lineStyle(SV_CONFIG.ARC_LINE_WIDTH, color, ARC_ALPHA);

      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const inverse = 1 - t;
        const x = inverse * inverse * x1 + 2 * inverse * t * controlX + t * t * x2;
        const y = inverse * inverse * startY + 2 * inverse * t * apexY + t * t * endY;

        if (!isFiniteNumber(x) || !isFiniteNumber(y)) {
          logDevSkip(variant, "Bezier point coordinate is non-finite", { i, t, x, y, x1, x2, controlX, startY, endY, apexY });
          return;
        }

        if (i === 0) {
          safeMoveTo(this.variantGraphics, x, y, "drawArc:moveTo");
        } else {
          safeLineTo(this.variantGraphics, x, y, "drawArc:lineTo");
        }
      }

      this.hitRegions.push({
        variant,
        kind: "arc",
        x1,
        x2,
        controlX,
        apexY,
        baselineY: startY,
      });
    }

    drawMarker(variant, color) {
      if (!isValidVariant(variant) || !isFiniteNumber(variant.startAbs)) {
        logDevSkip(variant, "Invalid variant coordinates in drawMarker");
        return;
      }

      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();

      // Immediately validate plotX returned values
      const rawX = this.plotX(variant.startAbs);
      if (!isFiniteNumber(rawX)) {
        logDevSkip(variant, "plotX(startAbs) returned non-finite value", { rawX });
        return;
      }
      const x = Math.max(leftAxisX, Math.min(rightAxisX, rawX));
      if (!isFiniteNumber(x)) {
        logDevSkip(variant, "Bounded x is non-finite", { x, rawX });
        return;
      }

      let x2 = x;
      if (isFiniteNumber(variant.endAbs)) {
        const rawX2 = this.plotX(variant.endAbs);
        if (isFiniteNumber(rawX2)) {
          x2 = Math.max(leftAxisX, Math.min(rightAxisX, rawX2));
        }
      }

      const span = Math.abs(x2 - x);
      const plotWidth = Math.max(1, rightAxisX - leftAxisX);
      let markerTop = baselineY;
      let markerBottom = baselineY;
      const multiplier = this.options.arcHeightMultiplier !== undefined ? Number(this.options.arcHeightMultiplier) : 1.0;

      if (this.hpFilter === "2" && !this.hpLaneMode) {
        markerTop = baselineY;
        const arcLift = (10 + Math.sqrt(Math.min(1, span / plotWidth)) * (height - 14)) * multiplier;
        markerBottom = Math.min(top + height - 2, baselineY + Math.min(height - 4, arcLift));
      } else if (!this.hpLaneMode) {
        const arcLift = (10 + Math.sqrt(Math.min(1, span / plotWidth)) * (height - 14)) * multiplier;
        markerTop = Math.max(top + 2, baselineY - Math.min(height - 4, arcLift));
        markerBottom = baselineY;
      }

      if (this.hpLaneMode) {
        const laneHeight = Math.max(18, height / 2 - 6);
        const laneLift = (8 + Math.sqrt(Math.min(1, span / plotWidth)) * (laneHeight - 6)) * multiplier;
        if (variant.hp === "1") {
          markerBottom = centerY - 4;
          markerTop = Math.max(top + 2, markerBottom - laneLift);
        } else {
          markerTop = centerY + 4;
          markerBottom = Math.min(top + height - 2, markerTop + laneLift);
        }
      }

      // Immediately validate vertical bounds
      if (!isFiniteNumber(markerTop) || !isFiniteNumber(markerBottom)) {
        logDevSkip(variant, "markerTop or markerBottom calculation produced non-finite value", { markerTop, markerBottom });
        return;
      }

      this.variantGraphics.lineStyle(SV_CONFIG.MARKER_LINE_WIDTH, color, MARKER_ALPHA);
      safeMoveTo(this.variantGraphics, x, markerTop, "drawMarker:moveTo");
      safeLineTo(this.variantGraphics, x, markerBottom, "drawMarker:lineTo");

      this.hitRegions.push({
        variant,
        kind: "marker",
        x,
        top: markerTop,
        bottom: markerBottom,
      });
    }

    drawStructuralVariants() {
      this.hitRegions = [];
      const visible = sampleRows(
        this.currentVariants,
        this.options.maxVisibleVariants || 1200
      );

      const markerVariants = visible.filter(
        (variant) => variant.type === "INS" || variant.type === "sBND" || variant.startAbs === variant.endAbs
      );
      const arcVariants = visible.filter(
        (variant) => !(variant.type === "INS" || variant.type === "sBND" || variant.startAbs === variant.endAbs)
      );

      // PER-VARIANT ERROR ISOLATION for markers
      markerVariants.forEach((variant) => {
        try {
          const color = this.HGC.utils.colorToHex(TYPE_COLORS[variant.type] || TYPE_COLORS.BND);
          this.drawMarker(variant, color);
        } catch (err) {
          logDevSkip(variant, "Runtime exception in drawMarker caught safely", { error: err?.message });
        }
      });

      // PER-VARIANT ERROR ISOLATION for arcs
      arcVariants.forEach((variant) => {
        try {
          const color = this.HGC.utils.colorToHex(TYPE_COLORS[variant.type] || TYPE_COLORS.BND);
          this.drawArc(variant, color);
        } catch (err) {
          logDevSkip(variant, "Runtime exception in drawArc caught safely", { error: err?.message });
        }
      });
    }

    updateExistingGraphics() {
      this.loadingText.text = "";
      this.bgGraphics.clear();
      this.variantGraphics.clear();

      if (!this.showTrack) {
        this.axisGraphics.clear();
        this.labelContainer.removeChildren();
        return;
      }

      if (!this.chromInfo) {
        this.loadingText.text = "Loading chromosome sizes...";
        return;
      }

      // Sub-step rendering isolation
      try {
        this.updateVisibleData();
      } catch (err) {
        logDevSkip(null, "Error updating visible data", { error: err?.message });
      }

      try {
        this.drawChromosomeBackground();
      } catch (err) {
        logDevSkip(null, "Error drawing chromosome background", { error: err?.message });
      }

      try {
        this.drawAxes();
      } catch (err) {
        logDevSkip(null, "Error drawing axes", { error: err?.message });
      }

      try {
        this.drawStructuralVariants();
      } catch (err) {
        logDevSkip(null, "Error drawing structural variants", { error: err?.message });
      }
    }

    getMouseOverHtml(trackX, trackY) {
      if (!isFiniteNumber(trackX) || !isFiniteNumber(trackY) || !this.showTrack) {
        return "";
      }

      const hits = this.hitRegions
        .map((region) => {
          if (!region || !region.variant || this.visibleTypes[region.variant.type] === false) {
            return null;
          }
          if (region.kind === "marker") {
            if (Math.abs(trackX - region.x) <= 6 && trackY >= region.top && trackY <= region.bottom + 4) {
              return {
                region,
                distance: Math.abs(trackX - region.x),
              };
            }
            return null;
          }
          const minX = Math.min(region.x1, region.x2) - 4;
          const maxX = Math.max(region.x1, region.x2) + 4;
          if (trackX < minX || trackX > maxX) {
            return null;
          }
          const spanX = region.x2 - region.x1;
          if (spanX === 0) {
            return null;
          }
          const t = Math.max(0, Math.min(1, (trackX - region.x1) / spanX));
          const inverse = 1 - t;
          const y =
            inverse * inverse * region.baselineY +
            2 * inverse * t * region.apexY +
            t * t * region.baselineY;
          if (!isFiniteNumber(y)) {
            return null;
          }
          const distance = Math.abs(trackY - y);
          return distance <= 8 ? { region, distance } : null;
        })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);

      const hit = hits.length ? hits[0].region : null;

      if (!hit || !hit.variant || this.visibleTypes[hit.variant.type] === false) {
        return "";
      }

      const variant = hit.variant;
      const toText = variant.chr2
        ? `${variant.chr2}: ${format(",")(variant.pos2 || variant.pos)}`
        : `${variant.chr}: ${format(",")(variant.pos2 || variant.pos)}`;
      return `<table style="margin-top:3px;border:1px solid #333333;">
        <tr><td style="font-weight:bold;">ID</td><td>${escapeHtml(variant.id)}</td></tr>
        <tr><td style="font-weight:bold;">Type</td><td>${escapeHtml(variant.type)}</td></tr>
        <tr><td style="font-weight:bold;">From</td><td>${escapeHtml(variant.chr)}: ${format(",")(variant.pos)}</td></tr>
        <tr><td style="font-weight:bold;">To</td><td>${escapeHtml(toText)}</td></tr>
        <tr><td style="font-weight:bold;">Length</td><td>${format(",")(variantLength(variant))}</td></tr>
        <tr><td style="font-weight:bold;">HP</td><td>${escapeHtml(variant.hp)}</td></tr>
        <tr><td style="font-weight:bold;">VAF</td><td>${escapeHtml(variant.vaf)}</td></tr>
        <tr><td style="font-weight:bold;">DV</td><td>${escapeHtml(variant.dv)}</td></tr>
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

  return new WakhanStructuralVariationTrackClass(...args);
}

const icon = new DOMParser().parseFromString(
  '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="2" width="14" height="12" fill="#fff" stroke="#777"/><path d="M3 12 Q8 2 13 12" stroke="#737373" fill="none"/><line x1="5" y1="4" x2="5" y2="13" stroke="#CF0759"/><line x1="11" y1="4" x2="11" y2="13" stroke="#178117"/></svg>',
  "text/xml"
).documentElement;

WakhanStructuralVariationTrack.config = {
  type: "wakhanStructuralVariation",
  datatype: ["wakhan"],
  orientation: "1d-horizontal",
  name: "WAKHAN structural variants",
  thumbnail: icon,
  availableOptions: [
    "chromSizesUrl",
    "data",
    "maxVisibleVariants",
    "minVariantLength",
    "passOnly",
    "hpLaneMode",
    "hpFilter",
    "showTrack",
    "svMode",
    "visibleTypes",
    "arcHeightMultiplier",
  ],
  defaultOptions: {
    data: [],
    maxVisibleVariants: 1200,
    minVariantLength: 50,
    passOnly: true,
    hpLaneMode: false,
    hpFilter: null,
    showTrack: true,
    svMode: DEFAULT_SV_MODE,
    visibleTypes: DEFAULT_VISIBLE_TYPES,
    arcHeightMultiplier: 5.0,
  },
  optionsInfo: {},
};

export default WakhanStructuralVariationTrack;
