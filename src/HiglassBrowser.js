"use strict";

import React, { useRef } from "react";
import { HiGlassComponent } from "higlass/dist/hglib";
import { default as higlassRegister } from "higlass-register/dist/higlass-register";
// import { default as SequenceTrack } from "higlass-sequence/es/SequenceTrack";
// import { default as TranscriptsTrack } from "higlass-transcripts/es/TranscriptsTrack";
// import { default as ClinvarTrack } from "higlass-clinvar/es/ClinvarTrack";
import { default as TextTrack } from "higlass-text/es/TextTrack";
import { default as AlignedChromosomeLabelsTrack } from "./AlignedChromosomeLabelsTrack";
import { default as ScannerResultTrack } from "./ScannerResultTrackPatched";
import { default as WakhanCoverageTrack } from "./WakhanCoverageTrack";
import { default as WakhanStructuralVariationTrack } from "./WakhanStructuralVariationTrack";
import { default as HorizontalGeneAnnotationsTrack } from "./HorizontalGeneAnnotationsTrackPatched";
import { scheduleFitToContent } from "./higlassLayout";
// import { default as OrthologsTrack } from "higlass-orthologs/es/OrthologsTrack";
// import { default as GnomadTrack } from "higlass-gnomad/es/GnomadTrack";
// import { default as GeneralVcfTrack } from 'higlass-general-vcf/es/GeneralVcfTrack';
// import { default as CohortTrack } from "higlass-cohort/es/CohortTrack";
// import { default as GeneListTrack } from 'higlass-cohort/es/GeneListTrack';
// import { BigwigDataFetcher } from "higlass-bigwig-datafetcher";
import HiGlassErrorBoundary from "./HiGlassErrorBoundary";
import viewConfig from "./viewConfig.json";

export class HiglassBrowser extends React.PureComponent {
  constructor(props) {
    super(props);
    this.hgc = React.createRef();
    window.hgc = this.hgc;
    this.viewConfig = viewConfig.viewConfig;
    // higlassRegister({
    //   name: "SequenceTrack",
    //   track: SequenceTrack,
    //   config: SequenceTrack.config,
    // });
    // higlassRegister({
    //   name: "TranscriptsTrack",
    //   track: TranscriptsTrack,
    //   config: TranscriptsTrack.config,
    // });
    // higlassRegister({
    //   name: "ClinvarTrack",
    //   track: ClinvarTrack,
    //   config: ClinvarTrack.config,
    // });
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
    // higlassRegister({
    //   name: "OrthologsTrack",
    //   track: OrthologsTrack,
    //   config: OrthologsTrack.config,
    // });
    // higlassRegister({
    //   name: "GnomadTrack",
    //   track: GnomadTrack,
    //   config: GnomadTrack.config,
    // });
    // higlassRegister({
    //   name: "GeneralVcfTrack",
    //   track: GeneralVcfTrack,
    //   config: GeneralVcfTrack.config,
    // });
    // higlassRegister({
    //   name: "CohortTrack",
    //   track: CohortTrack,
    //   config: CohortTrack.config,
    // });
    // higlassRegister({
    //   name: "GeneListTrack",
    //   track: GeneListTrack,
    //   config: GeneListTrack.config,
    // });
    // higlassRegister(
    //   {
    //     dataFetcher: BigwigDataFetcher,
    //     config: BigwigDataFetcher.config,
    //   },
    //   { pluginType: "dataFetcher" }
    // );
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
