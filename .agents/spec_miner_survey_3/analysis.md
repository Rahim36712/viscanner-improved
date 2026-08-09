# ViScanner Requirement Specifications, Feature Inventory & Acceptance Criteria

**Document Version**: 1.0.0  
**Author**: Survey Spec Miner (Feature & Spec Miner)  
**Target Repository**: `d:\internship\ViScanner`  
**Date**: 2026-08-09  

---

## Executive Summary

ViScanner is an interactive genomic visualization engine built on React 17 and HiGlass (v1.12.4) for single-cell Copy Number Alteration (CNA), B-allele Frequency (BAF), Haplotype-Specific Coverage (HP1/HP2), and Structural Variant (SV) breakpoint analysis. 

This document establishes the formal requirement inventory, input/output boundary specifications, edge case behaviors, and acceptance criteria for:
- **R1: White-Box Unit & Integration Test Suite** (covering core parsers, coordinate mappers, safe rendering primitives, and file uploader logic).
- **R2: Black-Box Playwright End-to-End (E2E) Test Suite** (covering SV toggles, plot dragging/panning persistence, hover tooltip filtering, dropzone upload handling, error alerts, PDF/CSV export, and layout fit scheduling).
- **R3: Test Automation & CI Readiness** (configuring npm scripts for zero-failure execution).

---

