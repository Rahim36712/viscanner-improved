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
      this.showHp1 = this.options.showHp1 !== false;
      this.showHp2 = this.options.showHp2 !== false;
      this.showCoverage = this.options.showCoverage !== false;
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

    setVisibilityOptions(options) {
      this.showHp1 = options.showHp1 !== false;
      this.showHp2 = options.showHp2 !== false;
      this.showCoverage = options.showCoverage !== false;
      this.updateExistingGraphics();
      this.animate();
    }

    parseData(data) {
      this.coverage = [];
      this.hp1Segments = [];
      this.hp2Segments = [];
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

    rerender(options) {
      super.rerender(options);
      this.options = options;
      this.showHp1 = this.showHp1 === undefined ? this.options.showHp1 !== false : this.showHp1;
      this.showHp2 = this.showHp2 === undefined ? this.options.showHp2 !== false : this.showHp2;
      this.showCoverage = this.showCoverage === undefined ? this.options.showCoverage !== false : this.showCoverage;
      if (this.options.data && !this.coverage.length) {
        this.parseData(this.options.data);
      }
      this.updateExistingGraphics();
    }

    resetCache() {
      this.previousFromX = Number.MIN_SAFE_INTEGER;
      this.previousToX = Number.MAX_SAFE_INTEGER;
    }

    metrics() {
      const top = 12;
      const bottom = 22;
      const leftAxisX = 72;
      const rightAxisX = this.dimensions[0] - 78;
      const height = Math.max(1, this.dimensions[1] - top - bottom);
      const centerY = top + height / 2;
      const halfHeight = height / 2 - 8;
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
        this.addText("HP-1", rightAxisX + 10, top + 12, {
          anchorX: 0,
          fill: HP1_COLOR,
          fontSize: "12px",
        });
      }
      if (this.showHp2) {
        this.addText("HP-2", rightAxisX + 10, bottomY - 12, {
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
      this.previousFromX = fromX;
      this.previousToX = toX;
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
  availableOptions: ["coverageMax", "chromSizesUrl", "data", "maxCoveragePoints", "showHp1", "showHp2", "showCoverage"],
  defaultOptions: {
    coverageMax: 180,
    data: {},
    maxCoveragePoints: 6000,
    showHp1: true,
    showHp2: true,
    showCoverage: true,
  },
  optionsInfo: {},
};

export default WakhanCoverageTrack;
