"use strict";

import React from "react";

import { GeneSearchBox } from "./GeneSearchBox";
import { ChromosomeInfo } from "higlass/dist/hglib";
import { resetHiglassView, scheduleFitToContent } from "./higlassLayout";
import { exportSvgAsPdf } from "./pdfExport";
// import Select from "react-select";

// import viewConfigClinvar from "./viewConfig.clinvar.json";
// import viewConfigTranscripts from "./viewConfig.transcripts.json";
// import viewConfigGnomad from "./viewConfig.gnomad.json";
// import viewConfigOrthologs from "./viewConfig.orthologs.json";

// const VIEW_CONFIGS = {
//   clinvar: viewConfigClinvar.viewConfigClinvar,
//   transcripts: viewConfigTranscripts.viewConfigTranscripts,
//   gnomad: viewConfigGnomad.viewConfigGnomad,
//   orthologs: viewConfigOrthologs.viewConfigOrthologs,
// };

// VEP consequence levels
const CL_HIGH = "High";
const CL_MODERATE = "Moderate";
const CL_LOW = "Low";
const CL_MODIFIER = "Modifier";

export class Facets extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      region: "",
      regionError: false,
    };
  }

  componentDidMount() {}

  exportDisplay = async () => {
    const hgc = window.hgc.current;
    if (!hgc) {
      console.warn("Higlass component not found.");
      return;
    }

    try {
      const svg = hgc.api.exportAsSvg();
      await exportSvgAsPdf(svg, "viscanner-cohort.pdf");
    } catch (error) {
      console.error("Failed to export the visualization as a PDF:", error);
    } finally {
      // Force HiGlass to re-render all Pixi tracks so the on-screen
      // display is restored after the offscreen captures.
      requestAnimationFrame(() => {
        try {
          if (hgc.pixiStage && hgc.pixiRenderer) {
            hgc.pixiRenderer.render(hgc.pixiStage);
          }
          // Trigger a resize which forces all tracks to redraw
          window.dispatchEvent(new Event("resize"));
        } catch (e) {
          // Last resort: force a resize event to trigger redraws
          window.dispatchEvent(new Event("resize"));
        }
      });
    }
  };

  addToRegion = (evt) => {
    this.setState({
      region: evt.target.value,
    });
  };

  goToRegion = () => {
    const hgc = window.hgc.current;
    if (!hgc) {
      console.warn("Higlass component not found.");
      return;
    }

    const regexp = /(chr)([0-9]{1,2}|X|Y|MT)(:)(\d+)(-)(chr)([0-9]{1,2}|X|Y|MT)(:)(\d+)$/g

    const isValidRegion = regexp.test(this.state.region);

    if(!isValidRegion){
      this.setState({
        regionError: true,
      });
      return;
    }

    this.setState({
      regionError: false,
    });

    const locations = this.state.region.split("-");
    const location1 = locations[0];
    const location1_ = location1.split(":");
    const location2 = locations[1];
    const location2_ = location2.split(":");

    const chr_first = location1_[0];
    const pos_first = parseInt(location1_[1], 10);
    const chr_sec = location2_[0];
    const pos_sec = parseInt(location2_[1], 10);

    const viewconf = hgc.api.getViewConfig();

    ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
      // Now we can use the chromInfo object to convert
      .then((chromInfo) => {
        hgc.api.zoomTo(
          viewconf.views[0].uid,
          chromInfo.chrToAbs([chr_first, pos_first]),
          chromInfo.chrToAbs([chr_sec, pos_sec]),
          chromInfo.chrToAbs(['chr1', 0]),
          chromInfo.chrToAbs(['chr1', 1000]),
          2500  // Animation time
        );
        scheduleFitToContent({ delay: 2600 });
      });
  };

  render() {
    // const consequenceLevels = [CL_HIGH, CL_MODERATE, CL_LOW, CL_MODIFIER];

    // const { selectedKeggCategory, selectedStatisticalTest } = this.state;

    const regionClass = this.state.regionError
      ? "form-control is-invalid form-control-sm mb-2 mr-sm-2"
      : "form-control form-control-sm mb-2 mr-sm-2";

    return (
      <React.Fragment>
        <div className="row z0">
          <div className="col">
            <div className="d-block bg-light px-2 mb-2">
              <small>NAVIGATION</small>
            </div>

            <div className="mb-1 mt-3">Go to specific region</div>
            <input
              type="text"
              onChange={this.addToRegion}
              className={regionClass}
              placeholder="e.g., chr2:1000-chr2:2000"
            />
            <button
              className="btn btn-outline-primary btn-sm btn-block mb-3"
              onClick={this.goToRegion}
            >
              Go
            </button>

            <div className="mb-1 mt-2">Go to specific gene</div>
            <GeneSearchBox />
            <button
              className="btn btn-outline-secondary btn-sm btn-block mt-2 mb-3"
              onClick={resetHiglassView}
              type="button"
            >
              Reset View
            </button>
            {/* <div className="form-check mt-3">
              <input
                type="checkbox"
                id="toggle-transcripts-check"
                className="form-check-input"
                value="transcripts"
                onChange={this.togglePluginTrack}
                checked={this.state.isTranscriptsTrackVisible ? "checked" : ""}
              />
              <label
                className="form-check-label"
                htmlFor="toggle-transcripts-check"
              >
                Show gene transcripts
              </label>
            </div>
            <div className="form-check mt-2">
              <input
                type="checkbox"
                id="toggle-clinvar-check"
                className="form-check-input"
                value="clinvar"
                onChange={this.togglePluginTrack}
                checked={this.state.isClinvarTrackVisible ? "checked" : ""}
              />
              <label
                className="form-check-label"
                htmlFor="toggle-clinvar-check"
              >
                Show Clinvar annotations
              </label>
            </div>
            <div className="form-check mt-2">
              <input
                type="checkbox"
                id="toggle-gnomad-check"
                className="form-check-input"
                value="gnomad"
                onChange={this.togglePluginTrack}
                checked={this.state.isGnomadTrackVisible ? "checked" : ""}
              />
              <label className="form-check-label" htmlFor="toggle-gnomad-check">
                Show GnomAD allele frequencies
              </label>
            </div>
            <div className="form-check mt-2">
              <input
                type="checkbox"
                id="toggle-orthologs-check"
                className="form-check-input"
                value="orthologs"
                onChange={this.togglePluginTrack}
                checked={this.state.isOrthologsTrackVisible ? "checked" : ""}
              />
              <label
                className="form-check-label"
                htmlFor="toggle-orthologs-check"
              >
                Show orthologs
              </label>
            </div>

            <div className="d-block bg-light px-2 mb-1 mt-3">
              <small>GENE LEVEL FILTERING</small>
            </div>

            <div className="mt-2">KEGG category</div>
            <Select
              value={selectedKeggCategory}
              onChange={this.handleKeggChange}
              options={KEGG_CATEGORY_OPTIONS}
              closeMenuOnSelect={false}
              isMulti
              placeholder="Select multiple..."
            />

            <div className="mt-2">Statistical test</div>
            <Select
              value={selectedStatisticalTest}
              onChange={this.handleStatTestChange}
              options={STATISTICAL_TEST_OPTIONS}
            />

            <div className="d-block bg-light px-2 mb-1 mt-3">
              <small>VARIANT LEVEL FILTERING</small>
            </div>
            <div className="mt-2">CADD Score</div>
            <div className="row">
              <div className="col-sm-6">
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Min"
                    onChange={(evt) => this.applyCaddFilter(evt, "min")}
                  />
                </div>
              </div>
              <div className="col-sm-6">
                <div className="form-group">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Max"
                    onChange={(evt) => this.applyCaddFilter(evt, "max")}
                  />
                </div>
              </div>
            </div>

            <div className="mt-1">Consequence levels (VEP)</div>
            <div className="row">
              {consequenceLevels.map((cl) => (
                <div className="col-sm-6">
                  <div class="form-check">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      id={"cb_" + cl}
                      value={cl}
                      onChange={this.changeActiveConsequenceLevels}
                      checked={
                        this.state.activeConsequenceLevels.includes(cl)
                          ? "checked"
                          : ""
                      }
                    />
                    <label className="form-check-label" htmlFor={"cb_" + cl}>
                      {cl}
                    </label>
                  </div>
                </div>
              ))}
            </div> */}

            <div className="d-block mb-1 mt-4">
              <button
                type="button"
                className="btn btn-primary btn-sm btn-block"
                onClick={this.exportDisplay}
              >
                <i className="icon icon-download icon-sm fas mr-1"></i>
                Export PDF (vector)
              </button>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
