# Technical Analysis Report: M1 White-Box Unit & Integration Testing Strategy

## Executive Summary
This report presents the complete investigation and architectural design for Milestone 1 (M1 White-Box Unit & Integration Suite) of the ViScanner project. It covers code refactoring recommendations (named export declarations for internal parsing and calculation utilities) and detailed Jest unit test implementation plans for `src/Uploader.js`, `src/safeRendering.js`, `src/plotBounds.js`, and `src/WakhanStructuralVariationTrack.js`.

---

## 1. Code Refactoring Recommendations (Export Statements)

To enable Jest to import and test internal parsing, normalization, and mathematical utility functions without altering module behavior, specific named exports must be added.

### 1.1 `src/Uploader.js` Refactoring
Currently, `src/Uploader.js` exports only the default React component `Uploader`. The following functions must be converted to named exports:

| Function Signature | Line # | Target Test Suite | Purpose |
|-------------------|--------|-------------------|---------|
| `export function normalizeChromosome(chrom)` | L15 | `Uploader.test.js` | Chromosome name normalization (`"1"` -> `"chr1"`) |
| `export async function fileSignature(file)` | L24 | `Uploader.test.js` | First 8 bytes hex signature reader |
| `export function parseHiglassData(v)` | L31 | `Uploader.test.js` | TSV segment data parser for CNA tracks |
| `export function parseSnpData(v, delimiter = "\t")` | L71 | `Uploader.test.js` | TSV/CSV SNP BAF data parser |
| `export function parseBreakendAlt(alt)` | L123 | `Uploader.test.js` | VCF BND ALT string regex extraction |
| `export function parseSeverusVcf(v, options = {})` | L148 | `Uploader.test.js` | Severus VCF parser with mate pairing & PASS filter |
| `export function parseWakhanCoverageData(v)` | L231 | `Uploader.test.js` | Wakhan phase coverage depth parser |
| `export function parseWakhanSegmentBed(v, haplotypeKey)` | L277 | `Uploader.test.js` | HP1/HP2 segment BED parser with breakpoint ID extraction |
| `export function parseMaskedRegionBed(v)` | L253 | `Uploader.test.js` | Masked region BED parser |
| `export function parseWakhanSegmentTableData(hp1Segments, hp2Segments)` | L311 | `Uploader.test.js` | Merges HP1 & HP2 segment BEDs for table display |
| `export function parseWakhanCopyNumberData(hp1Text, hp2Text)` | L347 | `Uploader.test.js` | Merges HP1 & HP2 segment BEDs into track format |
| `export const RAR_SIGNATURE = "526172211A07";` | L13 | `Uploader.test.js` | Constant for RAR magic byte checking |

#### Recommended Snippet for `src/Uploader.js`:
```javascript
// Change line 13:
export const RAR_SIGNATURE = "526172211A07";

// Change line 15:
export function normalizeChromosome(chrom) { ... }

// Change line 24:
export async function fileSignature(file) { ... }

// Change line 31:
export function parseHiglassData(v) { ... }

// Change line 71:
export function parseSnpData(v, delimiter = "\t") { ... }

// Change line 123:
export function parseBreakendAlt(alt) { ... }

// Change line 148:
export function parseSeverusVcf(v, options = {}) { ... }

// Change line 231:
export function parseWakhanCoverageData(v) { ... }

// Change line 253:
export function parseMaskedRegionBed(v) { ... }

// Change line 277:
export function parseWakhanSegmentBed(v, haplotypeKey) { ... }

// Change line 311:
export function parseWakhanSegmentTableData(hp1Segments, hp2Segments) { ... }

// Change line 347:
export function parseWakhanCopyNumberData(hp1Text, hp2Text) { ... }
```

### 1.2 `src/WakhanStructuralVariationTrack.js` Refactoring
Currently, `src/WakhanStructuralVariationTrack.js` exports only `WakhanStructuralVariationTrack` as default. The following utility functions must be converted to named exports:

| Function Signature | Line # | Target Test Suite | Purpose |
|-------------------|--------|-------------------|---------|
| `export function normalizeTrackData(data)` | L37 | `WakhanTrackUtils.test.js` | Normalizes input variant data into `{ variants, matchedIds }` |
| `export function variantLength(variant)` | L47 | `WakhanTrackUtils.test.js` | Calculates absolute variant span length in base pairs |
| `export function normalizeHpFilter(value)` | L33 | `WakhanTrackUtils.test.js` | Normalizes haplotype filter options ("1", "2", or null) |
| `export function escapeHtml(value)` | L69 | `WakhanTrackUtils.test.js` | Sanitizes string values for tooltip HTML rendering |

