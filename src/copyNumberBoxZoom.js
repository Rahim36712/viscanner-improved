import { getPlotBounds, unmapTrackX } from "./plotBounds";
import { scheduleFitToContent } from "./higlassLayout";

const MIN_DRAG_DISTANCE_PX = 8;
const DEFAULT_ANIMATION_DURATION_MS = 400;
const DEFAULT_VIEW_UID = "aa";
const COVERAGE_TRACK_UID = "wakhan-coverage-track";

/**
 * Creates and injects the selection box element with Bokeh-style corner markers into the container.
 */
function createOverlayBox(container) {
  const box = document.createElement("div");
  box.className = "viscanner-box-zoom-overlay";
  box.style.position = "absolute";
  box.style.display = "none";
  box.style.pointerEvents = "none";
  box.style.zIndex = "1000";
  box.style.border = "1.5px dashed rgba(45, 125, 210, 0.9)";
  box.style.backgroundColor = "rgba(45, 125, 210, 0.15)";
  box.style.boxShadow = "0 0 0 1px rgba(255, 255, 255, 0.7), 0 2px 8px rgba(0, 0, 0, 0.15)";
  box.style.borderRadius = "2px";
  box.style.boxSizing = "border-box";
  box.style.cursor = "crosshair";

  // Corner indicators matching reference screenshot
  const corners = ["tl", "tr", "bl", "br"];
  corners.forEach((corner) => {
    const mark = document.createElement("div");
    mark.className = `viscanner-box-zoom-corner viscanner-box-zoom-corner-${corner}`;
    mark.style.position = "absolute";
    mark.style.width = "7px";
    mark.style.height = "7px";
    mark.style.boxSizing = "border-box";
    mark.style.pointerEvents = "none";

    if (corner === "tl") {
      mark.style.top = "-2px";
      mark.style.left = "-2px";
      mark.style.borderTop = "2px solid #ffffff";
      mark.style.borderLeft = "2px solid #ffffff";
    } else if (corner === "tr") {
      mark.style.top = "-2px";
      mark.style.right = "-2px";
      mark.style.borderTop = "2px solid #ffffff";
      mark.style.borderRight = "2px solid #ffffff";
    } else if (corner === "bl") {
      mark.style.bottom = "-2px";
      mark.style.left = "-2px";
      mark.style.borderBottom = "2px solid #ffffff";
      mark.style.borderLeft = "2px solid #ffffff";
    } else if (corner === "br") {
      mark.style.bottom = "-2px";
      mark.style.right = "-2px";
      mark.style.borderBottom = "2px solid #ffffff";
      mark.style.borderRight = "2px solid #ffffff";
    }
    box.appendChild(mark);
  });

  container.appendChild(box);
  return box;
}

/**
 * Finds the copy number / coverage track object from the HiGlass API.
 */
export function getCoverageTrackObject(hgcRef) {
  const hgc = hgcRef?.current || (typeof window !== "undefined" ? window.hgc?.current : null);
  if (!hgc || !hgc.api || typeof hgc.api.getTrackObject !== "function") {
    return null;
  }
  try {
    const viewUid = hgc.api.getViewConfig()?.views?.[0]?.uid || DEFAULT_VIEW_UID;
    return hgc.api.getTrackObject(viewUid, COVERAGE_TRACK_UID) || null;
  } catch (error) {
    return null;
  }
}

/**
 * Computes the screen/container bounding box of the copy number plot area.
 */