## 1. Features Discovered Inventory

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| F-01 | R1: Parser | `normalizeChromosome` | Normalizes chromosome names to always include the `"chr"` prefix. | String (e.g. `"1"`, `"chr1"`, `"X"`) | String (e.g. `"chr1"`, `"chrX"`) | Handles string input; returns `"chr"` + string if prefix missing. | `src/Uploader.js:15` |
| F-02 | R1: Parser | `parseBreakendAlt` | Extracts breakend chromosome and position from VCF BND ALT string notation (e.g., `N[chr2:10000[`). | String `alt` | Object `{ chr: string, pos: number }` or `null` | Returns `null` if pattern regex match fails or `alt` is null/empty. | `src/Uploader.js:123` |
| F-03 | R1: Parser | `variantLength` | Calculates structural variant span in base pairs. | Variant object `{ svlen, startAbs, endAbs }` | Number (non-negative integer) | Returns `0` if numeric values are missing or non-finite. | `src/WakhanStructuralVariationTrack.js:47`, `src/WakhanCoverageTrack.js:85` |
| F-04 | R1: Parser | `parseHiglassData` | Parses TSV segment lines (`cna_short.txt`/`cna_long.txt`) into structured HiGlass tuples. | TSV text content | Array of 9-element tuples `[chr, start, end, major_cn, minor_cn, total_cn, rdr, baf, cell]` | Skips header row (index 0); handles line breaks cleanly. | `src/Uploader.js:31` |
| F-05 | R1: Parser | `normalizeTrackData` | Normalizes raw SV data into standard `{ variants, matchedIds }` structure. | Array or Object | Object `{ variants: Array, matchedIds: Array }` | Defaults to empty arrays if input is null or missing fields. | `src/WakhanStructuralVariationTrack.js:37`, `src/WakhanCoverageTrack.js:75` |
| F-06 | R1: Parser | `parseSeverusVcf` | Parses Severus VCF lines, filters `PASS` variants, pairs BND mates, extracts `SVTYPE`, `SVLEN`, `HP`, `VAF`, `DV`. | VCF text string, Options `{ passOnly }` | Array of parsed variant objects | Skips comment `#` lines and lines with < 8 columns. Treats missing `HP` as `"-"` (unassigned). | `src/Uploader.js:148` |
| F-07 | R1: Parser | `parseWakhanCoverageData` | Parses dense depth coverage CSV file (`phase_corrected_coverage.csv`). | CSV text string | Array of objects `{ chr, start, end, hp1, hp2, unphased }` | Skips header or `#` lines; parses numbers with `parseInt`/`parseFloat`. | `src/Uploader.js:231` |
| F-08 | R1: Parser | `parseWakhanSegmentBed` | Parses HP1 and HP2 BED segment files (`*_copynumbers_segments_HP_1/2.bed`). | BED text string, `haplotypeKey` (`"hp1"`/`"hp2"`) | Array of objects `{ chr, start, end, coverage, [hp1/2], confidence, breakpoints, breakpointIds }` | Skips comment `#` lines; extracts severus breakpoint IDs via regex. | `src/Uploader.js:277` |
| F-09 | R1: Parser | `parseWakhanSegmentTableData` | Merges HP1 and HP2 BED segments by region key (`chr:start:end`) for CnvTable display. | Arrays `hp1Segments`, `hp2Segments` | Array of merged table row objects sorted by chromosome & start pos | Fills missing haplotype fields with `"-"`. | `src/Uploader.js:311` |
| F-10 | R1: Parser | `parseSnpData` | Parses SNP BAF data files (`snp.txt` or `baf.csv`). | TSV/CSV text string, `delimiter` (`"\t"` or `","`) | Array of objects `{ chr, pos, yvalue, baf }` | Ignores header if NaN is detected on first row. | `src/Uploader.js:71` |
| F-11 | R1: Parser | `parseMaskedRegionBed` | Parses centromere/masked region BED file (`grch38.cen_coord.curated.bed`). | BED text string | Array of objects `{ chr, start, end }` | Filters out rows with invalid or non-finite coordinates. | `src/Uploader.js:253` |
| F-12 | R1: Uploader | RAR File Signature Detection | Inspects binary signature of uploaded `.zip` files to detect renamed RAR archives. | File object | Signature string / throws Error | Throws explicit Error if signature starts with `526172211A07` (`Rar!`). | `src/Uploader.js:13`, `src/Uploader.js:614` |
| F-13 | R1: Bounds | `getPlotBounds` | Calculates pixel margin boundaries for tracks based on container width. | Track object `{ dimensions }` | Object `{ left: 72, right: number }` | Fallback to `left: 72, right: 73` if track dimensions invalid. | `src/plotBounds.js:4` |
| F-14 | R1: Bounds | `mapTrackX` / `unmapTrackX` | Converts absolute genomic coordinate to/from pixel X within plot bounds. | Track object, `absPosition` / `plotX` | Number (pixel X or genomic coordinate) | Clamps raw width to minimum `1` to avoid division by zero. | `src/plotBounds.js:12`, `src/plotBounds.js:23` |
| F-15 | R1: Bounds | `getGlobalMasterChromBounds` | Computes dynamic global chromosome extents to prevent track bounds mismatch. | `chromInfo` object | Array of bounds `{ chr, start, end }` | Returns `null` if `chromInfo` or `cumPositions` missing. | `src/plotBounds.js:57` |
| F-16 | R1: Safe Drawing | `safeRendering` Primitives | Validates numeric values and points before PixiJS drawing commands (`safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`). | Graphics object, numeric coordinates/dimensions | Boolean (`true` if drawn, `false` if skipped) | Logs skip warning in non-production mode via `logDevSkip` without throwing exception. | `src/safeRendering.js` |
| F-17 | R2: E2E | SV Type Visibility Toggling | Toggles visibility for DEL, INV, INS, BND, DUP, and sBND structural variants. | Checkbox events | Re-rendered SV track canvas | Persists toggle states during zooming, panning, and sliding. | `src/App.js:177`, `tests/e2e/sv-toggles-and-drag.spec.js` |
| F-18 | R2: E2E | SV Filter Mode Selection | Switches between "BED-matched SVs" (default) and "All VCF SVs". | Radio button events | Filtered variant list passed to SV tracks | Recalculates matched SV IDs from BED breakpoint lists. | `src/App.js:227`, `src/Uploader.js:567` |
| F-19 | R2: E2E | HP2 SV Track Show/Hide | Dynamic toggle to show or hide the separated HP2 SV plot track under coverage. | Checkbox event | Dynamically resized track (1px collapsed vs 90px expanded) | Calls `updateHpSvTrackVisibility` and `fitToContent`. | `src/App.js:85`, `src/App.js:250` |
| F-20 | R2: E2E | Copy-Number SV Lines Toggle | Toggles vertical SV endpoint lines inside the HP1/HP2 coverage/copy-number plot. | Checkbox event | Re-rendered coverage track with/without line overlay | Respects SV type checkboxes and filter modes. | `src/App.js:258`, `src/WakhanCoverageTrack.js:1110` |
| F-21 | R2: E2E | Mouse Hover Tooltips | Displays rich HTML tooltips on hovering coverage scatter points, BED segment bars, SV arcs, and SV vertical lines. | Mouse move events over track canvas | HTML table tooltip string | Filters out off-screen/crossing giant arcs in zoomed views. Nearest hit detection logic. | `src/WakhanStructuralVariationTrack.js:749`, `src/WakhanCoverageTrack.js:1128` |
| F-22 | R2: E2E | File Dropzone & Validation | Accepts drag-and-drop or file pick of `.zip` or raw files (`.bed`, `.csv`, `.vcf`, `.txt`). | Uploaded File list | Table & Track data updates or UI alert | Shows spinner/overlay; calls `showUploadError` (`window.alert`) on invalid/corrupted files. | `src/Uploader.js:697`, `tests/e2e/file-upload.spec.js` |
| F-23 | R2: E2E | PDF Export Engine | Generates scalable vector PDF containing HiGlass SVG and high-resolution Pixi textures. | Button click (`exportDisplay`) | `viscanner-cohort.pdf` download | Caps offscreen RGBA texture allocation to `50 MB` (`MAX_TEXTURE_BYTES`) to prevent Chrome tab OOM crashes. | `src/pdfExport.js:59`, `src/Facets.js:41` |
| F-24 | R2: E2E | CnvTable Browser | Filterable segment data table with chromosome selection dropdown, column sorting, pagination, and eye icon (`👁️`). | Dropdown, sort headers, page buttons, eye icon click | Filtered table rows; HiGlass auto-zoom to region | Eye icon calls `goToHiglass` which scrolls to visualization and calls `zoomTo` + `scheduleFitToContent`. | `src/CnvTable.js` |
| F-25 | R2: E2E | `scheduleFitToContent` | Recalculates and adjusts HiGlass container height and SVG layout based on visible tracks. | Layout config, track options | Resized container DOM height & SVG viewBox | Debounces calls with timer (`delay` parameter, default 80ms/250ms). | `src/higlassLayout.js:343` |
| F-26 | R3: CI | NPM Test Script (`npm test`) | Executes Jest unit test suite covering internal modules. | Command line execution | Clean exit code 0, 100% passing tests | Must be added to `package.json` scripts (`"test": "jest"`). | `package.json`, `ORIGINAL_REQUEST.md:24` |
| F-27 | R3: CI | NPM E2E Test Script (`npm run test:e2e`) | Executes Playwright E2E test suite covering browser flows. | Command line execution | Clean exit code 0, all Playwright specs passing | Configured in `package.json` (`"test:e2e": "playwright test"`). | `package.json:59`, `playwright.config.js` |

