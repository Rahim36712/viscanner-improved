import { sanitizeSvgForPdf, exportPngBlobAsPdf } from "./pdfExport";

describe("pdfExport - sanitizeSvgForPdf", () => {
  test("should handle null or invalid SVG inputs gracefully", () => {
    expect(sanitizeSvgForPdf(null)).toBeNull();
    expect(sanitizeSvgForPdf(undefined)).toBeUndefined();
    expect(sanitizeSvgForPdf("")).toBe("");
  });

  test("should completely strip container rect tags with fill-opacity='0'", () => {
    const rawSvg = '<svg><rect x="15" y="47" width="887" height="95" fill-opacity="0"></rect></svg>';
    const cleaned = sanitizeSvgForPdf(rawSvg);

    expect(cleaned).not.toContain('<rect');
    expect(cleaned).toBe('<svg></svg>');
  });

  test("should preserve valid styled rect tags", () => {
    const styledSvg = '<svg><rect x="0" y="0" width="100" height="100" fill="red" stroke="blue"></rect></svg>';
    const cleaned = sanitizeSvgForPdf(styledSvg);

    expect(cleaned).toContain('fill="red"');
    expect(cleaned).toContain('stroke="blue"');
  });
});

describe("pdfExport - exportPngBlobAsPdf", () => {
  test("should reject if no blob provided", async () => {
    await expect(exportPngBlobAsPdf(null)).rejects.toThrow("No PNG blob provided for PDF export.");
  });
});
