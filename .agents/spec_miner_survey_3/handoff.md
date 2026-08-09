# Specification Mining Handoff Report

**Working Directory**: `d:\internship\ViScanner\.agents\spec_miner_survey_3`  
**Date**: 2026-08-09  
**Agent Identity**: Survey Spec Miner (Feature & Spec Miner)  
**Parent Agent**: `c7e2b26e-1e3f-44af-82c5-78ef47b81751`  

---

## 1. Observation

Direct evidence extracted from the repository files:

1. **`ORIGINAL_REQUEST.md` Requirements**:
   - R1: White-Box Unit & Integration tests covering internal utility functions in `src/Uploader.js`, `src/safeRendering.js`, `src/plotBounds.js`, and data parsers (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`).
   - R2: Playwright E2E suites covering SV visibility toggles (DEL, INV, INS, BND, DUP, sBND), drag/pan persistence, mouse hover tooltips, file dropzone (valid ZIP archives and invalid/corrupted files), PDF/CSV export, and `scheduleFitToContent`.
   - R3: Test automation & CI readiness (`npm test`, `npm run test:e2e`).

2. **Package Script Gap (`package.json`)**:
   - Lines 55-61 of `package.json`:
     ```json
     "scripts": {
       "start": "webpack serve --mode development",
       "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && webpack --mode production",
       "deploy": "node scripts/deploy.js",
       "test:e2e": "playwright test",
       "test:e2e:ui": "playwright test --ui"
     }
     ```
   - *Observation*: The `"test"` script is missing from `package.json`. Running `npm test` currently fails because `"test"` script is undefined.

3. **Core Parser Implementation (`src/Uploader.js`)**:
   - Line 15: `normalizeChromosome(chrom)` ensures `"chr"` prefix.
   - Line 123: `parseBreakendAlt(alt)` uses regex `/[\[\]]([^:\[\]]+):(\d+)[\[\]]/`.
   - Line 148: `parseSeverusVcf(v, options)` extracts `SVTYPE`, `SVLEN`, `END`, `HP`, `VAF`, `DV`, `MATE_ID`, filters by `PASS`, and handles missing `HP` as `"-"`.
   - Line 231: `parseWakhanCoverageData(v)` parses `phase_corrected_coverage.csv`.
   - Line 277: `parseWakhanSegmentBed(v, haplotypeKey)` extracts BED segment coverage, copy numbers, and breakpoint IDs via `parseBreakpointIds`.
   - Line 614: `readZip(file, props)` inspects `fileSignature(file)` against `RAR_SIGNATURE` (`"526172211A07"`). Throws caught error if file is a RAR archive.

4. **Safe Drawing & Bounds (`src/safeRendering.js`, `src/plotBounds.js`)**:
   - `safeRendering.js`: Exports `isFiniteNumber`, `isValidPoint`, `isValidRect`, `isValidVariant`, `safeClamp`, `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`, and `logDevSkip`.
   - `plotBounds.js`: Defines `PLOT_LEFT = 72`, `PLOT_RIGHT_MARGIN = 78`, `getPlotBounds`, `mapTrackX`, `unmapTrackX`, `registerGlobalChromExtents`, `getGlobalMasterChromBounds`, `registerDatasetExtents`, `getDynamicChrAbs`.

5. **Track Interactions & Tooltips (`src/WakhanStructuralVariationTrack.js`, `src/WakhanCoverageTrack.js`)**:
   - `WakhanStructuralVariationTrack.js:749`: `getMouseOverHtml` produces HTML table with `ID`, `Type`, `From`, `To`, `Length`, `HP`, `VAF`, `DV`. Applies viewport culling (`endpointPadding`) to exclude giant crossing arcs.
   - `WakhanCoverageTrack.js:1128`: `getMouseOverHtml` produces HTML table with `Position`, `Haplotype`, `Raw coverage`, `Copy-number equivalent`, `BED copy number`, `BED segment coverage`. Handles vertical SV line hover.

6. **UI Controls & Export (`src/App.js`, `src/Facets.js`, `src/pdfExport.js`)**:
   - `App.js`: Contains `WakhanVisibilityControls` (HP1/HP2/Coverage points) and `SvVisibilityControls` (Source mode, SV type checkboxes, HP2 SV plot show/hide, SV lines in copy-number plot, min span filter).
   - `Facets.js:41`: `exportDisplay` calls `exportSvgAsPdf(svg, "viscanner-cohort.pdf")`.
   - `pdfExport.js:118`: `createHighResBase64Extractor` caps texture size at `MAX_TEXTURE_BYTES = 50 MB` to prevent Chrome OOM.

---

## 2. Logic Chain

1. **Requirement Mapping**:
   - Based on `ORIGINAL_REQUEST.md`, test suites must cover unit utilities (R1), Playwright E2E interactions (R2), and CI execution (R3).

2. **Parser and Utility Verification Strategy (R1)**:
   - `safeRendering.js` already has an existing unit test file `src/safeRendering.test.js` covering primitive validators and mock PixiJS wrappers.
   - Core parser functions (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`, `parseSeverusVcf`, `parseWakhanCoverageData`, `parseWakhanSegmentBed`, `fileSignature` RAR detection) in `src/Uploader.js`, `src/plotBounds.js`, and track files require comprehensive Jest unit test specs in `src/*.test.js`.

