# ViScanner Test Infrastructure & UI Workflow Analysis

## Overview
This report provides a comprehensive analysis of the existing test infrastructure, Jest & Playwright configurations, sample data archives, and UI interaction workflows in the ViScanner codebase (`d:\internship\ViScanner`).

---

## 1. Dependency & Script Analysis (`package.json`)

### 1.1 Key Dependencies
- **React Environment**: `react` (^17.0.2), `react-dom` (^17.0.2), `react-scripts` (5.0.1).
- **Genome Browser & Visualization**:
  - `higlass` (1.12.4), `smaht-higlass-misc` (0.2.2), `higlass-text` (^0.1.6).
  - `pixi.js` (^5.2.4) — canvas rendering for tracks.
  - `d3-format` (^3.1.0) — numeric & genomic coordinate formatting.
- **File Parsing & Archive Handling**:
  - `@zip.js/zip.js` (^2.7.32) — client-side unzipping of sample archives.
  - `react-dropzone` (^14.2.3) — drag-and-drop file upload interface.
- **Export & Utilities**:
  - `pdfkit` (^0.19.1), `svg-to-pdfkit` (^0.1.8), `blob-stream` (^0.1.3), `html2canvas` (^1.4.1) — vector PDF export generation.
  - `bootstrap` (^4.6.1), `react-select` (^5.7.4), `react-tooltip` (4.2.10).

### 1.2 DevDependencies & Tooling
- **E2E Testing**: `@playwright/test` (^1.62.1).
- **Babel & Webpack**: `@babel/core` (^7.22.11), `@babel/preset-env` (^7.22.14), `@babel/preset-react` (^7.22.5), `webpack` (^5.88.2), `webpack-dev-server` (^4.15.1).

### 1.3 NPM Scripts Analysis
Current `scripts` in `package.json`:
```json
"scripts": {
  "start": "webpack serve --mode development",
  "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && webpack --mode production",
  "deploy": "node scripts/deploy.js",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```
**Key Finding**:
- `"npm test"` is **missing** from `package.json`.
- Jest is not explicitly declared under `devDependencies` (though CRA `eslintConfig` references `react-app/jest`).
- To meet Requirement R3 (`npm test` and `npm run test:e2e`), a `jest` dependency or runner script needs to be configured under `"test"`.

---

## 2. Test Infrastructure & Configuration Files

### 2.1 Playwright Configuration (`playwright.config.js`)
- **Test Directory**: `./tests/e2e`
- **Base URL**: `http://localhost:3030`
- **Web Server Config**: Automatically launches `npm start` on port 3030 if not running (`reuseExistingServer: true`).
- **Timeouts**: Global test timeout `60,000ms`, assertion timeout `15,000ms`.
- **Browser Target**: Desktop Chrome (`chromium`).

### 2.2 Jest Configuration
- `jest.config.js`: **Not present**.
- `src/setupTests.js`: Present (`import '@testing-library/jest-dom'`).
- `.babelrc`: Present with `@babel/preset-env` and `@babel/preset-react`.

### 2.3 Existing Test Files
1. **Unit Tests**:
   - `src/safeRendering.test.js`: Comprehensive tests for safe drawing utilities (`isFiniteNumber`, `isValidPoint`, `isValidRect`, `isValidVariant`, `safeClamp`, `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`).
   - `src/App.test.js`: Default Create React App starter test expecting `/learn react/i` text.
2. **E2E Tests (`tests/e2e/`)**:
   - `tests/e2e/file-upload.spec.js`: Tests uploading `examples/wakhan_viscanner_input.zip`, verifies canvas visibility and `pageerror` event count is 0.
   - `tests/e2e/sv-toggles-and-drag.spec.js`: Tests toggling BND/INV checkboxes, canvas dragging/panning simulation, and verifying state persistence.
   - `tests/e2e/track-controls.spec.js`: Tests SV source radio buttons ("Wakhan Copy number BED" vs "All VCF SVs") and display options checkboxes.

---

## 3. Sample Input Files & Data Archives

### 3.1 Location
All sample archives are located in `d:\internship\ViScanner\examples\`:
1. `d:\internship\ViScanner\examples\wakhan_viscanner_input.zip`
2. `d:\internship\ViScanner\examples\viscanner_example.zip`

### 3.2 Expected Archive File Structures (from `src/Uploader.js`)
- **Wakhan Pipeline Output Archives** (`wakhan_viscanner_input.zip`):
  - `*copynumbers_segments_HP_1.bed` — Phased haplotype 1 copy number segments.
  - `*copynumbers_segments_HP_2.bed` — Phased haplotype 2 copy number segments.
  - `phase_corrected_coverage.csv` — Windowed read depth coverage.
  - `*severus*.vcf` — Structural variant calls from Severus.
  - `baf.csv` / `snp.txt` — B-allele frequency and SNP data.
  - `grch38.cen_coord.curated.bed` — Curated centromere regions for masking.
- **HiScanner Legacy Output Archives** (`viscanner_example.zip`):
  - `cna_short.txt` — Summary CNV segments table.
  - `cna_long.txt` — Detailed copy number track.
  - `snp.txt` — SNP BAF values.

---

## 4. UI Interaction Handlers & Workflow Mechanics

### 4.1 SV Visibility Toggles (DEL, INV, INS, BND, DUP, sBND)
- **Configuration** (`src/labelsConfig.js`):
  - SV types and color scheme: DEL (`#ff002b`), INV (`#00c3ff`), INS (`#fb00ff`), BND (`#212529`), DUP (`#ffaf01`), sBND (`#00ffea`).
