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