export function getCoveragePlotBoundsInContainer(container, track) {
  if (!container || !track || !track.dimensions) {
    return null;
  }

  const containerRect = container.getBoundingClientRect();
  const canvas = container.querySelector("canvas");
  if (!canvas) {
    return null;
  }

  const canvasRect = canvas.getBoundingClientRect();
  const canvasOffsetX = canvasRect.left - containerRect.left;
  const canvasOffsetY = canvasRect.top - containerRect.top;

  const trackX = Number(track.position?.[0]) || 0;
  const trackY = Number(track.position?.[1]) || 0;
  const trackWidth = Math.max(1, Number(track.dimensions[0]) || 1);
  const trackHeight = Math.max(1, Number(track.dimensions[1]) || 1);

  const plotBounds = getPlotBounds(track);
  const plotLeft = plotBounds.left;
  const plotRight = plotBounds.right;

  const left = canvasOffsetX + trackX + plotLeft;
  const right = canvasOffsetX + trackX + plotRight;
  const top = canvasOffsetY + trackY;
  const bottom = canvasOffsetY + trackY + trackHeight;

  return {
    containerRect,
    canvasOffsetX,
    canvasOffsetY,
    trackX,
    trackY,
    trackWidth,
    trackHeight,
    plotLeft,
    plotRight,
    left,
    right,
    top,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

/**
 * Checks if a mouse event is the box zoom trigger:
 * Shift + Left-click (button === 0 && shiftKey === true).
 */
export function isBoxZoomTriggerEvent(event) {
  if (!event) return false;
  return event.button === 0 && event.shiftKey === true;
}

/**
 * Initializes Shift + Left-Click drag box zoom on the Copy Number plot.
 * Uses capture-phase event interception to freeze chart panning completely while dragging.
 * 
 * @param {HTMLElement} container The container DOM element (e.g. #higlass-container)
 * @param {object} hgcRef React ref or object holding the HiGlass component instance
 * @param {object} [options] Optional configuration overrides
 * @returns {function} Cleanup/destroy function
 */
export function initCopyNumberBoxZoom(container, hgcRef, options = {}) {
  if (!container) {
    return () => {};
  }

  const animationDuration = options.animationDuration ?? DEFAULT_ANIMATION_DURATION_MS;
  const overlayBox = createOverlayBox(container);

  let isDragging = false;
  let dragStartContainerX = 0;
  let dragStartContainerY = 0;
  let activePlotBounds = null;
  let activeTrack = null;
  let suppressNextClick = false;

  function isOverCoveragePlot(clientX, clientY) {
    const track = getCoverageTrackObject(hgcRef);
    if (!track) return null;

    const plotBounds = getCoveragePlotBoundsInContainer(container, track);
    if (!plotBounds) return null;

    const mouseX = clientX - plotBounds.containerRect.left;
    const mouseY = clientY - plotBounds.containerRect.top;

    if (
      mouseX >= plotBounds.left &&
      mouseX <= plotBounds.right &&
      mouseY >= plotBounds.top &&
      mouseY <= plotBounds.bottom
    ) {
      return { track, plotBounds, mouseX, mouseY };
    }
    return null;
  }

  function updateHoverCursor(event) {
    if (isDragging) return;
    if (event.shiftKey) {
      const hit = isOverCoveragePlot(event.clientX, event.clientY);
      if (hit) {
        container.style.cursor = "crosshair";
        return;
      }
    }
    container.style.cursor = "";
  }

  function onMouseDownCapture(event) {
    if (!isBoxZoomTriggerEvent(event)) {
      return;
    }

    const hit = isOverCoveragePlot(event.clientX, event.clientY);
    if (!hit) {
      return;
    }

    // Inside target track plot with Shift + Left-Click!
    // STOP IMMEDIATE PROPAGATION IN CAPTURE PHASE:
    // This stops HiGlass from ever seeing the mousedown event, so it will NEVER start panning!
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    isDragging = true;
    suppressNextClick = true;
    activeTrack = hit.track;
    activePlotBounds = hit.plotBounds;

    dragStartContainerX = hit.mouseX;
    dragStartContainerY = hit.mouseY;

    overlayBox.style.left = `${dragStartContainerX}px`;
    overlayBox.style.top = `${dragStartContainerY}px`;
    overlayBox.style.width = "0px";
    overlayBox.style.height = "0px";
    overlayBox.style.display = "block";

    document.body.style.cursor = "crosshair";
    document.body.style.userSelect = "none";

    window.addEventListener("mousemove", onMouseMoveCapture, { capture: true, passive: false });
    window.addEventListener("pointermove", onMouseMoveCapture, { capture: true, passive: false });
    window.addEventListener("mouseup", onMouseUpCapture, { capture: true, passive: false });
    window.addEventListener("pointerup", onMouseUpCapture, { capture: true, passive: false });
  }

  function onMouseMoveCapture(event) {
    if (!isDragging || !activePlotBounds) {
      return;
    }

    // Stop propagation so HiGlass never interprets this as a pan
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const currentX = Math.max(
      activePlotBounds.left,
      Math.min(activePlotBounds.right, event.clientX - activePlotBounds.containerRect.left)
    );
    const currentY = Math.max(
      activePlotBounds.top,
      Math.min(activePlotBounds.bottom, event.clientY - activePlotBounds.containerRect.top)
    );

    const boxLeft = Math.min(dragStartContainerX, currentX);
    const boxTop = Math.min(dragStartContainerY, currentY);
    const boxWidth = Math.abs(currentX - dragStartContainerX);
    const boxHeight = Math.abs(currentY - dragStartContainerY);

    overlayBox.style.left = `${boxLeft}px`;
    overlayBox.style.top = `${boxTop}px`;
    overlayBox.style.width = `${boxWidth}px`;
    overlayBox.style.height = `${boxHeight}px`;
  }

  function onMouseUpCapture(event) {
    if (!isDragging) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    isDragging = false;
    window.removeEventListener("mousemove", onMouseMoveCapture, { capture: true });
    window.removeEventListener("pointermove", onMouseMoveCapture, { capture: true });
    window.removeEventListener("mouseup", onMouseUpCapture, { capture: true });
    window.removeEventListener("pointerup", onMouseUpCapture, { capture: true });

    overlayBox.style.display = "none";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    const currentX = Math.max(
      activePlotBounds.left,
      Math.min(activePlotBounds.right, event.clientX - activePlotBounds.containerRect.left)
    );

    const minContainerX = Math.min(dragStartContainerX, currentX);
    const maxContainerX = Math.max(dragStartContainerX, currentX);
    const dragWidth = maxContainerX - minContainerX;

    if (dragWidth >= MIN_DRAG_DISTANCE_PX && activeTrack && activeTrack._xScale) {
      // Convert container coordinates back to track local plotX
      const trackBaseX = activePlotBounds.canvasOffsetX + activePlotBounds.trackX;
      const plotX1 = minContainerX - trackBaseX;
      const plotX2 = maxContainerX - trackBaseX;

      const abs1 = unmapTrackX(activeTrack, plotX1);
      const abs2 = unmapTrackX(activeTrack, plotX2);

      if (Number.isFinite(abs1) && Number.isFinite(abs2)) {
        const startAbs = Math.min(abs1, abs2);
        const endAbs = Math.max(abs1, abs2);

        if (endAbs > startAbs + 10) {
          const hgc = hgcRef?.current || (typeof window !== "undefined" ? window.hgc?.current : null);
          if (hgc && hgc.api && typeof hgc.api.zoomTo === "function") {
            const viewUid = hgc.api.getViewConfig()?.views?.[0]?.uid || DEFAULT_VIEW_UID;
            // Pass matched startAbs, endAbs for both X and Y to zoom proportionally to the exact selected box
            hgc.api.zoomTo(viewUid, startAbs, endAbs, startAbs, endAbs, animationDuration);
            scheduleFitToContent({ delay: animationDuration + 50 });
          }
        }
      }
    }

    activePlotBounds = null;
    activeTrack = null;
    updateHoverCursor(event);

    setTimeout(() => {
      suppressNextClick = false;
    }, 50);
  }

  function onClickCapture(event) {
    if (suppressNextClick) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      suppressNextClick = false;
    }
  }

  function onKeyDown(event) {
    if (event.key === "Shift") {
      container.style.cursor = "crosshair";
    }
  }

  function onKeyUp(event) {
    if (event.key === "Shift") {
      container.style.cursor = "";
    }
  }

  // Intercept events in CAPTURE phase so HiGlass pan listeners never receive them when Shift is held
  container.addEventListener("mousedown", onMouseDownCapture, { capture: true, passive: false });
  container.addEventListener("pointerdown", onMouseDownCapture, { capture: true, passive: false });
  container.addEventListener("click", onClickCapture, { capture: true, passive: false });
  container.addEventListener("mousemove", updateHoverCursor, { passive: true });

  window.addEventListener("keydown", onKeyDown, { passive: true });
  window.addEventListener("keyup", onKeyUp, { passive: true });

  // Return cleanup function
  return function destroy() {
    container.removeEventListener("mousedown", onMouseDownCapture, { capture: true });
    container.removeEventListener("pointerdown", onMouseDownCapture, { capture: true });
    container.removeEventListener("click", onClickCapture, { capture: true });
    container.removeEventListener("mousemove", updateHoverCursor);

    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    window.removeEventListener("mousemove", onMouseMoveCapture, { capture: true });
    window.removeEventListener("pointermove", onMouseMoveCapture, { capture: true });
    window.removeEventListener("mouseup", onMouseUpCapture, { capture: true });
    window.removeEventListener("pointerup", onMouseUpCapture, { capture: true });

    container.style.cursor = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    if (overlayBox.parentNode) {
      overlayBox.parentNode.removeChild(overlayBox);
    }
  };
}