---

## 2. Test Suite Architecture & Test Cases

Four Jest test files will compose the white-box unit test suite:
1. `src/Uploader.test.js`
2. `src/WakhanTrackUtils.test.js`
3. `src/safeRendering.test.js`
4. `src/plotBounds.test.js`

### 2.1 `src/Uploader.test.js` Specifications
This test suite covers file parsing, data extraction, chromosome normalization, and RAR archive detection.

#### Proposed Test Structure & Cases:
```javascript
import {
  normalizeChromosome,
  fileSignature,
  parseHiglassData,
  parseSnpData,
  parseBreakendAlt,
  parseSeverusVcf,
  parseWakhanCoverageData,
  parseWakhanSegmentBed,
  parseWakhanSegmentTableData,
  RAR_SIGNATURE,
} from "./Uploader";

describe("Uploader Data Parsers and Utilities", () => {

  describe("normalizeChromosome", () => {
    test("prefixes numeric chromosome strings with 'chr'", () => {
      expect(normalizeChromosome("1")).toBe("chr1");
      expect(normalizeChromosome("22")).toBe("chr22");
    });

    test("leaves chromosome strings already starting with 'chr' unchanged", () => {
      expect(normalizeChromosome("chr1")).toBe("chr1");
      expect(normalizeChromosome("chrX")).toBe("chrX");
      expect(normalizeChromosome("chrM")).toBe("chrM");
    });

    test("handles edge case chromosome names (e.g., 'MT', 'X')", () => {
      expect(normalizeChromosome("MT")).toBe("chrMT");
      expect(normalizeChromosome("X")).toBe("chrX");
    });
  });

  describe("fileSignature and RAR Detection", () => {
    test("detects RAR archive magic bytes (526172211A07)", async () => {
      const rarHeader = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00, 0x00]);
      const blob = new Blob([rarHeader]);
      const sig = await fileSignature(blob);
      expect(sig).toBe("526172211A070000");
      expect(sig.startsWith(RAR_SIGNATURE)).toBe(true);
    });

    test("returns correct hex signature for valid ZIP files (504B0304)", async () => {
      const zipHeader = new Uint8Array([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const blob = new Blob([zipHeader]);
      const sig = await fileSignature(blob);
      expect(sig).toBe("504B030414000000");
      expect(sig.startsWith(RAR_SIGNATURE)).toBe(false);
    });
  });

  describe("parseBreakendAlt", () => {
    test("parses standard BND ALT format (e.g., ]chr2:123456]N)", () => {
      expect(parseBreakendAlt("]chr2:123456]N")).toEqual({ chr: "chr2", pos: 123456 });
      expect(parseBreakendAlt("N[chrX:789012[")).toEqual({ chr: "chrX", pos: 789012 });
    });

    test("normalizes chromosome name in breakend ALT", () => {
      expect(parseBreakendAlt("]1:500000]A")).toEqual({ chr: "chr1", pos: 500000 });
    });

    test("returns null for non-BND ALT strings or malformed patterns", () => {
      expect(parseBreakendAlt("<DEL>")).toBeNull();
      expect(parseBreakendAlt("<INV>")).toBeNull();
      expect(parseBreakendAlt("A")).toBeNull();
      expect(parseBreakendAlt(null)).toBeNull();
      expect(parseBreakendAlt(undefined)).toBeNull();
    });
  });

  describe("parseSeverusVcf", () => {
    const validVcfContent = [
      "##fileformat=VCFv4.2",
      "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE",
      "chr1\t1000\tseverus_1\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000;SVLEN=-1000;HP=1\tGT:VAF:DV\t0/1:0.45:15",
      "chr1\t3000\tseverus_2\tN\t]chr1:5000]N\t50\tPASS\tSVTYPE=BND;MATE_ID=severus_3;HP=2\tGT:VAF:DV\t0/1:0.30:10",
      "chr1\t5000\tseverus_3\tN\tN[chr1:3000[\t50\tPASS\tSVTYPE=BND;MATE_ID=severus_2;HP=2\tGT:VAF:DV\t0/1:0.30:10",
      "chr2\t8000\tseverus_4\tN\t<DUP>\t30\tLowQual\tSVTYPE=DUP;END=9000;SVLEN=1000\tGT:VAF:DV\t0/1:0.10:2",
    ].join("\n");

    test("parses PASS variants correctly when passOnly is true (default)", () => {
      const records = parseSeverusVcf(validVcfContent);
      expect(records).toHaveLength(2); // 1 DEL + 1 mated BND pair (severus_2 & severus_3 merged)
      expect(records[0].id).toBe("severus_1");
      expect(records[0].type).toBe("DEL");
      expect(records[0].hp).toBe("1");
      expect(records[0].vaf).toBe("0.45");
      expect(records[0].dv).toBe("15");
    });

    test("includes non-PASS variants when passOnly is false", () => {
      const records = parseSeverusVcf(validVcfContent, { passOnly: false });
      const lowQualRecord = records.find((r) => r.id === "severus_4");
      expect(lowQualRecord).toBeDefined();
      expect(lowQualRecord.filter).toBe("LowQual");
    });

    test("correctly mates BND records using MATE_ID", () => {
      const records = parseSeverusVcf(validVcfContent);
      const bndRecord = records.find((r) => r.id === "severus_2");
      expect(bndRecord).toBeDefined();
      expect(bndRecord.chr2).toBe("chr1");
      expect(bndRecord.pos2).toBe(5000);
      expect(bndRecord.mateId).toBe("severus_3");
    });

    test("handles missing HP field by defaulting to '-'", () => {
      const vcfWithoutHp = "chr1\t1000\tseverus_9\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000\tGT\t0/1";
      const records = parseSeverusVcf(vcfWithoutHp);
      expect(records[0].hp).toBe("-");
    });

    test("handles corrupted VCF header lines and malformed columns without throwing", () => {
      const corruptedVcf = [
        "##corrupted_header_without_equals",
        "invalid_line_without_tabs",
        "chr1\tnot_a_number\tseverus_err\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL",
        "chr1\t1000", // too few columns
      ].join("\n");

      expect(() => parseSeverusVcf(corruptedVcf)).not.toThrow();
      expect(parseSeverusVcf(corruptedVcf)).toEqual([]);
    });

    test("handles non-finite positions gracefully (NaN pos)", () => {
      const nanVcf = "chr1\tNaN\tseverus_nan\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000\tGT\t0/1";
      expect(parseSeverusVcf(nanVcf)).toEqual([]);
    });
  });

  describe("parseHiglassData", () => {
    test("parses segment TSV skipping header row 0", () => {
      const tsv = "chrom\tstart\tend\tcn1\tcn2\tcn3\tcn4\tcn5\tsample\nchr1\t100\t200\t1.5\t2.0\t0.5\t1.0\t0.8\tS1";
      const parsed = parseHiglassData(tsv);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual(["chr1", 100, 200, 1.5, 2.0, 0.5, 1.0, 0.8, "S1"]);
    });
  });

  describe("parseSnpData", () => {
    test("parses TSV and CSV SNP data correctly", () => {
      const tsv = "#Comment\nchr1\t1000\t0.45\n2\t2000\t0.55";
      const parsedTsv = parseSnpData(tsv, "\t");
      expect(parsedTsv).toHaveLength(2);
      expect(parsedTsv[0].chr).toBe("chr1");
      expect(parsedTsv[1].chr).toBe("chr2");

      const csv = "chr1,1000,0.45";
      const parsedCsv = parseSnpData(csv, ",");
      expect(parsedCsv[0].baf).toBe(0.45);
    });

    test("skips header row if row 0 has NaN pos or value", () => {
      const dataWithHeader = "chr\tpos\tbaf\nchr1\t1000\t0.50";
      const parsed = parseSnpData(dataWithHeader, "\t");
      expect(parsed).toHaveLength(1);
      expect(parsed[0].pos).toBe(1000);
    });
  });

  describe("parseWakhanCoverageData and parseWakhanSegmentBed", () => {
    test("parses coverage CSV/TSV data", () => {
      const coverageText = "chr1 100 200 12.5 13.0 1.2";
      const rows = parseWakhanCoverageData(coverageText);
      expect(rows[0]).toEqual({
        chr: "chr1",
        start: 100,
        end: 200,
        hp1: 12.5,
        hp2: 13.0,
        unphased: 1.2,
      });
    });

    test("parses HP segment BED and extracts severus breakpoint IDs", () => {
      const bedText = "chr1\t100\t500\t10.5\t2.0\t0.95\tseverus_1,severus_2";
      const rows = parseWakhanSegmentBed(bedText, "hp1");
      expect(rows[0].hp1).toBe(2.0);
      expect(rows[0].breakpointIds).toEqual(["severus_1", "severus_2"]);
    });
  });

  describe("parseWakhanSegmentTableData", () => {
    test("merges HP1 and HP2 segment BED records by genomic region key", () => {
      const hp1 = [{ chr: "chr1", start: 100, end: 500, coverage: 10, hp1: 2, confidence: 0.9, breakpoints: "severus_1" }];
      const hp2 = [{ chr: "chr1", start: 100, end: 500, coverage: 12, hp2: 1, confidence: 0.85, breakpoints: "severus_1" }];
      const merged = parseWakhanSegmentTableData(hp1, hp2);
      expect(merged).toHaveLength(1);
      expect(merged[0].hp1CopyNumber).toBe(2);
      expect(merged[0].hp2CopyNumber).toBe(1);
    });
  });
});
```

