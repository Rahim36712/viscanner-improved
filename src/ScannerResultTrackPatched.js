import OriginalScannerResultTrack from "smaht-higlass-misc/es/ScannerResultTrack";
import {
  getPlotBounds,
  mapTrackX,
  registerGlobalChromExtents,
  getGlobalMasterChromBounds,
  getDynamicChrAbs,
} from "./plotBounds";
import { createHighResBase64Extractor } from "./pdfExport";
import { LABELS } from "./labelsConfig";

const CHROM_BAND_COLOR = "#e7eaed";
const BAF_COLOR = "#9A9D32";

function formatPos(val) {
  if (typeof val === "number" && !isNaN(val)) {
    return val.toLocaleString("en-US");
  }
  return val || "-";
}

function formatBafValue(val) {
  if (typeof val !== "number" || isNaN(val)) return "-";
  const pct = (val <= 1.0 ? val * 100 : val).toFixed(1);
  const numStr = val.toFixed(2);
  return `${numStr} (${pct}%)`;
}

function formatCopyNumber(val) {
  if (typeof val !== "number" || isNaN(val)) return "-";
  return Number(val).toFixed(2).replace(/\.00$/, "");
}

function drawChromosomeBands(track) {
  if (!track.chromInfo || !track.chromInfo.cumPositions) {
    return;
  }

  // Register all BAF segment & SNP extents globally ONCE per dataset change (not per frame)
  const dataLen = (track.data ? track.data.length : 0) + (track.snpData ? track.snpData.length : 0);
  if (track._extentsRegisteredKey !== dataLen && dataLen > 0) {
    track._extentsRegisteredKey = dataLen;
    const allSegs = track.data || [];
    for (let i = 0; i < allSegs.length; i++) {
      const seg = allSegs[i];
      if (seg.chr) registerGlobalChromExtents(seg.chr, seg.fromAbs, seg.toAbs);
    }
    const allSnps = track.snpData || [];
    for (let i = 0; i < allSnps.length; i++) {
      const snp = allSnps[i];
      if (snp.chr) registerGlobalChromExtents(snp.chr, snp.posAbs, snp.posAbs);
    }
  }

  const { left, right } = getPlotBounds(track);
  const bandColor = track.HGC.utils.colorToHex(CHROM_BAND_COLOR);
  const bounds = getGlobalMasterChromBounds(track.chromInfo);

  track.chromInfo.cumPositions.forEach((chromosome, index) => {
    if (index % 2 !== 0) {
      return;
    }

    let startPos, endPos;
    if (bounds && bounds[index]) {
      startPos = bounds[index].start;
      endPos = bounds[index].end;
    } else {
      const chrLength = Number(track.chromInfo.chromLengths[chromosome.chr]);
      if (!Number.isFinite(chrLength)) {
        return;
      }
      startPos = chromosome.pos;
      endPos = chromosome.pos + chrLength;
    }

    const startX = Math.max(left, mapTrackX(track, startPos));
    const endX = Math.min(right, mapTrackX(track, endPos));
    if (endX <= left || startX >= right || endX <= startX) {
      return;
    }

    track.bgGraphics.beginFill(bandColor, 0.85);
    track.bgGraphics.drawRect(startX, 0, endX - startX, track.dimensions[1]);
  });
}

function drawPlotGrid(track) {
  // Horizontal grid lines disabled to keep plot background clean
  return;
}

