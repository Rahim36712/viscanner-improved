import { ChromosomeInfo } from "smaht-higlass-misc/es/chrom-utils";
import { getPlotBounds, mapTrackX, PLOT_LEFT, PLOT_RIGHT_MARGIN } from "./plotBounds";

const CHROM_BAND_COLOR = "#e7eaed";
const TRACK_TYPE = "aligned-horizontal-gene-annotations";

function HorizontalGeneAnnotationsTrackPatched(HGC, ...args) {
  const OriginalTrack = HGC.tracks.HorizontalGeneAnnotationsTrack;
  if (!OriginalTrack) {
    console.error("HorizontalGeneAnnotationsTrack not found in HGC.tracks!");
    return null;
  }

  // Create the real instance using the original class constructor.
  // We keep the original uncompressed _xScale intact so HiGlass
  // internals (including stretchRects and zooming) work perfectly.
  const instance = new OriginalTrack(...args);

  // Setup PIXI Graphics for alternating chromosome bands
  const PIXI = HGC.libraries?.PIXI || window.PIXI;
  let bandGraphics = null;
  if (PIXI && instance.pBackground) {
    bandGraphics = new PIXI.Graphics();
    instance.pBackground.addChild(bandGraphics);
  }

  let chromInfo = null;
  const context = args[0]; // first element in ...args is context
  const chromSizesUrl =
    instance.options.chromSizesUrl ||
    instance.options.chromInfoPath ||
    context?.chromInfoPath;

  if (chromSizesUrl && ChromosomeInfo) {
    ChromosomeInfo(chromSizesUrl, (info) => {
      chromInfo = info;
      if (instance.draw) {
        instance.draw();
      }
    });
  }

  function drawChromosomeBands() {
    if (!bandGraphics) return;
    bandGraphics.clear();
    if (!chromInfo || !chromInfo.cumPositions || !instance.dimensions) {
      return;
    }

    const width = instance.dimensions[0];
    const height = instance.dimensions[1];
    const { left, right } = getPlotBounds(instance);
    const bandColor = HGC.utils.colorToHex(CHROM_BAND_COLOR);
    const startY = instance.position ? instance.position[1] : 0;

    chromInfo.cumPositions.forEach((chromosome, index) => {
      if (index % 2 !== 0) {
        return;
      }

      const chrLength = Number(chromInfo.chromLengths[chromosome.chr]);
      if (!Number.isFinite(chrLength)) {
        return;
      }

      // Map chromosome boundaries using the standard mapTrackX helper
      const startX = Math.max(left, mapTrackX(instance, chromosome.pos));
      const endX = Math.min(right, mapTrackX(instance, chromosome.pos + chrLength));

      if (endX <= left || startX >= right || endX <= startX) {
        return;
      }

      bandGraphics.beginFill(bandColor, 0.85);
      bandGraphics.drawRect(startX, startY, endX - startX, height);
      bandGraphics.endFill();
    });
  }

  // Hook into draw() to:
  // 1. Perform original draw logic (which renders genes/labels in uncompressed [0, width] space)
  // 2. Compress and translate the PIXI graphics container of each tile to [72, width - 78]
  // 3. Clear and redraw background bands using the compressed coordinates
  const originalDraw = instance.draw.bind(instance);
  instance.draw = function patchedDraw() {
    originalDraw();

    if (instance.dimensions) {
      const width = instance.dimensions[0];
      const scaleX = (width - (PLOT_LEFT + PLOT_RIGHT_MARGIN)) / width;
      const translateX = PLOT_LEFT;

      Object.values(instance.fetchedTiles).forEach((tile) => {
        if (tile.graphics) {
          tile.graphics.scale.x = scaleX;
          tile.graphics.x = translateX;
        }
      });
    }

    drawChromosomeBands();
  };

  return instance;
}

HorizontalGeneAnnotationsTrackPatched.config = {
  type: TRACK_TYPE,
  datatype: ["gene-annotation", "bedlike"],
  local: false,
  orientation: "1d-horizontal",
  name: "Gene Annotations (aligned)",
  thumbnail: null,
  availableOptions: [
    "fontSize",
    "labelColor",
    "labelBackgroundColor",
    "labelPosition",
    "plusStrandColor",
    "minusStrandColor",
    "trackBorderWidth",
    "trackBorderColor",
    "showMousePosition",
    "mousePositionColor",
    "geneAnnotationHeight",
    "geneLabelPosition",
    "geneStrandSpacing"
  ],
  defaultOptions: {
    fontSize: 10,
    labelColor: "black",
    labelBackgroundColor: "#ffffff",
    labelPosition: "hidden",
    plusStrandColor: "blue",
    minusStrandColor: "red",
    trackBorderWidth: 0,
    trackBorderColor: "black",
    showMousePosition: false,
    mousePositionColor: "#000000",
    geneAnnotationHeight: 16,
    geneLabelPosition: "outside",
    geneStrandSpacing: 4
  },
  optionsInfo: {}
};

export default HorizontalGeneAnnotationsTrackPatched;