---

### 2.2 `src/WakhanTrackUtils.test.js` Specifications
This test suite validates track helper functions from `src/WakhanStructuralVariationTrack.js`.

#### Proposed Test Structure & Cases:
```javascript
import {
  normalizeTrackData,
  variantLength,
  normalizeHpFilter,
  escapeHtml,
} from "./WakhanStructuralVariationTrack";

describe("WakhanStructuralVariationTrack Utility Functions", () => {

  describe("normalizeTrackData", () => {
    test("wraps raw array in object format with empty matchedIds", () => {
      const arr = [{ id: "v1" }, { id: "v2" }];
      expect(normalizeTrackData(arr)).toEqual({
        variants: arr,
        matchedIds: [],
      });
    });

    test("preserves existing object structure containing variants and matchedIds", () => {
      const input = { variants: [{ id: "v1" }], matchedIds: ["v1"] };
      expect(normalizeTrackData(input)).toEqual(input);
    });

    test("handles null or undefined input by returning empty defaults", () => {
      expect(normalizeTrackData(null)).toEqual({ variants: [], matchedIds: [] });
      expect(normalizeTrackData(undefined)).toEqual({ variants: [], matchedIds: [] });
    });
  });

  describe("variantLength", () => {
    test("returns Math.abs(svlen) when svlen is finite number", () => {
      expect(variantLength({ svlen: -500 })).toBe(500);
      expect(variantLength({ svlen: 1200 })).toBe(1200);
    });

    test("calculates Math.abs(endAbs - startAbs) when svlen is absent", () => {
      expect(variantLength({ startAbs: 1000, endAbs: 2500 })).toBe(1500);
      expect(variantLength({ startAbs: 5000, endAbs: 1000 })).toBe(4000);
    });

    test("handles zero-length variants", () => {
      expect(variantLength({ svlen: 0 })).toBe(0);
      expect(variantLength({ startAbs: 1000, endAbs: 1000 })).toBe(0);
    });

    test("returns 0 for non-finite coordinates or invalid variant objects", () => {
      expect(variantLength({ svlen: NaN })).toBe(0);
      expect(variantLength({ startAbs: Infinity, endAbs: 1000 })).toBe(0);
      expect(variantLength(null)).toBe(0);
      expect(variantLength(undefined)).toBe(0);
    });
  });

  describe("normalizeHpFilter", () => {
    test("returns '1' or '2' for valid haplotype filter strings", () => {
      expect(normalizeHpFilter("1")).toBe("1");
      expect(normalizeHpFilter("2")).toBe("2");
    });

    test("returns null for any other value (e.g., 'all', null, undefined)", () => {
      expect(normalizeHpFilter("all")).toBeNull();
      expect(normalizeHpFilter("0")).toBeNull();
      expect(normalizeHpFilter(null)).toBeNull();
      expect(normalizeHpFilter(undefined)).toBeNull();
    });
  });

  describe("escapeHtml", () => {
    test("escapes special HTML characters (&, <, >, \")", () => {
      expect(escapeHtml("<div>&\"test\"</div>")).toBe("&lt;div&gt;&amp;&quot;test&quot;&lt;/div&gt;");
    });

    test("returns '-' for null or undefined values", () => {
      expect(escapeHtml(null)).toBe("-");
      expect(escapeHtml(undefined)).toBe("-");
    });
  });
});
```

