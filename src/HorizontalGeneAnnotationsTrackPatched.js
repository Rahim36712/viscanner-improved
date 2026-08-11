import { getPlotBounds, mapTrackX } from "./plotBounds";

const TRACK_TYPE = "aligned-horizontal-gene-annotations";

function getAllGeneSymbolsFromTd(td) {
  const symbols = new Set();
  if (!td) return symbols;

  // 1. Check direct geneName property if present
  if (td.geneName && typeof td.geneName === "string") {
    symbols.add(td.geneName.trim().toUpperCase());
  }

  // 2. Check td.fields array for clean gene symbols (excluding exon arrays at index 10 & 11)
  if (Array.isArray(td.fields)) {
    td.fields.forEach((field, index) => {
      // Exclude numeric exon sizes/starts arrays to avoid false positive token matches
      if (index === 10 || index === 11) return;

      if (typeof field === "string" && field.trim().length >= 2) {
        const val = field.trim().toUpperCase();
        // Ignore pure numbers or RefSeq accession prefixes (NM_, NR_)
        if (/^\d+$/.test(val) || val.startsWith("NM_") || val.startsWith("NR_") || val === "HG19") {
          return;
        }
        symbols.add(val);

        // Add base token if field has version/isoform delimiters (e.g. "TP53.1" -> "TP53")
        val.split(/[|_\.\/\s]+/).forEach((part) => {
          if (
            part.length >= 2 &&
            !/^\d+$/.test(part) &&
            !part.startsWith("NM") &&
            !part.startsWith("NR") &&
            part !== "HG19"
          ) {
            symbols.add(part);
          }
        });
      }
    });
  }

  return symbols;
}

function isGeneMatchingFilter(td, instance, geneFilterSet) {
  if (!td) return false;
  if (td.type === "filler") return true;

  const candidateSymbols = getAllGeneSymbolsFromTd(td);
  if (candidateSymbols.size === 0) return false;

  for (const filterGene of geneFilterSet) {
    for (const candidate of candidateSymbols) {
      if (
        candidate === filterGene ||
        candidate.startsWith(filterGene) ||
        filterGene.startsWith(candidate)
      ) {
        return true;
      }
    }
  }

  return false;
}

