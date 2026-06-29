import OriginalScannerResultTrack from "smaht-higlass-misc/es/ScannerResultTrack";

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
    const snpColorHex = this.HGC.utils.colorToHex(this.options.snpColor);
    const blackColorHex = this.HGC.utils.colorToHex("#333333");
    this.segmentGraphics.removeChildren();
    this.segmentGraphics.clear();

    this.segmentGraphics.beginFill(snpColorHex, 0.4);
    this.currentFilteredListSnp.forEach((segment) => {
      const xPos = this._xScale(segment.posAbs);
      this.segmentGraphics.drawCircle(xPos, this.currentYScalePoints(segment.yvalue), 3);
    });

    this.currentFilteredList.forEach((segment) => {
      const xPos = this._xScale(segment.fromAbs);
      const width = this._xScale(segment.toAbs) - xPos;
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

  const originalRerender = instance.rerender.bind(instance);
  instance.rerender = function patchedRerender(options) {
    applyScaleConfig(options);
    return originalRerender(options);
  };

  instance.updateExistingGraphics = patchedUpdateExistingGraphics.bind(instance);
  applyScaleConfig();

  return instance;
}

ScannerResultTrackPatched.config = OriginalScannerResultTrack.config;

export default ScannerResultTrackPatched;
