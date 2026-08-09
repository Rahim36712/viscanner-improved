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

  describe("Constants and getPlotBounds", () => {
    test("defines PLOT_LEFT as 72 and PLOT_RIGHT_MARGIN as 78", () => {
      expect(PLOT_LEFT).toBe(72);
      expect(PLOT_RIGHT_MARGIN).toBe(78);
    });

    test("calculates left and right plot margins based on track width", () => {
      const track = { dimensions: [1000, 300] };
      const bounds = getPlotBounds(track);
      expect(bounds.left).toBe(PLOT_LEFT); // 72
      expect(bounds.right).toBe(1000 - PLOT_RIGHT_MARGIN); // 1000 - 78 = 922
    });

    test("handles missing or invalid dimensions using fallback width of 1", () => {
      expect(getPlotBounds(null)).toEqual({ left: 72, right: 73 });
      expect(getPlotBounds({})).toEqual({ left: 72, right: 73 });
      expect(getPlotBounds({ dimensions: [] })).toEqual({ left: 72, right: 73 });
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
      expect(bounds).toBeDefined();
      expect(bounds.length).toBeGreaterThan(0);
      const chr1Bounds = bounds.find((b) => b.chr === "chr1");
      expect(chr1Bounds).toBeDefined();
      expect(chr1Bounds.start).toBe(0);
      expect(chr1Bounds.end).toBe(250000000);
    });

    test("registerDatasetExtents extracts positions from dataset rows", () => {
      const dataSets = {
        coverage: [{ chr: "chr1", start: 10, end: 500 }],
        snpData: [{ chr: "chr2", pos: 1000 }],
      };
      registerDatasetExtents(mockChromInfo, dataSets);
      const masterBounds = getGlobalMasterChromBounds(mockChromInfo);
      expect(masterBounds).toBeDefined();
      expect(masterBounds.length).toBeGreaterThan(0);
    });

    test("getDynamicChrAbs resolves relative positions on chromosomes", () => {
      const absPos = getDynamicChrAbs("chr2", 5000, mockChromInfo);
      expect(absPos).toBe(248956422 + 5000);
    });

    test("getDynamicChrAbs falls back to raw position when chromInfo is missing", () => {
      expect(getDynamicChrAbs("chr1", 5000, null)).toBe(5000);
    });
  });
});