function ScannerResultTrackPatched(HGC, ...args) {
  const instance = OriginalScannerResultTrack(HGC, ...args);

  const applyScaleConfig = (options = instance.options) => {
    instance.numGridlines = options?.yValue === "rdr" ? 6 : 4;
    if (options?.yValue === "baf") {
      instance.numGridlines = 6;
    }
  };

  const patchedUpdateExistingGraphics = function patchedUpdateExistingGraphics() {
    this.loadingText.text = "Rendering...";

    const fromX = this._xScale.invert(0);
    const toX = this._xScale.invert(this.dimensions[0]);
    const refreshStep = this.options.yValue === "baf" ? 0.02 : 0.05;

    const prevSpan = Math.abs(this.previousToX - this.previousFromX);
    if (
      !Number.isFinite(prevSpan) ||
      prevSpan === 0 ||
      Math.abs((this.previousFromX - fromX) / prevSpan) > refreshStep ||
      Math.abs((this.previousToX - toX) / prevSpan) > refreshStep
    ) {
      this.currentFilteredList = (this.data || []).filter(
        (segment) => segment.toAbs >= fromX - refreshStep && segment.fromAbs <= toX + refreshStep
      );

      const snpLimit = this.options.yValue === "baf" ? 6000 : 10000;
      this.currentFilteredListSnp = (this.snpData || [])
        .filter((segment) => segment.posAbs >= fromX - refreshStep && segment.posAbs <= toX + refreshStep)
        .slice(0, snpLimit);

      if (this.options.yValue === "rdr") {
        let maxValue = 6.0;
        this.currentFilteredList.forEach((segment) => {
          maxValue = Math.max(maxValue, segment.yvalue);
        });
        this.currentMaxValue = maxValue;
      } else if (this.options.yValue === "baf") {
        this.currentMaxValue = 0.6;
      } else {
        this.currentMaxValue = 1.0;
      }

      this.previousFromX = fromX;
      this.previousToX = toX;
    }

    if (!Array.isArray(this.currentFilteredList)) {
      this.currentFilteredList = [];
    }
    if (!Array.isArray(this.currentFilteredListSnp)) {
      this.currentFilteredListSnp = [];
    }

    this.createLegendGraphics(this.currentMaxValue);
    const isBafTrack = this.options.yValue === "baf";
    if (isBafTrack) {
      this.bgGraphics.removeChildren();
      this.bgGraphics.clear();
      drawChromosomeBands(this);
      drawPlotGrid(this);
    }

    this.currentYScaleSegments = this.HGC.libraries.d3Scale.scaleLinear(
      [0, this.currentMaxValue],
      [
        this.legendUtils.currentLegendLevels[this.numGridlines] - this.options.segmentHeight / 2,
        this.legendUtils.currentLegendLevels[0] - this.options.segmentHeight / 2,
      ]
    );

    this.currentYScalePoints = this.HGC.libraries.d3Scale.scaleLinear(
      [0, this.currentMaxValue],
      [
        this.legendUtils.currentLegendLevels[this.numGridlines],
        this.legendUtils.currentLegendLevels[0],
      ]
    );

    const segmentColorHex = this.HGC.utils.colorToHex(this.options.segmentColor);
    const snpColorHex = this.HGC.utils.colorToHex(isBafTrack ? BAF_COLOR : this.options.snpColor);
    const blackColorHex = this.HGC.utils.colorToHex("#333333");
    this.segmentGraphics.removeChildren();
    this.segmentGraphics.clear();

    try {
      this.segmentGraphics.beginFill(snpColorHex, 0.4);
      this.currentFilteredListSnp.forEach((segment) => {
        if (!segment || !Number.isFinite(segment.posAbs) || !Number.isFinite(segment.yvalue)) {
          return;
        }
        const xPos = isBafTrack ? mapTrackX(this, segment.posAbs) : this._xScale(segment.posAbs);
        const yPos = this.currentYScalePoints(segment.yvalue);
        const bounds = getPlotBounds(this);
        if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) {
          return;
        }
        if (isBafTrack && (xPos < bounds.left || xPos > bounds.right)) {
          return;
        }
        const pointRadius = isBafTrack ? 1.5 : 3;
        this.segmentGraphics.drawCircle(xPos, yPos, pointRadius);
      });

      this.currentFilteredList.forEach((segment) => {
        if (!segment || !Number.isFinite(segment.fromAbs) || !Number.isFinite(segment.toAbs)) {
          return;
        }
        const bounds = getPlotBounds(this);
        const xPos = isBafTrack
          ? Math.max(bounds.left, mapTrackX(this, segment.fromAbs))
          : this._xScale(segment.fromAbs);
        const xEnd = isBafTrack
          ? Math.min(bounds.right, mapTrackX(this, segment.toAbs))
          : this._xScale(segment.toAbs);
        const width = xEnd - xPos;
        if (isBafTrack && width <= 0) {
          return;
        }
        const yPos = this.currentYScaleSegments(segment.yvalue);
        if (!Number.isFinite(xPos) || !Number.isFinite(yPos) || !Number.isFinite(width)) {
          return;
        }
        this.segmentGraphics.beginFill(segmentColorHex);
        this.segmentGraphics.drawRect(
          xPos,
          yPos,
          width,
          this.options.segmentHeight
        );
        if (this.options.show_total_cn && Number.isFinite(segment.total_cn)) {
          const yTotalCn = this.currentYScalePoints(segment.total_cn);
          if (Number.isFinite(yTotalCn)) {
            this.segmentGraphics.beginFill(blackColorHex);
            this.segmentGraphics.drawRect(xPos, yTotalCn, width, 2);
          }
        }
      });
    } catch (err) {
      console.warn("ScannerResultTrack graphics render caught error silently:", err);
    }

    if (!this.mouseOverGraphics && this.pMain) {
      this.mouseOverGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.pMain.addChild(this.mouseOverGraphics);
    }

    this.loadingText.text = "";
  };

  const originalSetData = instance.setData.bind(instance);
  instance.setData = function patchedSetData(data) {
    this.options.data = data;
    const res = originalSetData(data);
    if (this.chromInfo && Array.isArray(this.data)) {
      const bounds = getGlobalMasterChromBounds(this.chromInfo);
      this.data.forEach((seg) => {
        if (seg && seg.chr && Number.isFinite(seg.from || seg.start)) {
          seg.fromAbs = getDynamicChrAbs(seg.chr, seg.from || seg.start, this.chromInfo, bounds);
          seg.toAbs = getDynamicChrAbs(seg.chr, seg.to || seg.end || seg.from, this.chromInfo, bounds);
        }
      });
    }
    return res;
  };

  const originalSetSnpData = instance.setSnpData.bind(instance);
  instance.setSnpData = function patchedSetSnpData(data) {
    this.options.snpData = data;
    const formattedData = Array.isArray(data)
      ? data.map((item) => {
          if (Array.isArray(item)) {
            return item;
          }
          if (item && typeof item === "object") {
            const chr = item.chr || item[0];
            const pos = item.pos !== undefined ? item.pos : item[1];
            const yvalue =
              item.yvalue !== undefined
                ? item.yvalue
                : item.baf !== undefined
                ? item.baf
                : item[2];
            const arr = [chr, pos, yvalue];
            arr.chr = chr;
            arr.pos = pos;
            arr.yvalue = yvalue;
            arr.baf = yvalue;
            arr.hp = item.hp;
            return arr;
          }
          return item;
        })
      : [];

    const res = originalSetSnpData(formattedData);

    if (this.chromInfo && Array.isArray(this.snpData)) {
      const bounds = getGlobalMasterChromBounds(this.chromInfo);
      this.snpData.forEach((snp) => {
        if (snp && snp.chr && Number.isFinite(snp.pos)) {
          snp.posAbs = getDynamicChrAbs(snp.chr, snp.pos, this.chromInfo, bounds);
        }
      });
    }
    return res;
  };

  const originalRerender = instance.rerender.bind(instance);
  instance.rerender = function patchedRerender(options) {
    applyScaleConfig(options);
    return originalRerender(options);
  };

  instance.updateExistingGraphics = patchedUpdateExistingGraphics.bind(instance);
  applyScaleConfig();

  instance.getMouseOverHtml = function getMouseOverHtml(trackX, trackY) {
    if (!Number.isFinite(trackX) || !Number.isFinite(trackY)) {
      return "";
    }
    if (this.mouseOverGraphics) {
      this.mouseOverGraphics.clear();
    }
    const bounds = getPlotBounds(this);
    if (trackX < bounds.left || trackX > bounds.right) {
      return "";
    }

    const isBafTrack = this.options.yValue === "baf";
    const snpList = this.currentFilteredListSnp || [];
    let bestHit = null;
    let minDistance = 8.0;

    for (let i = 0; i < snpList.length; i++) {
      const snp = snpList[i];
      if (!snp || !Number.isFinite(snp.posAbs) || !Number.isFinite(snp.yvalue)) {
        continue;
      }
      const xPos = isBafTrack ? mapTrackX(this, snp.posAbs) : this._xScale(snp.posAbs);
      const yPos = this.currentYScalePoints ? this.currentYScalePoints(snp.yvalue) : null;
      if (!Number.isFinite(xPos) || !Number.isFinite(yPos)) {
        continue;
      }
      if (isBafTrack && (xPos < bounds.left || xPos > bounds.right)) {
        continue;
      }

      const dist = Math.hypot(trackX - xPos, trackY - yPos);
      if (dist < minDistance) {
        minDistance = dist;
        bestHit = { snp, xPos, yPos };
      }
    }

    if (bestHit) {
      const { snp, xPos, yPos } = bestHit;
      if (this.mouseOverGraphics) {
        this.mouseOverGraphics.lineStyle(1.5, 0x000000, 0.85);
        this.mouseOverGraphics.drawCircle(xPos, yPos, isBafTrack ? 3.5 : 5);
      }

      const segList = this.currentFilteredList || this.data || [];
      const overlapSeg = segList.find((seg) => {
        if (!seg) return false;
        if (Number.isFinite(seg.fromAbs) && Number.isFinite(seg.toAbs)) {
          return snp.posAbs >= seg.fromAbs && snp.posAbs <= seg.toAbs;
        }
        if (seg.chr && seg.chr === snp.chr && Number.isFinite(seg.start) && Number.isFinite(seg.end)) {
          return snp.pos >= seg.start && snp.pos <= seg.end;
        }
        return false;
      });

      const bedCopyNumber = overlapSeg
        ? (overlapSeg.total_cn ?? overlapSeg.copyNumber ?? overlapSeg.yvalue)
        : undefined;

      const hpText = snp.hp
        ? snp.hp
        : (snp.yvalue >= 0.5 ? "HP-1" : "HP-2");

      return `<table style="margin-top:3px;border:1px solid #333333;">
        <tr><td style="font-weight:bold;">Position</td><td>${snp.chr ? `${snp.chr}: ` : ""}${formatPos(snp.pos)}</td></tr>
        <tr><td style="font-weight:bold;">B-allele frequency</td><td>${formatBafValue(snp.yvalue)}</td></tr>
        <tr><td style="font-weight:bold;">Haplotype</td><td>${hpText}</td></tr>
        <tr><td style="font-weight:bold;">BED copy number</td><td>${formatCopyNumber(bedCopyNumber)}</td></tr>
      </table>`;
    }

    const segList = this.currentFilteredList || [];
    const segHit = segList.find((segment) => {
      if (!segment || !Number.isFinite(segment.fromAbs) || !Number.isFinite(segment.toAbs)) {
        return false;
      }
      const xPos = isBafTrack
        ? Math.max(bounds.left, mapTrackX(this, segment.fromAbs))
        : this._xScale(segment.fromAbs);
      const xEnd = isBafTrack
        ? Math.min(bounds.right, mapTrackX(this, segment.toAbs))
        : this._xScale(segment.toAbs);
      const yPos = this.currentYScaleSegments ? this.currentYScaleSegments(segment.yvalue) : null;
      if (!Number.isFinite(xPos) || !Number.isFinite(xEnd) || !Number.isFinite(yPos)) {
        return false;
      }
      const segH = this.options.segmentHeight || 10;
      return (
        trackX >= xPos &&
        trackX <= xEnd &&
        trackY >= yPos - 2 &&
        trackY <= yPos + segH + 2
      );
    });

    if (segHit) {
      const posStart = segHit.start ?? segHit.from;
      const posEnd = segHit.end ?? segHit.to;
      const posStr = segHit.chr && Number.isFinite(posStart) && Number.isFinite(posEnd)
        ? `${segHit.chr}: ${formatPos(posStart)} - ${formatPos(posEnd)}`
        : "-";

      return `<table style="margin-top:3px;border:1px solid #333333;">
        <tr><td style="font-weight:bold;">${LABELS.tooltips.position}</td><td>${posStr}</td></tr>
        <tr><td style="font-weight:bold;">Value (${isBafTrack ? "BAF" : "RDR"})</td><td>${formatBafValue(segHit.yvalue)}</td></tr>
        <tr><td style="font-weight:bold;">${LABELS.tooltips.bedCopyNumber}</td><td>${formatCopyNumber(segHit.total_cn ?? segHit.copyNumber ?? segHit.yvalue)}</td></tr>
      </table>`;
    }

    return "";
  };

  const originalCreateLegendGraphics = instance.createLegendGraphics.bind(instance);
  instance.createLegendGraphics = function patchedCreateLegendGraphics(maxValue) {
    this.legendHeight = this.dimensions[1] - 1;
    this.legendVerticalOffset = 1;

    if (this.legendUtils) {
      const track = this;
      if (!this._patchedLegendUtils) {
        this._patchedLegendUtils = true;
        const bounds = getPlotBounds(track);

        const origResetLegend = this.legendUtils.resetLegend.bind(this.legendUtils);
        this.legendUtils.resetLegend = function (legendGraphics) {
          legendGraphics.removeChildren();
          legendGraphics.clear();
          legendGraphics.beginFill(this.HGC.utils.colorToHex("#ffffff"));
          legendGraphics.drawRect(0, 0, this.legendWidth, track.dimensions[1]);
          this.currentLegendLevels = [];
        };

        const origDrawHoriz = this.legendUtils.drawHorizontalLines.bind(this.legendUtils);
        this.legendUtils.drawHorizontalLines = function (tileGraphics, from, to) {
          const plotLeft = getPlotBounds(track).left;
          // Start horizontal lines at plot canvas left boundary (plotLeft) so no stray line extends into left margin
          return origDrawHoriz(tileGraphics, Math.max(from, plotLeft), to);
        };
      }
    }

    return originalCreateLegendGraphics(maxValue);
  };

  const originalExportSVG = instance.exportSVG.bind(instance);
  instance.exportSVG = function patchedExportSVG() {
    const renderer = HGC?.services?.pixiRenderer;
    const extractor = renderer ? createHighResBase64Extractor(HGC, 6) : null;

    if (extractor) {
      renderer.plugins.extract.base64 = extractor.highResBase64;
    }

    let result;
    try {
      result = originalExportSVG();
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
  };

  return instance;
}

ScannerResultTrackPatched.config = OriginalScannerResultTrack.config;

export default ScannerResultTrackPatched;
