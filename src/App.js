import React from "react";
import "./App.css";
import { Facets } from "./Facets";
import "bootstrap/dist/css/bootstrap.min.css";
import { HiglassBrowser } from "./HiglassBrowser";
import { CnvTable } from "./CnvTable";
import { fitToContent, scheduleFitToContent } from "./higlassLayout";
import { LABELS, SV_CONFIG, UI_COLORS } from "./labelsConfig";
import { DEFAULT_SETTINGS } from "./defaultSettings";

const DEFAULT_WAKHAN_VISIBILITY = {
  showHp1: DEFAULT_SETTINGS.showHp1 ?? false,
  showHp2: DEFAULT_SETTINGS.showHp2 ?? false,
  showCoverage: DEFAULT_SETTINGS.showCoveragePoints ?? false,
};

const SV_TYPE_OPTIONS = Object.keys(SV_CONFIG.TYPE_COLORS).map((key) => ({
  key,
  label: key,
  color: SV_CONFIG.TYPE_COLORS[key],
}));

const DEFAULT_SV_VISIBILITY = SV_TYPE_OPTIONS.reduce((visibility, option) => {
  visibility[option.key] = DEFAULT_SETTINGS.svTypes?.[option.key] ?? false;
  return visibility;
}, {});
const DEFAULT_SV_MODE = DEFAULT_SETTINGS.svMode ?? "matched";
const ENABLE_HP2_SV_TRACK = DEFAULT_SETTINGS.enableHp2SvTrack === true;
const DEFAULT_SHOW_SV_TRACK = DEFAULT_SETTINGS.showSvTrack ?? true;
const DEFAULT_SHOW_HP_SV_TRACK = DEFAULT_SETTINGS.showHpSvTrack ?? false;
const DEFAULT_SHOW_SV_LINES_IN_COPY_NUMBER = DEFAULT_SETTINGS.showSvLinesInCopyNumber ?? false;
const DEFAULT_SHOW_MASKED_REGIONS = DEFAULT_SETTINGS.showMaskedRegions ?? false;
const DEFAULT_SHOW_LOH_REGIONS = DEFAULT_SETTINGS.showLohRegions ?? false;
const DEFAULT_MAX_SV_SPAN = DEFAULT_SETTINGS.maxSvSpan ?? 0;

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

export function updateSingleSvTrackVisibility(showTrack) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api || typeof hgc.api.getViewConfig !== "function") {
    return;
  }

  try {
    const viewconf = hgc.api.getViewConfig();
    if (!viewconf || !viewconf.views || !viewconf.views.length) {
      return;
    }
    const targetHeight = showTrack ? 90 : 1;
    fitToContent({
      resetLocation: showTrack,
      preserveLocation: !showTrack,
      trackOptionsByUid: {
        "wakhan-sv-track": {
          showTrack,
          height: targetHeight,
          expandedHeight: 90,
          layoutHeight: 90,
        },
      },
    })
      .then(() => {
        const svTrack = hgc.api.getTrackObject("aa", "wakhan-sv-track");
        if (svTrack && svTrack.setVisibilityOptions) {
          svTrack.setVisibilityOptions({
            showTrack,
            height: targetHeight,
            expandedHeight: 90,
          });
        }
        scheduleFitToContent();
      })
      .catch((err) => {
        console.warn("fitToContent caught error silently:", err);
      });
  } catch (error) {
    console.warn("Error in updateSingleSvTrackVisibility:", error);
    return;
  }
}
if (typeof window !== "undefined") {
  window.updateSingleSvTrackVisibility = updateSingleSvTrackVisibility;
}

