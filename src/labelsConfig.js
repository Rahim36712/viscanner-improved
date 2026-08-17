/**
 * labelsConfig.js
 * 
 * Centralized Configuration for ViScanner / HiScanner UI Labels & Visual Styling (Colors).
 * 
 * To customize any text on the website or change colors, arc thickness, etc.
 * simply edit the values in this file!
 */

export const LABELS = {
  // Main Navigation / Header
  appTitle: "HiScanner [Wakhan] visualization",
  visualizationSectionTitle: "Interactive visualization",
  exportPdfButton: "Export PDF",
  loadingOverlay: "Loading data",

  // File Upload Section
  uploader: {
    title: "Wakhan Compressed Output files (required)",
    subtitle: "Include grch38.cen_coord.curated.bed to show masked regions",
    centromereBuildTitle: "Centromere Masking Build:",
    buildOptions: {
      GRCh38: "GRCh38",
      GRCh37: "GRCh37",
      CHM13: "CHM13",
    },
    buttonText: "Click to upload",
    orDividerText: "or",
    exampleButtonText: "Load example data",
  },

  // Facets / Navigation Section
  facets: {
    navigationTitle: "NAVIGATION",
    goToRegionLabel: "Go to specific region",
    goToRegionPlaceholder: "e.g., chr2:1000-chr2:2000",
    goButton: "Go",
    goToGeneLabel: "Go to specific gene",
    resetViewButton: "Reset View",
  },

  // Gene Annotation Filtering Section
  geneFilter: {
    sectionTitle: "GENE FILTERING",
    filterLabel: "Filter genes on track",
    inputPlaceholder: "Add gene (e.g. TERT, TP53)",
    presetsTitle: "Presets:",
    presetVisiblePlot: "Filter by Genes in Current Plot",
    presetCancer: "TERT & Drivers",
    presetDnaRepair: "DNA Repair",
    clearFilter: "Clear",
    showingAll: "Showing all genes",
    showingFiltered: "Filtered: {count} gene(s)",
    zoomToGeneTooltip: "Zoom to gene",
    removeGeneTooltip: "Remove gene"
  },

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
    lohRegionsInCopyNumber: "LOH regions",
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

  // Somatic CNV & Variant Table
  cnvTable: {
    somaticTitle: "Somatic Structural Variations & Copy Number Table",
    wakhanTitle: "WAKHAN segment browser",
    variantTitle: "Variant browser",
    exportCsvButton: "Export CSV",
    previousButton: "Previous",
    nextButton: "Next",
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
    lohRegion: "LOH Region",
    centromereMaskedRegion: "Masked Centromere Region",
  },

  // Footer
  footer: {
    text: "For support, documentation, or code contributions, visit the ",
    originalRepoText: "Original HiScanner Repository",
    originalRepoUrl: "https://github.com/parklab/hiscanner",
    wakhanRepoText: "WAKHAN Visualization Repository",
    wakhanRepoUrl: "https://github.com/wakhan-visualization/wakhan-visualization.github.io",
  },
};

/**
 * Centralized UI Element & Theme Colors.
 */
export const UI_COLORS = {
  // Page Title & Header Colors
  appTitleColor: "#212529",
  visualizationSectionTitleColor: "#212529",

  // Uploader UI Colors
  uploaderTitleColor: "#212529",
  uploaderSubtitleColor: "#6c757d",
  uploaderButtonText: "#0d6efd",
  uploaderButtonBorder: "#0d6efd",
};

/**
 * Centralized Visual Styling & Colors for Genome Tracks, Haplotypes, and Regions.
 */
export const TRACK_COLORS = {
  // Haplotype Copy Number & Coverage Colors
  hp1: "#B23A48",           // Dark Red / Crimson for Haplotype 1
  hp1Point: "#D95F65",      // Light Red for HP1 coverage points
  hp2: "#2D7DD2",           // Deep Blue for Haplotype 2
  hp2Point: "#63A6D8",      // Light Blue for HP2 coverage points

  // Layout, Grid & Axis Colors
  axis: "#3f464d",          // Axis line & text color
  grid: "#e5e8eb",          // Grid line color
  center: "#222222",        // Baseline / center divider color
  chromBand: "#e7eaed",     // Chromosome alternating background band color

  // Special Genomic Regions Colors
  maskedRegion: "#E8C766",       // Masked Centromere fill color
  maskedRegionBorder: "#B58A2A", // Masked Centromere border color
  lohRegion: "#808080",          // LOH (Loss of Heterozygosity) region fill color
  lohRegionBorder: "#555555",    // LOH region border color
};

export const SV_CONFIG = {
  /**
   * Vibrant, bold, high-contrast colors for Structural Variations.
   */
  TYPE_COLORS: {
    DEL: "#B82607",   // Bold Crimson / Deep Vivid Red
    INV: "#D1970F",   // Vivid Sky Blue / Electric Cyan
    INS: "#0004FF",   // Vivid Magenta / Neon Pink
    BND: "#616060",   // Near-Black / Dark Graphite
    DUP: "#399953",   // Bright Amber / Golden Yellow
    sBND: "#A6A6A6",  // Bright Aqua / Neon Turquoise
  },

  /**
   * Arc curve line width and opacity settings.
   */
  ARC_LINE_WIDTH: 1.15,   // Thick, crisp, highly visible arc lines
  ARC_ALPHA: 0.72,        // Solid crisp opacity

  /**
   * Marker line width and opacity settings.
   */
  MARKER_LINE_WIDTH: 1.0, // Vertical breakpoint marker width
  MARKER_ALPHA: 0.34,     // Opacity for breakpoint vertical lines
};

