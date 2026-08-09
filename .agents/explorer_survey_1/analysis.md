# ViScanner Codebase Architecture & Data Parser Analysis Report

## 1. Executive Summary & Architecture Overview

ViScanner is a React-based genomic visualization application that integrates HiGlass custom PixiJS tracks (`WakhanCoverageTrack`, `WakhanStructuralVariationTrack`, `ScannerResultTrack`, `AlignedChromosomeLabelsTrack`, `HorizontalGeneAnnotationsTrack`) with tabular segment browsing (`CnvTable`) and multi-format data ingestion (`Uploader`).

The core data flow proceeds as follows:
1. **User Data Ingestion**: `Uploader.js` receives raw files (`.zip`, `.vcf`, `.bed`, `.csv`, `.txt`) via `react-dropzone` or decompression via `@zip.js/zip.js`.
2. **Parsing & Normalization**: Custom parser functions extract records, normalize chromosome identifiers (`normalizeChromosome`), compute variant dimensions (`variantLength`, `parseBreakendAlt`), and construct standard data structures.
3. **Data Distribution**: `parseUploadedEntryTexts` dispatches parsed objects to `CnvTable` (`populateTable`) and HiGlass custom tracks (`updateCopyNumberTracks`, `updateWakhanStructuralVariationTrack`, `updateWakhanCoverageTracks`, `updateBafSnpTrack`).
4. **Rendering & Validation**: Custom tracks utilize `plotBounds.js` for dynamic multi-chromosome coordinate mapping (`mapTrackX`, `getDynamicChrAbs`) and `safeRendering.js` for defensive rendering checks (`isFiniteNumber`, `isValidVariant`, `safeMoveTo`, `safeLineTo`, `safeDrawRect`) before calling PixiJS drawing methods.

---

## 2. Module Map (Files, Exports, Imports, and Dependencies)

| Module Path | Exports | Key Dependencies / Imports | Consumed By |
| --- | --- | --- | --- |
| `src/Uploader.js` | `default Uploader` (React component) | `react-dropzone`, `@zip.js/zip.js`, `higlassLayout.js`, `plotBounds.js` | `src/CnvTable.js` |
| `src/safeRendering.js` | `isFiniteNumber`, `isValidPoint`, `isValidRect`, `isValidVariant`, `safeClamp`, `logDevSkip`, `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect` | None (pure JS utility) | `src/WakhanCoverageTrack.js`, `src/WakhanStructuralVariationTrack.js`, `src/safeRendering.test.js` |
| `src/plotBounds.js` | `PLOT_LEFT`, `PLOT_RIGHT_MARGIN`, `getPlotBounds`, `mapTrackX`, `unmapTrackX`, `resetGlobalChromExtents`, `registerGlobalChromExtents`, `getGlobalMasterChromBounds`, `registerDatasetExtents`, `getDynamicChrAbs` | None (pure JS utility) | `src/Uploader.js`, `src/WakhanCoverageTrack.js`, `src/WakhanStructuralVariationTrack.js` |
| `src/WakhanCoverageTrack.js` | `default WakhanCoverageTrack` (Factory function & HiGlass Track Class) | `smaht-higlass-misc`, `d3-format`, `plotBounds.js`, `pdfExport.js`, `labelsConfig.js`, `safeRendering.js` | `src/HiglassBrowser.js` (registered via `higlassRegister`) |
| `src/WakhanStructuralVariationTrack.js` | `default WakhanStructuralVariationTrack` (Factory function & HiGlass Track Class) | `smaht-higlass-misc`, `d3-format`, `plotBounds.js`, `pdfExport.js`, `labelsConfig.js`, `safeRendering.js` | `src/HiglassBrowser.js` (registered via `higlassRegister`) |
| `src/App.js` | `default App`, `updateHpSvTrackVisibility` | `Facets.js`, `HiglassBrowser.js`, `CnvTable.js`, `higlassLayout.js`, `labelsConfig.js` | `src/index.js` |
| `src/HiglassBrowser.js` | `HiglassBrowser` (React component) | `higlass`, `higlass-register`, `higlass-text`, `AlignedChromosomeLabelsTrack.js`, `ScannerResultTrackPatched.js`, `WakhanCoverageTrack.js`, `WakhanStructuralVariationTrack.js`, `HorizontalGeneAnnotationsTrackPatched.js`, `higlassLayout.js`, `HiGlassErrorBoundary.js`, `viewConfig.json` | `src/App.js` |
| `src/CnvTable.js` | `CnvTable` (React component) | `Uploader.js`, `higlass/dist/hglib` (`ChromosomeInfo`), `d3-format`, `react-select`, `higlassLayout.js`, `labelsConfig.js` | `src/App.js` |

