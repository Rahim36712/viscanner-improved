import {
  normalizeTrackData,
  variantLength,
  normalizeHpFilter,
  escapeHtml,
} from "./WakhanStructuralVariationTrack";
import {
  binarySearchCoverage,
  filterVisibleCoverageRows,
  copyNumberEquivalent,
} from "./WakhanCoverageTrack";

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

describe("WakhanCoverageTrack High-Performance Search & Filtering", () => {
  const sampleCoverage = [
    { startAbs: 100000, endAbs: 150000, hp1CopyNumberEquivalent: 1.2, hp2CopyNumberEquivalent: 0.9 },
    { startAbs: 200000, endAbs: 250000, hp1CopyNumberEquivalent: 1.1, hp2CopyNumberEquivalent: 1.0 },
    { startAbs: 300000, endAbs: 350000, hp1CopyNumberEquivalent: 2.0, hp2CopyNumberEquivalent: 0.1 },
    { startAbs: 400000, endAbs: 450000, hp1CopyNumberEquivalent: 1.5, hp2CopyNumberEquivalent: 1.5 },
  ];

  describe("binarySearchCoverage", () => {
    test("returns exact matching row when absX falls strictly inside bin interval", () => {
      const match = binarySearchCoverage(sampleCoverage, 220000);
      expect(match).toBe(sampleCoverage[1]);
    });

    test("matches at startAbs and endAbs bin boundaries", () => {
      expect(binarySearchCoverage(sampleCoverage, 100000)).toBe(sampleCoverage[0]);
      expect(binarySearchCoverage(sampleCoverage, 150000)).toBe(sampleCoverage[0]);
      expect(binarySearchCoverage(sampleCoverage, 450000)).toBe(sampleCoverage[3]);
    });

    test("matches nearest neighbor bin when absX is within 50kb tolerance", () => {
      // 170000 is between [100000, 150000] and [200000, 250000]
      // Distance to bin 0 mid (125000): 45000 (< 50000)
      const match = binarySearchCoverage(sampleCoverage, 160000);
      expect(match).toBe(sampleCoverage[0]);
    });

    test("returns null when absX is far beyond tolerance (> 50kb)", () => {
      expect(binarySearchCoverage(sampleCoverage, 20000)).toBeNull();
      expect(binarySearchCoverage(sampleCoverage, 800000)).toBeNull();
    });

    test("handles empty rows, null, undefined, and non-finite absX gracefully", () => {
      expect(binarySearchCoverage([], 220000)).toBeNull();
      expect(binarySearchCoverage(null, 220000)).toBeNull();
      expect(binarySearchCoverage(undefined, 220000)).toBeNull();
      expect(binarySearchCoverage(sampleCoverage, NaN)).toBeNull();
      expect(binarySearchCoverage(sampleCoverage, Infinity)).toBeNull();
    });
  });

  describe("filterVisibleCoverageRows", () => {
    test("returns only rows overlapping the visible viewport range", () => {
      const visible = filterVisibleCoverageRows(sampleCoverage, 180000, 320000);
      expect(visible).toEqual([sampleCoverage[1], sampleCoverage[2]]);
    });

    test("handles inverted min/max coordinates automatically", () => {
      const visible = filterVisibleCoverageRows(sampleCoverage, 320000, 180000);
      expect(visible).toEqual([sampleCoverage[1], sampleCoverage[2]]);
    });

    test("returns all rows when visible range encompasses all data", () => {
      const visible = filterVisibleCoverageRows(sampleCoverage, 0, 1000000);
      expect(visible).toEqual(sampleCoverage);
    });

    test("returns empty array when visible range is completely before all data", () => {
      const visible = filterVisibleCoverageRows(sampleCoverage, 10000, 50000);
      expect(visible).toEqual([]);
    });

    test("returns empty array when visible range is completely after all data", () => {
      const visible = filterVisibleCoverageRows(sampleCoverage, 500000, 900000);
      expect(visible).toEqual([]);
    });

    test("returns original rows when minAbs or maxAbs is non-finite", () => {
      expect(filterVisibleCoverageRows(sampleCoverage, NaN, 500000)).toEqual(sampleCoverage);
      expect(filterVisibleCoverageRows(sampleCoverage, 100000, Infinity)).toEqual(sampleCoverage);
    });

    test("handles empty rows, null, or undefined gracefully", () => {
      expect(filterVisibleCoverageRows([], 100000, 200000)).toEqual([]);
      expect(filterVisibleCoverageRows(null, 100000, 200000)).toEqual([]);
      expect(filterVisibleCoverageRows(undefined, 100000, 200000)).toEqual([]);
    });
  });

  describe("copyNumberEquivalent", () => {
    test("scales coverage around integer copy number state for standard segments", () => {
      const segment = { coverage: 90, copyNumber: 2 };
      expect(copyNumberEquivalent(45, segment, 4 / 180)).toBeCloseTo(1.0);
      expect(copyNumberEquivalent(90, segment, 4 / 180)).toBeCloseTo(2.0);
      expect(copyNumberEquivalent(135, segment, 4 / 180)).toBeCloseTo(3.0);
    });

    test("scales coverage using global scale for zero copy-number segments (deletions) instead of returning 0", () => {
      const deletionSegment = { coverage: 1.13, copyNumber: 0 };
      const globalScale = 4 / 180; // 1 / 45
      // 45 raw coverage corresponds to 1.0 copy on global scale
      expect(copyNumberEquivalent(45, deletionSegment, globalScale)).toBeCloseTo(1.0);
      // Small coverage is preserved rather than squashed to zero
      expect(copyNumberEquivalent(2.25, deletionSegment, globalScale)).toBeCloseTo(0.05);
    });

    test("scales coverage using global scale for zero-coverage segments (centromeres) instead of returning null", () => {
      const centromereSegment = { coverage: 0, copyNumber: 0 };
      const globalScale = 4 / 180;
      expect(copyNumberEquivalent(45, centromereSegment, globalScale)).toBeCloseTo(1.0);
      expect(copyNumberEquivalent(90, centromereSegment, globalScale)).toBeCloseTo(2.0);
    });

    test("scales coverage using global scale when segment is null or undefined", () => {
      const globalScale = 4 / 180;
      expect(copyNumberEquivalent(45, null, globalScale)).toBeCloseTo(1.0);
      expect(copyNumberEquivalent(45, undefined, globalScale)).toBeCloseTo(1.0);
    });

    test("returns 0 when rawCoverage is zero or negative", () => {
      expect(copyNumberEquivalent(0, { coverage: 90, copyNumber: 2 })).toBe(0);
      expect(copyNumberEquivalent(-10, { coverage: 90, copyNumber: 2 })).toBe(0);
    });

    test("returns null when rawCoverage is non-finite", () => {
      expect(copyNumberEquivalent(NaN, { coverage: 90, copyNumber: 2 })).toBeNull();
      expect(copyNumberEquivalent(null, { coverage: 90, copyNumber: 2 })).toBeNull();
      expect(copyNumberEquivalent(undefined, { coverage: 90, copyNumber: 2 })).toBeNull();
    });
  });
});
