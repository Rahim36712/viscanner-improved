# Handoff Report — E2E Environment & Mock Data Explorer (M2 Explorer 2)

## 1. Observation
- **Playwright Setup (`playwright.config.js`)**:
  - `testDir`: `./tests/e2e`
  - `baseURL`: `http://localhost:3030`
  - `webServer.command`: `npm start` (`webpack serve --mode development`)
  - `webServer.reuseExistingServer`: `true`, timeout: `120,000 ms`
  - Execution mode: single worker (`workers: 1`), non-parallel (`fullyParallel: false`), test timeout `60,000 ms`, expect timeout `15,000 ms`.
- **Sample Archives (`examples/`)**:
  - `wakhan_viscanner_input.zip` (277,390 bytes): Contains `2009_2.36_0.97_0.8_copynumbers_segments_HP_1.bed`, `2009_2.36_0.97_0.8_copynumbers_segments_HP_2.bed`, `baf.csv`.
  - `viscanner_example.zip` (6,863,495 bytes): Contains `cna_short.txt`, `cna_long.txt`, `snp.txt`.
- **Error Alert Handling (`src/Uploader.js`)**:
  - `RAR_SIGNATURE = "526172211A07"`: Signature check throws `"This file is a RAR archive, not a real ZIP..."` when file starts with RAR hex signature.
  - `zipReader.getEntries()` failure: Throws `"ViScanner could not read this archive as a ZIP file..."` when unzipping non-ZIP or corrupted zip files.
  - Exception handler catches errors and calls `showUploadError(message)`, executing `window.alert(message)`.

## 2. Logic Chain
1. Playwright launches the React development server via `npm start` on `http://localhost:3030` if not already running.
2. Existing E2E specs in `tests/e2e/` test valid archive loading, SV visibility toggling, canvas dragging, and track control toggling.
3. To fulfill requirement R2 / Black-Box acceptance criteria (testing invalid file uploads and verifying UI alert popups), Playwright tests must upload mock invalid files.
4. `Uploader.js` uses binary signature checking (`fileSignature`) for RAR files (`526172211A07`) and `@zip.js/zip.js` decompression for `.zip` files.
5. Creating mock invalid fixtures (`invalid_rar.zip` with RAR signature, `corrupted_text.zip` with plain text content, `corrupted_header.zip` with 0 bytes) enables Playwright tests to register a `page.on('dialog', ...)` listener and verify user-friendly alert popups.

## 3. Caveats
- No test files were executed or modified during this read-only investigation.
- Fixture creation requires generating binary buffers (e.g. `Buffer.from("526172211A07", "hex")`) when writing mock fixture files to `tests/fixtures/`.

## 4. Conclusion
The E2E execution environment is properly configured via `playwright.config.js` to target `http://localhost:3030`. Sample ZIP archives in `examples/` serve as valid data sources. Mock invalid fixtures can be generated with specific magic byte signatures or text content to thoroughly test error alert popups in Playwright.

## 5. Verification Method
- **File Inspection**: Verify existence of `playwright.config.js`, `examples/wakhan_viscanner_input.zip`, and `examples/viscanner_example.zip`.
- **Code Inspection**: Inspect `src/Uploader.js` lines 613–645 (`readZip` and `fileSignature`).
- **Test Command**: Run `npx playwright test` or `npm run test:e2e` after implementing fixtures and E2E test suites in Milestone 2.