---

## 3. Target Function Specifications

### 3.1 `parseBreakendAlt`
- **Definition File**: `src/Uploader.js` (lines 123-132)
- **Signature**: `function parseBreakendAlt(alt)`
- **Export Status**: Internal function (not exported).
- **Callers**: `parseSeverusVcf` (`src/Uploader.js:175`)
- **Inputs**:
  - `alt` (`string | null | undefined`): VCF ALT allele field for breakend records (e.g. `N[chr2:12345[`, `]chrX:999]N`, `G[1:5000[`).
- **Regex Pattern**: `/[\[\]]([^:\[\]]+):(\d+)[\[\]]/`
- **Outputs**:
  - Returns `{ chr: string, pos: number }` where `chr` is normalized via `normalizeChromosome` and `pos` is integer.
  - Returns `null` if `alt` is null, undefined, or does not match the breakend pattern.
- **Boundary Handling**:
  - Handles non-BND ALT strings (e.g. `<DEL>`, `<INV>`, `A`, `G`) by returning `null`.
  - Handles falsy `alt` gracefully.

### 3.2 `variantLength`
- **Definition Files**:
  - `src/WakhanCoverageTrack.js` (lines 85-93)
  - `src/WakhanStructuralVariationTrack.js` (lines 47-55)
- **Signature**: `function variantLength(variant)`
- **Export Status**: Internal function in both files (not exported).
- **Callers**:
  - `WakhanCoverageTrack.js:816`, `819`, `1210`
  - `WakhanStructuralVariationTrack.js:458`, `462`, `807`
- **Inputs**:
  - `variant` (`object | null | undefined`): Structural variant record.
- **Outputs**: `number` (non-negative variant length in base pairs).
- **Logic**:
  1. If `isFiniteNumber(variant?.svlen)`: returns `Math.abs(variant.svlen)`.
  2. Else if `isFiniteNumber(variant?.startAbs)` and `isFiniteNumber(variant?.endAbs)`: returns `Math.abs(variant.endAbs - variant.startAbs)`.
  3. Else returns `0`.
- **Boundary Handling**:
  - Null/undefined variant: safe optional chaining (`variant?.svlen`) returns `0`.
  - Negative `svlen` (e.g. `-500` for DEL): `Math.abs` converts to `500`.
  - Zero-length variant or single breakpoint (`INS`, `sBND`): returns `0`.

### 3.3 `normalizeChromosome`
- **Definition File**: `src/Uploader.js` (lines 15-17)
- **Signature**: `function normalizeChromosome(chrom)`
- **Export Status**: Internal function (not exported).
- **Callers**:
  - `parseHiglassData` (`Uploader.js:40`)
  - `parseSnpData` (`Uploader.js:84`)
  - `parseBreakendAlt` (`Uploader.js:129`)
  - `parseSeverusVcf` (`Uploader.js:178, 180`)
  - `parseWakhanCoverageData` (`Uploader.js:242`)
  - `parseMaskedRegionBed` (`Uploader.js:269`)
  - `parseWakhanSegmentBed` (`Uploader.js:288`)