export function updateHpSvTrackVisibility(showTrack) {
  const hgc = window.hgc && window.hgc.current;
  if (!hgc || !hgc.api || typeof hgc.api.getViewConfig !== "function") {
    return;
  }

  try {
    const viewconf = hgc.api.getViewConfig();
    if (!viewconf || !viewconf.views || !viewconf.views.length) {
      return;
    }
    const targetHeight = showTrack ? 90 : 1;
    fitToContent({
      resetLocation: showTrack,
      preserveLocation: !showTrack,
      trackOptionsByUid: {
        "wakhan-hp-sv-track": {
          showTrack,
          height: targetHeight,
          expandedHeight: 90,
          layoutHeight: 90,
        },
      },
    })
      .then(() => {
        const hpSvTrack = hgc.api.getTrackObject("aa", "wakhan-hp-sv-track");
        if (hpSvTrack && hpSvTrack.setVisibilityOptions) {
          hpSvTrack.setVisibilityOptions({
            showTrack,
            height: targetHeight,
            expandedHeight: 90,
          });
        }
        scheduleFitToContent();
      })
      .catch((err) => {
        console.warn("fitToContent caught error silently:", err);
      });
  } catch (error) {
    console.warn("Error in updateHpSvTrackVisibility:", error);
    return;
  }
}
if (typeof window !== "undefined") {
  window.updateHpSvTrackVisibility = updateHpSvTrackVisibility;
}

function WakhanVisibilityControls() {
  const [visibility, setVisibility] = React.useState(DEFAULT_WAKHAN_VISIBILITY);

  React.useEffect(() => {
    const handleReset = () => setVisibility({ ...DEFAULT_WAKHAN_VISIBILITY });
    window.addEventListener("viscanner:reset-defaults", handleReset);
    return () => window.removeEventListener("viscanner:reset-defaults", handleReset);
  }, []);

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
      <div className="wakhan-visibility-title">{LABELS.wakhanVisibility.panelTitle}</div>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showHp1}
          onChange={() => toggleVisibility("showHp1")}
        />
        <span>{LABELS.wakhanVisibility.hp1Plot}</span>
      </label>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showHp2}
          onChange={() => toggleVisibility("showHp2")}
        />
        <span>{LABELS.wakhanVisibility.hp2Plot}</span>
      </label>
      <label className="wakhan-visibility-option">
        <input
          type="checkbox"
          checked={visibility.showCoverage}
          onChange={() => toggleVisibility("showCoverage")}
        />
        <span>{LABELS.wakhanVisibility.coveragePoints}</span>
      </label>
    </div>
  );
}