---

### 2.3 `src/safeRendering.test.js` Specifications
This test suite expands existing tests in `src/safeRendering.test.js` to systematically cover non-finite inputs, bounds validation, and PixiJS graphics object exceptions.

#### Additional Edge Cases & Boundaries:
```javascript
import {
  isFiniteNumber,
  isValidPoint,
  isValidRect,
  isValidVariant,
  safeClamp,
  logDevSkip,
  safeMoveTo,
  safeLineTo,
  safeDrawCircle,
  safeDrawRect,
} from "./safeRendering";

describe("safeRendering Edge Cases and Robustness", () => {
  describe("isFiniteNumber boundary coverage", () => {
    test("handles boundary numbers and non-numbers", () => {
      expect(isFiniteNumber(Number.MAX_VALUE)).toBe(true);
      expect(isFiniteNumber(Number.MIN_VALUE)).toBe(true);
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(-0)).toBe(true);
      expect(isFiniteNumber(NaN)).toBe(false);
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
      expect(isFiniteNumber("100")).toBe(false);
    });
  });

  describe("isValidRect boundary conditions", () => {
    test("allows zero width and zero height", () => {
      expect(isValidRect(0, 0, 0, 0)).toBe(true);
    });

    test("rejects negative dimensions", () => {
      expect(isValidRect(0, 0, -0.001, 100)).toBe(false);
      expect(isValidRect(0, 0, 100, -5)).toBe(false);
    });
  });

  describe("isValidVariant missing fields", () => {
    test("rejects variants missing chromosome or start coordinate", () => {
      expect(isValidVariant({ pos: 1000 })).toBe(false);
      expect(isValidVariant({ chr: "chr1" })).toBe(false);
      expect(isValidVariant({})).toBe(false);
    });
  });

  describe("safeClamp edge fallback cases", () => {
    test("returns custom fallback when min/max or val are invalid", () => {
      expect(safeClamp(NaN, 0, 100, 50)).toBe(50);
      expect(safeClamp(10, NaN, 100, -1)).toBe(-1);
      expect(safeClamp(10, 0, Infinity, -1)).toBe(-1);
    });
  });

  describe("PixiJS safe wrappers robustness", () => {
    test("returns false gracefully when graphics object is null or lacks methods", () => {
      expect(safeMoveTo(null, 10, 10)).toBe(false);
      expect(safeLineTo(undefined, 10, 10)).toBe(false);
      expect(safeDrawCircle({}, 10, 10, 5)).toBe(false);
      expect(safeDrawRect({ drawRect: "not a function" }, 0, 0, 10, 10)).toBe(false);
    });
  });
});
```

