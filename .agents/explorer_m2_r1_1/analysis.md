# Analysis Report: Playwright Test Suite & UI Control Investigation

## 1. Executive Summary
This analysis details the structure of the existing Playwright E2E test suite (`tests/e2e/`), configuration (`playwright.config.js`), React UI interaction controls (`src/App.js`, `src/Uploader.js`, `src/Facets.js`, `src/CnvTable.js`, `src/labelsConfig.js`), sample archives (`examples/`), and error handling mechanisms in ViScanner.

Key Findings:
- Playwright is configured to run E2E tests against `http://localhost:3030` using Chromium, auto-starting the dev server via `npm start`.
- Three existing E2E specs (`file-upload.spec.js`, `sv-toggles-and-drag.spec.js`, `track-controls.spec.js`) test basic upload, SV visibility toggling/persistence during mouse drags, and track option radios/checkboxes.
- Invalid/corrupted file uploads (e.g. renamed RAR files or corrupted zip archives) are intercepted in `src/Uploader.js` via binary signature detection (`RAR_SIGNATURE = "526172211A07"`) and `zipReader.getEntries()` decompresion checks, raising user-friendly `window.alert()` popups.
- Playwright intercepts these `window.alert()` popups via `page.on('dialog', async dialog => ...)` to assert error message strings and dismiss dialogs cleanly without causing page errors.

---

## 2. Existing Playwright Test Suite Overview

### 2.1 Configuration (`playwright.config.js`)
- **Test Directory**: `./tests/e2e`
- **Base URL**: `http://localhost:3030`
- **Web Server**: Runs `npm start` on `http://localhost:3030` with `reuseExistingServer: true`, 120s launch timeout.
- **Timeouts**: Global test timeout `60,000 ms`, expectation timeout `15,000 ms`.
- **Browser & Viewport**: Chromium (`Desktop Chrome`), default viewport `1280x800`.
- **Concurrency**: `fullyParallel: false`, `workers: 1` to prevent port/state conflicts during local testing.

### 2.2 Existing Test Specs (`tests/e2e/`)
1. **`file-upload.spec.js`**:
   - Navigation: `http://localhost:3030`.
   - Locates hidden file input: `page.locator("input[type='file']").first()`.
   - Uploads sample ZIP: `examples/wakhan_viscanner_input.zip` via `.setInputFiles()`.
   - Asserts canvas visibility (`page.locator("canvas").first()`) and zero page errors (`page.on("pageerror")`).
2. **`sv-toggles-and-drag.spec.js`**:
   - Locates SV type checkboxes using exact text filtering: `page.locator("label.sv-visibility-option").filter({ hasText: /^BND$/ }).locator("input[type='checkbox']")`.
   - Unchecks `BND` and `INV` checkboxes.
   - Simulates mouse drag/slide on canvas using `page.mouse.move()` and `page.mouse.down()/up()`.
   - Verifies checkboxes remain unchecked after plot dragging (state persistence).
3. **`track-controls.spec.js`**:
   - Tests SV source radio buttons (`Wakhan Copy number BED` vs `All VCF SVs`).
   - Toggles "Display SV lines in copy-number plot" and "Masked Centromere regions" checkboxes.
   - Verifies controls toggle cleanly without JavaScript console errors.

---

## 3. UI Element Selectors & Interaction Map

| Component / Feature | Element Description | Selector Strategy | Expected Behavior / Effect |
|---|---|---|---|
| **File Uploader Dropzone** | Hidden File Input | `input[type='file']` | Accepts `.zip`, `.csv`, `.bed`, `.vcf` files |
| **File Uploader Button** | Visible Dropzone Button | `button:has-text('Click to upload')` | Triggers browser file dialog |
| **Upload Spinner** | Loading Indicator | `#upload-spinner` | Uncollapses during decompression & parsing |
| **Overlay** | Loading Screen Overlay | `#overlay` | Blocks interaction while processing ZIP archive |
| **SV Type Checkboxes** | `DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND` | `label.sv-visibility-option:has-text('<TYPE>') input[type='checkbox']` | Toggles rendering of specific SV types in track |
| **SV Source Radios** | "Wakhan Copy number BED" / "All VCF SVs" | `label:has-text('Wakhan Copy number BED') input[type='radio']` | Switches between BED-matched SVs (`matched`) and all VCF SVs (`all`) |
| **HP2 SV Track Toggle** | "Phased HP2 SV's plot" | `label:has-text("Phased HP2 SV's plot") input[type='checkbox']` | Toggles HP2 SV track height between 90px and 1px (`updateHpSvTrackVisibility`) |
| **SV Lines Toggle** | "Display SV lines in copy-number plot" | `label:has-text('Display SV lines in copy-number plot') input[type='checkbox']` | Shows/hides vertical SV breakpoint lines in coverage plot |
| **Masked Regions Toggle**| "Masked Centromere regions" | `label:has-text('Masked Centromere regions') input[type='checkbox']` | Shows/hides centromere/masked region overlays |
| **Min SV Span Input** | SV Minimum Span Field | `div.sv-max-span-input input[type='number']` | Filters SVs by minimum length in bp |
| **Export PDF Button** | Vector PDF Export | `button:has-text('Export PDF')` | Calls `exportSvgAsPdf()`, re-renders Pixi canvas |
| **Export CSV Button** | Segment Table CSV Export | `button:has-text('Export CSV')` | Downloads segment data in CSV format |
| **Region Navigation** | Genomic Position Input | `input[placeholder='e.g., chr2:1000-chr2:2000']` | Takes genomic coordinates string |
| **Go Button** | Jump to Region Button | `button:has-text('Go')` | Invokes `hgc.api.zoomTo()` to view region |
| **Gene Search** | Gene Name Input | `input[placeholder='Search for gene']` | Suggests genes via HiGlass API, zooms on selection |
| **Reset View Button** | Reset Pan/Zoom Button | `button:has-text('Reset View')` | Resets HiGlass zoom/location to default |
| **CNV Table** | Segment Data Table | `table.table` | Displays parsed CNV segments and SV breakpoints |
| **Table Chrom Filter** | Chromosome Dropdown | `th .basic-single` / `Select` | Filters table rows by chromosome ("All", "chr1"-"chr22") |
| **Table Sorting** | Column Header Sort Icon | `th i.sort-table-icon` | Sorts table rows ascending/descending |
| **Inspect Region Eye** | Eye Icon in Table | `td i.fa-eye` | Scrolls to visualization section and zooms HiGlass to segment |
| **Table Pagination** | Next / Previous Buttons | `button:has-text('Next')`, `button:has-text('Previous')` | Navigates 20-row table pages |
| **HiGlass Canvas** | Main PixiJS Render Canvas | `canvas` or `#higlass-container canvas` | Interactive genomic track visualizer |