function SvVisibilityControls() {
  const [visibility, setVisibility] = React.useState(DEFAULT_SV_VISIBILITY);
  const [svMode, setSvMode] = React.useState(DEFAULT_SV_MODE);
  const [showSvTrack, setShowSvTrack] = React.useState(DEFAULT_SHOW_SV_TRACK);
  const [showHpSvTrack, setShowHpSvTrack] = React.useState(DEFAULT_SHOW_HP_SV_TRACK);
  const [showSvLinesInCopyNumber, setShowSvLinesInCopyNumber] = React.useState(
    DEFAULT_SHOW_SV_LINES_IN_COPY_NUMBER
  );
  const [showMaskedRegions, setShowMaskedRegions] = React.useState(
    DEFAULT_SHOW_MASKED_REGIONS
  );
  const [showLohRegions, setShowLohRegions] = React.useState(
    DEFAULT_SHOW_LOH_REGIONS
  );
  const [maxSvSpan, setMaxSvSpan] = React.useState(DEFAULT_MAX_SV_SPAN);

  React.useEffect(() => {
    const handleReset = () => {
      setVisibility({ ...DEFAULT_SV_VISIBILITY });
      setSvMode(DEFAULT_SV_MODE);
      setShowSvTrack(DEFAULT_SHOW_SV_TRACK);
      setShowHpSvTrack(DEFAULT_SHOW_HP_SV_TRACK);
      setShowSvLinesInCopyNumber(DEFAULT_SHOW_SV_LINES_IN_COPY_NUMBER);
      setShowMaskedRegions(DEFAULT_SHOW_MASKED_REGIONS);
      setShowLohRegions(DEFAULT_SHOW_LOH_REGIONS);
      setMaxSvSpan(DEFAULT_MAX_SV_SPAN);
    };
    window.addEventListener("viscanner:reset-defaults", handleReset);
    return () => window.removeEventListener("viscanner:reset-defaults", handleReset);
  }, []);

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
      showMaskedRegions,
      showLohRegions,
      maxVariantLength: maxLen,
    });
  }, [visibility, svMode, showSvLinesInCopyNumber, showMaskedRegions, showLohRegions, maxSvSpan]);

  React.useEffect(() => {
    if (ENABLE_HP2_SV_TRACK) {
      updateHpSvTrackVisibility(showHpSvTrack);
    } else {
      updateSingleSvTrackVisibility(showSvTrack);
    }
  }, [showSvTrack, showHpSvTrack]);

  const toggleVisibility = (key) => {
    setVisibility((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  return (
    <div className="wakhan-visibility border p-2 mt-3">
      <div className="wakhan-visibility-title">{LABELS.svVisibility.panelTitle}</div>
      <div className="sv-control-section">
        <div className="sv-control-section-title">{LABELS.svVisibility.sourceTitle}</div>
        <label className="wakhan-visibility-option">
          <input
            type="radio"
            name="sv-filter-mode"
            checked={svMode === "matched"}
            onChange={() => setSvMode("matched")}
          />
          <span>{LABELS.svVisibility.bedMatchedSvs}</span>
        </label>
        <label className="wakhan-visibility-option">
          <input
            type="radio"
            name="sv-filter-mode"
            checked={svMode === "all"}
            onChange={() => setSvMode("all")}
          />
          <span>{LABELS.svVisibility.allVcfSvs}</span>
        </label>
      </div>
      <div className="sv-control-section">
        <div className="sv-control-section-title">{LABELS.svVisibility.displaysTitle}</div>
        {ENABLE_HP2_SV_TRACK ? (
          <label className="wakhan-visibility-option">
            <input
              type="checkbox"
              checked={showHpSvTrack}
              onChange={() => setShowHpSvTrack((current) => !current)}
            />
            <span>{LABELS.svVisibility.hp2SvPlot}</span>
          </label>
        ) : (
          <label className="wakhan-visibility-option">
            <input
              type="checkbox"
              checked={showSvTrack}
              onChange={() => setShowSvTrack((current) => !current)}
            />
            <span>{LABELS.svVisibility.svTrackPlot || "Breakpoints plot"}</span>
          </label>
        )}
        <label className="wakhan-visibility-option">
          <input
            type="checkbox"
            checked={showSvLinesInCopyNumber}
            onChange={() => setShowSvLinesInCopyNumber((current) => !current)}
          />
          <span>{LABELS.svVisibility.svLinesInCopyNumber}</span>
        </label>
        <label className="wakhan-visibility-option">
          <input
            type="checkbox"
            checked={showMaskedRegions}
            onChange={() => setShowMaskedRegions((current) => !current)}
          />
          <span>{LABELS.svVisibility.maskedRegionsInCopyNumber}</span>
        </label>
        <label className="wakhan-visibility-option">
          <input
            type="checkbox"
            checked={showLohRegions}
            onChange={() => setShowLohRegions((current) => !current)}
          />
          <span>{LABELS.svVisibility.lohRegionsInCopyNumber}</span>
        </label>
      </div>
      <div className="sv-control-section">
        <div className="sv-control-section-title">{LABELS.svVisibility.typesTitle}</div>
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
        <div className="sv-control-section-title">{LABELS.svVisibility.minSpanTitle}</div>
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
          <span className="sv-max-span-unit">{LABELS.svVisibility.minSpanUnit}</span>
        </div>
        <div className="sv-max-span-hint">{LABELS.svVisibility.minSpanHint}</div>
      </div>
    </div>
  );
}

function SampleLegendBanner() {
  const [metadata, setMetadata] = React.useState(() => {
    if (typeof window !== "undefined" && window._viscannerSampleMetadata) {
      return window._viscannerSampleMetadata;
    }
    return {
      sample_name: "1437_merged",
      ploidy: "2.57",
      purity: "0.65",
      confidence: "0.86",
    };
  });

  React.useEffect(() => {
    const handleUpdate = (e) => {
      if (e && e.detail) {
        setMetadata(e.detail);
      }
    };
    window.addEventListener("viscanner:sample-metadata-updated", handleUpdate);
    return () => {
      window.removeEventListener("viscanner:sample-metadata-updated", handleUpdate);
    };
  }, []);

  const svBadges = [
    { label: "DEL", color: "#D90429" },
    { label: "INV", color: "#3A0CA3" },
    { label: "INS", color: "#B58403" },
    { label: "BND", color: "#212529" },
    { label: "DUP", color: "#15803D" },
    { label: "LOH", color: "#2D7DD2" },
  ];

  return (
    <div className="sample-legend-banner text-center py-2 px-3 mb-2 bg-white border rounded shadow-sm">
      {/* Sample ID Title */}
      <div className="fw-bold mb-1" style={{ color: "#D90429", fontSize: "17px" }}>
        {metadata.sample_name || "1437_merged"}
      </div>

      {/* QC Metrics Row */}
      <div className="mb-2" style={{ fontSize: "13px", fontWeight: "600" }}>
        <span style={{ color: "#2D7DD2" }}>
          Ploidy: <span style={{ color: "#D90429" }}>{metadata.ploidy ?? "2.57"}</span>
        </span>
        <span className="mx-3" style={{ color: "#2D7DD2" }}>
          Purity: <span style={{ color: "#D90429" }}>{metadata.purity ?? "0.65"}</span>
        </span>
        <span style={{ color: "#2D7DD2" }}>
          Confidence: <span style={{ color: "#D90429" }}>{metadata.confidence ?? "0.86"}</span>
        </span>
      </div>

      {/* Legend Dots & Lines */}
      <div className="d-flex flex-wrap justify-content-center align-items-center mb-2" style={{ fontSize: "12px", color: "#555", gap: "14px" }}>
        <span className="d-inline-flex align-items-center">
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#B23A48", marginRight: "5px" }}></span>
          HP-1
        </span>
        <span className="d-inline-flex align-items-center">
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#2D7DD2", marginRight: "5px" }}></span>
          HP-2
        </span>
        <span className="d-inline-flex align-items-center">
          <span style={{ display: "inline-block", width: "10px", height: "10px", borderRadius: "50%", backgroundColor: "#9A9D32", marginRight: "5px" }}></span>
          BAF
        </span>
        <span className="d-inline-flex align-items-center">
          <span style={{ display: "inline-block", width: "16px", height: "3px", backgroundColor: "#B23A48", marginRight: "5px" }}></span>
          HP-1
        </span>
        <span className="d-inline-flex align-items-center">
          <span style={{ display: "inline-block", width: "16px", height: "3px", backgroundColor: "#2D7DD2", marginRight: "5px" }}></span>
          HP-2
        </span>
      </div>

      {/* Horizontal SV Type Badges */}
      <div className="d-flex flex-wrap justify-content-center align-items-center" style={{ gap: "10px" }}>
        {svBadges.map((badge) => (
          <span
            key={badge.label}
            style={{
              backgroundColor: badge.color,
              color: "#ffffff",
              fontWeight: "bold",
              fontSize: "11px",
              padding: "2px 8px",
              borderRadius: "3px",
              display: "inline-block",
              letterSpacing: "0.5px",
            }}
          >
            {badge.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function App() {
  return (
    <div className="App">
      <div id="overlay">
        <div id="overlay-text"><i className="fas fa fa-spin fa-spinner mr-1"></i>{LABELS.loadingOverlay}</div>
      </div>

      <div className="container-fluid px-4 mt-5">
        <h2 id="variant-view" className="text-center" style={{ color: UI_COLORS.appTitleColor }}>
          {LABELS.appTitle}
        </h2>
        <CnvTable />

        <div className="h3 mt-5" id="sec:visualization" style={{ color: UI_COLORS.visualizationSectionTitleColor }}>
          {LABELS.visualizationSectionTitle}
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
            <SampleLegendBanner />
            <div className="fixedHeight" id="higlass-container">
              <HiglassBrowser />
            </div>
          </div>
        </div>
        <div className="py-5"></div>
      </div>
      <div className="container-fluid bg-light mt-5 py-4 text-center">
        <div className="mb-1" style={{ fontSize: "14px" }}>
          {LABELS.footer.text}
          <a
            href={LABELS.footer.originalRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fw-bold mx-1"
          >
            {LABELS.footer.originalRepoText}
          </a>
          {" or "}
          <a
            href={LABELS.footer.wakhanRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="fw-bold mx-1"
          >
            {LABELS.footer.wakhanRepoText}
          </a>
          .
        </div>
      </div>
    </div>
  );
}

export default App;
