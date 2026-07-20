import React from "react";
import "./App.css";
import { Facets } from "./Facets";
import "bootstrap/dist/css/bootstrap.min.css";
import { HiglassBrowser } from "./HiglassBrowser";
import { CnvTable } from "./CnvTable";
import { fitToContent, scheduleFitToContent } from "./higlassLayout";

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
const DEFAULT_SHOW_HP_SV_TRACK = true;
const DEFAULT_SHOW_SV_LINES_IN_COPY_NUMBER = true;
const DEFAULT_MAX_SV_SPAN = 0;

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
    scheduleFitToContent();
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
    ["wakhan-sv-track", "wakhan-hp-sv-track"].forEach((trackUid) => {
      const svTrack = hgc.api.getTrackObject("aa", trackUid);
      if (svTrack && svTrack.setVisibilityOptions) {
        svTrack.setVisibilityOptions(options);
      }
    });
    scheduleFitToContent();
  } catch (error) {
    return;
  }
}

function updateCoverageSvVisibility(options) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api) {
    return;
  }

  try {
    const wakhanTrack = hgc.api.getTrackObject("aa", "wakhan-coverage-track");
    if (wakhanTrack && wakhanTrack.setVisibilityOptions) {
      wakhanTrack.setVisibilityOptions(options);
    }
    scheduleFitToContent();
  } catch (error) {
    return;
  }
}

function updateHpSvTrackVisibility(showTrack) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api) {
    return;
  }

  try {
    fitToContent({
      resetLocation: showTrack,
      preserveLocation: !showTrack,
      trackOptionsByUid: {
        "wakhan-hp-sv-track": { showTrack },
      },
    }).then(() => {
      const hpSvTrack = hgc.api.getTrackObject("aa", "wakhan-hp-sv-track");
      if (hpSvTrack && hpSvTrack.setVisibilityOptions) {
        hpSvTrack.setVisibilityOptions({ showTrack });
      }
      scheduleFitToContent();
    });
  } catch (error) {
    console.error("Error in updateHpSvTrackVisibility:", error);
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
  const [showHpSvTrack, setShowHpSvTrack] = React.useState(DEFAULT_SHOW_HP_SV_TRACK);
  const [showSvLinesInCopyNumber, setShowSvLinesInCopyNumber] = React.useState(
    DEFAULT_SHOW_SV_LINES_IN_COPY_NUMBER
  );
  const [maxSvSpan, setMaxSvSpan] = React.useState(DEFAULT_MAX_SV_SPAN);

  const handleMaxSvSpanChange = (e) => {
    const value = e.target.value;
    if (value === "") {
      setMaxSvSpan("");
      return;
    }
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0) {
      setMaxSvSpan(parsed);
    }
  };

  React.useEffect(() => {
    const maxLen = maxSvSpan === "" || maxSvSpan === 0 ? null : maxSvSpan;
    updateSvTrackVisibility({ visibleTypes: visibility, svMode, maxVariantLength: maxLen });
    updateCoverageSvVisibility({
      visibleTypes: visibility,
      svMode,
      showSvBreakpoints: showSvLinesInCopyNumber,
      maxVariantLength: maxLen,
    });
  }, [visibility, svMode, showSvLinesInCopyNumber, maxSvSpan]);

  React.useEffect(() => {
    updateHpSvTrackVisibility(showHpSvTrack);
  }, [showHpSvTrack]);

  const toggleVisibility = (key) => {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="wakhan-visibility border p-2 mt-3">
      <div className="wakhan-visibility-title">SV visibility</div>
      <div className="sv-control-section">
        <div className="sv-control-section-title">SV source</div>
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
      <div className="sv-control-section">
        <div className="sv-control-section-title">SV displays</div>
        <label className="wakhan-visibility-option">
          <input
            type="checkbox"
            checked={showHpSvTrack}
            onChange={() => setShowHpSvTrack((current) => !current)}
          />
          <span>HP2 SV plot</span>
        </label>
        <label className="wakhan-visibility-option">
          <input
            type="checkbox"
            checked={showSvLinesInCopyNumber}
            onChange={() => setShowSvLinesInCopyNumber((current) => !current)}
          />
          <span>SV lines in copy-number plot</span>
        </label>
      </div>
      <div className="sv-control-section">
        <div className="sv-control-section-title">SV types</div>
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
      <div className="sv-control-section">
        <div className="sv-control-section-title">SV min span</div>
        <div className="sv-max-span-input">
          <input
            type="number"
            className="form-control form-control-sm"
            value={maxSvSpan}
            onChange={handleMaxSvSpanChange}
            min="0"
            step="10000"
            placeholder="e.g. 50000"
          />
          <span className="sv-max-span-unit">bp</span>
        </div>
        <div className="sv-max-span-hint">0 or empty = no limit</div>
      </div>
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

      <div className="container-fluid px-4 mt-5">
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
            <div className="fixedHeight" id="higlass-container">
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