3. **E2E Flow Verification Strategy (R2)**:
   - Playwright test files exist in `tests/e2e/file-upload.spec.js`, `tests/e2e/sv-toggles-and-drag.spec.js`, and `tests/e2e/track-controls.spec.js`.
   - Complete verification requires testing SV type toggle persistence during plot dragging/panning, hover tooltip contents, dropzone handling for valid archives (`wakhan_viscanner_input.zip`, `viscanner_example.zip`) and invalid RAR files, UI alert dialogs (`window.alert`), PDF/CSV export buttons, and `scheduleFitToContent` layout adjustments.

4. **CI Automation Gap (R3)**:
   - `package.json` currently lacks a `"test"` script. Adding `"test": "react-scripts test --watchAll=false"` or `"test": "jest"` will allow `npm test` to pass cleanly.

---

## 3. Caveats

- **WebGL / Offscreen Canvas Rendering**: High-res canvas texture capture in `pdfExport.js` depends on WebGL context availability. Headless browsers in CI require WebGL software rendering support (e.g. SwiftShader in Chromium).
- **HiGlass API Dependencies**: Custom tracks depend on global `window.hgc.current` API instance. Unit tests for track methods require mocking HiGlass track context or testing underlying pure helper functions.

---

## 4. Conclusion & Feature Inventory

All specifications, inputs, outputs, error behaviors, and edge cases have been mined and documented.

