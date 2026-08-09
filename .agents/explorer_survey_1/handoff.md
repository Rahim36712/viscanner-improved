# Explorer Handoff Report — Codebase Architecture & Data Parsers

## 1. Observation

### 1.1 Direct File Observations
- `src/Uploader.js` (802 lines): Contains file decompression (`readZip`), VCF parser (`parseSeverusVcf`), BND breakend parser (`parseBreakendAlt`), HiGlass data parser (`parseHiglassData`), chromosome normalizer (`normalizeChromosome`), SNP/BAF parser (`parseSnpData`), coverage parser (`parseWakhanCoverageData`), segment parser (`parseWakhanSegmentBed`), and upload error handler (`showUploadError`).
- `src/safeRendering.js` (181 lines): Exported functions: `isFiniteNumber`, `isValidPoint`, `isValidRect`, `isValidVariant`, `safeClamp`, `logDevSkip`, `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`.
- `src/plotBounds.js` (126 lines): Exported functions: `getPlotBounds`, `mapTrackX`, `unmapTrackX`, `resetGlobalChromExtents`, `registerGlobalChromExtents`, `getGlobalMasterChromBounds`, `registerDatasetExtents`, `getDynamicChrAbs`.
- `src/WakhanCoverageTrack.js` (1334 lines): Contains internal utility `variantLength(variant)` (lines 85-93).
- `src/WakhanStructuralVariationTrack.js` (900 lines): Contains internal utility `variantLength(variant)` (lines 47-55) and `normalizeTrackData(data)` (lines 37-45).

### 1.2 Function Signatures & Code Snippets
1. `parseBreakendAlt(alt)` (`src/Uploader.js:123`):
   ```javascript
   function parseBreakendAlt(alt) {
     const match = alt && alt.match(/[\[\]]([^:\[\]]+):(\d+)[\[\]]/);
     if (!match) return null;
     return { chr: normalizeChromosome(match[1]), pos: parseInt(match[2], 10) };
   }
   ```
2. `variantLength(variant)` (`src/WakhanCoverageTrack.js:85`, `src/WakhanStructuralVariationTrack.js:47`):
   ```javascript
   function variantLength(variant) {
     if (isFiniteNumber(variant?.svlen)) return Math.abs(variant.svlen);
     if (isFiniteNumber(variant?.startAbs) && isFiniteNumber(variant?.endAbs)) {
       return Math.abs(variant.endAbs - variant.startAbs);
     }
     return 0;
   }
   ```
3. `normalizeChromosome(chrom)` (`src/Uploader.js:15`):
   ```javascript
   function normalizeChromosome(chrom) {
     return chrom.startsWith("chr") ? chrom : "chr" + chrom;
   }
   ```
4. `parseHiglassData(v)` (`src/Uploader.js:31`):
   ```javascript
   function parseHiglassData(v) {
     const result = v.trim().split(/\r?\n/);
     const higlassData = [];
     result.forEach((r, i) => {
       if (i === 0) return;
       const segment = r.split("\t");
       higlassData.push([
         normalizeChromosome(segment[0]),
         parseInt(segment[1], 10),
         parseInt(segment[2], 10),
         parseFloat(segment[3]), parseFloat(segment[4]), parseFloat(segment[5]),
         parseFloat(segment[6]), parseFloat(segment[7]), segment[8],
       ]);
     });
     return higlassData;
   }
   ```
5. `normalizeTrackData(data)` (`src/WakhanStructuralVariationTrack.js:37`):
   ```javascript
   function normalizeTrackData(data) {
     if (Array.isArray(data)) return { variants: data, matchedIds: [] };
     return {
       variants: (data && data.variants) || [],
       matchedIds: (data && data.matchedIds) || [],
     };
   }
   ```

---

## 2. Logic Chain

1. **Requirement Mapping**: Requirement R1 asks for unit test coverage on data parsers (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`), safe rendering (`safeRendering.js`), and plot bounds (`plotBounds.js`).
2. **Function Definition & Location**:
   - `normalizeChromosome`, `parseBreakendAlt`, `parseHiglassData` are internal functions in `src/Uploader.js`.
   - `variantLength` is defined identically in both `src/WakhanCoverageTrack.js:85` and `src/WakhanStructuralVariationTrack.js:47`.
   - `normalizeTrackData` is defined in `src/WakhanStructuralVariationTrack.js:37`.
   - Utility functions in `src/safeRendering.js` and `src/plotBounds.js` are ES module exports.
3. **Data Flow & Dependencies**:
   - Ingested files from `Uploader.js` flow through `parseSeverusVcf`, `parseWakhanSegmentBed`, `parseHiglassData`, and `parseSnpData`.
   - Data objects are fed into HiGlass track methods (`setData`, `setStructuralVariationData`) where `plotBounds.js` converts genomic coordinates to screen space and `safeRendering.js` validates coordinates before PixiJS drawing.
4. **Boundary Condition & Robustness Assessment**:
   - Corrupted VCF headers are safely skipped by comment/length checks (`parseSeverusVcf`).
   - Zero-length variants return `0` in `variantLength` and are handled as markers in track drawing.
   - Non-finite coordinates (`NaN`, `Infinity`) are rejected by `isFiniteNumber` and `isValidVariant`, avoiding WebGL rendering exceptions.
   - Missing haplotype fields (`HP`) fall back to `"-"` and set `isOnlyUnphased = true`.
   - Exception risk: `normalizeChromosome` calls `chrom.startsWith` directly without checking if `chrom` is a string, which would throw if `chrom` is a number or null.

---

## 3. Caveats

- **Source Code Read-Only**: As an explorer agent, no source code was modified and no unit/E2E test commands were executed.
- **Export Refactoring Recommendation**: `normalizeChromosome`, `parseBreakendAlt`, `parseHiglassData`, `variantLength`, and `normalizeTrackData` are currently internal non-exported functions inside component files (`Uploader.js`, `WakhanCoverageTrack.js`, `WakhanStructuralVariationTrack.js`). To make them directly unit-testable by Jest without altering implementation logic, the implementing agent may export them or extract them to a helper module (e.g., `src/parsers.js`).

---

## 4. Conclusion

The codebase architecture of ViScanner has been mapped in detail. All key parsing functions (`parseBreakendAlt`, `variantLength`, `normalizeChromosome`, `parseHiglassData`, `normalizeTrackData`), rendering utilities (`safeRendering.js`), and coordinate translation utilities (`plotBounds.js`) have been cataloged with file paths, line numbers, signatures, and boundary condition handling.

The complete analysis report is written to `.agents/explorer_survey_1/analysis.md`.

---

## 5. Verification Method

To independently verify the observations and logic chain:

1. **Inspect Report Files**:
   - Check `.agents/explorer_survey_1/analysis.md`
   - Check `.agents/explorer_survey_1/handoff.md`

2. **Verify Function Locations**:
   - `view_file` `src/Uploader.js` at lines 15, 31, 123
   - `view_file` `src/safeRendering.js` at lines 10-180
   - `view_file` `src/plotBounds.js` at lines 4-125
   - `view_file` `src/WakhanCoverageTrack.js` at line 85
   - `view_file` `src/WakhanStructuralVariationTrack.js` at lines 37, 47

3. **Invalidation Conditions**:
   - If any function signature or line range specified in this report does not match `src/`, this handoff is invalidated.
