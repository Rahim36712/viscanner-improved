# Survey Explorer 2 Handoff Report

## 1. Observation
- **Package & Test Setup (`package.json`)**:
  - `package.json` contains dependencies `@zip.js/zip.js` (2.7.32), `higlass` (1.12.4), `pixi.js` (5.2.4), `react` (17.0.2), `pdfkit` (0.19.1), `react-dropzone` (14.2.3), `react-tooltip` (4.2.10).
  - `devDependencies` contains `@playwright/test` (^1.62.1), `@babel/core`, `@babel/preset-env`, `@babel/preset-react`, `webpack-dev-server`.
  - `scripts` in `package.json`: `"start"`, `"build"`, `"deploy"`, `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`. Note: `"test"` script is currently **missing** from `package.json`.
- **Existing Test Suite**:
  - Playwright configuration (`playwright.config.js`): `testDir: "./tests/e2e"`, `baseURL: "http://localhost:3030"`, `webServer: { command: "npm start", url: "http://localhost:3030", reuseExistingServer: true }`.
  - E2E tests in `tests/e2e/`: `file-upload.spec.js`, `sv-toggles-and-drag.spec.js`, `track-controls.spec.js`.
  - Unit tests in `src/`: `src/safeRendering.test.js` (testing safe rendering math/primitives), `src/App.test.js` (CRA starter placeholder test).
  - Test setup: `src/setupTests.js` imports `@testing-library/jest-dom`. `.babelrc` specifies `@babel/preset-env` and `@babel/preset-react`. `jest.config.js` does not exist yet.
- **Sample Input Data Archives**:
  - Located in `d:\internship\ViScanner\examples\`: `wakhan_viscanner_input.zip` (Wakhan pipeline: BED copy numbers, coverage CSV, Severus VCF, BAF CSV, centromere BED) and `viscanner_example.zip` (HiScanner output: `cna_short.txt`, `cna_long.txt`, `snp.txt`).
- **UI Interaction Workflows**:
  - **SV Visibility Toggles**: Controlled in `src/App.js` (`SvVisibilityControls`) with types (DEL, INV, INS, BND, DUP, sBND) defined in `src/labelsConfig.js` (`SV_CONFIG.TYPE_COLORS`). `updateSvTrackVisibility` and `updateCoverageSvVisibility` propagate options to tracks (`wakhan-sv-track`, `wakhan-hp-sv-track`, `wakhan-coverage-track`).
  - **Zooming/Panning & Sliding Persistence**: `WakhanCoverageTrack` and `WakhanStructuralVariationTrack` filter visible data per frame in `updateVisibleData()` using genomic bounds via `plotBounds.js` (`mapTrackX` / `unmapTrackX`). `visibleTypes` filter state is stored on track instances across zoom/pan redraws.
  - **Hover Tooltips**: Implemented in custom track `getMouseOverHtml(trackX, trackY)`. `WakhanCoverageTrack` checks coverage/segment/breakpoint proximity; `WakhanStructuralVariationTrack` performs Bezier curve arc hit testing to render detailed HTML tables (SV ID, Type, Endpoint, Length, HP, VAF, DV).
  - **File Dropzone**: Implemented in `src/Uploader.js` using `react-dropzone` and `@zip.js/zip.js`. Calls `readUploadedFiles` -> `readZip` / `readRawFiles` -> `parseUploadedEntryTexts`.
  - **PDF / CSV Export**: PDF export in `src/Facets.js` (`exportDisplay`) retrieves SVG from `hgc.api.exportAsSvg()` and converts to vector PDF via `src/pdfExport.js` (`exportSvgAsPdf`) using `pdfkit` and `svg-to-pdfkit`. CSV export & table in `src/CnvTable.js`.
  - **Window Resizing**: `src/higlassLayout.js` (`scheduleFitToContent`) dynamically adjusts track and SVG heights. `src/HiglassBrowser.js` attaches window `resize` listeners and `ResizeObserver`/`MutationObserver` on `.react-grid-item`.
  - **Error Handling & Protection**: `src/Uploader.js` catches parsing rejections in `onDrop` and calls `showUploadError` -> `window.alert()`. Magic-byte signature check rejects RAR files with clear messages. `src/HiGlassErrorBoundary.js` wraps `<HiGlassComponent>` to recover from React canvas crashes after 50ms. `src/safeRendering.js` guards Pixi graphics operations against NaN/Infinity coordinates.

## 2. Logic Chain
- Step 1: `package.json` analysis reveals Playwright is configured for E2E testing, but `"npm test"` script and explicit `jest` dependency are missing.
- Step 2: Inspection of `src/*.test.js` shows `safeRendering.test.js` is established, but unit test coverage needs extension for parser functions in `src/Uploader.js` (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`), `src/plotBounds.js`, etc.
- Step 3: Analysis of `tests/e2e/` reveals initial test specs exist (`file-upload.spec.js`, `sv-toggles-and-drag.spec.js`, `track-controls.spec.js`), which validate Playwright setup against `http://localhost:3030`.
- Step 4: Analysis of UI handlers confirms that state persistence, tooltip hit testing, window auto-fitting, export workflows, and alert popup error handling are all backed by specific source functions, which provides a clear roadmap for expanding E2E test specs.

## 3. Caveats
- Read-only investigation mode was maintained; no code changes or test executions were performed during this survey.
- Webpack dev server port is configured as `3030` in `webpack.config.js` and `playwright.config.js`.

## 4. Conclusion
- ViScanner's codebase has strong foundational rendering safety, dynamic track layout capabilities, and robust user-facing error handling (alert popups + ErrorBoundary + safe rendering wrappers).
- To achieve full CI readiness and fulfill requirements R1–R3:
  1. An `"npm test"` script using Jest (with necessary Babel transformation config) must be added to `package.json`.
  2. Unit test files (`src/*.test.js`) should be added/expanded for data parsing functions (`Uploader.js`, `plotBounds.js`, `safeRendering.js`).
  3. Playwright E2E suites should be expanded to fully cover edge cases for invalid file uploads, tooltip data correctness, and PDF/CSV export triggers.

## 5. Verification Method
- Inspect `.agents/explorer_survey_2/analysis.md` and `.agents/explorer_survey_2/handoff.md` to verify documented evidence chains and file paths.
- Run `npm test` once configured by the implementer agent.
- Run `npm run test:e2e` once configured by the implementer agent.