---

## 2. White-Box Utility & Data Parser Specifications (R1)

### 2.1 `normalizeChromosome(chrom)`
- **Module**: `src/Uploader.js`
- **Signature**: `(chrom: string) => string`
- **Expected Inputs**:
  - String without prefix: `"1"`, `"22"`, `"X"`, `"MT"`
  - String with prefix: `"chr1"`, `"chrX"`
- **Expected Outputs**: `"chr1"`, `"chr22"`, `"chrX"`, `"chrMT"`
- **Boundary / Null Conditions**: Expects string input. Will concatenate `"chr"` to any input string missing it.

### 2.2 `parseBreakendAlt(alt)`
- **Module**: `src/Uploader.js`
- **Signature**: `(alt: string) => { chr: string, pos: number } | null`
- **Expected Inputs**:
  - Valid VCF BND ALT string: `"N[chr2:10000["`, `"]chrX:50000]N"`, `"G[chr12:345678["`
  - Non-breakend ALT string: `"<DEL>"`, `"<INV>"`, `"A"`
  - Null/undefined/empty string: `null`, `""`
- **Expected Outputs**:
  - Valid: `{ chr: "chr2", pos: 10000 }` (chromosome is normalized with `normalizeChromosome`)
  - Invalid / No Match: `null`

### 2.3 `variantLength(variant)`
- **Modules**: `src/WakhanStructuralVariationTrack.js`, `src/WakhanCoverageTrack.js`
- **Signature**: `(variant: Object) => number`
- **Expected Inputs**:
  - Object with `svlen`: `{ svlen: -1500 }` -> `1500`
  - Object with `startAbs` & `endAbs`: `{ startAbs: 1000, endAbs: 5000 }` -> `4000`
  - Object with non-finite or missing fields: `{}` -> `0`