---

## 4. Invalid File Upload & Dialog (`window.alert`) Handling

### 4.1 Decompression & Error Raising Pipeline (`src/Uploader.js`)
When a file is dropped into the dropzone:
1. `readUploadedFiles(acceptedFiles, props)` checks file extension.
2. If `.zip`, `readZip(file, props)` executes:
   - **RAR Signature Verification**: Checks the first 8 bytes using `fileSignature(file)`. If the header starts with `RAR_SIGNATURE` (`"526172211A07"`), it throws:
     `"This file is a RAR archive, not a real ZIP. Please create it using Windows 'Send to > Compressed (zipped) folder', or upload the BED/CSV/VCF files directly."`
   - **Corrupted Zip Decompression**: Attempts `zipReader.getEntries()`. If decompression fails or archive is invalid, it catches the error and throws:
     `"ViScanner could not read this archive as a ZIP file. Please remake the archive as a normal .zip, or upload the BED/CSV/VCF files directly."`
3. Catch block in `onDrop`:
   ```javascript
   readUploadedFiles(acceptedFiles, props)
     .then(...)
     .catch((error) => {
       showUploadError(error.message || "ViScanner could not read the uploaded file.");
     });
   ```
4. `showUploadError` resets the upload spinner overlay and invokes `window.alert(message)`.

### 4.2 Playwright Dialog Interception Pattern
Playwright handles browser dialogs (alerts, confirms, prompts) via event listeners. Because `window.alert` blocks browser execution, the dialog handler must be set up **prior** to triggering the upload action:

```javascript
test("should show alert popup on uploading renamed RAR archive", async ({ page }) => {
  let dialogMessage = "";
  
  // Register dialog listener
  page.on("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.accept(); // Dismiss alert modal
  });

  const fileInput = page.locator("input[type='file']").first();
  const rarPath = path.resolve(__dirname, "../../examples/invalid_rar.zip");

  await fileInput.setInputFiles(rarPath);

  // Wait for async file processing & dialog trigger
  await page.waitForTimeout(1000);

  // Assert expected error message
  expect(dialogMessage).toContain("This file is a RAR archive, not a real ZIP");
});
```

---

## 5. Sample Archives in `examples/`
- `examples/wakhan_viscanner_input.zip`: Valid sample ZIP containing Wakhan phased coverage, CNV segments, and Severus VCF files.
- `examples/viscanner_example.zip`: Valid sample ZIP containing standard HiScanner `cna_short.txt` and `cna_long.txt` datasets.

---

## 6. Test Suite Extension Plan for M2 Implementer

1. **`tests/e2e/invalid-file-upload.spec.js`**:
   - Test RAR archive detection (`window.alert` assertion for `invalid_rar.zip`).
   - Test corrupted ZIP archive error (`window.alert` assertion for `corrupted.zip`).
   - Verify React application does not throw uncaught page exceptions (`page.on('pageerror')`).

2. **`tests/e2e/sv-visibility-persistence.spec.js`**:
   - Test toggling all 6 SV type checkboxes (`DEL`, `INV`, `INS`, `BND`, `DUP`, `sBND`).
   - Verify SV checkboxes retain state across canvas drag/pan and zoom interactions.
   - Verify min SV span input filters properly without breaking state.

3. **`tests/e2e/export-and-table-interactions.spec.js`**:
   - Test "Export PDF" button click (triggers `exportSvgAsPdf` without runtime crashes).
   - Test CNV Table sorting, pagination, and chromosome dropdown filtering.
   - Test eye icon ("Inspect region") click navigation.
