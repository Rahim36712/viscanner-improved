# Handoff Report: Playwright E2E Test Suite Investigation

## 1. Observation
- **Playwright Configuration (`playwright.config.js`)**: Configured with `testDir: "./tests/e2e"`, `baseURL: "http://localhost:3030"`, single worker (`workers: 1`), and automatic dev server management (`webServer: { command: "npm start", url: "http://localhost:3030" }`).
- **Existing E2E Specs (`tests/e2e/*.spec.js`)**:
  - `file-upload.spec.js`: Uploads `examples/wakhan_viscanner_input.zip` via `input[type='file']` and verifies canvas visibility (`canvas.first()`).
  - `sv-toggles-and-drag.spec.js`: Targets checkboxes via `label.sv-visibility-option.filter({ hasText: /^BND$/ }).locator("input[type='checkbox']")`, unchecks `BND` and `INV`, performs canvas dragging via `page.mouse.move()`, and verifies checkbox state persistence.
  - `track-controls.spec.js`: Tests SV source radios (`label:has-text('Wakhan Copy number BED') input[type='radio']`) and display checkboxes.
- **UI Control Selectors (`src/App.js`, `src/Facets.js`, `src/CnvTable.js`, `src/labelsConfig.js`)**:
  - File Dropzone Input: `input[type='file']`.
  - Dropzone Button: `button:has-text('Click to upload')`.
  - SV Type Checkboxes: `DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND` under `label.sv-visibility-option`.
  - SV Source Radios: `label:has-text('Wakhan Copy number BED') input[type='radio']` (`matched`) and `label:has-text('All VCF SVs') input[type='radio']` (`all`).
  - Track Display Checkboxes: `label:has-text("Phased HP2 SV's plot") input[type='checkbox']`, `label:has-text('Display SV lines in copy-number plot') input[type='checkbox']`, `label:has-text('Masked Centromere regions') input[type='checkbox']`.
  - Export PDF Button: `button:has-text('Export PDF')` in `Facets.js:303`.
  - Export CSV Button Label: `LABELS.cnvTable.exportCsvButton` ("Export CSV") in `labelsConfig.js:57`.
  - Table Controls: `th .basic-single` (Chrom select), `th i.sort-table-icon` (Sort), `td i.fa-eye` (Inspect region), `button:has-text('Next')` / `button:has-text('Previous')` (Pagination).
- **Alert Popup Mechanics (`src/Uploader.js`)**:
  - RAR detection: Line 615 checks `fileSignature(file)` against `RAR_SIGNATURE = "526172211A07"`. Throws Error: `"This file is a RAR archive, not a real ZIP..."`.
  - Corrupted ZIP detection: Line 636 catches `zipReader.getEntries()` failure. Throws Error: `"ViScanner could not read this archive as a ZIP file..."`.
  - `showUploadError` (Line 526) invokes `window.alert(message)`.
  - Playwright intercepts `window.alert` dialogs using `page.on('dialog', async dialog => { message = dialog.message(); await dialog.accept(); })`.
- **Sample Archives (`examples/`)**: `examples/wakhan_viscanner_input.zip` and `examples/viscanner_example.zip`.

---

## 2. Logic Chain
1. Playwright E2E tests run against React dev server on `http://localhost:3030`.
2. Existing specs demonstrate how Playwright interacts with hidden `<input type="file">` elements for dropzone uploads, labels/checkboxes for SV filtering, and mouse actions on `<canvas>`.
3. Investigation of `src/Uploader.js` confirms that invalid file uploads throw explicit JavaScript errors caught by `onDrop()`, which delegates to `showUploadError()`, calling `window.alert(message)`.
4. Playwright naturally handles `window.alert` dialogs via `page.on('dialog')`. Attaching a listener prior to calling `setInputFiles()` allows testing invalid upload alerts cleanly without triggering uncaught exceptions.
5. All required UI selectors, labels, inputs, checkboxes, export buttons, and table controls were mapped to concrete Playwright selector expressions, enabling implementation of new test specs for M2.

---

## 3. Caveats
- No Playwright tests were executed during this investigation (read-only investigation constraint).
- PDF export invokes `exportSvgAsPdf()` which triggers a browser download / blob generation; Playwright can assert that the button click completes without errors.

---

## 4. Conclusion
The existing Playwright suite and UI component architecture provide a solid, deterministic framework for E2E testing. All element selectors, interaction flows, dialog handling strategies, and extension plans have been fully documented in `analysis.md`.

---

## 5. Verification Method
1. Inspect `analysis.md` in `d:\internship\ViScanner\.agents\explorer_m2_r1_1\analysis.md`.
2. Verify selector mappings against `src/App.js`, `src/Uploader.js`, `src/Facets.js`, and `src/CnvTable.js`.
3. Verify `window.alert` handling against `src/Uploader.js:526-530` and `615-645`.
