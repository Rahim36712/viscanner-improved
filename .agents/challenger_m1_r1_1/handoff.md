# Handoff Report: Milestone 1 Verification (Unit Test Stress Challenge)

**VERDICT: REQUEST_CHANGES**

## 1. Observation
- **Standard Test Suite Execution**: Executed `npm test` in `d:\internship\ViScanner`.
  - The worker's 5 default test suites (`App.test.js`, `Uploader.test.js`, `WakhanTrackUtils.test.js`, `plotBounds.test.js`, `safeRendering.test.js`) pass cleanly with exit code **0** (`5 passed, 5 total`, `60 passed, 60 total`).
- **Empirical Stress Test Discovery & Failure**:
  - Adversarial stress testing of parser functions in `src/Uploader.js` revealed a **defect in `parseSnpData`**:
    - Counter-example input string: `"# Comment line\nchr\tpos\tbaf\nchr1\t500\t0.33\nchr2\t1500\t0.66"`
    - Expected output length: `2` (skipping `# Comment line` and header `chr\tpos\tbaf`, returning only data items for `chr1` and `chr2`).
    - Actual output length: `3`
    - Actual output content: `[["chr", NaN, NaN], ["chr1", 500, 0.33], ["chr2", 1500, 0.66]]`
    - Test failure output:
      ```text
      FAIL src/stressHarness.test.js
        ● Adversarial Stress Test Suite for ViScanner Parsers & Utilities › parseSnpData Adversarial Inputs › skips comments and header rows correctly

          expect(received).toHaveLength(expected)

          Expected length: 2
          Received length: 3
          Received array:  [["chr", NaN, NaN], ["chr1", 500, 0.33], ["chr2", 1500, 0.66]]
      ```

## 2. Logic Chain
1. **Source Code Analysis**: In `src/Uploader.js` lines 81-83:
   ```javascript
   if (i === 0 && (Number.isNaN(pos) || Number.isNaN(value))) {
     return;
   }
   ```
2. **Failure Mechanics**: The parameter `i` is the line index in the file split by newlines.
   - When a file starts with a `#` comment line (e.g. `# Comment line`), line index `0` starts with `#` and returns early.
   - Line index `1` contains the text column header (`chr\tpos\tbaf`).
   - Because `i === 1` (not `0`), the check `i === 0 && ...` evaluates to `false`.
   - `parseSnpData` proceeds to parse `chr\tpos\tbaf` as a data row, producing `["chr", NaN, NaN]`, which is invalid SNP BAF data.
3. **Required Fix**:
   - `parseSnpData` should check whether `Number.isNaN(pos) || Number.isNaN(value)` for ANY line (or skip any row where `pos` or `value` is non-numeric/NaN) instead of restricting header detection exclusively to index `i === 0`.

## 3. Caveats
- All other parser functions (`parseSeverusVcf`, `parseBreakendAlt`, `parseHiglassData`, `parseWakhanCoverageData`, `parseMaskedRegionBed`, `parseWakhanSegmentBed`, `parseWakhanSegmentTableData`, `parseWakhanCopyNumberData`, `variantLength`, `normalizeTrackData`, `safeRendering` wrappers, `plotBounds` functions) handled adversarial inputs gracefully.

## 4. Conclusion
Milestone 1 requires changes before full approval.
**Required Worker Actions**:
1. Update `parseSnpData` in `src/Uploader.js` to filter out non-numeric rows (where `pos` or `baf`/`value` is `NaN`), ensuring header rows are skipped regardless of line index `i`.
2. Add a unit test case to `src/Uploader.test.js` validating `parseSnpData` when a `#` comment line precedes a text column header.

## 5. Verification Method
To verify the fix:
1. Update `src/Uploader.js` and `src/Uploader.test.js`.
2. Run `npm test`.
3. Confirm all unit tests pass cleanly with exit code 0 and `parseSnpData` ignores comments preceding header lines without returning `["chr", NaN, NaN]`.
