import { getPlotBounds, mapTrackX } from "./plotBounds";

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

  // Hook into draw() to:
  // 1. Perform original draw logic (which renders genes/labels in uncompressed [0, width] space)
  // 2. Compress and translate the PIXI graphics container of each tile to [72, width - 78]
  const originalDraw = instance.draw.bind(instance);
  instance.draw = function patchedDraw() {
    originalDraw();

    if (!instance.dimensions || !instance.dimensions[0] || instance.dimensions[0] <= 0) {
      return;
    }

    const width = instance.dimensions[0];
    const { left, right } = getPlotBounds(instance);
    const compressionScale = (right - left) / width;
    const compressionOffset = left;

    Object.values(instance.fetchedTiles).forEach((tile) => {
      if (!tile.graphics) return;

      // stretchRects (called inside renderTile/draw) sets tile.rectGraphics
      // and tile.rectMaskGraphics scale/position. We need to incorporate those
      // child transforms into a single parent transform to avoid double-scaling.

      // Read the stretchRects values from tile.rectGraphics (if any)
      const childScaleX = tile.rectGraphics ? tile.rectGraphics.scale.x : 1;
      const childOffsetX = tile.rectGraphics ? tile.rectGraphics.x : 0;

      // Reset child container transforms to neutral
      if (tile.rectGraphics) {
        tile.rectGraphics.scale.x = 1;
        tile.rectGraphics.x = 0;
      }
      if (tile.rectMaskGraphics) {
        tile.rectMaskGraphics.scale.x = 1;
        tile.rectMaskGraphics.x = 0;
      }

      // Apply combined transform: first stretchRects, then compression
      // Combined: effective_x = compressionOffset + (childOffsetX + local_x * childScaleX) * compressionScale
      // = compressionOffset + childOffsetX * compressionScale + local_x * childScaleX * compressionScale
      tile.graphics.scale.x = childScaleX * compressionScale;
      tile.graphics.x = compressionOffset + childOffsetX * compressionScale;

      // Exclude text/label children (tile.textGraphics and tile.textBgGraphics)
      // from the parent scale.
      const parentScaleX = tile.graphics.scale.x;
      const invScaleX = parentScaleX !== 0 ? 1 / parentScaleX : 1;

      if (tile.textGraphics) {
        tile.textGraphics.scale.x = invScaleX;
        tile.textGraphics.x = 0;
      }
      if (tile.textBgGraphics) {
        tile.textBgGraphics.scale.x = invScaleX;
        tile.textBgGraphics.x = 0;
      }

      // Reposition their .x individually via mapTrackX(instance, <their genomic position>)
      if (tile.initialized && tile.texts && tile.tileData) {
        tile.tileData.forEach((td) => {
          if (td.type === "filler") return;
          const geneId = instance.geneId(td.fields, td.type);
          const text = tile.texts[geneId];
          if (!text) return;

          const chrOffset = +td.chrOffset;
          const txStart = +td.fields[1] + chrOffset;
          const txEnd = +td.fields[2] + chrOffset;
          const txMiddle = (txStart + txEnd) / 2;

          text.txMiddle = txMiddle; // Cache txMiddle for redrawing background rects
          text.position.x = mapTrackX(instance, txMiddle) - tile.graphics.x;
        });
      }
    });

    // Redraw text backgrounds using the new mapped positions
    Object.values(instance.fetchedTiles).forEach((tile) => {
      if (!tile.graphics) return;

      if (tile.textBgGraphics) {
        tile.textBgGraphics.clear();
        tile.textBgGraphics.beginFill(
          typeof instance.options.labelBackgroundColor !== "undefined"
            ? HGC.utils.colorToHex(instance.options.labelBackgroundColor)
            : HGC.utils.colorToHex("#ffffff")
        );
      }
    });

    if (instance.allTexts && instance.allBoxes) {
      instance.allTexts.forEach((textObj, i) => {
        const text = textObj.text;
        if (!text.visible) return;

        const box = instance.allBoxes[i];
        if (!box) return;

        // Find the tile graphics
        const textGraphics = text.parent;
        if (!textGraphics || !textGraphics.parent) return;
        const tileGraphics = textGraphics.parent;
        const tile = Object.values(instance.fetchedTiles).find(
          (t) => t.graphics === tileGraphics
        );
        if (!tile || !tile.textBgGraphics) return;

        if (text.txMiddle === undefined) return;

        const targetScreenX = mapTrackX(instance, text.txMiddle);
        const localCenterX = targetScreenX - tile.graphics.x;

        const [minX, minY, maxX, maxY] = box;
        const width = maxX - minX;
        const height = maxY - minY;

        // Redraw using the offset coordinate formula
        tile.textBgGraphics.drawRect(
          localCenterX - width,
          minY - height / 2,
          width,
          height
        );
      });
    }
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