- **Expected Outputs**: Non-negative integer representing length in base pairs.

### 2.4 `parseHiglassData(v)`
- **Module**: `src/Uploader.js`
- **Signature**: `(v: string) => Array<Array>`
- **Expected Inputs**: Multiline TSV string containing header line followed by segment rows (`chrom`, `start`, `end`, `major_cn`, `minor_cn`, `total_cn`, `rdr`, `baf`, `cell`).
- **Expected Outputs**: Array of 9-element arrays: `[[chr, start, end, major_cn, minor_cn, total_cn, rdr, baf, cell], ...]`.
- **Boundary Behavior**: Header line (index 0) is omitted. `chrom` is normalized. Coordinates and numeric values are parsed as `parseInt`/`parseFloat`.

### 2.5 `normalizeTrackData(data)`
- **Modules**: `src/WakhanStructuralVariationTrack.js`, `src/WakhanCoverageTrack.js`
- **Signature**: `(data: Array | Object) => { variants: Array, matchedIds: Array }`
- **Expected Inputs**:
  - Array of variants: `[{ id: "sv1" }, ...]` -> `{ variants: [...], matchedIds: [] }`
  - Object: `{ variants: [...], matchedIds: ["sv1"] }` -> `{ variants: [...], matchedIds: ["sv1"] }`
  - `null` / `undefined` -> `{ variants: [], matchedIds: [] }`

### 2.6 `parseSeverusVcf(v, options)`
- **Module**: `src/Uploader.js`
- **Signature**: `(v: string, options: { passOnly?: boolean }) => Array<Object>`
- **Fields Extracted**:
  - `id`: VCF ID column
  - `chr`: normalized `CHROM`
  - `pos`: `parseInt(POS)`
  - `chr2`: mate chromosome (parsed from BND ALT or `CHROM`)
  - `pos2`: mate position (parsed from BND ALT, `END`, or `pos + abs(svlen)`)
  - `type`: `INFO/SVTYPE` or ALT string (e.g. `DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND`)
  - `svlen`: `parseNumber(INFO/SVLEN)`
  - `end`: `parseNumber(INFO/END)`
  - `filter`: VCF FILTER column
  - `mateId`: `INFO/MATE_ID`
  - `hp`: `INFO/HP` (e.g. `"1"`, `"2"`, or `"-"` if missing)
  - `vaf`: `FORMAT/VAF` from sample column
  - `dv`: `FORMAT/DV` from sample column
- **BND Pairing Logic**: Matches records using `MATE_ID`. Keeps paired BND records with updated `chr2` and `pos2` from mate, discarding duplicate mate records.

### 2.7 `plotBounds.js` Functions
- `getPlotBounds(track)`: Returns `{ left: 72, right: Math.max(73, width - 78) }`.
- `mapTrackX(track, absPosition)`: Calculates screen pixel position: `left + ((rawScale(absPosition) - rawLeft) / rawWidth) * (right - left)`.
- `unmapTrackX(track, plotX)`: Converts screen pixel position back to absolute genomic coordinate.
- `registerGlobalChromExtents(chrName, minStart, maxEnd)`: Updates global chromosome extents map (`window._globalChromExtents`).
- `getGlobalMasterChromBounds(chromInfo)`: Computes master bounding box array per chromosome.
- `registerDatasetExtents(chromInfo, dataSets)`: Iterates over HP1/HP2 segments, coverage, BAF, and SNP data to register all chromosome extents.

### 2.8 `safeRendering.js` Utilities
- `isFiniteNumber(val)`: Returns `true` only for finite numeric values; `false` for `NaN`, `Infinity`, `-Infinity`, `null`, `undefined`, `"42"`.
- `isValidPoint(x, y)`: `isFiniteNumber(x) && isFiniteNumber(y)`
- `isValidRect(x, y, width, height)`: `isValidPoint(x, y) && isFiniteNumber(width) && isFiniteNumber(height) && width >= 0 && height >= 0`
- `isValidVariant(variant)`: Checks object exists, has `chr`, and has finite `startAbs` or `pos`.
- `safeClamp(val, min, max, fallback=0)`: Returns clamped value or fallback if inputs non-finite.
- `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`: Safely wrap PixiJS draw commands, returning `true` on success or `false` on invalid input. Dev skips logged via `logDevSkip`.