- **Inputs**: `chrom` (`string`): Chromosome identifier (e.g. `"1"`, `"chr1"`, `"X"`, `"chrX"`).
- **Outputs**: `string` starting with `"chr"` (e.g. `"chr1"`).
- **Implementation**: `return chrom.startsWith("chr") ? chrom : "chr" + chrom;`
- **Boundary Risks**: If `chrom` is null, undefined, or non-string (e.g. number `1`), `chrom.startsWith` will throw a `TypeError`. Unit tests should verify behavior with non-string values.

### 3.4 `parseHiglassData`
- **Definition File**: `src/Uploader.js` (lines 31-52)
- **Signature**: `function parseHiglassData(v)`
- **Export Status**: Internal function (not exported).
- **Callers**: `parseUploadedEntryTexts` (`Uploader.js:545, 549`)
- **Inputs**: `v` (`string`): Raw tab-delimited text from `cna_short.txt` or `cna_long.txt`.
- **Outputs**: `Array<Array<string | number>>`: Array of 9-element arrays `[chr, start, end, val3, val4, val5, val6, val7, label]`.
- **Logic**:
  1. Trims and splits `v` by newlines (`\r?\n`).
  2. Skips header line (index 0 unconditionally).
  3. For each data line: splits by `\t`, normalizes `segment[0]` with `normalizeChromosome`, parses start/end as ints, numbers 3-7 as floats, and keeps label string `segment[8]`.
- **Boundary Handling**:
  - Empty string: returns `[]`.
  - Trailing newlines: trimmed prior to splitting.

### 3.5 `normalizeTrackData`
- **Definition File**: `src/WakhanStructuralVariationTrack.js` (lines 37-45)
- **Signature**: `function normalizeTrackData(data)`
- **Export Status**: Internal function (not exported).
- **Callers**: `parseData` (`WakhanStructuralVariationTrack.js:188`)
- **Inputs**: `data` (`Array<object> | { variants?: Array<object>, matchedIds?: Array<string> } | null | undefined`)
- **Outputs**: `{ variants: Array<object>, matchedIds: Array<string> }`
- **Logic**:
  - If `Array.isArray(data)`: returns `{ variants: data, matchedIds: [] }`.
  - Else: returns `{ variants: data?.variants || [], matchedIds: data?.matchedIds || [] }`.
- **Boundary Handling**:
  - Handles raw arrays, missing object properties, `null`, and `undefined` without throwing exceptions.

---

## 4. Ancillary Utility & Parsing Functions

### 4.1 Additional Parsers in `src/Uploader.js`
1. `parseSeverusVcf(v, options = {})` (`Uploader.js:148-229`)
   - Parses Severus VCF lines, skipping `#` comment/header lines.
   - Extracts INFO (`parseInfoField`) and SAMPLE (`parseSampleField`) columns.
   - Resolves BND mates using `parseBreakendAlt` and second-pass pairing by `MATE_ID`.
   - Filters out non-PASS records when `passOnly: true`.
2. `parseSnpData(v, delimiter = "\t")` (`Uploader.js:71-93`)
   - Parses BAF / SNP position-value pairs. Automatically detects and skips non-numeric header row on line 0.
3. `parseWakhanCoverageData(v)` (`Uploader.js:231-251`)
   - Parses space/tab delimited coverage files into `{ chr, start, end, hp1, hp2, unphased }`.
4. `parseWakhanSegmentBed(v, haplotypeKey)` (`Uploader.js:277-299`)
   - Parses haplotype segment BED files, extracting coverage, copy number, confidence, and breakpoint IDs via `parseBreakpointIds`.
5. `parseMaskedRegionBed(v)` (`Uploader.js:253-275`)
   - Parses centromere/masked region BED files into `{ chr, start, end }`. Validates `Number.isFinite` for start/end.
6. `parseInfoField(infoText)` (`Uploader.js:95-108`)
   - Parses VCF `;`-separated key-value INFO fields. Falsy/empty input returns `{}`.
7. `parseSampleField(formatText, sampleText)` (`Uploader.js:110-121`)
   - Maps colon-separated FORMAT keys to SAMPLE values.
8. `parseBreakpointIds(value)` (`Uploader.js:139-146`)
   - Uses regex `/severus_[A-Za-z0-9_]+/g` to extract Severus SV IDs.