---

### 2.4 `src/plotBounds.test.js` Specifications
This test suite covers margin constants, coordinate translation (`mapTrackX` and `unmapTrackX`), chromosome extent registration, and dynamic coordinate calculations.

#### Proposed Test Structure & Cases:
```javascript
import {
  PLOT_LEFT,
  PLOT_RIGHT_MARGIN,
  getPlotBounds,
  mapTrackX,
  unmapTrackX,
  resetGlobalChromExtents,
  registerGlobalChromExtents,
  getGlobalMasterChromBounds,
  registerDatasetExtents,
  getDynamicChrAbs,
} from "./plotBounds";

describe("plotBounds Coordinate Utilities", () => {
  beforeEach(() => {
    resetGlobalChromExtents();
  });

  describe("getPlotBounds", () => {
    test("calculates left and right plot margins based on track width", () => {
      const track = { dimensions: [1000, 300] };
      const bounds = getPlotBounds(track);
      expect(bounds.left).toBe(PLOT_LEFT); // 72
      expect(bounds.right).toBe(1000 - PLOT_RIGHT_MARGIN); // 1000 - 78 = 922
    });

    test("handles missing or invalid dimensions using fallback width of 1", () => {
      expect(getPlotBounds(null)).toEqual({ left: 72, right: 73 });
      expect(getPlotBounds({})).toEqual({ left: 72, right: 73 });
    });
  });

  describe("mapTrackX and unmapTrackX", () => {
    const mockTrack = {
      dimensions: [1000, 300],
      _xScale: Object.assign(
        (absPos) => (absPos / 1000000) * 1000, // linear scale: 0..1M bp -> 0..1000 px
        {
          range: () => [0, 1000],
          invert: (pixelX) => (pixelX / 1000) * 1000000,
        }
      ),
    };

    test("maps absolute position to track pixel X coordinates", () => {
      // getPlotBounds gives left=72, right=922 (width=850)
      // absPos = 500,000 -> rawScale gives 500
      // mappedX = 72 + ((500 - 0) / 1000) * 850 = 72 + 425 = 497
      const mappedX = mapTrackX(mockTrack, 500000);
      expect(mappedX).toBe(497);
    });

    test("unmapTrackX accurately reverses mapTrackX mapping", () => {
      const originalAbsPos = 250000;
      const mappedX = mapTrackX(mockTrack, originalAbsPos);
      const unmappedAbsPos = unmapTrackX(mockTrack, mappedX);
      expect(unmappedAbsPos).toBeCloseTo(originalAbsPos, 5);
    });
  });

  describe("Global Chromosome Extents and Master Bounds", () => {
    const mockChromInfo = {
      cumPositions: [
        { chr: "chr1", pos: 0 },
        { chr: "chr2", pos: 248956422 },
      ],
      chromLengths: {
        chr1: 248956422,
        chr2: 242193529,
      },
      chrPositions: {
        chr1: { pos: 0 },
        chr2: { pos: 248956422 },
      },
    };

    test("registers chromosome extents and calculates master bounds", () => {
      registerGlobalChromExtents("chr1", 100, 250000000);
      const bounds = getGlobalMasterChromBounds(mockChromInfo);
      expect(bounds).toHaveLength(2);
      expect(bounds[0].chr).toBe("chr1");
      expect(bounds[0].start).toBe(0);
      expect(bounds[0].end).toBe(250000000);
    });

    test("registerDatasetExtents extracts positions from dataset rows", () => {
      const dataSets = {
        coverage: [{ chr: "chr1", start: 10, end: 500 }],
        snpData: [{ chr: "chr2", pos: 1000 }],
      };
      registerDatasetExtents(mockChromInfo, dataSets);
      const masterBounds = getGlobalMasterChromBounds(mockChromInfo);
      expect(masterBounds).toBeDefined();
    });

    test("getDynamicChrAbs resolves relative positions on chromosomes", () => {
      const absPos = getDynamicChrAbs("chr2", 5000, mockChromInfo);
      expect(absPos).toBe(248956422 + 5000);
    });
  });
});
```

