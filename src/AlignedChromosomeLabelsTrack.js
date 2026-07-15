import BaseTrack from "smaht-higlass-misc/es/BaseTrack";
import { ChromosomeInfo } from "smaht-higlass-misc/es/chrom-utils";
import { scaleLinear } from "d3-scale";
import { getPlotBounds, mapTrackX, unmapTrackX, PLOT_LEFT } from "./plotBounds";

const AXIS_COLOR = "#808080";
const TEXT_STROKE = "#ffffff";
const TICK_WIDTH = 200;
const TICK_HEIGHT = 6;
const TICK_TEXT_SEPARATION = 2;

/**
 * Map an absolute genomic position to [chrName, posWithinChr, absPos, index].
 * Returns null if chromInfo is not loaded.
 */
function absToChr(absPosition, chromInfo) {
  if (!chromInfo || !chromInfo.cumPositions) return null;
  const cumPositions = chromInfo.cumPositions;
  for (let i = 0; i < cumPositions.length; i++) {
    const start = cumPositions[i].pos;
    const end = start + Number(chromInfo.chromLengths[cumPositions[i].chr]);
    if (absPosition >= start && absPosition <= end) {
      return [cumPositions[i].chr, absPosition - start, absPosition, i];
    }
  }
  // If beyond the last chromosome, clamp to the last one
  const lastIndex = cumPositions.length - 1;
  const lastChr = cumPositions[lastIndex];
  return [lastChr.chr, absPosition - lastChr.pos, absPosition, lastIndex];
}

/**
 * Format a tick value with thousands separators.
 * e.g., 2000 → "2,000"
 */
function formatTickValue(pos) {
  return Number(pos).toLocaleString("en-US");
}

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
      this.tickGraphics = new this.HGC.libraries.PIXI.Graphics();
      this.loadingText = new this.HGC.libraries.PIXI.Text("Loading...", {
        fontSize: "12px",
        fontFamily: "Arial",
        fill: "grey",
      });
      this.loadingText.x = PLOT_LEFT;
      this.loadingText.y = this.dimensions[1] / 2;
      this.loadingText.anchor.y = 0.5;

      this.pMain.addChild(this.tickGraphics);
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
      return label;
    }

    /**
     * Draw detailed sub-ticks for a single chromosome that occupies
     * the screen region [vpLeft, vpRight].
     * Returns the number of ticks drawn (0 means "show chromosome name instead").
     */
    drawTicksForChromosome(cumPos, chromLen, vpLeft, vpRight) {
      const numTicks = (vpRight - vpLeft) / TICK_WIDTH;

      if (numTicks < 1) {
        return 0;
      }

      // Determine the visible genomic range of this chromosome
      // within the aligned plot boundaries
      const leftDomain = Math.max(1, unmapTrackX(this, vpLeft) - cumPos.pos);
      const rightDomain = Math.min(
        chromLen,
        unmapTrackX(this, vpRight) - cumPos.pos
      );

      if (rightDomain <= leftDomain) {
        return 0;
      }

      const xScale = scaleLinear()
        .domain([leftDomain, rightDomain])
        .range([vpLeft, vpRight]);

      const ticks = xScale
        .ticks(numTicks)
        .filter((t) => Number.isInteger(t));

      if (ticks.length === 0) {
        return 0;
      }

      const tickColor = this.HGC.utils.colorToHex(
        this.options.tickColor || AXIS_COLOR
      );
      const strokeColor = this.HGC.utils.colorToHex(
        this.options.stroke || TEXT_STROKE
      );
      const yPadding = TICK_HEIGHT + TICK_TEXT_SEPARATION;

      ticks.forEach((tickVal) => {
        const screenX = mapTrackX(this, cumPos.pos + tickVal);

        // Draw vertical tick line at the bottom of the track
        const lineYStart = this.dimensions[1];
        const lineYEnd = this.dimensions[1] - TICK_HEIGHT;

        // White outline for visibility
        this.tickGraphics.lineStyle(1, strokeColor);
        this.tickGraphics.moveTo(screenX - 1, lineYStart);
        this.tickGraphics.lineTo(screenX - 1, lineYEnd - 1);
        this.tickGraphics.lineTo(screenX + 1, lineYEnd - 1);
        this.tickGraphics.lineTo(screenX + 1, lineYStart);

        // Colored tick line
        this.tickGraphics.lineStyle(1, tickColor);
        this.tickGraphics.moveTo(screenX, lineYStart);
        this.tickGraphics.lineTo(screenX, lineYEnd);

        // Tick label text
        const textContent =
          tickVal === 0
            ? `${cumPos.chr}: 1`
            : `${cumPos.chr}: ${formatTickValue(tickVal)}`;

        this.addText(textContent, screenX, this.dimensions[1] - yPadding, {
          fontSize: `${this.options.fontSize || 12}px`,
          anchorX: 0.5,
          anchorY: 1,
        });
      });

      return ticks.length;
    }

    updateExistingGraphics() {
      this.loadingText.text = "";
      this.labelContainer.removeChildren();
      this.tickGraphics.clear();

      if (!this.chromInfo || !this.chromInfo.cumPositions) {
        this.loadingText.text = "Loading chromosome sizes...";
        return;
      }

      const { left, right } = getPlotBounds(this);

      // Find visible chromosomes in the current domain
      const domain = this._xScale.domain();
      const x1 = absToChr(domain[0], this.chromInfo);
      const x2 = absToChr(domain[1], this.chromInfo);

      if (!x1 || !x2) {
        return;
      }

      // Loop through all visible chromosomes
      for (let i = x1[3]; i <= x2[3]; i++) {
        const cumPos = this.chromInfo.cumPositions[i];
        if (!cumPos) continue;

        const chromLen = Number(this.chromInfo.chromLengths[cumPos.chr]);
        if (!Number.isFinite(chromLen)) {
          continue;
        }

        // Screen boundaries of this chromosome, clamped to plot bounds
        const vpLeft = Math.max(left, mapTrackX(this, cumPos.pos));
        const vpRight = Math.min(
          right,
          mapTrackX(this, cumPos.pos + chromLen)
        );

        if (vpRight <= left || vpLeft >= right || vpRight <= vpLeft) {
          continue;
        }

        // Try drawing detailed sub-ticks
        const numTicksDrawn = this.drawTicksForChromosome(
          cumPos,
          chromLen,
          vpLeft,
          vpRight
        );

        // If no detailed ticks were drawn, show the chromosome name
        if (numTicksDrawn <= 0) {
          const centerX = (vpLeft + vpRight) / 2;
          const minLabelWidth = Math.max(
            16,
            String(cumPos.chr).length * 7
          );
          if (vpRight - vpLeft >= minLabelWidth) {
            this.addText(cumPos.chr, centerX, this.dimensions[1] / 2);
          }
        }
      }
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
    "tickColor",
  ],
  defaultOptions: {
    color: AXIS_COLOR,
    stroke: TEXT_STROKE,
    fontSize: 12,
  },
  optionsInfo: {},
};

export default AlignedChromosomeLabelsTrack;