### 4.2 Utility Functions in `src/safeRendering.js`
- `isFiniteNumber(val)`: Returns `true` only for valid finite numbers.
- `isValidPoint(x, y)`: Checks both x and y are finite numbers.
- `isValidRect(x, y, width, height)`: Checks coordinates and positive dimensions (`width >= 0 && height >= 0`).
- `isValidVariant(variant)`: Checks object structure, non-null `chr`, and finite `startAbs` or `pos`.
- `safeClamp(val, min, max, fallback = 0)`: Clamps numbers with non-finite fallback protection.
- `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`: PixiJS graphics wrapper methods that pre-validate coordinates and dimensions before executing canvas commands.

### 4.3 Utility Functions in `src/plotBounds.js`
- `getPlotBounds(track)`: Returns `{ left: 72, right: Math.max(73, width - 78) }`.
- `mapTrackX(track, absPosition)`: Converts genomic absolute position to track canvas X coordinate.
- `unmapTrackX(track, plotX)`: Inverse mapping of track X coordinate to genomic absolute position.
- `getGlobalMasterChromBounds(chromInfo)`: Constructs global master chromosome boundaries.
- `getDynamicChrAbs(chrName, relPos, chromInfo, customBounds)`: Maps chromosome relative position to global absolute position.

---

## 5. Data Structures Specification

```typescript
// Variant Object (VCF / Track Record)
interface Variant {
  id: string;
  chr: string; // e.g. "chr1"
  pos: number; // 1-based start
  chr2: string; // e.g. "chr1" or "chr2"
  pos2: number; // 1-based end
  type: "DEL" | "INV" | "INS" | "BND" | "DUP" | "sBND";
  svlen: number | null;
  end: number | null;
  filter: string; // "PASS" or other
  mateId: string | null;
  strands: string;
  detailedType: string;
  hp: "1" | "2" | "-"; // Haplotype designation
  vaf: string | number;
  dv: string | number;
  qual: string | number;
  ref: string;
  alt: string;
  startAbs?: number; // Calculated absolute start
  endAbs?: number; // Calculated absolute end
}

// Haplotype Segment Object (BED segment)
interface HaplotypeSegment {
  chr: string;
  start: number;
  end: number;
  coverage: number;
  copyNumber: number;
  confidence: number;
  breakpoints: string;
  breakpointIds: string[];
  startAbs?: number;
  endAbs?: number;
}

// Coverage Point Object
interface CoverageRow {
  chr: string;
  start: number;
  end: number;
  hp1: number;
  hp2: number;
  unphased: number;
  startAbs?: number;
  endAbs?: number;
  hp1Segment?: HaplotypeSegment | null;
  hp2Segment?: HaplotypeSegment | null;
  hp1CopyNumberEquivalent?: number | null;
  hp2CopyNumberEquivalent?: number | null;
}

// HiGlass CNA 9-Tuple Array
type HiGlassSegmentTuple = [
  chr: string,
  start: number,
  end: number,
  val3: number,
  val4: number,
  val5: number,
  val6: number,
  val7: number,
  label: string
];
```

---

## 6. Boundary Conditions & Edge Case Analysis Matrix

