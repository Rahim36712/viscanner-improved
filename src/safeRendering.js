/**
 * Centralized Validation and Safe Drawing Utilities for HiGlass Custom Tracks
 */

/**
 * Checks if a value is a valid finite number.
 * @param {*} val
 * @returns {boolean}
 */
export function isFiniteNumber(val) {
  return typeof val === "number" && Number.isFinite(val);
}

/**
 * Checks if a 2D point (x, y) contains valid finite coordinates.
 * @param {*} x
 * @param {*} y
 * @returns {boolean}
 */
export function isValidPoint(x, y) {
  return isFiniteNumber(x) && isFiniteNumber(y);
}

/**
 * Checks if rectangle bounds (x, y, width, height) are valid finite numbers with non-negative dimensions.
 * @param {*} x
 * @param {*} y
 * @param {*} width
 * @param {*} height
 * @returns {boolean}
 */
export function isValidRect(x, y, width, height) {
  return (
    isFiniteNumber(x) &&
    isFiniteNumber(y) &&
    isFiniteNumber(width) &&
    isFiniteNumber(height) &&
    width >= 0 &&
    height >= 0
  );
}

/**
 * Validates basic structural variant fields.
 * @param {*} variant
 * @returns {boolean}
 */
export function isValidVariant(variant) {
  if (!variant || typeof variant !== "object") {
    return false;
  }
  const hasValidStart =
    isFiniteNumber(variant.startAbs) || isFiniteNumber(variant.pos);
  return Boolean(variant.chr && hasValidStart);
}

/**
 * Safely clamps a numeric value between min and max.
 * Returns fallback if the value or bounds are invalid/NaN.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @param {number} [fallback=0]
 * @returns {number}
 */
export function safeClamp(val, min, max, fallback = 0) {
  if (!isFiniteNumber(val) || !isFiniteNumber(min) || !isFiniteNumber(max)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, val));
}

/**
 * Logs diagnostic information in development mode when a primitive or variant is skipped.
 * Silently skipped in production.
 * @param {Object} item - The variant or graphic item being rendered
 * @param {string} reason - The reason why rendering was skipped
 * @param {Object} [extraInfo={}] - Additional calculated values (e.g. x1, x2, controlX, apexY)
 */
export function logDevSkip(item, reason, extraInfo = {}) {
  if (process.env.NODE_ENV !== "production") {
    console.warn("[WakhanTrack] Skipping item due to invalid state:", {
      id: item?.id || item?.variant?.id || "N/A",
      chr: item?.chr || item?.variant?.chr || "N/A",
      start: item?.pos || item?.start || item?.variant?.pos || "N/A",
      end: item?.pos2 || item?.end || item?.variant?.pos2 || "N/A",
      startAbs: item?.startAbs || item?.variant?.startAbs,
      endAbs: item?.endAbs || item?.variant?.endAbs,
      reason,
      ...extraInfo,
    });
  }
}

/**
 * Safe wrapper for PixiJS graphics.moveTo(x, y).
 * Validates coordinates before invoking PixiJS.
 * @param {Object} graphics - PixiJS Graphics instance
 * @param {number} x
 * @param {number} y
 * @param {string} [contextInfo="moveTo"]
 * @returns {boolean} True if successfully drawn, false if skipped
 */
export function safeMoveTo(graphics, x, y, contextInfo = "moveTo") {
  if (!graphics || typeof graphics.moveTo !== "function") {
    return false;
  }
  if (!isValidPoint(x, y)) {
    logDevSkip(null, `Invalid coordinates in ${contextInfo}`, { x, y });
    return false;
  }
  graphics.moveTo(x, y);
  return true;
}

/**
 * Safe wrapper for PixiJS graphics.lineTo(x, y).
 * Validates coordinates before invoking PixiJS.
 * @param {Object} graphics - PixiJS Graphics instance
 * @param {number} x
 * @param {number} y
 * @param {string} [contextInfo="lineTo"]
 * @returns {boolean} True if successfully drawn, false if skipped
 */
export function safeLineTo(graphics, x, y, contextInfo = "lineTo") {
  if (!graphics || typeof graphics.lineTo !== "function") {
    return false;
  }
  if (!isValidPoint(x, y)) {
    logDevSkip(null, `Invalid coordinates in ${contextInfo}`, { x, y });
    return false;
  }
  graphics.lineTo(x, y);
  return true;
}

/**
 * Safe wrapper for PixiJS graphics.drawCircle(x, y, radius).
 * Validates coordinates and radius before invoking PixiJS.
 * @param {Object} graphics - PixiJS Graphics instance
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @param {string} [contextInfo="drawCircle"]
 * @returns {boolean} True if successfully drawn, false if skipped
 */
export function safeDrawCircle(graphics, x, y, radius, contextInfo = "drawCircle") {
  if (!graphics || typeof graphics.drawCircle !== "function") {
    return false;
  }
  if (!isValidPoint(x, y) || !isFiniteNumber(radius) || radius < 0) {
    logDevSkip(null, `Invalid coordinates or radius in ${contextInfo}`, { x, y, radius });
    return false;
  }
  graphics.drawCircle(x, y, radius);
  return true;
}

/**
 * Safe wrapper for PixiJS graphics.drawRect(x, y, width, height).
 * Validates coordinates and dimensions before invoking PixiJS.
 * @param {Object} graphics - PixiJS Graphics instance
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {string} [contextInfo="drawRect"]
 * @returns {boolean} True if successfully drawn, false if skipped
 */
export function safeDrawRect(graphics, x, y, width, height, contextInfo = "drawRect") {
  if (!graphics || typeof graphics.drawRect !== "function") {
    return false;
  }
  if (!isValidRect(x, y, width, height)) {
    logDevSkip(null, `Invalid coordinates or dimensions in ${contextInfo}`, { x, y, width, height });
    return false;
  }
  graphics.drawRect(x, y, width, height);
  return true;
}
