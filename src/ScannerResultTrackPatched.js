import OriginalScannerResultTrack from "smaht-higlass-misc/es/ScannerResultTrack";
import { getPlotBounds, mapTrackX } from "./plotBounds";
import { createHighResBase64Extractor } from "./pdfExport";

const CHROM_BAND_COLOR = "#e7eaed";
const BAF_COLOR = "#9A9D32";
function drawChromosomeBands(track) {
  if (!track.chromInfo || !track.chromInfo.cumPositions) {
    return;
  }

  const { left, right } = getPlotBounds(track);
  const bandColor = track.HGC.utils.colorToHex(CHROM_BAND_COLOR);
  track.chromInfo.cumPositions.forEach((chromosome, index) => {
    if (index % 2 !== 0) {
      return;
    }

    const chrLength = Number(track.chromInfo.chromLengths[chromosome.chr]);
    if (!Number.isFinite(chrLength)) {
      return;
    }

    const startX = Math.max(left, mapTrackX(track, chromosome.pos));
    const endX = Math.min(right, mapTrackX(track, chromosome.pos + chrLength));
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

function drawPatchedSegments(track, isBafTrack, segmentColorHex, blackColorHex) {
  const bounds = getPlotBounds(track);

  if (track.chromInfo && track.chromInfo.cumPositions) {
    const cumPositions = track.chromInfo.cumPositions;
    const chromLengths = track.chromInfo.chromLengths;

    const segmentsByChr = new Map();
    track.currentFilteredList.forEach((segment) => {
      let matchedIndex = -1;
      for (let i = 0; i < cumPositions.length; i++) {
        const start = cumPositions[i].pos;
        const length = Number(chromLengths[cumPositions[i].chr]) || 0;
        const end = start + length;
        if (segment.fromAbs >= start && segment.fromAbs <= end) {
          matchedIndex = i;
          break;
        }
      }
      if (matchedIndex === -1 && cumPositions.length > 0) {
        for (let i = 0; i < cumPositions.length; i++) {
          const start = cumPositions[i].pos;
          if (segment.fromAbs < start) {
            matchedIndex = Math.max(0, i - 1);
            break;
          }
          matchedIndex = i;
        }
      }

      if (matchedIndex >= 0) {
        if (!segmentsByChr.has(matchedIndex)) {
          segmentsByChr.set(matchedIndex, []);
        }
        segmentsByChr.get(matchedIndex).push(segment);
      }
    });

    segmentsByChr.forEach((chrSegments, chrIdx) => {
      const cumPos = cumPositions[chrIdx];
      const chrStart = cumPos.pos;
      const chrEnd = chrStart + (Number(chromLengths[cumPos.chr]) || 0);

      chrSegments.sort((a, b) => a.fromAbs - b.fromAbs);

      const n = chrSegments.length;
      for (let i = 0; i < n; i++) {
        const segment = chrSegments[i];
        let effFrom = segment.fromAbs;
        let effTo = segment.toAbs;

        // Snap 1st segment in chromosome to chromosome start
        if (i === 0) {
          effFrom = chrStart;
        }
        // Snap last segment in chromosome to chromosome end
        if (i === n - 1) {
          effTo = chrEnd;
        }
        // Snap adjacent segments together to eliminate gaps
        if (i < n - 1) {
          const nextSegment = chrSegments[i + 1];
          if (nextSegment.fromAbs > effTo) {
            effTo = nextSegment.fromAbs;
          }
        }

        // Strict clamping to chromosome boundaries
        effFrom = Math.max(chrStart, effFrom);
        effTo = Math.min(chrEnd, effTo);

        if (effTo <= effFrom) continue;

        const xPos = isBafTrack
          ? Math.max(bounds.left, mapTrackX(track, effFrom))
          : track._xScale(effFrom);
        const xEnd = isBafTrack
          ? Math.min(bounds.right, mapTrackX(track, effTo))
          : track._xScale(effTo);

        const width = xEnd - xPos;
        if (width <= 0) continue;

        if (isBafTrack && (xEnd < bounds.left || xPos > bounds.right)) continue;

        track.segmentGraphics.beginFill(segmentColorHex);
        track.segmentGraphics.drawRect(
          xPos,
          track.currentYScaleSegments(segment.yvalue),
          width,
          track.options.segmentHeight
        );

        if (track.options.show_total_cn) {
          track.segmentGraphics.beginFill(blackColorHex);
          track.segmentGraphics.drawRect(xPos, track.currentYScalePoints(segment.total_cn), width, 2);
        }
      }
    });
    return;
  }

  // Fallback
  track.currentFilteredList.forEach((segment) => {
    const xPos = isBafTrack
      ? Math.max(bounds.left, mapTrackX(track, segment.fromAbs))
      : track._xScale(segment.fromAbs);
    const xEnd = isBafTrack
      ? Math.min(bounds.right, mapTrackX(track, segment.toAbs))
      : track._xScale(segment.toAbs);
    const width = xEnd - xPos;
    if (width <= 0) return;

    track.segmentGraphics.beginFill(segmentColorHex);
    track.segmentGraphics.drawRect(
      xPos,
      track.currentYScaleSegments(segment.yvalue),
      width,
      track.options.segmentHeight
    );

    if (track.options.show_total_cn) {
      track.segmentGraphics.beginFill(blackColorHex);
      track.segmentGraphics.drawRect(xPos, track.currentYScalePoints(segment.total_cn), width, 2);
    }
  });
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

    if (
      Math.abs((this.previousFromX - fromX) / (this.previousToX - this.previousFromX)) >
        refreshStep ||
      Math.abs((this.previousToX - toX) / (this.previousToX - this.previousFromX)) >
        refreshStep
    ) {
      this.currentFilteredList = this.data.filter(
        (segment) => segment.toAbs >= fromX - refreshStep && segment.fromAbs <= toX + refreshStep
      );

      const snpLimit = this.options.yValue === "baf" ? 6000 : 10000;
      this.currentFilteredListSnp = this.snpData
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

    this.segmentGraphics.beginFill(snpColorHex, 0.4);
    this.currentFilteredListSnp.forEach((segment) => {
      const xPos = isBafTrack ? mapTrackX(this, segment.posAbs) : this._xScale(segment.posAbs);
      const bounds = getPlotBounds(this);
      if (isBafTrack && (xPos < bounds.left || xPos > bounds.right)) {
        return;
      }
      // BAF points are drawn smaller for denser, cleaner scatter
      const pointRadius = isBafTrack ? 1.5 : 3;
      this.segmentGraphics.drawCircle(
        xPos,
        this.currentYScalePoints(segment.yvalue),
        pointRadius
      );
    });

    drawPatchedSegments(this, isBafTrack, segmentColorHex, blackColorHex);

    this.loadingText.text = "";
  };

  const originalSetData = instance.setData.bind(instance);
  instance.setData = function patchedSetData(data) {
    this.options.data = data;
    return originalSetData(data);
  };

  const originalSetSnpData = instance.setSnpData.bind(instance);
  instance.setSnpData = function patchedSetSnpData(data) {
    this.options.snpData = data;
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
        const gTrack = result[0];

        // Remove extra default SVG axis/legend line & path overlays
        // appended by OriginalScannerResultTrack to gTrack
        const axisOverlays = gTrack.querySelectorAll("g.axis, g.legend, g.y-axis, path, line");
        axisOverlays.forEach((el) => el.remove());

        const image = gTrack.querySelector("image");
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