### Features Discovered
| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| F-01 | R1: Parser | `normalizeChromosome` | Normalizes chromosome names to always include `"chr"`. | String | String | Concatenates `"chr"` if prefix missing. | `src/Uploader.js:15` |
| F-02 | R1: Parser | `parseBreakendAlt` | Extracts breakend chr and position from VCF ALT string. | String `alt` | Object or `null` | Returns `null` if regex fails. | `src/Uploader.js:123` |
| F-03 | R1: Parser | `variantLength` | Calculates variant span length in base pairs. | Variant Object | Number | Returns `0` if non-finite/missing. | `src/WakhanStructuralVariationTrack.js:47` |
| F-04 | R1: Parser | `parseHiglassData` | Parses TSV segment lines (`cna_short.txt`/`cna_long.txt`). | TSV string | Array of 9-element tuples | Skips header line (index 0). | `src/Uploader.js:31` |
| F-05 | R1: Parser | `normalizeTrackData` | Normalizes SV input into standard object shape. | Array or Object | Object `{ variants, matchedIds }` | Defaults to empty arrays if null. | `src/WakhanStructuralVariationTrack.js:37` |
| F-06 | R1: Parser | `parseSeverusVcf` | Parses Severus VCF lines, filters PASS, pairs BND mates, extracts HP, VAF, DV. | VCF text string, Options | Array of parsed variant objects | Skips comment `#` lines and < 8 cols. HP missing parsed as `"-"`. | `src/Uploader.js:148` |
| F-07 | R1: Parser | `parseWakhanCoverageData` | Parses phase coverage depth CSV (`phase_corrected_coverage.csv`). | CSV string | Array of row objects | Skips header or `#` lines. | `src/Uploader.js:231` |
| F-08 | R1: Parser | `parseWakhanSegmentBed` | Parses HP1 and HP2 BED segment files. | BED string, haplotypeKey | Array of BED segment objects | Extracts severus breakpoint IDs. | `src/Uploader.js:277` |
| F-09 | R1: Parser | `parseWakhanSegmentTableData` | Merges HP1 and HP2 BED segments by region key. | Arrays hp1Segments, hp2Segments | Array of merged table rows | Fills missing fields with `"-"`. | `src/Uploader.js:311` |
| F-10 | R1: Parser | `parseSnpData` | Parses SNP BAF data files (`snp.txt` or `baf.csv`). | TSV/CSV text string | Array of SNP objects | Ignores header line if NaN detected. | `src/Uploader.js:71` |
| F-11 | R1: Parser | `parseMaskedRegionBed` | Parses centromere/masked region BED file. | BED text string | Array of region objects | Filters out non-finite coords. | `src/Uploader.js:253` |
| F-12 | R1: Uploader | RAR Signature Detection | Inspects binary signature of `.zip` files to detect renamed RAR archives. | File object | Signature string / throws Error | Throws Error if signature starts with `526172211A07`. | `src/Uploader.js:13` |
| F-13 | R1: Bounds | `getPlotBounds` | Calculates pixel margin boundaries for tracks. | Track object | Object `{ left, right }` | Fallback to `left: 72, right: 73`. | `src/plotBounds.js:4` |
| F-14 | R1: Bounds | `mapTrackX` / `unmapTrackX` | Converts genomic position to/from pixel X. | Track object, position | Number | Clamps raw width to min 1. | `src/plotBounds.js:12` |
| F-15 | R1: Bounds | `getGlobalMasterChromBounds` | Computes dynamic global chromosome extents. | `chromInfo` object | Array of bounds | Returns `null` if chromInfo missing. | `src/plotBounds.js:57` |
| F-16 | R1: Safe Drawing | `safeRendering` Primitives | Validates coordinates/dimensions before PixiJS drawing commands. | Graphics, coords, dims | Boolean | Logs skip warning in dev mode. | `src/safeRendering.js` |
| F-17 | R2: E2E | SV Type Visibility Toggling | Toggles visibility for DEL, INV, INS, BND, DUP, sBND. | Checkbox events | Canvas re-render | Persists state across zoom/pan/drag. | `src/App.js:177` |
| F-18 | R2: E2E | SV Filter Mode Selection | Switches between "BED-matched SVs" and "All VCF SVs". | Radio button events | Filtered variant list | Recalculates matched SV IDs. | `src/App.js:227` |
| F-19 | R2: E2E | HP2 SV Track Show/Hide | Dynamic toggle to show/hide separated HP2 SV plot. | Checkbox event | Resized track (1px vs 90px) | Calls `updateHpSvTrackVisibility`. | `src/App.js:85` |
| F-20 | R2: E2E | Copy-Number SV Lines Toggle | Toggles vertical SV endpoint lines inside coverage plot. | Checkbox event | Canvas re-render | Respects SV type checkboxes. | `src/App.js:258` |
| F-21 | R2: E2E | Mouse Hover Tooltips | Displays HTML tooltips on hovering scatter dots, segment bars, arcs, and SV lines. | Mouse move events | HTML table string | Viewport culling excludes giant crossing arcs. | `src/WakhanStructuralVariationTrack.js:749` |
| F-22 | R2: E2E | File Dropzone & Validation | Accepts drag-and-drop or pick of `.zip` / raw files. | File list | Data updates or UI alert | Shows spinner/overlay; calls `showUploadError` on invalid files. | `src/Uploader.js:697` |
| F-23 | R2: E2E | PDF Export Engine | Generates scalable vector PDF containing SVG and high-res textures. | Button click | PDF download | Caps texture size at 50 MB to prevent Chrome OOM. | `src/pdfExport.js:59` |
| F-24 | R2: E2E | CnvTable Browser | Filterable segment table with chrom dropdown, sorting, pagination, eye icon. | Dropdown, headers, buttons | Filtered table rows | Eye icon scrolls to visualization and calls `zoomTo`. | `src/CnvTable.js` |
| F-25 | R2: E2E | `scheduleFitToContent` | Adjusts HiGlass container height and SVG layout dynamically. | Layout config, options | Resized DOM height & SVG | Debounces timer calls. | `src/higlassLayout.js:343` |
| F-26 | R3: CI | NPM Test Script (`npm test`) | Executes Jest unit test suite. | CLI command | Exit code 0 | Must be added to `package.json` scripts. | `package.json`, `ORIGINAL_REQUEST.md:24` |
| F-27 | R3: CI | NPM E2E Script (`npm run test:e2e`) | Executes Playwright E2E test suite. | CLI command | Exit code 0 | Configured in `package.json`. | `package.json:59` |