---

## 3. Boundary Conditions & Edge Case Matrix

| Component | Function / Feature | Boundary / Edge Condition | Expected Behavior |
|-----------|--------------------|---------------------------|-------------------|
| `Uploader.js` | `fileSignature` | Renamed RAR archive (`526172211A07...`) | `readZip` throws explicit RAR error message |
| `Uploader.js` | `parseSeverusVcf` | Missing HP field in INFO column | Record created with `hp: "-"` |
| `Uploader.js` | `parseSeverusVcf` | Malformed/corrupted VCF header/lines | Skips invalid lines, returns valid records without error |
| `Uploader.js` | `parseSeverusVcf` | Non-finite position (`NaN`) | Record excluded from `rawRecords` |
| `Uploader.js` | `parseBreakendAlt` | Standard ALT string (`<DEL>`, `<INV>`) | Returns `null` |
| `Uploader.js` | `parseBreakendAlt` | Breakend ALT string (`]chr2:1000]N`) | Returns `{ chr: "chr2", pos: 1000 }` |
| `WakhanTrack` | `variantLength` | `svlen = 0` or identical start/end | Returns `0` |
| `WakhanTrack` | `variantLength` | Non-finite `svlen` or `startAbs`/`endAbs` | Returns `0` |
| `safeRendering` | `isValidRect` | Negative width/height | Returns `false` |
| `safeRendering` | `safeClamp` | `val = NaN` or invalid bounds | Returns `fallback` |
| `safeRendering` | Pixi Wrappers | Null graphics object or missing method | Returns `false` without throwing exception |
| `plotBounds` | `getPlotBounds` | Null/undefined track or dimensions `[0, 0]` | Returns default bounds `{ left: 72, right: 73 }` |
| `plotBounds` | `mapTrackX` / `unmapTrackX` | Out-of-bounds genomic/pixel coordinates | Performs linear scale conversion safely |

---

## 4. Verification & Readiness Assessment

1. **Isolation**: All tests are pure unit tests in Jest; no DOM or WebGL canvas is required.
2. **Backward Compatibility**: Refactoring involves only adding `export` keywords. Existing default exports (`export default Uploader;`, `export default WakhanStructuralVariationTrack;`) remain identical, so zero risk of breaking application code.
3. **Execution Ready**: Test structures map 1:1 to Jest runner conventions (`npm test`).