- **Component State** (`src/App.js` -> `SvVisibilityControls`):
  - Checkbox changes trigger `updateSvTrackVisibility` and `updateCoverageSvVisibility`.
  - Calls `setVisibilityOptions({ visibleTypes })` on tracks: `wakhan-sv-track`, `wakhan-hp-sv-track`, and `wakhan-coverage-track`.
  - Custom tracks update `this.visibleSvTypes` and call `updateExistingGraphics()`, preserving filter state.

### 4.2 Zooming, Panning & Sliding State Persistence
- **Track Layout Mapping** (`src/plotBounds.js`):
  - `mapTrackX(track, absPosition)` and `unmapTrackX(track, plotX)` map canvas pixel coordinates to absolute genomic coordinates using `PLOT_LEFT` (72px) and `PLOT_RIGHT_MARGIN` (78px).
- **Viewport Filtering & Persistence**:
  - Track classes (`WakhanCoverageTrack`, `WakhanStructuralVariationTrack`) execute `updateVisibleData()` when `zoomed()` or panned.
  - Active visibility state (`this.visibleSvTypes`, `this.svMode`, `this.showHp1`, `this.showHp2`) is stored on the track instance and re-applied across zoom/pan events.

### 4.3 Mouse Hover Tooltips
- **Implementation**: Handled via `getMouseOverHtml(trackX, trackY)` in custom tracks.
- **Hit Detection**:
  - `WakhanCoverageTrack`: Checks coverage points, SV breakpoint vertical lines (`this.svHitRegions`), or BED copy number segments. Returns formatted HTML table containing Position, Haplotype, Raw coverage, Copy-number equivalent, BED copy number, and BED segment coverage.
  - `WakhanStructuralVariationTrack`: Uses quadratic Bezier curve math (`inverse * inverse * baselineY + 2 * inverse * t * apexY + t * t * baselineY`) for arc hit testing and vertical line bounds for markers. Returns HTML table with SV ID, Type, From, To, Length, HP, VAF, DV.

### 4.4 File Uploader Dropzone
- **Component** (`src/Uploader.js`):
  - Built with `react-dropzone` (`useDropzone`) accepting `.zip`, `.csv`, `.txt`, `.bed`, `.vcf`.
  - Drop workflow: `onDrop` -> `readUploadedFiles` -> `readZip` (via `@zip.js/zip.js`) or `readRawFiles` -> `parseUploadedEntryTexts` -> updates HiGlass tracks and `CnvTable`.

### 4.5 PDF & CSV Export Triggers
- **PDF Export** (`src/Facets.js` & `src/pdfExport.js`):
  - Triggered by `exportDisplay()` in `Facets.js`.
  - Extracts SVG from HiGlass (`hgc.api.exportAsSvg()`).
  - `exportSvgAsPdf()` converts SVG to vector PDF using `PDFDocument` (PDFKit standalone) and `SVGtoPDF`.
  - Uses `createHighResBase64Extractor` to extract Pixi canvas layers safely without WebGL texture corruption or out-of-memory tab crashes.
- **CSV Export & Variant Table** (`src/CnvTable.js` & `src/labelsConfig.js`):
  - `CnvTable` handles rendering of copy number segments and SV breakpoints.
  - Label defined in `labelsConfig.js` (`LABELS.cnvTable.exportCsvButton`).

### 4.6 Window Resizing & Layout Auto-Fitting (`scheduleFitToContent`)
- **Layout Manager** (`src/higlassLayout.js`):
  - `scheduleFitToContent(options)` debounces calls to `fitToContent(options)`.
  - Dynamically calculates track heights (`calculateLayout`), sets container height (`#higlass-container`), updates SVG element heights and `clipPath` rects (`resizeSvgLayers`), and dispatches window `resize` events.
- **Browser Observer** (`src/HiglassBrowser.js`):
  - Listens to window `resize` events and uses `ResizeObserver` / `MutationObserver` on `.react-grid-item` in `#higlass-container` to automatically recalculate layout.

### 4.7 Error Handling: UI Alert Popups vs Uncaught Exceptions
- **File Upload Errors** (`src/Uploader.js`):
  - `readUploadedFiles` promise chain handles errors via `.catch((error) => showUploadError(error.message))`.
  - `showUploadError` resets the loading spinner (`resetUploadSpinner()`) and displays a user-friendly `window.alert(message)`.
  - Archive Signature Check: Checks RAR magic bytes (`526172211A07`) and throws explicit error message if user uploads a RAR file renamed to `.zip`.
  - ZIP Reader Catch: Catches ZipReader failures and throws user-friendly explanation.
- **Canvas / React Error Recovery** (`src/HiGlassErrorBoundary.js`):
  - Wraps `<HiGlassComponent>` in a React Error Boundary (`HiGlassErrorBoundary.js`).
  - Catches unhandled rendering exceptions, logs warning, displays "Resetting view...", and automatically resets error state after 50ms.
- **Safe Rendering Wrappers** (`src/safeRendering.js`):
  - `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect` validate all coordinates and dimensions (`Number.isFinite`, non-negative) before passing to PixiJS, preventing NaN/Infinity canvas exceptions during dragging or bad data.
