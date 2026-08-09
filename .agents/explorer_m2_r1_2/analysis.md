# E2E Environment & Mock Data Analysis Report

## Executive Summary
This report documents the investigation of the Playwright E2E test execution environment, local dev server configuration, sample input archive structures, and error alert handling mechanisms in ViScanner. It provides a detailed specification for generating mock invalid/corrupted test fixtures required for Black-Box E2E error handling verification in Milestone 2.

---

## 1. Playwright Execution Setup & WebServer Configuration

### Configuration File: `playwright.config.js`
- **Test Directory (`testDir`)**: `./tests/e2e`
- **Execution Mode**:
  - `fullyParallel`: `false` (tests run sequentially)
  - `workers`: `1` (single worker process)
  - `retries`: `0`
- **Timeouts**:
  - Global test timeout: `60,000 ms` (60 seconds)
  - Expect assertion timeout: `15,000 ms` (15 seconds)
  - WebServer startup timeout: `120,000 ms` (2 minutes)
- **Browser & Target Environment**:
  - Base URL (`baseURL`): `http://localhost:3030`
  - Browser Project: `chromium` (Desktop Chrome)
  - Viewport: `{ width: 1280, height: 800 }`
  - Reporter: `html`
  - Trace: `on-first-retry`
- **Local WebServer (`webServer`)**:
  - Command: `npm start` (invokes `webpack serve --mode development`)
  - Server URL: `http://localhost:3030`
  - `reuseExistingServer`: `true` (allows running against an already active dev server during development)

### NPM Scripts (`package.json`)
- `"start"`: `webpack serve --mode development`
- `"test:e2e"`: `playwright test`
- `"test:e2e:ui"`: `playwright test --ui`

---

## 2. Sample Data Archives Analysis (`examples/`)

ViScanner includes two pre-packaged sample ZIP archives in `d:\internship\ViScanner\examples\`:

### Archive 1: `wakhan_viscanner_input.zip` (277,390 bytes)
- **Files Contained**:
  1. `2009_2.36_0.97_0.8_copynumbers_segments_HP_1.bed` (195,234 bytes)
  2. `2009_2.36_0.97_0.8_copynumbers_segments_HP_2.bed` (194,490 bytes)
  3. `baf.csv` (1,152,741 bytes)
- **Data Flow & Parsing (`Uploader.js`)**:
  - `copynumbers_segments_HP_1.bed` & `HP_2.bed`: Parsed via `parseWakhanSegmentBed()`. Extracted segments build the Wakhan CNV table (`parseWakhanSegmentTableData`) and populates `scanner-result-track-hp1` / `scanner-result-track-hp2`.
  - `baf.csv`: Parsed via `parseSnpData(text, ",")` to render B-allele frequency tracks on `scanner-result-track-1`.

### Archive 2: `viscanner_example.zip` (6,863,495 bytes)
- **Files Contained**:
  1. `cna_short.txt` (8,032 bytes)
  2. `cna_long.txt` (1,209,741 bytes)
  3. `snp.txt` (20,879,304 bytes)
- **Data Flow & Parsing (`Uploader.js`)**:
  - `cna_short.txt`: Parsed via `parseHiglassData()` to populate the copy-number segment table.
  - `cna_long.txt`: Parsed via `parseHiglassData()` to populate main copy number tracks (`scanner-result-track-1`, `hp1`, `hp2`).
  - `snp.txt`: Parsed via `parseSnpData(text, "\t")` to render BAF SNP scatter plot data.

---

## 3. Upload Error Handling & UI Alert Dialog Analysis

### Code Inspection (`src/Uploader.js`)

1. **RAR Archive Detection**:
   ```javascript
   export const RAR_SIGNATURE = "526172211A07";
   const signature = await fileSignature(file);
   if (signature.startsWith(RAR_SIGNATURE)) {
     throw new Error(
       "This file is a RAR archive, not a real ZIP. Please create it using Windows 'Send to > Compressed (zipped) folder', or upload the BED/CSV/VCF files directly."
     );
   }
   ```

2. **ZIP Decompression Failure**:
   ```javascript
   try {
     const entries = await zipReader.getEntries();
     // process entries...
   } catch (error) {
     throw new Error(
       "ViScanner could not read this archive as a ZIP file. Please remake the archive as a normal .zip, or upload the BED/CSV/VCF files directly."
     );
   }
   ```

3. **Alert Popup Dispatch (`showUploadError`)**:
   ```javascript
   function showUploadError(message) {
     resetUploadSpinner();
     window.alert(message);
   }
   ```

When an upload error occurs, `window.alert()` is invoked with a user-friendly message.

---

## 4. Test Fixtures Preparation Plan (Invalid/Corrupted Files)

To enable comprehensive E2E testing of error alert popups in Playwright, the following mock fixture files must be created under a dedicated fixtures directory (e.g. `tests/fixtures/`):

### 1. `invalid_rar.zip`
- **File Type**: Renamed RAR Archive file.
- **Magic Header**: `52 61 72 21 1A 07 00 00` (Hex string `526172211A07`).
- **Purpose**: Test detection of renamed `.rar` files uploaded with a `.zip` extension.
- **Expected Result**: Triggers `window.alert` containing:
  `"This file is a RAR archive, not a real ZIP. Please create it using Windows 'Send to > Compressed (zipped) folder', or upload the BED/CSV/VCF files directly."`

### 2. `corrupted_text.zip`
- **File Type**: Non-ZIP plain text file saved with a `.zip` extension.
- **Content**: Plain text string (e.g. `"INVALID_ZIP_HEADER_PLAIN_TEXT_CONTENT"`).
- **Purpose**: Test ZIP parsing failure handling when `zipReader.getEntries()` fails.
- **Expected Result**: Triggers `window.alert` containing:
  `"ViScanner could not read this archive as a ZIP file. Please remake the archive as a normal .zip, or upload the BED/CSV/VCF files directly."`

### 3. `corrupted_header.zip`
- **File Type**: Truncated/corrupted 0-byte or corrupted binary archive file.
- **Content**: Empty buffer `Buffer.alloc(0)` or corrupted bytes.
- **Purpose**: Test zero-length/empty ZIP archive error handling.
- **Expected Result**: Triggers `window.alert` containing:
  `"ViScanner could not read this archive as a ZIP file. Please remake the archive as a normal .zip, or upload the BED/CSV/VCF files directly."`

### Playwright Verification Pattern for Invalid File Uploads
In Playwright tests (`tests/e2e/file-upload-invalid.spec.js` or `tests/e2e/file-upload.spec.js`), alert dialogs are handled as follows:
```javascript
let dialogMessage = "";
page.on("dialog", async (dialog) => {
  dialogMessage = dialog.message();
  await dialog.dismiss();
});

const fileInput = page.locator("input[type='file']").first();
await fileInput.setInputFiles(invalidFixturePath);
await page.waitForTimeout(1000);

expect(dialogMessage).toContain("expected user-friendly message");
```