function HorizontalGeneAnnotationsTrackPatched(HGC, ...args) {
  const OriginalTrack = HGC.tracks.HorizontalGeneAnnotationsTrack;
  if (!OriginalTrack) {
    console.error("HorizontalGeneAnnotationsTrack not found in HGC.tracks!");
    return null;
  }

  const instance = new OriginalTrack(...args);

  instance.geneFilterSet = null;

  // Save reference to HiGlass's original renderTile method
  const originalRenderTile = instance.renderTile.bind(instance);

  // Hook renderTile to filter tileData BEFORE HiGlass draws PIXI rects and text
  instance.renderTile = function patchedRenderTile(tile) {
    if (!tile || !tile.tileData) return;

    // 1. Preserve exact original tileData reference from HiGlass upon first load
    if (!tile.originalTileData) {
      tile.originalTileData = tile.tileData;
    }

    // 2. Filter tile.tileData based on active geneFilterSet
    if (instance.geneFilterSet && instance.geneFilterSet.size > 0) {
      tile.tileData = tile.originalTileData.filter((td) =>
        isGeneMatchingFilter(td, instance, instance.geneFilterSet)
      );
    } else {
      // 3. Restore exact original tileData reference when filter is cleared / empty
      tile.tileData = tile.originalTileData;
    }

    // 4. Delegate to HiGlass's original renderTile to draw tileData into PIXI
    originalRenderTile(tile);
  };

  const originalGetMouseOverHtml = typeof instance.getMouseOverHtml === "function"
    ? instance.getMouseOverHtml.bind(instance)
    : null;

  if (originalGetMouseOverHtml) {
    instance.getMouseOverHtml = function patchedGetMouseOverHtml(trackX, trackY) {
      if (instance.fetchedTiles) {
        Object.values(instance.fetchedTiles).forEach((tile) => {
          if (tile && Array.isArray(tile.tileData)) {
            tile.tileData.forEach((td) => {
              if (td && !td.fields) {
                td.fields = [];
              }
            });
          }
        });
      }
      try {
        return originalGetMouseOverHtml(trackX, trackY);
      } catch (err) {
        console.warn("Caught error in getMouseOverHtml:", err);
        return "";
      }
    };
  }

  instance.setGeneFilter = function (geneList) {
    if (Array.isArray(geneList) && geneList.length > 0) {
      instance.geneFilterSet = new Set(
        geneList.map((g) => String(g).trim().toUpperCase()).filter(Boolean)
      );
    } else {
      instance.geneFilterSet = null;
    }

    // Clear tile graphics & texts to force HiGlass to re-render tileData
    Object.values(instance.fetchedTiles).forEach((tile) => {
      if (tile.graphics) tile.graphics.clear();
      if (tile.rectGraphics) tile.rectGraphics.clear();
      if (tile.rectMaskGraphics) tile.rectMaskGraphics.clear();
      if (tile.textGraphics) {
        tile.textGraphics.removeChildren();
      }
      if (tile.textBgGraphics) tile.textBgGraphics.clear();

      tile.texts = {};
      tile.initialized = false;

      if (typeof instance.renderTile === "function") {
        instance.renderTile(tile);
      }
    });

    if (Array.isArray(instance.allTexts)) instance.allTexts = [];
    if (Array.isArray(instance.allBoxes)) instance.allBoxes = [];

    if (typeof instance.draw === "function") {
      instance.draw();
    }

    // Immediately flush WebGL canvas frame within sub-milliseconds
    if (window.hgc && window.hgc.current) {
      const hgc = window.hgc.current;
      try {
        if (hgc.pixiStage && hgc.pixiRenderer) {
          hgc.pixiRenderer.render(hgc.pixiStage);
        }
      } catch (e) {}
    }
  };

  instance.getVisibleGeneNames = function () {
    const geneNames = new Set();
    Object.values(instance.fetchedTiles).forEach((tile) => {
      const data = tile.originalTileData || tile.tileData;
      if (Array.isArray(data)) {
        data.forEach((td) => {
          if (td.type === "filler") return;
          const candidates = getAllGeneSymbolsFromTd(td);
          candidates.forEach((name) => {
            if (
              name &&
              name.length >= 2 &&
              !/^\d+$/.test(name) &&
              !name.startsWith("NM") &&
              !name.startsWith("NR") &&
              name !== "HG19"
            ) {
              geneNames.add(name);
            }
          });
        });
      }
    });
    return Array.from(geneNames).sort();
  };

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

    const allRenderedTexts = [];

    Object.values(instance.fetchedTiles).forEach((tile) => {
      if (!tile.graphics) return;

      const childScaleX = tile.rectGraphics ? tile.rectGraphics.scale.x : 1;
      const childOffsetX = tile.rectGraphics ? tile.rectGraphics.x : 0;

      if (tile.rectGraphics) {
        tile.rectGraphics.scale.x = 1;
        tile.rectGraphics.x = 0;
      }
      if (tile.rectMaskGraphics) {
        tile.rectMaskGraphics.scale.x = 1;
        tile.rectMaskGraphics.x = 0;
      }

      const parentScaleX = childScaleX * compressionScale;
      tile.graphics.scale.x = parentScaleX;
      tile.graphics.x = compressionOffset + childOffsetX * compressionScale;

      const invScaleX = parentScaleX !== 0 ? 1 / parentScaleX : 1;

      if (tile.textGraphics) {
        tile.textGraphics.scale.x = invScaleX;
        tile.textGraphics.x = 0;
      }
      if (tile.textBgGraphics) {
        tile.textBgGraphics.scale.x = invScaleX;
        tile.textBgGraphics.x = 0;
      }

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

          text.txMiddle = txMiddle;

          const targetScreenX = mapTrackX(instance, txMiddle);
          text.position.x = (targetScreenX - tile.graphics.x) * parentScaleX;
          text.scale.x = 1;

          const textWidth = (text.width && text.width > 0)
            ? text.width
            : (text.text ? text.text.length * 7 : 35);
          const strand = td.fields && td.fields[5] ? td.fields[5] : "+";

          allRenderedTexts.push({
            text,
            targetScreenX,
            textWidth,
            strand,
            isPlusStrand: strand === "+",
            tile,
            parentScaleX,
          });
        });
      }
    });

    // Smart 1D Screen-Space Collision Detection in Mapped Coordinates
    const occupiedPlus = [];
    const occupiedMinus = [];

    allRenderedTexts.sort((a, b) => a.targetScreenX - b.targetScreenX);

    allRenderedTexts.forEach((item) => {
      const { text, targetScreenX, textWidth, isPlusStrand } = item;
      const padding = 10; // 10px minimum padding between text labels on screen
      const leftBoundary = targetScreenX - textWidth / 2 - padding;
      const rightBoundary = targetScreenX + textWidth / 2 + padding;

      const occupiedList = isPlusStrand ? occupiedPlus : occupiedMinus;

      let collides = false;
      for (const interval of occupiedList) {
        if (leftBoundary < interval.right && rightBoundary > interval.left) {
          collides = true;
          break;
        }
      }

      // When unfiltered, hide colliding gene labels to prevent text overlapping!
      // When user filters specific genes, always render target genes clearly!
      if (collides && !instance.geneFilterSet) {
        text.visible = false;
      } else {
        text.visible = true;
        occupiedList.push({ left: leftBoundary, right: rightBoundary });
      }
    });

    // Redraw text backgrounds for visible labels using mapped screen coordinates
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
        if (!text || !text.visible) return;

        const box = instance.allBoxes[i];
        if (!box) return;

        const textGraphics = text.parent;
        if (!textGraphics || !textGraphics.parent) return;
        const tileGraphics = textGraphics.parent;
        const tile = Object.values(instance.fetchedTiles).find(
          (t) => t.graphics === tileGraphics
        );
        if (!tile || !tile.textBgGraphics) return;

        if (text.txMiddle === undefined) return;

        const parentScaleX = tile.graphics.scale.x;
        const targetScreenX = mapTrackX(instance, text.txMiddle);
        const localCenterX = (targetScreenX - tile.graphics.x) * parentScaleX;

        const [minX, minY, maxX, maxY] = box;
        const width = maxX - minX;
        const height = maxY - minY;

        tile.textBgGraphics.drawRect(
          localCenterX - width / 2,
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
