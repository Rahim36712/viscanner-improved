import OriginalScannerResultTrack from "smaht-higlass-misc/es/ScannerResultTrack";
import { getPlotBounds, mapTrackX } from "./plotBounds";

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
  const { left, right } = getPlotBounds(track);
  track.bgGraphics.beginFill(track.HGC.utils.colorToHex("#ebebeb"));
  track.legendUtils.currentLegendLevels.forEach((yLevel) => {
    track.bgGraphics.drawRect(left, yLevel, right - left, 1);
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
      this.segmentGraphics.drawCircle(xPos, this.currentYScalePoints(segment.yvalue), 3);
    });

    this.currentFilteredList.forEach((segment) => {
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
      this.segmentGraphics.beginFill(segmentColorHex);
      this.segmentGraphics.drawRect(
        xPos,
        this.currentYScaleSegments(segment.yvalue),
        width,
        this.options.segmentHeight
      );
      if (this.options.show_total_cn) {
        this.segmentGraphics.beginFill(blackColorHex);
        this.segmentGraphics.drawRect(xPos, this.currentYScalePoints(segment.total_cn), width, 2);
      }
    });

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

  return instance;
}

ScannerResultTrackPatched.config = OriginalScannerResultTrack.config;

export default ScannerResultTrackPatched;
