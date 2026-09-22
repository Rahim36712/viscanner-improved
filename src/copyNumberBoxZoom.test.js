/**
 * @jest-environment jsdom
 */

import {
  isBoxZoomTriggerEvent,
  getCoverageTrackObject,
  getCoveragePlotBoundsInContainer,
  initCopyNumberBoxZoom,
  dismissMouseOverTooltips,
} from "./copyNumberBoxZoom";

describe("copyNumberBoxZoom", () => {
  describe("isBoxZoomTriggerEvent", () => {
    test("returns true for shift + left-click (button 0 and shiftKey)", () => {
      expect(isBoxZoomTriggerEvent({ button: 0, shiftKey: true })).toBe(true);
    });

    test("returns false for right-click without shift (button 2)", () => {
      expect(isBoxZoomTriggerEvent({ button: 2, shiftKey: false })).toBe(false);
    });

    test("returns false for right-click even with shift (button 2)", () => {
      expect(isBoxZoomTriggerEvent({ button: 2, shiftKey: true })).toBe(false);
    });

    test("returns false for regular left-click (button 0 without shift)", () => {
      expect(isBoxZoomTriggerEvent({ button: 0, shiftKey: false })).toBe(false);
    });

    test("returns false for middle-click (button 1)", () => {
      expect(isBoxZoomTriggerEvent({ button: 1, shiftKey: false })).toBe(false);
    });

    test("returns false for null/undefined event", () => {
      expect(isBoxZoomTriggerEvent(null)).toBe(false);
      expect(isBoxZoomTriggerEvent(undefined)).toBe(false);
    });
  });

  describe("getCoverageTrackObject", () => {
    test("returns null if hgc is missing or has no api", () => {
      expect(getCoverageTrackObject(null)).toBe(null);
      expect(getCoverageTrackObject({})).toBe(null);
      expect(getCoverageTrackObject({ current: {} })).toBe(null);
    });

    test("returns track from hgc api using default or configured viewUid", () => {
      const mockTrack = { id: "wakhan-coverage-track", dimensions: [800, 400] };
      const hgcRef = {
        current: {
          api: {
            getViewConfig: () => ({ views: [{ uid: "view1" }] }),
            getTrackObject: jest.fn((viewUid, trackUid) => {
              if (viewUid === "view1" && trackUid === "wakhan-coverage-track") {
                return mockTrack;
              }
              return null;
            }),
          },
        },
      };

      const track = getCoverageTrackObject(hgcRef);
      expect(track).toBe(mockTrack);
      expect(hgcRef.current.api.getTrackObject).toHaveBeenCalledWith("view1", "wakhan-coverage-track");
    });
  });

  describe("getCoveragePlotBoundsInContainer", () => {
    test("returns null if container, track or canvas is missing", () => {
      const container = document.createElement("div");
      expect(getCoveragePlotBoundsInContainer(null, {})).toBe(null);
      expect(getCoveragePlotBoundsInContainer(container, null)).toBe(null);
      expect(getCoveragePlotBoundsInContainer(container, { dimensions: [800, 400] })).toBe(null);
    });

    test("computes correct plot boundaries inside container", () => {
      const container = document.createElement("div");
      const canvas = document.createElement("canvas");
      container.appendChild(canvas);

      jest.spyOn(container, "getBoundingClientRect").mockReturnValue({
        left: 100,
        top: 50,
        width: 1000,
        height: 600,
      });

      jest.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
        left: 100,
        top: 50,
        width: 1000,
        height: 600,
      });

      const mockTrack = {
        position: [0, 200],
        dimensions: [900, 300],
      };

      const bounds = getCoveragePlotBoundsInContainer(container, mockTrack);
      expect(bounds).not.toBe(null);
      expect(bounds.plotLeft).toBe(72);
      expect(bounds.plotRight).toBe(900 - 78);
      expect(bounds.left).toBe(72);
      expect(bounds.right).toBe(822);
      expect(bounds.top).toBe(200);
      expect(bounds.bottom).toBe(500);
      expect(bounds.width).toBe(822 - 72);
      expect(bounds.height).toBe(300);
    });
  });

  describe("initCopyNumberBoxZoom lifecycle and interactions", () => {
    let container;
    let canvas;
    let hgcRef;
    let mockTrack;
    let mockZoomTo;

    beforeEach(() => {
      container = document.createElement("div");
      canvas = document.createElement("canvas");
      container.appendChild(canvas);
      document.body.appendChild(container);

      jest.spyOn(container, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 1000,
        height: 800,
      });

      jest.spyOn(canvas, "getBoundingClientRect").mockReturnValue({
        left: 0,
        top: 0,
        width: 1000,
        height: 800,
      });

      const fakeScale = (abs) => abs;
      fakeScale.invert = (px) => px * 1000;
      fakeScale.range = () => [0, 1000];

      mockZoomTo = jest.fn();
      mockTrack = {
        id: "wakhan-coverage-track",
        position: [0, 100],
        dimensions: [1000, 300],
        _xScale: fakeScale,
      };

      hgcRef = {
        current: {
          api: {
            getViewConfig: () => ({ views: [{ uid: "aa" }] }),
            getTrackObject: jest.fn(() => mockTrack),
            zoomTo: mockZoomTo,
          },
        },
      };
    });

    afterEach(() => {
      if (container && container.parentNode) {
        container.parentNode.removeChild(container);
      }
    });

    test("creates overlay box with corners and cleans it up on destroy", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);
      const overlay = container.querySelector(".viscanner-box-zoom-overlay");
      expect(overlay).not.toBe(null);
      expect(overlay.querySelectorAll(".viscanner-box-zoom-corner").length).toBe(4);

      destroy();
      expect(container.querySelector(".viscanner-box-zoom-overlay")).toBe(null);
    });

    test("does not trigger drag on regular left click without shift (allowing normal pan)", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);
      const overlay = container.querySelector(".viscanner-box-zoom-overlay");

      const event = new MouseEvent("mousedown", {
        button: 0,
        shiftKey: false,
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      const stopImmediatePropagationSpy = jest.spyOn(event, "stopImmediatePropagation");
      container.dispatchEvent(event);

      expect(overlay.style.display).toBe("none");
      expect(stopImmediatePropagationSpy).not.toHaveBeenCalled();
      destroy();
    });

    test("does not trigger drag if clicking outside copy number track", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);
      const overlay = container.querySelector(".viscanner-box-zoom-overlay");

      // Track is from y = 100 to y = 400. ClientY = 50 is outside.
      const event = new MouseEvent("mousedown", {
        button: 0,
        shiftKey: true,
        clientX: 200,
        clientY: 50,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(event);

      expect(overlay.style.display).toBe("none");
      destroy();
    });

    test("triggers drag on Shift + Left click, stops propagation to freeze chart, and zooms proportionally", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef, { animationDuration: 400 });
      const overlay = container.querySelector(".viscanner-box-zoom-overlay");

      // 1. Mouse down with Shift + Left click at x = 200, y = 200 (inside track)
      const downEvent = new MouseEvent("mousedown", {
        button: 0,
        shiftKey: true,
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      const stopImmediatePropagationSpy = jest.spyOn(downEvent, "stopImmediatePropagation");
      const preventDefaultSpy = jest.spyOn(downEvent, "preventDefault");

      container.dispatchEvent(downEvent);

      // Verify that propagation was stopped to prevent HiGlass pan
      expect(stopImmediatePropagationSpy).toHaveBeenCalled();
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(overlay.style.display).toBe("block");

      // 2. Mouse move to x = 400, y = 280
      const moveEvent = new MouseEvent("mousemove", {
        clientX: 400,
        clientY: 280,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(moveEvent);

      expect(overlay.style.width).toBe("200px");
      expect(overlay.style.height).toBe("80px");

      // 3. Mouse up
      const upEvent = new MouseEvent("mouseup", {
        clientX: 400,
        clientY: 280,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(upEvent);

      expect(overlay.style.display).toBe("none");
      expect(mockZoomTo).toHaveBeenCalledTimes(1);

      // Verify zoom is called with matched startAbs, endAbs (proportional zoom without extreme overshooting)
      const zoomArgs = mockZoomTo.mock.calls[0];
      expect(zoomArgs[0]).toBe("aa");
      const startAbs = zoomArgs[1];
      const endAbs = zoomArgs[2];
      expect(typeof startAbs).toBe("number");
      expect(typeof endAbs).toBe("number");
      expect(zoomArgs[3]).toBe(startAbs);
      expect(zoomArgs[4]).toBe(endAbs);
      expect(zoomArgs[5]).toBe(400);

      destroy();
    });

    test("ignores micro-drags under 8px", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);

      const downEvent = new MouseEvent("mousedown", {
        button: 0,
        shiftKey: true,
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(downEvent);

      const upEvent = new MouseEvent("mouseup", {
        clientX: 203,
        clientY: 201,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(upEvent);

      expect(mockZoomTo).not.toHaveBeenCalled();
      destroy();
    });

    test("updates cursor when Shift key is pressed and released", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);

      const keyDownEvent = new KeyboardEvent("keydown", { key: "Shift" });
      window.dispatchEvent(keyDownEvent);
      expect(container.style.cursor).toBe("crosshair");

      const keyUpEvent = new KeyboardEvent("keyup", { key: "Shift" });
      window.dispatchEvent(keyUpEvent);
      expect(container.style.cursor).toBe("");

      destroy();
    });

    test("dismisses active tooltips and sets Shift-active flags when Shift key is pressed", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);

      const tooltip = document.createElement("div");
      tooltip.className = "track-mouseover-menu";
      document.body.appendChild(tooltip);

      expect(document.querySelectorAll(".track-mouseover-menu").length).toBe(1);

      const keyDownEvent = new KeyboardEvent("keydown", { key: "Shift" });
      window.dispatchEvent(keyDownEvent);

      expect(window.__viscannerShiftPressed).toBe(true);
      expect(document.body.classList.contains("viscanner-shift-active")).toBe(true);
      expect(document.querySelectorAll(".track-mouseover-menu").length).toBe(0);

      const keyUpEvent = new KeyboardEvent("keyup", { key: "Shift" });
      window.dispatchEvent(keyUpEvent);

      expect(window.__viscannerShiftPressed).toBe(false);
      expect(document.body.classList.contains("viscanner-shift-active")).toBe(false);

      destroy();
    });

    test("resets Shift flags and classes on window blur", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);

      const keyDownEvent = new KeyboardEvent("keydown", { key: "Shift" });
      window.dispatchEvent(keyDownEvent);
      expect(window.__viscannerShiftPressed).toBe(true);
      expect(document.body.classList.contains("viscanner-shift-active")).toBe(true);

      window.dispatchEvent(new Event("blur"));
      expect(window.__viscannerShiftPressed).toBe(false);
      expect(document.body.classList.contains("viscanner-shift-active")).toBe(false);
      expect(container.style.cursor).toBe("");

      destroy();
    });

    test("sets boxZoomDragging flag and removes tooltips during drag", () => {
      const destroy = initCopyNumberBoxZoom(container, hgcRef);

      const tooltip = document.createElement("div");
      tooltip.className = "track-mouseover-menu";
      document.body.appendChild(tooltip);

      const downEvent = new MouseEvent("mousedown", {
        button: 0,
        shiftKey: true,
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      container.dispatchEvent(downEvent);

      expect(window.__viscannerBoxZoomDragging).toBe(true);
      expect(document.querySelectorAll(".track-mouseover-menu").length).toBe(0);

      const upEvent = new MouseEvent("mouseup", {
        shiftKey: false,
        clientX: 200,
        clientY: 200,
        bubbles: true,
        cancelable: true,
      });
      window.dispatchEvent(upEvent);

      expect(window.__viscannerBoxZoomDragging).toBe(false);
      expect(window.__viscannerShiftPressed).toBe(false);

      destroy();
    });
  });

  describe("dismissMouseOverTooltips", () => {
    test("removes any .track-mouseover-menu elements from DOM", () => {
      const el1 = document.createElement("div");
      el1.className = "track-mouseover-menu";
      const el2 = document.createElement("div");
      el2.className = "track-mouseover-menu other-class";
      document.body.appendChild(el1);
      document.body.appendChild(el2);

      expect(document.querySelectorAll(".track-mouseover-menu").length).toBe(2);
      dismissMouseOverTooltips();
      expect(document.querySelectorAll(".track-mouseover-menu").length).toBe(0);
    });
  });
});
