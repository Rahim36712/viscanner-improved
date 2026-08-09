# Original User Request

## Initial Request — 2026-08-09T02:23:22+05:00

Build a comprehensive White-Box (Unit/Integration) and Black-Box (E2E / Alpha-Beta) test suite for ViScanner to guarantee product stability, accurate SV/CNV parsing, UI state persistence, and robust error handling.

Working directory: d:\internship\ViScanner
Integrity mode: development

## Requirements

### R1. White-Box (Unit & Integration) Testing
- Implement Jest unit tests (`src/*.test.js`) covering internal utility functions in `src/Uploader.js`, `src/safeRendering.js`, `src/plotBounds.js`, and data parsers (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`).
- Validate boundary conditions and edge cases (corrupted VCF header lines, zero-length variants, non-finite genomic positions, missing haplotype fields).

### R2. Black-Box & Alpha/Beta System (E2E) Testing
- Implement Playwright E2E test suites (`tests/e2e/*.spec.js`) covering full user interaction flows:
  - SV visibility toggling (DEL, INV, INS, BND, DUP, sBND) and persistence during zooming/panning/sliding.
  - Mouse hover tooltips and tooltip data correctness across tracks.
  - File uploader dropzone testing with valid sample archives (`wakhan_viscanner_input.zip`, `viscanner_example.zip`) and invalid/corrupted files.
  - Track displays, PDF export triggers, CSV export triggers, and window resizing (`scheduleFitToContent`).

### R3. Test Automation & CI Readiness
- Configure npm scripts (`npm test`, `npm run test:e2e`) so all test suites run cleanly with zero failures.

## Acceptance Criteria

### Unit & Integration (White-Box)
- [ ] Jest unit test suite achieves comprehensive coverage on data parsing, variant calculation, and safe rendering modules.
- [ ] All unit tests pass cleanly when running `npm test`.

### End-to-End & System (Black-Box / Alpha & Beta)
- [ ] Playwright E2E suites verify SV visibility persistence during plot dragging/panning and hover tooltip filtering.
- [ ] Invalid/corrupted file uploads trigger user-friendly UI alert popups instead of uncaught JavaScript exceptions.
- [ ] All Playwright E2E tests pass cleanly when running `npm run test:e2e`.
