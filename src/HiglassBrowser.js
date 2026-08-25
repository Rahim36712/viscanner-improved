"use strict";

import React, { useRef } from "react";
import { HiGlassComponent } from "higlass/dist/hglib";
import { default as higlassRegister } from "higlass-register/dist/higlass-register";
import { default as TextTrack } from "higlass-text/es/TextTrack";
import { default as AlignedChromosomeLabelsTrack } from "./AlignedChromosomeLabelsTrack";
import { default as ScannerResultTrack } from "./ScannerResultTrackPatched";
import { default as WakhanCoverageTrack } from "./WakhanCoverageTrack";
import { default as WakhanStructuralVariationTrack } from "./WakhanStructuralVariationTrack";
import { default as HorizontalGeneAnnotationsTrack } from "./HorizontalGeneAnnotationsTrackPatched";
import { scheduleFitToContent } from "./higlassLayout";
import HiGlassErrorBoundary from "./HiGlassErrorBoundary";
import viewConfig from "./viewConfig.json";
import { DEFAULT_SETTINGS } from "./defaultSettings";

function getInitializedViewConfig() {
  const cloned = JSON.parse(JSON.stringify(viewConfig.viewConfig));
  const enableHp2 = DEFAULT_SETTINGS.enableHp2SvTrack === true;
  let topTracks = (cloned.views && cloned.views[0] && cloned.views[0].tracks && cloned.views[0].tracks.top) || [];

  if (!enableHp2) {
    topTracks = topTracks.filter((track) => track.uid !== "wakhan-hp-sv-track");
    if (cloned.views && cloned.views[0] && cloned.views[0].tracks) {
      cloned.views[0].tracks.top = topTracks;
    }
  }

  topTracks.forEach((track) => {
    if (track.type === "wakhanCoverage") {
      track.options = track.options || {};
      track.options.showHp1 = DEFAULT_SETTINGS.showHp1 ?? true;
      track.options.showHp2 = DEFAULT_SETTINGS.showHp2 ?? true;
      track.options.showCoverage = DEFAULT_SETTINGS.showCoveragePoints ?? true;
      track.options.showSvBreakpoints = DEFAULT_SETTINGS.showSvLinesInCopyNumber ?? true;
      track.options.showMaskedRegions = DEFAULT_SETTINGS.showMaskedRegions ?? false;
      track.options.showLohRegions = DEFAULT_SETTINGS.showLohRegions ?? false;
      track.options.svMode = DEFAULT_SETTINGS.svMode ?? "matched";
      track.options.visibleTypes = { ...(DEFAULT_SETTINGS.svTypes || {}) };
    } else if (track.type === "wakhanStructuralVariation") {
      track.options = track.options || {};
      track.options.svMode = DEFAULT_SETTINGS.svMode ?? "matched";
      track.options.visibleTypes = { ...(DEFAULT_SETTINGS.svTypes || {}) };

      if (track.uid === "wakhan-sv-track") {
        if (!enableHp2) {
          track.options.hpFilter = null; // Display all SVs in unified track
        }
        track.options.showTrack = DEFAULT_SETTINGS.showSvTrack ?? true;
        if (!track.options.showTrack) {
          track.height = 1;
        }
      } else if (track.uid === "wakhan-hp-sv-track") {
        track.options.showTrack = DEFAULT_SETTINGS.showHpSvTrack ?? true;
        if (!track.options.showTrack) {
          track.height = 1;
        }
      }
    }
  });
  return cloned;
}

export class HiglassBrowser extends React.PureComponent {
  constructor(props) {
    super(props);
    this.hgc = React.createRef();
    window.hgc = this.hgc;
    this.viewConfig = getInitializedViewConfig();

    higlassRegister({
      name: "TextTrack",
      track: TextTrack,
      config: TextTrack.config,
    });
    higlassRegister({
      name: "AlignedChromosomeLabelsTrack",
      track: AlignedChromosomeLabelsTrack,
      config: AlignedChromosomeLabelsTrack.config,
    }, { force: true });
    higlassRegister({
      name: "ScannerResultTrack",
      track: ScannerResultTrack,
      config: ScannerResultTrack.config,
    }, { force: true });
    higlassRegister({
      name: "WakhanCoverageTrack",
      track: WakhanCoverageTrack,
      config: WakhanCoverageTrack.config,
    }, { force: true });
    higlassRegister({
      name: "WakhanStructuralVariationTrack",
      track: WakhanStructuralVariationTrack,
      config: WakhanStructuralVariationTrack.config,
    }, { force: true });
    higlassRegister({
      name: "HorizontalGeneAnnotationsTrack",
      track: HorizontalGeneAnnotationsTrack,
      config: HorizontalGeneAnnotationsTrack.config,
    }, { force: true });
  }

  componentDidMount() {
    this.handleWindowResize = () => {
      if (!window.__viscannerApplyingLayout) {
        scheduleFitToContent({ delay: 150 });
      }
    };
    window.addEventListener("resize", this.handleWindowResize);

    if (typeof ResizeObserver !== "undefined" && typeof MutationObserver !== "undefined") {
      const container = document.getElementById("higlass-container");
      if (container) {
        let lastProcessedHeight = 0;

        const setupGridItemObserver = (gridItem) => {
          this.gridItemObserver = new ResizeObserver(() => {
            const currentHeight = gridItem.offsetHeight;
            if (currentHeight > 0 && currentHeight !== lastProcessedHeight) {
              lastProcessedHeight = currentHeight;
              scheduleFitToContent({ delay: 20 });
            }
          });
          this.gridItemObserver.observe(gridItem);
        };

        const existingGridItem = container.querySelector(".react-grid-item");
        if (existingGridItem) {
          setupGridItemObserver(existingGridItem);
        } else {
          this.mutationObserver = new MutationObserver(() => {
            const gridItem = container.querySelector(".react-grid-item");
            if (gridItem) {
              setupGridItemObserver(gridItem);
              this.mutationObserver.disconnect();
              this.mutationObserver = null;
            }
          });
          this.mutationObserver.observe(container, { childList: true, subtree: true });
        }
      }
    }

    scheduleFitToContent({ delay: 0 });
  }

  componentWillUnmount() {
    window.removeEventListener("resize", this.handleWindowResize);
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.gridItemObserver) {
      this.gridItemObserver.disconnect();
    }
  }

  render() {
    return (
      <HiGlassErrorBoundary>
        <HiGlassComponent
          viewConfig={this.viewConfig}
          bounded={true}
          ref={this.hgc}
        />
      </HiGlassErrorBoundary>
    );
  }
}
