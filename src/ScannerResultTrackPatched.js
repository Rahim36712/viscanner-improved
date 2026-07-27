import OriginalScannerResultTrack from "smaht-higlass-misc/es/ScannerResultTrack";
import {
  getPlotBounds,
  mapTrackX,
  registerGlobalChromExtents,
  getGlobalMasterChromBounds,
  getDynamicChrAbs,
} from "./plotBounds";
import { createHighResBase64Extractor } from "./pdfExport";

const CHROM_BAND_COLOR = "#e7eaed";
const BAF_COLOR = "#9A9D32";

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

    this.loadingText.text = "";
  };

  const originalSetData = instance.setData.bind(instance);
  instance.setData = function patchedSetData(data) {
    this.options.data = data;
    if (this.chromInfo && Array.isArray(data)) {
      const bounds = getGlobalMasterChromBounds(this.chromInfo);
      data.forEach((seg) => {
        if (seg.chr && Number.isFinite(seg.from || seg.start)) {
          seg.fromAbs = getDynamicChrAbs(seg.chr, seg.from || seg.start, this.chromInfo, bounds);
          seg.toAbs = getDynamicChrAbs(seg.chr, seg.to || seg.end || seg.from, this.chromInfo, bounds);
        }
      });
    }
    return originalSetData(data);
  };

  const originalSetSnpData = instance.setSnpData.bind(instance);
  instance.setSnpData = function patchedSetSnpData(data) {
    this.options.snpData = data;
    if (this.chromInfo && Array.isArray(data)) {
      const bounds = getGlobalMasterChromBounds(this.chromInfo);
      data.forEach((snp) => {
        if (snp.chr && Number.isFinite(snp.pos)) {
          snp.posAbs = getDynamicChrAbs(snp.chr, snp.pos, this.chromInfo, bounds);
        }
      });
    }
    return originalSetSnpData(data);
  };

  const originalRerender = instance.rerender.bind(instance);
  instance.rerender = function patchedRerender(options) {
    applyScaleConfig(options);
    return originalRerender(options);
  };

  instance.updateExistingGraphics = patchedUpdateExistingGraphics.bind(instance);
  applyScaleConfig();

  const originalCreateLegendGraphics = instance.createLegendGraphics.bind(instance);
  instance.createLegendGraphics = function patchedCreateLegendGraphics(maxValue) {
    this.legendHeight = this.dimensions[1] - 1;
    this.legendVerticalOffset = 1;
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
