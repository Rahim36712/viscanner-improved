/**
 * labelsConfig.js
 * 
 * Centralized Configuration for ViScanner / HiScanner UI Labels & Structural Variation (SV) Styling.
 * 
 * To customize any text on the website or change structural variation colors/arc thickness,
 * simply edit the values in this file!
 */

export const LABELS = {
  // Main Navigation / Header
  appTitle: "HiScanner output visualization",
  visualizationSectionTitle: "Interactive visualization",
  exportPdfButton: "Export PDF",

  // WAKHAN Track Visibility Controls (Left Panel)
  wakhanVisibility: {
    panelTitle: "WAKHAN visibility",
    hp1Plot: "HP1 copy number plot",
    hp2Plot: "HP2 copy number plot",
    coveragePoints: "Coverage depth plot",
  },

  // Structural Variation (SV) Visibility Controls (Left Panel)
  svVisibility: {
    panelTitle: "SV visibility",
    sourceTitle: "SV SOURCE",
    bedMatchedSvs: "Wakhan Copy number BED",
    allVcfSvs: "All VCF SVs",
    displaysTitle: "SV DISPLAYS",
    hp2SvPlot: "Phased HP2 SV's plot",
    svLinesInCopyNumber: "Display SV lines in copy-number plot",
    maskedRegionsInCopyNumber: "Masked Centromere regions",
    typesTitle: "SV TYPES",
    minSpanTitle: "SV MIN SPAN",
    minSpanUnit: "bp",
    minSpanHint: "0 or empty = no limit",
  },

  // Track Axis Labels
  tracks: {
    hp1Breakpoints: "HP-1 breakpoints",
    hp2Breakpoints: "HP-2 breakpoints",
    unphasedBreakpoints: "Breakpoints",
    hpSvs: "HP SVs",
    coverageDepth: "Coverage depth",
    phasedBaf: "Phased B-allele frequency",
    phasedCopyNumber: "Phased copy number",
    geneAnnotations: "Gene annotations",
    hp1Label: "HP-1",
    hp2Label: "HP-2",
  },

  // Somatic CNV Table
  cnvTable: {
    title: "Somatic Structural Variations & Copy Number Table",
    exportCsvButton: "Export CSV",
    searchPlaceholder: "Search by Chr, Pos, Type, ID...",
    noDataText: "No variants or copy-number segments found.",
    columns: {
      id: "ID",
      chr: "Chr",
      start: "Start",
      end: "End",
      type: "Type",
      hp: "HP",
      copyNumberState: "CN State",
      confidence: "Confidence",
      breakpoints: "Breakpoints",
    },
  },

  // Tooltips & Descriptions
  tooltips: {
    position: "Position",
    haplotype: "Haplotype",
    rawCoverage: "Raw coverage",
    cnEquivalent: "Copy-number equivalent",
    bedCopyNumber: "BED copy number",
    bedSegmentCoverage: "BED segment coverage",
  },

  // Footer
  footer: {
    supportText: "For support or questions, please open an issue on our ",
    githubLinkText: "GitHub repository",
    githubUrl: "https://github.com/parklab/hiscanner",
  },
};

export const SV_CONFIG = {
  /**
   * Vibrant, bold, high-contrast colors for Structural Variations.
   */
  TYPE_COLORS: {
    DEL: "#ff002b",   // Bold Crimson / Deep Vivid Red
    INV: "#00c3ff",   // Vivid Sky Blue / Electric Cyan
    INS: "#fb00ff",   // Vivid Magenta / Neon Pink
    BND: "#212529",   // Near-Black / Dark Graphite
    DUP: "#ffaf01",   // Bright Amber / Golden Yellow
    sBND: "#00ffea",  // Bright Aqua / Neon Turquoise
  },

  /**
   * Arc curve line width and opacity settings.
   */
  ARC_LINE_WIDTH: 1.15,   // Thick, crisp, highly visible arc lines (default was 1.25)
  ARC_ALPHA: 0.72,        // Solid crisp opacity (default was 0.72)
  
  /**
   * Marker line width and opacity settings.
   */
  MARKER_LINE_WIDTH: 1.0, // Vertical breakpoint marker width (default was 1.0)
  MARKER_ALPHA: 0.34,     // Opacity for breakpoint vertical lines (default was 0.34)
};
