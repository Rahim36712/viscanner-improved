import {
  isFiniteNumber,
  isValidPoint,
  isValidRect,
  isValidVariant,
  safeClamp,
  safeMoveTo,
  safeLineTo,
  safeDrawCircle,
  safeDrawRect,
} from "./safeRendering";

describe("safeRendering utility tests", () => {
  describe("isFiniteNumber", () => {
    test("returns true for valid finite numbers", () => {
      expect(isFiniteNumber(0)).toBe(true);
      expect(isFiniteNumber(42)).toBe(true);
      expect(isFiniteNumber(-12.34)).toBe(true);
    });

    test("returns false for non-finite values", () => {
      expect(isFiniteNumber(NaN)).toBe(false);
      expect(isFiniteNumber(Infinity)).toBe(false);
      expect(isFiniteNumber(-Infinity)).toBe(false);
      expect(isFiniteNumber(undefined)).toBe(false);
      expect(isFiniteNumber(null)).toBe(false);
      expect(isFiniteNumber("42")).toBe(false);
    });
  });

  describe("isValidPoint", () => {
    test("validates 2D points", () => {
      expect(isValidPoint(10, 20)).toBe(true);
      expect(isValidPoint(NaN, 20)).toBe(false);
      expect(isValidPoint(10, Infinity)).toBe(false);
    });
  });

  describe("isValidRect", () => {
    test("validates rectangle bounds", () => {
      expect(isValidRect(10, 20, 100, 50)).toBe(true);
      expect(isValidRect(10, 20, -5, 50)).toBe(false);
      expect(isValidRect(NaN, 20, 100, 50)).toBe(false);
    });
  });

  describe("isValidVariant", () => {
    test("validates variant structures", () => {
      expect(isValidVariant({ chr: "chr1", startAbs: 1000 })).toBe(true);
      expect(isValidVariant({ chr: "chr1", pos: 500 })).toBe(true);
      expect(isValidVariant({ chr: null, pos: 500 })).toBe(false);
      expect(isValidVariant(null)).toBe(false);
    });
  });

  describe("safeClamp", () => {
    test("clamps numbers within bounds", () => {
      expect(safeClamp(5, 0, 10)).toBe(5);
      expect(safeClamp(-5, 0, 10)).toBe(0);
      expect(safeClamp(15, 0, 10)).toBe(10);
    });

    test("returns fallback on invalid values", () => {
      expect(safeClamp(NaN, 0, 10, 42)).toBe(42);
    });
  });

  describe("PixiJS safe wrappers", () => {
    let mockGraphics;

    beforeEach(() => {
      mockGraphics = {
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        drawCircle: jest.fn(),
        drawRect: jest.fn(),
      };
    });

    test("safeMoveTo calls moveTo for valid numbers and rejects NaN", () => {
      expect(safeMoveTo(mockGraphics, 10, 20)).toBe(true);
      expect(mockGraphics.moveTo).toHaveBeenCalledWith(10, 20);

      expect(safeMoveTo(mockGraphics, NaN, 20)).toBe(false);
      expect(mockGraphics.moveTo).toHaveBeenCalledTimes(1);
    });

    test("safeLineTo calls lineTo for valid numbers and rejects NaN", () => {
      expect(safeLineTo(mockGraphics, 30, 40)).toBe(true);
      expect(mockGraphics.lineTo).toHaveBeenCalledWith(30, 40);

      expect(safeLineTo(mockGraphics, 30, Infinity)).toBe(false);
      expect(mockGraphics.lineTo).toHaveBeenCalledTimes(1);
    });

    test("safeDrawCircle validates radius and coordinates", () => {
      expect(safeDrawCircle(mockGraphics, 5, 5, 2.5)).toBe(true);
      expect(mockGraphics.drawCircle).toHaveBeenCalledWith(5, 5, 2.5);

      expect(safeDrawCircle(mockGraphics, 5, 5, -1)).toBe(false);
      expect(safeDrawCircle(mockGraphics, 5, NaN, 2.5)).toBe(false);
    });

    test("safeDrawRect validates rect dimensions and coordinates", () => {
      expect(safeDrawRect(mockGraphics, 0, 0, 100, 200)).toBe(true);
      expect(mockGraphics.drawRect).toHaveBeenCalledWith(0, 0, 100, 200);

      expect(safeDrawRect(mockGraphics, 0, 0, -10, 200)).toBe(false);
      expect(safeDrawRect(mockGraphics, undefined, 0, 100, 200)).toBe(false);
    });
  });
});
