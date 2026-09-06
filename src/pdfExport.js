// Use PDFKit's browser build so its built-in PDF fonts do not try to call
// Node's fs.readFileSync at export time.
import PDFDocument from "pdfkit/js/pdfkit.standalone.js";
import SVGtoPDF from "svg-to-pdfkit";
import blobStream from "blob-stream";
import { SV_CONFIG, TRACK_COLORS } from "./labelsConfig";

const PX_TO_PT = 72 / 96;
const DEFAULT_WIDTH = 1200;
const DEFAULT_HEIGHT = 800;

function parseLength(value, fallback) {
  if (typeof value !== "string" && typeof value !== "number") {
    return fallback;
  }

  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getSvgSize(svgMarkup) {
  const document = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
  const svg = document.documentElement;
  const viewBox = (svg.getAttribute("viewBox") || "")
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  const viewBoxWidth = viewBox.length === 4 && viewBox[2] > 0 ? viewBox[2] : DEFAULT_WIDTH;
  const viewBoxHeight = viewBox.length === 4 && viewBox[3] > 0 ? viewBox[3] : DEFAULT_HEIGHT;

  const width = parseLength(svg.getAttribute("width"), viewBoxWidth);
  const height = parseLength(svg.getAttribute("height"), viewBoxHeight);

  return {
    // HiGlass exports CSS pixels. Use PDF points for a sensible physical page size,
    // while the SVG viewBox keeps every path and text element scalable.
    width: width * PX_TO_PT,
    height: height * PX_TO_PT,
  };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Sanitizes HiGlass SVG markup for PDF rendering by removing unwanted
 * container bounding boxes, zero-opacity track outline rects, and enforcing
 * explicit stroke="none" fill="none" presentation attributes where needed.
 */
export function sanitizeSvgForPdf(svgMarkup) {
  if (!svgMarkup || typeof svgMarkup !== "string") {
    return svgMarkup;
  }

  let cleaned = svgMarkup;

  // Completely strip unthemed layout/container <rect> tags (such as fill-opacity="0")
  cleaned = cleaned.replace(/<rect[^>]*fill-opacity=["']0["'][^>]*>(?:\s*<\/rect>)?/gi, "");
  cleaned = cleaned.replace(/<rect[^>]*fill-opacity=["']0["'][^>]*\/>/gi, "");

  // Convert any remaining rect without fill/stroke to explicit stroke="none" fill="none"
  cleaned = cleaned.replace(/<rect([^>]*)>/gi, (match, attrs) => {
    if (!attrs.includes("stroke=") && !attrs.includes("fill=")) {
      return `<rect${attrs} stroke="none" fill="none">`;
    }
    return match;
  });

  return cleaned;
}

/**
 * Convert HiGlass high-resolution PNG Blob into a crisp PDF file.
 * Captures 1-to-1 pixel-perfect canvas rendering with zero border line artifacts.
 */
export function exportPngBlobAsPdf(pngBlob, filename = "viscanner-cohort.pdf") {
  return new Promise((resolve, reject) => {
    if (!pngBlob) {
      return reject(new Error("No PNG blob provided for PDF export."));
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dataUrl = reader.result;
        const base64Data = dataUrl.split(",")[1];
        const binaryString = window.atob(base64Data);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        const img = new Image();
        img.onload = () => {
          try {
            // Convert px dimensions to PDF pt (72 pt / 96 px)
            const ptWidth = Math.round(img.width * (72 / 96));
            const ptHeight = Math.round(img.height * (72 / 96));

            const pdf = new PDFDocument({
              autoFirstPage: false,
              margin: 0,
              size: [ptWidth, ptHeight],
              compress: true,
            });
            const stream = pdf.pipe(blobStream());

            stream.on("finish", () => {
              try {
                const blob = stream.toBlob("application/pdf");
                downloadBlob(blob, filename);
                resolve(blob);
              } catch (err) {
                reject(err);
              }
            });
            stream.on("error", reject);

            pdf.addPage({ size: [ptWidth, ptHeight], margin: 0 });
            pdf.image(bytes.buffer, 0, 0, { width: ptWidth, height: ptHeight });
            pdf.end();
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error("Failed to load PNG image for PDF conversion."));
        img.src = dataUrl;
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read PNG Blob for PDF export."));
    reader.readAsDataURL(pngBlob);
  });
}

/**
 * Convert HiGlass' SVG export into a PDF without rasterizing the SVG as a whole.
 * SVG paths, labels, axes, and shapes remain PDF vector content. Pixi layers that
 * HiGlass exposes as embedded images remain embedded at the track export's
 * high-resolution capture, which avoids introducing an additional rasterization
 * step during PDF generation.
 */
export function exportSvgAsPdf(svgMarkup, customFilename = null, customMetadata = null) {
  if (!svgMarkup || typeof svgMarkup !== "string") {
    return Promise.reject(new Error("The visualization did not return an SVG export."));
  }

  const defaultSampleName =
    (typeof window !== "undefined" && window._viscannerLoadedSampleName) || "Sample 2009";

  const meta =
    customMetadata ||
    (typeof window !== "undefined" ? window._viscannerSampleMetadata : null) || {
      sample_name: defaultSampleName,
      ploidy: "2.57",
      purity: "0.65",
      confidence: "0.86",
    };

  const sampleName =
    meta.sample_name && meta.sample_name !== "1437_merged"
      ? meta.sample_name
      : defaultSampleName;

  const filename =
    customFilename ||
    `viscanner_${sampleName.replace(/[^a-zA-Z0-9_\-]/g, "_")}.pdf`;

  const cleanedSvg = sanitizeSvgForPdf(svgMarkup);
  const { width, height } = getSvgSize(cleanedSvg);

  const HEADER_HEIGHT = 86; // Height reserved at the top for sample title, QC metrics & legend
  const totalHeight = height + HEADER_HEIGHT;

  return new Promise((resolve, reject) => {
    // Yield execution to event loop so UI state (e.g. loading spinner) updates before PDF compilation
    setTimeout(() => {
      try {
        const pdf = new PDFDocument({
          autoFirstPage: false,
          margin: 0,
          size: [width, totalHeight],
          compress: true,
        });
        const stream = pdf.pipe(blobStream());

        stream.on("finish", () => {
          try {
            const blob = stream.toBlob("application/pdf");
            downloadBlob(blob, filename);
            resolve(blob);
          } catch (err) {
            reject(err);
          }
        });
        stream.on("error", reject);

        pdf.addPage({ size: [width, totalHeight], margin: 0 });

        // 1. Crisp white background for header area
        pdf.rect(0, 0, width, HEADER_HEIGHT).fill("#ffffff");

        // 2. Sample ID Title (Red, bold, centered)
        pdf
          .font("Helvetica-Bold")
          .fontSize(14)
          .fillColor("#D90429")
          .text(sampleName, 0, 10, { width, align: "center" });

        // 3. QC Metrics Row (Ploidy, Purity, Confidence)
        const hasMetrics =
          meta.hasMetrics !== false &&
          meta.ploidy !== undefined &&
          meta.ploidy !== null &&
          meta.ploidy !== "";

        if (hasMetrics) {
          const ploidyVal = String(meta.ploidy);
          const purityVal = meta.purity !== undefined && meta.purity !== null ? String(meta.purity) : "-";
          const confVal = meta.confidence !== undefined && meta.confidence !== null ? String(meta.confidence) : "-";

          pdf.font("Helvetica-Bold").fontSize(10);
          const fullMetricsStr = `Ploidy: ${ploidyVal}    Purity: ${purityVal}    Confidence: ${confVal}`;
          const metricsStrWidth = pdf.widthOfString(fullMetricsStr);
          let startX = Math.max(10, (width - metricsStrWidth) / 2);
          const metricsY = 28;

          pdf.fillColor("#2D7DD2").text("Ploidy: ", startX, metricsY, { continued: true });
          pdf.fillColor("#D90429").text(`${ploidyVal}    `, { continued: true });
          pdf.fillColor("#2D7DD2").text("Purity: ", { continued: true });
          pdf.fillColor("#D90429").text(`${purityVal}    `, { continued: true });
          pdf.fillColor("#2D7DD2").text("Confidence: ", { continued: true });
          pdf.fillColor("#D90429").text(confVal, { continued: false });
        }

        // 4. Dot Swatches Row (HP-1, HP-2, BAF only, no duplicate line items)
        const swatchesY = 46;
        const swatchItems = [
          { type: "dot", label: "HP-1", color: TRACK_COLORS.hp1 || "#B23A48" },
          { type: "dot", label: "HP-2", color: TRACK_COLORS.hp2 || "#2D7DD2" },
          { type: "dot", label: "BAF", color: "#9A9D32" },
        ];

        pdf.font("Helvetica").fontSize(9);
        let totalSwatchesWidth = 0;
        swatchItems.forEach((item) => {
          totalSwatchesWidth += 12 + pdf.widthOfString(item.label) + 16;
        });

        let swatchX = Math.max(10, (width - totalSwatchesWidth) / 2);
        swatchItems.forEach((item) => {
          pdf.circle(swatchX + 4, swatchesY + 4, 3.5).fill(item.color);
          swatchX += 12;
          pdf.fillColor("#444444").text(item.label, swatchX, swatchesY, { continued: false });
          swatchX += pdf.widthOfString(item.label) + 16;
        });

        // 5. Horizontal SV Type Badges synchronized with SV_CONFIG.TYPE_COLORS
        const badgesY = 64;
        const badges = [
          { label: "DEL", color: SV_CONFIG.TYPE_COLORS.DEL || "#B82607" },
          { label: "INV", color: SV_CONFIG.TYPE_COLORS.INV || "#D1970F" },
          { label: "INS", color: SV_CONFIG.TYPE_COLORS.INS || "#0004FF" },
          { label: "BND", color: SV_CONFIG.TYPE_COLORS.BND || "#616060" },
          { label: "DUP", color: SV_CONFIG.TYPE_COLORS.DUP || "#399953" },
          { label: "LOH", color: TRACK_COLORS.lohRegionBorder || "#555555" },
        ];

        const badgeWidth = 32;
        const badgeHeight = 14;
        const badgeGap = 8;
        const totalBadgesWidth = badges.length * badgeWidth + (badges.length - 1) * badgeGap;
        let badgeX = Math.max(10, (width - totalBadgesWidth) / 2);

        badges.forEach((b) => {
          pdf.roundedRect(badgeX, badgesY, badgeWidth, badgeHeight, 2).fill(b.color);
          pdf
            .font("Helvetica-Bold")
            .fontSize(7.5)
            .fillColor("#ffffff")
            .text(b.label, badgeX, badgesY + 3, { width: badgeWidth, align: "center" });
          badgeX += badgeWidth + badgeGap;
        });

        // 6. Draw HiGlass SVG below header
        SVGtoPDF(pdf, cleanedSvg, 0, HEADER_HEIGHT, {
          assumePt: false,
          height,
          precision: 6,
          preserveAspectRatio: "none",
          width,
          fontCallback: (family) => {
            if (/bold/i.test(family)) return "Helvetica-Bold";
            if (/oblique|italic/i.test(family)) return "Helvetica-Oblique";
            return "Helvetica";
          },
        });
        pdf.end();
      } catch (error) {
        reject(error);
      }
    }, 20);
  });
}

/**
 * Safely extracts high-resolution PNG base64 data URLs from Pixi containers
 * without corrupting WebGL renderer context, main canvas framebuffers, or screen display.
 *
 * Includes automatic memory-safe scaling: the effective scale is capped so that
 * no single offscreen texture exceeds ~50 MB of RGBA pixel data, preventing
 * Chrome "Out of Memory" tab crashes on wide viewports.
 */
export function createHighResBase64Extractor(HGC, scale = 6) {
  const renderer = HGC?.services?.pixiRenderer;
  if (!renderer || !renderer.plugins || !renderer.plugins.extract) {
    return null;
  }

  const originalBase64 = renderer.plugins.extract.base64.bind(renderer.plugins.extract);

  // Maximum bytes a single offscreen RGBA texture may occupy.
  // 50 MB keeps us well within Chrome's per-tab budget even with 7+ tracks.
  const MAX_TEXTURE_BYTES = 50 * 1024 * 1024; // 50 MB

  const highResBase64 = (target) => {
    let renderTexture = null;
    try {
      if (!target) {
        return originalBase64(target);
      }

      let bounds = null;
      try {
        if (target.getBounds) {
          bounds = target.getBounds();
        }
      } catch (e) {}

      if (!bounds || !Number.isFinite(bounds.width) || bounds.width <= 0 || !Number.isFinite(bounds.height) || bounds.height <= 0) {
        return originalBase64(target);
      }

      // GPU texture dimension limit
      const maxTextureSize = (renderer.gl && typeof renderer.gl.getParameter === "function")
        ? Math.min(16384, renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE) || 16384)
        : 8192;

      const width = Math.ceil(bounds.width);
      const height = Math.ceil(bounds.height);

      // --- Memory-safe scale calculation ---
      let effectiveScale = scale;

      // 1. Cap by GPU max texture dimension
      if (width * effectiveScale > maxTextureSize || height * effectiveScale > maxTextureSize) {
        effectiveScale = Math.min(maxTextureSize / width, maxTextureSize / height);
      }

      // 2. Cap by memory budget (4 bytes per RGBA pixel)
      const pixelBytes = width * effectiveScale * height * effectiveScale * 4;
      if (pixelBytes > MAX_TEXTURE_BYTES) {
        // Solve: w*s * h*s * 4 <= budget  =>  s <= sqrt(budget / (w*h*4))
        effectiveScale = Math.sqrt(MAX_TEXTURE_BYTES / (width * height * 4));
      }

      // Floor to avoid sub-pixel rounding issues; minimum 2x
      effectiveScale = Math.max(2, Math.floor(effectiveScale));

      renderTexture = HGC.libraries.PIXI.RenderTexture.create(
        width * effectiveScale,
        height * effectiveScale
      );

      // Translate target's stage position to (0,0), then scale
      const matrix = new HGC.libraries.PIXI.Matrix();
      matrix.translate(-bounds.x, -bounds.y);
      matrix.scale(effectiveScale, effectiveScale);

      renderer.render(target, renderTexture, false, matrix, true);

      const canvas = renderer.plugins.extract.canvas(renderTexture);
      const b64 = canvas.toDataURL("image/png");

      // Immediately free GPU + canvas memory
      renderTexture.destroy(true);
      renderTexture = null;
      canvas.width = 1;
      canvas.height = 1;

      // Rebind renderer back to screen
      _rebindToScreen(renderer);

      return b64;
    } catch (err) {
      console.warn("High-res capture fallback:", err);
      if (renderTexture) {
        try { renderTexture.destroy(true); } catch (e) {}
      }
      _rebindToScreen(renderer);
      return originalBase64(target);
    }
  };

  return { highResBase64, originalBase64 };
}

/**
 * Rebind the Pixi renderer back to the screen framebuffer so
 * that subsequent renders (including live on-screen display and
 * future exports) target the correct canvas.
 */
function _rebindToScreen(renderer) {
  try {
    // Render to null (= screen) to reset the active framebuffer
    if (renderer.renderTexture) {
      renderer.renderTexture.bind(null);
    }
    // Reset WebGL state machine
    if (renderer.reset) renderer.reset();
    // Flush any pending batched geometry so the state is clean
    if (renderer.batch && renderer.batch.currentRenderer) {
      renderer.batch.currentRenderer.stop();
    }
  } catch (e) {
    // Fallback for Pixi v5 / older API
    try {
      if (renderer.bind) renderer.bind();
      if (renderer.reset) renderer.reset();
    } catch (e2) {}
  }
}
