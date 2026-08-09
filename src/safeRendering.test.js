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

describe("safeRendering utility tests", () => {
  describe("isFiniteNumber boundary coverage", () => {
    test("returns true for valid finite numbers", () => {
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(-0)).toBe(true);
      expect(isFiniteNumber(42)).toBe(true);
      expect(isFiniteNumber(-12.34)).toBe(true);
      expect(isFiniteNumber(Number.MAX_VALUE)).toBe(true);
      expect(isFiniteNumber(Number.MIN_VALUE)).toBe(true);
    });

    test("returns false for non-finite values or non-numbers", () => {
      expect(isFiniteNumber(NaN)).toBe(false);
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
      expect(isFiniteNumber(undefined)).toBe(false);
      expect(isFiniteNumber(null)).toBe(false);
      expect(isFiniteNumber("42")).toBe(false);
      expect(isFiniteNumber(true)).toBe(false);
      expect(isFiniteNumber({})).toBe(false);
    });
  });

  describe("isValidPoint", () => {
    test("validates 2D points", () => {
      expect(isValidPoint(10, 20)).toBe(true);
      expect(isValidPoint(0, 0)).toBe(true);
      expect(isValidPoint(NaN, 20)).toBe(false);
      expect(isValidPoint(10, Infinity)).toBe(false);
      expect(isValidPoint(-5, -10)).toBe(true);
    });
  });

  describe("isValidRect boundary conditions", () => {
    test("validates rectangle bounds including zero width and height", () => {
      expect(isValidRect(10, 20, 100, 50)).toBe(true);
      expect(isValidRect(0, 0, 0, 0)).toBe(true);
    });

    test("rejects negative dimensions or non-finite values", () => {
      expect(isValidRect(10, 20, -5, 50)).toBe(false);
      expect(isValidRect(10, 20, 50, -0.001)).toBe(false);
      expect(isValidRect(NaN, 20, 100, 50)).toBe(false);
      expect(isValidRect(10, Infinity, 100, 50)).toBe(false);
    });
  });

  describe("isValidVariant missing fields", () => {
    test("validates variant structures", () => {
      expect(isValidVariant({ chr: "chr1", startAbs: 1000 })).toBe(true);
      expect(isValidVariant({ chr: "chr1", pos: 500 })).toBe(true);
    });

    test("rejects variants missing chromosome or start coordinate", () => {
      expect(isValidVariant({ pos: 1000 })).toBe(false);
      expect(isValidVariant({ chr: "chr1" })).toBe(false);
      expect(isValidVariant({ chr: null, pos: 500 })).toBe(false);
      expect(isValidVariant({})).toBe(false);
      expect(isValidVariant(null)).toBe(false);
      expect(isValidVariant(undefined)).toBe(false);
    });
  });

  describe("safeClamp edge fallback cases", () => {
    test("clamps numbers within bounds", () => {
      expect(safeClamp(5, 0, 10)).toBe(5);
      expect(safeClamp(-5, 0, 10)).toBe(0);
      expect(safeClamp(15, 0, 10)).toBe(10);
    });

    test("returns fallback on invalid values or non-finite min/max", () => {
      expect(safeClamp(NaN, 0, 10, 42)).toBe(42);
      expect(safeClamp(10, NaN, 100, -1)).toBe(-1);
      expect(safeClamp(10, 0, Infinity, -1)).toBe(-1);
      expect(safeClamp(10, -Infinity, 100, -1)).toBe(-1);
    });
  });

  describe("logDevSkip", () => {
    test("calls console.warn in development environment", () => {
      const spyWarn = jest.spyOn(console, "warn").mockImplementation(() => {});
      logDevSkip({ id: "v1", chr: "chr1" }, "TestReason", { foo: "bar" });
      expect(spyWarn).toHaveBeenCalledWith(
        "[WakhanTrack] Skipping item due to invalid state:",
        expect.objectContaining({
          id: "v1",
          chr: "chr1",
          reason: "TestReason",
          foo: "bar",
        })
      );
      spyWarn.mockRestore();
    });
  });

  describe("PixiJS safe wrappers robustness", () => {
    let mockGraphics;

    beforeEach(() => {
      mockGraphics = {
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        drawCircle: jest.fn(),
        drawRect: jest.fn(),
      };
    });

    test("safeMoveTo calls moveTo for valid numbers and rejects NaN or invalid graphics", () => {
      expect(safeMoveTo(mockGraphics, 10, 20)).toBe(true);
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(10, 20);

      expect(safeMoveTo(mockGraphics, NaN, 20)).toBe(false);
      expect(safeMoveTo(null, 10, 20)).toBe(false);
      expect(safeMoveTo({}, 10, 20)).toBe(false);
    });

    test("safeLineTo calls lineTo for valid numbers and rejects NaN or invalid graphics", () => {
      expect(safeLineTo(mockGraphics, 30, 40)).toBe(true);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(30, 40);

      expect(safeLineTo(mockGraphics, 30, Infinity)).toBe(false);
      expect(safeLineTo(undefined, 30, 40)).toBe(false);
    });

    test("safeDrawCircle validates radius and coordinates", () => {
      expect(safeDrawCircle(mockGraphics, 5, 5, 2.5)).toBe(true);
      expect(mockGraphics.drawCircle).toHaveBeenCalledWith(5, 5, 2.5);

      expect(safeDrawCircle(mockGraphics, 5, 5, -1)).toBe(false);
      expect(safeDrawCircle(mockGraphics, 5, NaN, 2.5)).toBe(false);
      expect(safeDrawCircle(null, 5, 5, 2.5)).toBe(false);
    });

    test("safeDrawRect validates rect dimensions and coordinates", () => {
      expect(safeDrawRect(mockGraphics, 0, 0, 100, 200)).toBe(true);
      expect(mockGraphics.drawRect).toHaveBeenCalledWith(0, 0, 100, 200);

      expect(safeDrawRect(mockGraphics, 0, 0, -10, 200)).toBe(false);
      expect(safeDrawRect(mockGraphics, undefined, 0, 100, 200)).toBe(false);
      expect(safeDrawRect({ drawRect: "not a function" }, 0, 0, 10, 10)).toBe(false);
    });
  });
});
