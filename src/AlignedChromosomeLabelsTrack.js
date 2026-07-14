import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo } from "smaht-higlass-misc/es/chrom-utils";
import { getPlotBounds, mapTrackX, PLOT_LEFT } from "./plotBounds";

const AXIS_COLOR = "#808080";
const TEXT_STROKE = "#ffffff";
function AlignedChromosomeLabelsTrack(HGC, ...args) {
  class AlignedChromosomeLabelsTrackClass extends BaseTrack(HGC, ...args) {
    constructor(context, options) {
      super(context, options);
      this.HGC = HGC;
      this.chromInfo = null;
      this.initTrack();

      const chromSizesUrl =
        this.options.chromSizesUrl ||
        this.options.chromInfoPath ||
        context.chromInfoPath;

      if (chromSizesUrl) {
        ChromosomeInfo(chromSizesUrl, (chromInfo) => {
          this.chromInfo = chromInfo;
          this.updateExistingGraphics();
        });
      }
    }

    initTrack() {
      this.pForeground.removeChildren();
      this.pForeground.clear();
      this.pMain.removeChildren();
      this.pMain.clear();

      this.labelContainer = new this.HGC.libraries.PIXI.Container();
      this.loadingText = new this.HGC.libraries.PIXI.Text("Loading...", {
        fontSize: "12px",
        fontFamily: "Arial",
        fill: "grey",
      });
      this.loadingText.x = PLOT_LEFT;
      this.loadingText.y = this.dimensions[1] / 2;
      this.loadingText.anchor.y = 0.5;

      this.pForeground.addChild(this.labelContainer);
      this.pForeground.addChild(this.loadingText);
    }

    addText(text, x, y, options = {}) {
      const label = new this.HGC.libraries.PIXI.Text(text, {
        fontSize: options.fontSize || `${this.options.fontSize || 12}px`,
        fontFamily: "Arial",
        fill: options.fill || this.options.color || AXIS_COLOR,
        stroke: options.stroke || this.options.stroke || TEXT_STROKE,
        strokeThickness: 2,
      });
      label.x = x;
      label.y = y;
      label.anchor.x = options.anchorX === undefined ? 0.5 : options.anchorX;
      label.anchor.y = options.anchorY === undefined ? 0.5 : options.anchorY;
      this.labelContainer.addChild(label);
    }

    updateExistingGraphics() {
      this.loadingText.text = "";
      this.labelContainer.removeChildren();

      if (!this.chromInfo || !this.chromInfo.cumPositions) {
        this.loadingText.text = "Loading chromosome sizes...";
        return;
      }

      const { left, right } = getPlotBounds(this);
      const y = this.dimensions[1] / 2;

      this.chromInfo.cumPositions.forEach((chromosome) => {
        const chrLength = Number(this.chromInfo.chromLengths[chromosome.chr]);
        if (!Number.isFinite(chrLength)) {
          return;
        }

        const startX = Math.max(left, mapTrackX(this, chromosome.pos));
        const endX = Math.min(right, mapTrackX(this, chromosome.pos + chrLength));
        if (endX <= left || startX >= right || endX <= startX) {
          return;
        }

        const x = (startX + endX) / 2;
        const minLabelWidth = Math.max(16, String(chromosome.chr).length * 7);
        if (endX - startX < minLabelWidth) {
          return;
        }

        this.addText(chromosome.chr, x, y);
      });
    }

    rerender(options) {
      this.options = {
        ...this.options,
        ...(options || {}),
      };
      this.updateExistingGraphics();
    }

    draw() {
      this.updateExistingGraphics();
    }

    zoomed(newXScale, newYScale) {
      super.zoomed(newXScale, newYScale);
      this.updateExistingGraphics();
    }
  }

  return new AlignedChromosomeLabelsTrackClass(...args);
}

const icon = new DOMParser().parseFromString(
  '<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg"><text x="2" y="11" font-size="8" fill="#808080">chr</text><line x1="2" y1="14" x2="14" y2="14" stroke="#808080"/></svg>',
  "text/xml"
).documentElement;

AlignedChromosomeLabelsTrack.config = {
  type: "alignedChromosomeLabels",
  datatype: ["chromsizes"],
  local: true,
  orientation: "1d-horizontal",
  name: "Aligned chromosome labels",
  thumbnail: icon,
  availableOptions: [
    "chromSizesUrl",
    "chromInfoPath",
    "color",
    "stroke",
    "fontSize",
  ],
  defaultOptions: {
    color: AXIS_COLOR,
    stroke: TEXT_STROKE,
    fontSize: 12,
  },
  optionsInfo: {},
};

export default AlignedChromosomeLabelsTrack;
