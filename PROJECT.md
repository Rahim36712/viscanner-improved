# Project: ViScanner Test Suite Project

## Architecture
- Target Project: ViScanner (`d:\internship\ViScanner`)
- Frameworks: React, HiGlass, PixiJS, Webpack, Jest, Playwright
- Testing Layers:
  1. White-Box Unit & Integration (Jest): Parser functions (`src/Uploader.js`), safe rendering validators (`src/safeRendering.js`), plot bounds (`src/plotBounds.js`), track utils (`src/WakhanStructuralVariationTrack.js`).
  2. Black-Box E2E (Playwright): Interaction flows, SV visibility toggling & persistence during zoom/pan, tooltip verification, file dropzone (valid ZIP archives vs invalid RAR/corrupted files triggering UI alert popups), PDF/CSV export, and layout auto-fit (`scheduleFitToContent`).
  3. Automation & CI: `npm test` and `npm run test:e2e` scripts configured in `package.json`.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | `normalizeChromosome` | Normalizes chromosome names to always include `"chr"` | M1 | `src/Uploader.js:15` |
| 2 | `parseBreakendAlt` | Extracts breakend chr and position from VCF ALT string | M1 | `src/Uploader.js:123` |
| 3 | `variantLength` | Calculates variant span length in base pairs | M1 | `src/WakhanStructuralVariationTrack.js:47` |
| 4 | `parseHiglassData` | Parses TSV segment lines (`cna_short.txt`/`cna_long.txt`) | M1 | `src/Uploader.js:31` |
| 5 | `normalizeTrackData` | Normalizes SV input into standard object shape | M1 | `src/WakhanStructuralVariationTrack.js:37` |
| 6 | `parseSeverusVcf` | Parses Severus VCF lines, filters PASS, pairs BND mates | M1 | `src/Uploader.js:148` |
| 7 | `parseWakhanCoverageData` | Parses phase coverage depth CSV | M1 | `src/Uploader.js:231` |
| 8 | `parseWakhanSegmentBed` | Parses HP1 and HP2 BED segment files | M1 | `src/Uploader.js:277` |
| 9 | `parseWakhanSegmentTableData` | Merges HP1 and HP2 BED segments by region key | M1 | `src/Uploader.js:311` |
| 10 | `parseSnpData` | Parses SNP BAF data files (`snp.txt` or `baf.csv`) | M1 | `src/Uploader.js:71` |
| 11 | `parseMaskedRegionBed` | Parses centromere/masked region BED file | M1 | `src/Uploader.js:253` |
| 12 | RAR Signature Detection | Binary signature check for renamed RAR files | M1 & M2 | `src/Uploader.js:13` |
| 13 | `getPlotBounds` | Pixel margin calculations | M1 | `src/plotBounds.js:4` |
| 14 | `mapTrackX` / `unmapTrackX` | Genomic to pixel X coordinate translation | M1 | `src/plotBounds.js:12` |
| 15 | `getGlobalMasterChromBounds` | Global chromosome extents calculation | M1 | `src/plotBounds.js:57` |
| 16 | `safeRendering` Primitives | Pixi drawing parameter validations | M1 | `src/safeRendering.js` |
| 17 | SV Type Visibility Toggling | Toggles DEL, INV, INS, BND, DUP, sBND | M2 | `src/App.js:177` |
| 18 | SV Filter Mode Selection | BED-matched vs All VCF SVs | M2 | `src/App.js:227` |
| 19 | HP2 SV Track Show/Hide | Toggle HP2 SV plot height (1px vs 90px) | M2 | `src/App.js:85` |
| 20 | Copy-Number SV Lines Toggle | Toggle vertical SV lines in coverage plot | M2 | `src/App.js:258` |
| 21 | Mouse Hover Tooltips | HTML tooltips on hover over dots, bars, arcs, lines | M2 | `src/WakhanStructuralVariationTrack.js` |
| 22 | File Dropzone & Validation | Dropzone for ZIP archives and invalid files | M2 | `src/Uploader.js` |
| 23 | PDF Export Engine | Vector PDF generation trigger | M2 | `src/pdfExport.js` |
| 24 | CnvTable Browser | CNV segment table sorting, filtering, eye icon | M2 | `src/CnvTable.js` |
| 25 | `scheduleFitToContent` | Window resize auto-fitting | M2 | `src/higlassLayout.js` |
| 26 | NPM Test Script (`npm test`) | Executes Jest unit test suite | M3 | `package.json` |
| 27 | NPM E2E Script (`npm run test:e2e`) | Executes Playwright E2E test suite | M3 | `package.json` |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Unit & Integration Suite (White-Box) | Implement Jest test suites (`src/*.test.js`) covering parsers in `Uploader.js`, `safeRendering.js`, `plotBounds.js`, and track utilities. | none | DONE |
| M2 | Playwright E2E Suite (Black-Box) | Implement Playwright E2E suites (`tests/e2e/*.spec.js`) covering SV visibility toggles & persistence, hover tooltips, file uploader (valid ZIPs & invalid/corrupted files triggering UI alert popups), PDF/CSV export, and layout fitting. | M1 | PLANNED |
| M3 | Test Automation & CI Integration | Configure npm scripts (`npm test`, `npm run test:e2e`) in `package.json` and ensure all tests run cleanly with exit code 0. | M1, M2 | PLANNED |

## Interface Contracts
### Jest Unit Tests ↔ Source Modules
- Export key internal parsing functions (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`, `parseSeverusVcf`, `parseWakhanCoverageData`, `parseWakhanSegmentBed`, `parseSnpData`) or helper exports in `src/Uploader.js`, `src/WakhanStructuralVariationTrack.js`, etc., so Jest can import them cleanly.
- `safeRendering.js` and `plotBounds.js` exports must retain existing signatures and return predictable types/values.

### Playwright E2E Tests ↔ React Frontend
- App runs on port `3030` (`http://localhost:3030`).
- File dropzone handles ZIP uploads (`wakhan_viscanner_input.zip`, `viscanner_example.zip`) and invalid files (e.g., `invalid_rar.zip`).
- Invalid file uploads must trigger `window.alert` dialogs which Playwright listens for via `page.on('dialog')`.
- Controls use data-testid or text selectors (`DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND`, PDF Export, CSV Export).

## Code Layout
- Unit Tests: `src/*.test.js`
- E2E Tests: `tests/e2e/*.spec.js`
- Configs: `package.json`, `jest.config.js`, `playwright.config.js`, `.babelrc`
- Sample Inputs: `examples/wakhan_viscanner_input.zip`, `examples/viscanner_example.zip`