### 2.9 Uploader RAR & Zip Validation
- `fileSignature(file)`: Reads first 8 bytes of file.
- `RAR_SIGNATURE`: `"526172211A07"`.
- `readZip(file, props)`: Checks `fileSignature`. If RAR signature detected, throws explicit error message: `"This file is a RAR archive, not a real ZIP. Please create it using Windows 'Send to > Compressed (zipped) folder', or upload the BED/CSV/VCF files directly."`

---

## 3. Playwright E2E Interaction Specifications (R2)

### 3.1 SV Visibility Controls & Drag/Pan Persistence
- **UI Elements**: Sidebar checkboxes for `DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND`.
- **Interaction Spec**:
  1. User unchecks SV type checkboxes (e.g. `BND` and `INV`).
  2. Canvas drag / pan is triggered via mouse press and drag (`mouse.move`, `mouse.down`, `mouse.move`, `mouse.up`).
  3. Re-render occurs upon drag release.
  4. **Acceptance Criteria**: The SV checkboxes remain unchecked (`false`) after drag/pan, and filtered SV types are not re-drawn on the canvas.

### 3.2 Mouse Hover Tooltips & Viewport Culling
- **UI Elements**: Pixi canvas hover triggers.
- **Interaction Spec**:
  1. Hovering SV arc/marker shows HTML tooltip with `ID`, `Type`, `From`, `To`, `Length`, `HP`, `VAF`, `DV`.
  2. Hovering Coverage scatter dot shows `Position`, `Haplotype` (`HP-1` / `HP-2`), `Raw coverage`, `Copy-number equivalent`, `BED copy number`, `BED segment coverage`.
  3. Hovering BED segment bar shows `Position`, `Haplotype`, `BED segment coverage`, `BED copy number`, `Confidence`.
  4. Hovering vertical SV line inside coverage plot shows `SV ID`, `Type`, `Endpoint`, `Position`, `Length`, `HP`, `VAF`, `DV`.
  5. **Viewport Culling**: SVs whose endpoints are entirely outside the current visible genomic window (plus 20% padding) are excluded from hover hit detection. Hit detection selects nearest hit in pixel distance (`sort((a,b) => a.distance - b.distance)`).

### 3.3 File Dropzone Valid & Invalid Uploads
- **UI Elements**: React Dropzone component (`Uploader.js`).
- **Valid Upload Spec**: Dragging or picking `wakhan_viscanner_input.zip` or `viscanner_example.zip` triggers decompression, populates `CnvTable`, updates HiGlass tracks, and hides loading spinner/overlay.
- **Invalid Upload Spec**:
  - Uploading a `.rar` archive renamed as `.zip` throws a caught error and displays a browser alert dialog (`showUploadError` / `window.alert`) with explicit instructions.
  - Spinner (`#upload-spinner`) and overlay (`#overlay`) are reset cleanly (`resetUploadSpinner`). No uncaught JS errors logged to console.

### 3.4 PDF & CSV Export Interactions
- **PDF Export**:
  - Button click on `Export visualization as PDF` (`Facets.js`).
  - Calls `exportSvgAsPdf(svg, "viscanner-cohort.pdf")`.
  - Captures high-res Pixi canvas base64 textures (`createHighResBase64Extractor`) with dynamic memory scaling (`MAX_TEXTURE_BYTES = 50 MB`).
  - Generates scalable PDF document via `pdfkit` and `svg-to-pdfkit`, triggering automatic file download (`viscanner-cohort.pdf`).
- **CSV / Segment Table Browser**:
  - Filterable by chromosome (`CHROMS` dropdown: `All`, `chr1`..`chr22`).
  - Sortable by headers (`Start`, `End`, `HP1 coverage`, `HP1 CN`, `HP1 confidence`, `HP2 coverage`, `HP2 CN`, `HP2 confidence`, `Total CN`).
  - Pagination (`PAGE_SIZE = 20`): `Next` and `Previous` buttons with item count indicator.
  - Eye icon (`👁️`): Invokes `goToHiglass(chr, start, end)`, scrolling smoothly to `#sec:visualization` and calling `hgc.api.zoomTo` + `scheduleFitToContent`.

