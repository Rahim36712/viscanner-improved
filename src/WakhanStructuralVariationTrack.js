import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo, chrToAbs } from "smaht-higlass-misc/es/chrom-utils";
import { format } from "d3-format";

const TYPE_COLORS = {
  DEL: "#F27A9A",
  INV: "#7C83FF",
  INS: "#D9CB3E",
  BND: "#8F969E",
  sBND: "#A9B7BA",
  DUP: "#74C69D",
};

const AXIS_COLOR = "#3f464d";
const GRID_COLOR = "#e5e8eb";
const CHROM_BAND_COLOR = "#e7eaed";
const ARC_ALPHA = 0.72;
const MARKER_ALPHA = 0.34;
const DEFAULT_VISIBLE_TYPES = {
  DEL: true,
  INV: true,
  INS: true,
  BND: true,
  DUP: true,
  sBND: true,
};
const DEFAULT_SV_MODE = "matched";

function normalizeHpFilter(value) {
  return value === "1" || value === "2" ? value : null;
}

function normalizeTrackData(data) {
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

function escapeHtml(value) {
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
      this.maxVariantLength = this.options.maxVariantLength || null;
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
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
      this.rawData = data || [];
      this.parseData(this.rawData);
      this.rerender(this.options);
      this.animate();
    }

    setVisibilityOptions(options = {}) {
      this.visibleTypes = {
        ...this.visibleTypes,
        ...(options.visibleTypes || {}),
      };
      if (options.svMode) {
        this.svMode = options.svMode;
      }
      if (options.showTrack !== undefined) {
        this.showTrack = options.showTrack !== false;
      }
      if (options.hpFilter !== undefined) {
        this.hpFilter = normalizeHpFilter(options.hpFilter);
      }
      if (options.maxVariantLength !== undefined) {
        this.maxVariantLength = options.maxVariantLength || null;
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
        .filter((variant) => this.chromInfo.chrPositions[variant.chr])
        .map((variant) => {
          const startAbs = chrToAbs(variant.chr, variant.pos, this.chromInfo);
          let endAbs = startAbs;
          if (variant.chr2 && this.chromInfo.chrPositions[variant.chr2]) {
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

      this.resetCache();
    }

    resetCache() {
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
    }

    rerender(options) {
      super.rerender(options);
      this.options = options;
      this.svMode = this.svMode || this.options.svMode || DEFAULT_SV_MODE;
      this.showTrack = this.showTrack === undefined ? this.options.showTrack !== false : this.showTrack;
      this.hpLaneMode = this.options.hpLaneMode === true;
      this.hpFilter =
        this.hpFilter === undefined ? normalizeHpFilter(this.options.hpFilter) : this.hpFilter;
      this.visibleTypes = {
        ...DEFAULT_VISIBLE_TYPES,
        ...this.visibleTypes,
        ...(this.options.visibleTypes || {}),
      };
      if (this.rawData && !this.variants.length) {
        this.parseData(this.rawData);
      }
      this.updateExistingGraphics();
    }

    metrics() {
      const top = this.hpLaneMode ? 4 : 0;
      const bottom = this.hpLaneMode ? 4 : 0;
      const leftAxisX = 72;
      const rightAxisX = this.dimensions[0] - 78;
      const height = Math.max(1, this.dimensions[1] - top - bottom);
      const baselineY = this.hpFilter === "2" && !this.hpLaneMode
        ? top + 2
        : top + height - 2;
      const centerY = top + height / 2;
      return { top, bottom, leftAxisX, rightAxisX, height, baselineY, centerY };
    }

    plotX(absPosition) {
      const { leftAxisX, rightAxisX } = this.metrics();
      const rawX = this._xScale(absPosition);
      const rawWidth = Math.max(1, this.dimensions[0]);
      return leftAxisX + (rawX / rawWidth) * (rightAxisX - leftAxisX);
    }

    addText(text, x, y, options = {}) {
      const label = new this.HGC.libraries.PIXI.Text(text, {
        fontSize: options.fontSize || "11px",
        fontFamily: "Arial",
        fill: options.fill || AXIS_COLOR,
        fontWeight: options.fontWeight || "normal",
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

    drawAxes() {
      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();
      this.axisGraphics.clear();
      this.labelContainer.removeChildren();

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(GRID_COLOR), 1);
      if (this.hpLaneMode) {
        this.axisGraphics.moveTo(leftAxisX, centerY);
        this.axisGraphics.lineTo(rightAxisX, centerY);
      } else {
        this.axisGraphics.moveTo(leftAxisX, baselineY);
        this.axisGraphics.lineTo(rightAxisX, baselineY);
      }

      this.axisGraphics.lineStyle(1, this.HGC.utils.colorToHex(AXIS_COLOR), 1);
      this.axisGraphics.moveTo(leftAxisX, top);
      this.axisGraphics.lineTo(leftAxisX, top + height);
      this.axisGraphics.moveTo(rightAxisX, top);
      this.axisGraphics.lineTo(rightAxisX, top + height);

      const axisLabel = this.hpFilter
        ? `HP-${this.hpFilter} breakpoints`
        : this.hpLaneMode
          ? "HP SVs"
          : "Breakpoints";
      this.addText(axisLabel, 20, top + height / 2, {
        rotation: -Math.PI / 2,
        fontSize: "12px",
      });
      if (this.hpLaneMode) {
        if (!this.hpFilter || this.hpFilter === "1") {
          this.addText("HP-1", rightAxisX + 10, top + 15, {
            anchorX: 0,
            fill: TYPE_COLORS.DEL,
            fontSize: "12px",
          });
        }
        if (!this.hpFilter || this.hpFilter === "2") {
          this.addText("HP-2", rightAxisX + 10, top + height - 15, {
            anchorX: 0,
            fill: "#2D7DD2",
            fontSize: "12px",
          });
        }
      }
    }

    updateVisibleData() {
      const fromX = this._xScale.invert(0);
      const toX = this._xScale.invert(this.dimensions[0]);
      const span = Math.max(1, this.previousToX - this.previousFromX);
      const refreshStep = 0.02;
      if (
        Math.abs((this.previousFromX - fromX) / span) <= refreshStep &&
        Math.abs((this.previousToX - toX) / span) <= refreshStep
      ) {
        return;
      }

      const minLength = this.options.minVariantLength === undefined ? 50 : this.options.minVariantLength;
      const passOnly = this.options.passOnly !== false;
      const endpointPadding = Math.max(5000, Math.abs(toX - fromX) * 0.2);
      this.currentVariants = this.variants.filter((variant) => {
        if (this.hpFilter && variant.hp !== this.hpFilter) {
          return false;
        }
        if (this.hpLaneMode && variant.hp !== "1" && variant.hp !== "2") {
          return false;
        }
        if (passOnly && variant.filter !== "PASS") {
          return false;
        }
        if (variantLength(variant) < minLength) {
          return false;
        }
        const maxLength = this.maxVariantLength;
        if (maxLength && variant.chr === variant.chr2 && variantLength(variant) > maxLength) {
          return false;
        }
        if (maxLength && variant.chr2 && variant.chr !== variant.chr2) {
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
        return (
          (variant.startAbs >= fromX - endpointPadding && variant.startAbs <= toX + endpointPadding) ||
          (variant.endAbs >= fromX - endpointPadding && variant.endAbs <= toX + endpointPadding)
        );
      });
      this.previousFromX = fromX;
      this.previousToX = toX;
    }

    drawArc(variant, color) {
      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();
      const x1 = Math.max(leftAxisX, Math.min(rightAxisX, this.plotX(variant.startAbs)));
      const x2 = Math.max(leftAxisX, Math.min(rightAxisX, this.plotX(variant.endAbs)));
      if (Math.abs(x2 - x1) < 1) {
        return this.drawMarker(variant, color);
      }

      const span = Math.abs(x2 - x1);
      const plotWidth = Math.max(1, rightAxisX - leftAxisX);
      let startY = baselineY;
      let endY = baselineY;
      let apexY;
      if (this.hpLaneMode) {
        const laneHeight = Math.max(18, height / 2 - 6);
        const laneLift = 8 + Math.sqrt(Math.min(1, span / plotWidth)) * (laneHeight - 6);
        if (variant.hp === "1") {
          startY = centerY - 4;
          endY = centerY - 4;
          apexY = Math.max(top + 2, startY - laneLift);
        } else {
          startY = centerY + 4;
          endY = centerY + 4;
          apexY = Math.min(top + height - 2, startY + laneLift);
        }
      } else {
        const arcLift = 10 + Math.sqrt(Math.min(1, span / plotWidth)) * (height - 14);
        if (this.hpFilter === "2") {
          apexY = Math.min(top + height - 2, baselineY + Math.min(height - 4, arcLift));
        } else {
          apexY = Math.max(top + 2, baselineY - Math.min(height - 4, arcLift));
        }
      }
      const controlX = (x1 + x2) / 2;
      const steps = span > 280 ? 30 : 22;

      this.variantGraphics.lineStyle(1.25, color, ARC_ALPHA);
      for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const inverse = 1 - t;
        const x = inverse * inverse * x1 + 2 * inverse * t * controlX + t * t * x2;
        const y = inverse * inverse * startY + 2 * inverse * t * apexY + t * t * endY;
        if (i === 0) {
          this.variantGraphics.moveTo(x, y);
        } else {
          this.variantGraphics.lineTo(x, y);
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
      const { top, leftAxisX, rightAxisX, height, baselineY, centerY } = this.metrics();
      const x = Math.max(leftAxisX, Math.min(rightAxisX, this.plotX(variant.startAbs)));
      let markerTop = top + 2;
      let markerBottom = baselineY;
      if (this.hpFilter === "2" && !this.hpLaneMode) {
        markerTop = baselineY;
        markerBottom = top + height - 2;
      }
      if (this.hpLaneMode) {
        if (variant.hp === "1") {
          markerTop = top + 2;
          markerBottom = centerY - 4;
        } else {
          markerTop = centerY + 4;
          markerBottom = top + height - 2;
        }
      }
      this.variantGraphics.lineStyle(1, color, MARKER_ALPHA);
      this.variantGraphics.moveTo(x, markerTop);
      this.variantGraphics.lineTo(x, markerBottom);
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

      markerVariants.forEach((variant) => {
        const color = this.HGC.utils.colorToHex(TYPE_COLORS[variant.type] || TYPE_COLORS.BND);
        this.drawMarker(variant, color);
      });

      arcVariants.forEach((variant) => {
        const color = this.HGC.utils.colorToHex(TYPE_COLORS[variant.type] || TYPE_COLORS.BND);
        this.drawArc(variant, color);
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

      this.updateVisibleData();
      this.drawChromosomeBackground();
      this.drawAxes();
      this.drawStructuralVariants();
    }

    getMouseOverHtml(trackX, trackY) {
      const hits = this.hitRegions
        .map((region) => {
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
        const t = Math.max(0, Math.min(1, (trackX - region.x1) / (region.x2 - region.x1)));
        const inverse = 1 - t;
        const y =
          inverse * inverse * region.baselineY +
          2 * inverse * t * region.apexY +
          t * t * region.baselineY;
        const distance = Math.abs(trackY - y);
        return distance <= 8 ? { region, distance } : null;
      })
        .filter(Boolean)
        .sort((a, b) => a.distance - b.distance);

      const hit = hits.length ? hits[0].region : null;

      if (!hit) {
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
  },
  optionsInfo: {},
};

export default WakhanStructuralVariationTrack;