### Edge Cases
| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| E-01 | `fileSignature` | Renamed RAR file with `.zip` extension (`526172211A07`) | Throws Error: `"This file is a RAR archive, not a real ZIP..."`. Calls `showUploadError` (`window.alert`) and resets spinner. |
| E-02 | `parseSeverusVcf` | VCF record missing `HP` field | Parsed as `hp = "-"`. Hidden from HP-1/HP-2 separated SV plots; shown in general SV plot. |
| E-03 | `parseSeverusVcf` | Single-endpoint variant (`INS`, `sBND`) | Drawn as vertical line marker instead of arc. |
| E-04 | `parseSeverusVcf` | Unpaired `BND` variant | Drawn using ALT breakend coordinates (`parseBreakendAlt`) or fallback position. |
| E-05 | `copyNumberEquivalent` | `bedSegmentCoverage` is 0 or non-finite | Returns `null` to prevent division by zero. |
| E-06 | `maxCoverageFromSegments` | Extreme raw coverage CSV depth outliers | Uses BED segment max coverage (`maxBedSegmentCoverage`), extending axis to `nextMultipleOf30` (floor 180). |
| E-07 | `safeMoveTo` / `safeLineTo` | `NaN` or `Infinity` coordinates | Validated by `isValidPoint`; skips drawing command and logs dev warning via `logDevSkip`. |
| E-08 | `safeDrawCircle` / `safeDrawRect` | Negative radius or width/height dimensions | Validated by `isValidRect` / `isFiniteNumber(radius) && radius >= 0`; skips drawing command. |
| E-09 | `createHighResBase64Extractor` | Offscreen texture allocation during PDF export | Caps texture size at `50 MB` (`MAX_TEXTURE_BYTES`) to prevent Chrome OOM crash. |
| E-10 | `updateVisibleData` | Zoomed local view crossed by multi-megabase giant arc | Viewport culling excludes arc if endpoints are not near visible window. |
| E-11 | `updateHpSvTrackVisibility` | Toggling HP2 SV track show/hide | Resizes track height between 1px and 90px via `fitToContent`. |
| E-12 | `goToHiglass` | Eye icon clicked in `CnvTable` | Scrolls to visualization section, converts coordinates via `ChromosomeInfo`, calls `zoomTo` + `scheduleFitToContent`. |

---

## 5. Verification Method

To verify the mined requirements independently:

1. **Verify Unit Test Suite Execution**:
   - Inspect `package.json` and ensure `"test"` script is present.
   - Command: `npm test` (or `npx jest --ci`)
   - Target files: `src/*.test.js`

2. **Verify Playwright E2E Suite Execution**:
   - Ensure local dev server is running (`npm start`) or launched via Playwright webServer config.
   - Command: `npm run test:e2e` (or `npx playwright test`)
   - Target files: `tests/e2e/*.spec.js`

3. **Verify Documentation Artifacts**:
   - Confirm `analysis.md` and `handoff.md` exist in `d:\internship\ViScanner\.agents\spec_miner_survey_3\`.