---

## 4. Test Automation & CI Readiness (R3)

### 4.1 Script Configuration Requirements
In `package.json`:
```json
{
  "scripts": {
    "start": "webpack serve --mode development",
    "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && webpack --mode production",
    "deploy": "node scripts/deploy.js",
    "test": "react-scripts test --watchAll=false",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```
*Note*: The original `package.json` was missing the `"test"` entry under `scripts`. Adding `"test"` ensures `npm test` runs Jest unit tests cleanly.

### 4.2 CI Execution Criteria
- `npm test`: Runs all unit tests in `src/*.test.js` (including `src/safeRendering.test.js`, `src/App.test.js`, and new parser test files). Zero test failures allowed.
- `npm run test:e2e`: Runs all Playwright E2E specs in `tests/e2e/*.spec.js` against local dev server (`http://localhost:3030`). Zero spec failures allowed.

---

## 5. Comprehensive Edge Cases Table

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| E-01 | `fileSignature` | Renamed RAR file with `.zip` extension (`526172211A07`) | Throws Error: `"This file is a RAR archive, not a real ZIP..."`. Handled by `onDrop` catch block, triggering `showUploadError` (`window.alert`) and resetting spinner. |
| E-02 | `parseSeverusVcf` | VCF record missing `HP` field in INFO column | Parsed with `hp = "-"`. Hidden from HP-1/HP-2 separated SV plots; shown in general SV plot. |
| E-03 | `parseSeverusVcf` | Single-endpoint variant (`INS`, `sBND`) | Filtered to `markerVariants`; drawn as vertical line marker instead of arc to avoid false second endpoint representation. |
| E-04 | `parseSeverusVcf` | Unpaired `BND` variant (missing `MATE_ID` or mate not in VCF) | Drawn using parsed ALT breakend coordinates (`parseBreakendAlt`) or fallback position. |
| E-05 | `copyNumberEquivalent` | `bedSegmentCoverage` is 0 or non-finite | Returns `null` to prevent division-by-zero or `NaN` coordinate calculation. |
| E-06 | `maxCoverageFromSegments` | Extreme raw coverage CSV outliers (e.g. depth > 10,000) | Uses BED segment max coverage (`maxBedSegmentCoverage`) instead of raw CSV max, extending axis to `nextMultipleOf30(maxBedCoverage)` (floor 180). |
| E-07 | `safeMoveTo` / `safeLineTo` | `NaN` or `Infinity` coordinates passed from track mapping | Validated by `isValidPoint`; skips drawing command and logs dev warning via `logDevSkip`. Prevents WebGL rendering crash. |
| E-08 | `safeDrawCircle` / `safeDrawRect` | Negative radius or width/height dimensions | Validated by `isValidRect` / `isFiniteNumber(radius) && radius >= 0`; skips drawing command gracefully. |
| E-09 | `createHighResBase64Extractor` | Ultra-wide viewport rendering 7+ tracks during PDF export | Dynamically calculates `effectiveScale` so single RGBA texture does not exceed `50 MB` (`MAX_TEXTURE_BYTES`), preventing Chrome tab OOM crash. |
| E-10 | `updateVisibleData` | Zoomed-in local region crossed by multi-megabase giant arc | Applies `endpointPadding` viewport culling. Arc omitted if neither endpoint is near visible window, preventing wrong tooltip focus. |
| E-11 | `updateHpSvTrackVisibility` | Toggling HP2 SV track show/hide checkbox | Resizes track height between 1px (collapsed) and 90px (expanded), recalculating view layout via `fitToContent`. |
| E-12 | `goToHiglass` | Eye icon clicked in `CnvTable` | Smoothly scrolls to visualization section (`#sec:visualization`), calculates absolute genomic coordinates via `ChromosomeInfo`, calls `zoomTo`, and schedules layout fit (`scheduleFitToContent({ delay: 2600 })`). |

---
