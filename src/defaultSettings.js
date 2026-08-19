/**
 * defaultSettings.js
 * 
 * Central configuration for all default visibility settings in ViScanner.
 * Edit any setting below (change true/false, numbers, or modes) to customize
 * what displays by default whenever data is uploaded or "Load Example Data" is clicked.
 */

export const DEFAULT_SETTINGS = {
  // =========================================================================
  // 1. WAKHAN COPY NUMBER TRACK OVERLAYS
  // =========================================================================
  // Set to true to show, or false to hide by default:
  showHp1: false,                // Blue HP-1 copy number segments
  showHp2: false,                // Orange HP-2 copy number segments
  showCoveragePoints: false,     // Grey coverage depth scatter points

  // =========================================================================
  // 2. STRUCTURAL VARIATION (SV) PLOTS & REGION OVERLAYS
  // =========================================================================
  showHpSvTrack: false,          // Top SV arc track (Structural Variations plot)
  showSvLinesInCopyNumber: false, // Vertical dashed lines for SV breakpoints in copy number track
  showLohRegions: false,         // Loss of Heterozygosity (LOH) green shaded regions
  showMaskedRegions: false,      // Centromere masked grey bands

  // Filter mode for SVs:
  // "matched" -> Only show SVs that match copy number segment boundaries
  // "all"     -> Show all SVs present in the VCF file
  svMode: "matched",

  // Maximum SV length span filter in base pairs (0 or empty string = show all SVs):
  maxSvSpan: 0,

  // =========================================================================
  // 3. STRUCTURAL VARIATION (SV) TYPES
  // =========================================================================
  // Set each SV type to true (checked) or false (unchecked) by default:
  svTypes: {
    DEL: false,   // Deletions
    INV: false,   // Inversions
    INS: false,   // Insertions
    BND: false,   // Translocations / Breakends
    DUP: false,   // Duplications
    sBND: false,  // Small Breakends
  },

  // =========================================================================
  // 4. DEFAULT GENOMIC VIEW (Coordinates in base pairs)
  // =========================================================================
  // Whole-genome coordinates: [0, 3095693983]
  initialXDomain: [0, 3095693983],
};
