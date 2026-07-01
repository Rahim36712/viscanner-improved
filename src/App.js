import React from "react";
import "./App.css";
import { Facets } from "./Facets";
import "bootstrap/dist/css/bootstrap.min.css";
import { HiglassBrowser } from "./HiglassBrowser";
import { CnvTable } from "./CnvTable";

const DEFAULT_WAKHAN_VISIBILITY = {
  showHp1: true,
  showHp2: true,
  showCoverage: true,
};

const SV_TYPE_OPTIONS = [
  { key: "DEL", label: "DEL", color: "#F27A9A" },
  { key: "INV", label: "INV", color: "#7C83FF" },
  { key: "INS", label: "INS", color: "#D9CB3E" },
  { key: "BND", label: "BND", color: "#8F969E" },
  { key: "DUP", label: "DUP", color: "#74C69D" },
  { key: "sBND", label: "sBND", color: "#A9B7BA" },
];

const DEFAULT_SV_VISIBILITY = SV_TYPE_OPTIONS.reduce((visibility, option) => {
  visibility[option.key] = true;
  return visibility;
}, {});
const DEFAULT_SV_MODE = "matched";

function updateWakhanTrackVisibility(visibility) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api) {
    return;
  }

  try {
    const wakhanTrack = hgc.api.getTrackObject("aa", "wakhan-coverage-track");
    if (wakhanTrack && wakhanTrack.setVisibilityOptions) {
      wakhanTrack.setVisibilityOptions(visibility);
    }
  } catch (error) {
    return;
  }
}

function updateSvTrackVisibility(options) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api) {
    return;
  }

  try {
    const svTrack = hgc.api.getTrackObject("aa", "wakhan-sv-track");
    if (svTrack && svTrack.setVisibilityOptions) {
      svTrack.setVisibilityOptions(options);
    }
  } catch (error) {
    return;
  }
}

function WakhanVisibilityControls() {
  const [visibility, setVisibility] = React.useState(DEFAULT_WAKHAN_VISIBILITY);

  React.useEffect(() => {
    updateWakhanTrackVisibility(visibility);
  }, [visibility]);

  const toggleVisibility = (key) => {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="wakhan-visibility border p-2 mt-3">
      <div className="wakhan-visibility-title">WAKHAN visibility</div>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showHp1}
          onChange={() => toggleVisibility("showHp1")}
        />
        <span>HP1 plot</span>
      </label>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showHp2}
          onChange={() => toggleVisibility("showHp2")}
        />
        <span>HP2 plot</span>
      </label>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showCoverage}
          onChange={() => toggleVisibility("showCoverage")}
        />
        <span>Coverage points</span>
      </label>
    </div>
  );
}

function SvVisibilityControls() {
  const [visibility, setVisibility] = React.useState(DEFAULT_SV_VISIBILITY);
  const [svMode, setSvMode] = React.useState(DEFAULT_SV_MODE);

  React.useEffect(() => {
    updateSvTrackVisibility({ visibleTypes: visibility, svMode });
  }, [visibility, svMode]);

  const toggleVisibility = (key) => {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="wakhan-visibility border p-2 mt-3">
      <div className="wakhan-visibility-title">SV visibility</div>
      <div className="sv-filter-mode">
        <label className="wakhan-visibility-option">
          <input
            type="radio"
            name="sv-filter-mode"
            checked={svMode === "matched"}
            onChange={() => setSvMode("matched")}
          />
          <span>BED-matched SVs</span>
        </label>
        <label className="wakhan-visibility-option">
          <input
            type="radio"
            name="sv-filter-mode"
            checked={svMode === "all"}
            onChange={() => setSvMode("all")}
          />
          <span>All VCF SVs</span>
        </label>
      </div>
      {SV_TYPE_OPTIONS.map((option) => (
        <label className="wakhan-visibility-option sv-visibility-option" key={option.key}>
          <input
            type="checkbox"
            checked={visibility[option.key]}
            onChange={() => toggleVisibility(option.key)}
          />
          <span
            className="sv-color-swatch"
            style={{ backgroundColor: option.color }}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function App() {
  return (
    <div className="App">
      {/* <div className="container">
        <div className="row">
          <div className="col">
            <h1 className="my-5">Scanner output visualization</h1>
            <Uploader></Uploader>
          </div>
        </div>
      </div> */}

      <div id="overlay">
        <div id="overlay-text"><i className="fas fa fa-spin fa-spinner mr-1"></i>Loading data</div>
      </div>

      <div className="container mt-5">
        <h2 id="variant-view" className="text-center">
          HiScanner output visualization
        </h2>
        <CnvTable />

        <div className="h3 mt-5" id="sec:visualization">
          Interactive visualization
        </div>
        <div className="row mt-4">
          <div className="col-md-3 ">
            <div className="border p-2 mt-3">
              <Facets />
            </div>
            <WakhanVisibilityControls />
            <SvVisibilityControls />
          </div>
          <div className="col-md-9">
            <div className="fixedHeight">
              <HiglassBrowser />
            </div>
          </div>
        </div>
        <div className="py-5"></div>
      </div>
      <div className="container-fluid bg-light mt-5 py-4 text-center">
        <div className="mb-1">
          For support or questions, please open an issue on our{" "}
          <a href="https://github.com/parklab/hiscanner">GitHub repository</a>.
        </div>
      </div>
    </div>
  );
}

export default App;