| Case ID | Scenario / Edge Case | Component / File | Specific Function | Observed Handling | Risk / Impact |
| --- | --- | --- | --- | --- | --- |
| **BC-01** | Corrupted VCF Header Lines | `Uploader.js:156` | `parseSeverusVcf` | Comment lines starting with `#` are skipped. Lines with `< 8` fields are skipped. | High stability; safely ignores malformed headers. |
| **BC-02** | Zero-Length Variants | `WakhanCoverageTrack.js:85`<br>`WakhanStructuralVariationTrack.js:47` | `variantLength` | Returns `0`. Track classifies as single-point marker instead of arc. | Handled safely without division by zero. |
| **BC-03** | Non-Finite Genomic Coordinates (`NaN`, `Infinity`, `null`) | `safeRendering.js:10-55`<br>`plotBounds.js:46-52` | `isFiniteNumber`, `isValidVariant`, `registerGlobalChromExtents` | Rejects `NaN`/`Infinity`. PixiJS safe wrappers log dev warning and skip rendering. | Prevents WebGL/Canvas crashes on corrupt data. |
| **BC-04** | Missing Haplotype Fields (`HP`) | `Uploader.js:189`<br>`WakhanStructuralVariationTrack.js:216-228` | `parseSeverusVcf`, `updateVisibleData` | `hp` defaults to `"-"`. If no HP1/HP2 variants exist, `isOnlyUnphased` is set to `true` (renders on Track 1, hides Track 2). | Correct UI behavior for unphased datasets. |
| **BC-05** | Breakend ALT Pattern Mismatch (`BND`) | `Uploader.js:123` | `parseBreakendAlt` | Returns `null` if pattern doesn't match `/[\[\]]([^:\[\]]+):(\d+)[\[\]]/`. Calling function falls back to `chrom` and `end`/`pos`. | Safe fallback for non-standard BND formats. |
| **BC-06** | RAR File Uploaded as `.zip` | `Uploader.js:614-620` | `readZip` | Magic bytes signature `526172211A07` checked; throws user-friendly error string. | Caught by `onDrop` catch block; shows alert popup. |
| **BC-07** | Non-String Chromosome Input | `Uploader.js:15` | `normalizeChromosome` | Performs `chrom.startsWith("chr")`. | **Risk**: Throws `TypeError` if `chrom` is a number or `null`/`undefined`. Recommend adding string guard `String(chrom || "")`. |
| **BC-08** | Negative / Invalid Rect Dimensions | `safeRendering.js:32-41` | `isValidRect`, `safeDrawRect` | Checks `width >= 0 && height >= 0`. Skips PixiJS draw call if invalid. | Prevents PixiJS rendering warnings/errors. |

---

## 7. Recommended White-Box Test Cases for Implementation Phase

To fulfill **R1** (Jest White-Box unit and integration testing), unit tests should be implemented in `src/` (e.g. `src/Uploader.test.js`, `src/safeRendering.test.js`, `src/plotBounds.test.js`) covering:

1. **`src/Uploader.test.js`**:
   - `normalizeChromosome`: test strings (`"1"` -> `"chr1"`, `"chr1"` -> `"chr1"`, `"X"` -> `"chrX"`), and edge cases (`""`, non-string inputs).
   - `parseBreakendAlt`: test standard breakends (`"N[chr2:12345["`, `"]chrX:999]N"`), non-BND ALTs (`"<DEL>"`, `"A"`), `null`, `undefined`.
   - `parseHiglassData`: test standard 9-column tabbed string, multi-line string, empty string, line with missing columns.
   - `parseSeverusVcf`: test standard VCF, corrupted header lines, lines with `<8` fields, missing `HP` INFO field, `BND` mate matching, `passOnly` filtering.
   - `parseSnpData`: test tab-delimited and comma-delimited strings, header line detection/skipping, `#` comments.
   - `parseWakhanCoverageData`: test space-separated and tab-separated rows.
   - `parseWakhanSegmentBed`: test BED format parsing and `parseBreakpointIds` extraction.
   - `parseMaskedRegionBed`: test BED format with valid coordinates, negative coordinates, non-finite values.

2. **`src/safeRendering.test.js`**:
   - `isFiniteNumber`, `isValidPoint`, `isValidRect`, `isValidVariant`, `safeClamp`.
   - Mock PixiJS graphics object testing for `safeMoveTo`, `safeLineTo`, `safeDrawCircle`, `safeDrawRect`.

3. **`src/plotBounds.test.js`**:
   - `getPlotBounds`: test valid track dimensions, missing track object, 0 width.
   - `mapTrackX` and `unmapTrackX`: test coordinate translation and round-trip conversion.
   - `registerGlobalChromExtents` and `getGlobalMasterChromBounds`: test cumulative position calculations with normal and non-finite extents.
