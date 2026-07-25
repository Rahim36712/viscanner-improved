import initialViewConfig from "./viewConfig.json";

const DEFAULT_VIEW_UID = "aa";
const HIGLASS_CONTAINER_ID = "higlass-container";
const MIN_CONTAINER_HEIGHT = 500;
const VIEW_CHROME_HEIGHT = 49;
const DEFAULT_TRACK_HEIGHT = 1;
const DEFAULT_LAYOUT_SPACING = 0;

let scheduledFit = null;

function cloneConfig(config) {
  return JSON.parse(JSON.stringify(config));
}

function numericValue(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function positiveValue(value, fallback) {
  return Math.max(0, numericValue(value, fallback));
}

function getHiglassApi() {
  return window.hgc && window.hgc.current && window.hgc.current.api;
}

function getContainer() {
  return document.getElementById(HIGLASS_CONTAINER_ID);
}

function isLayoutVisible(track) {
  if (!track) {
    return false;
  }

  const options = track.options || {};
  return (
    track.hidden !== true &&
    options.hidden !== true &&
    options.visible !== false &&
    options.showTrack !== false
  );
}

function expandedTrackHeight(track) {
  const options = track.options || {};
  return Math.max(
    DEFAULT_TRACK_HEIGHT,
    positiveValue(
      options.layoutHeight,
      positiveValue(
        options.expandedHeight,
        positiveValue(track.defaultHeight, positiveValue(track.height, DEFAULT_TRACK_HEIGHT))
      )
    )
  );
}

function collapsedTrackHeight(track) {
  const options = track.options || {};
  return positiveValue(
    options.collapsedHeight,
    positiveValue(options.layoutCollapsedHeight, 0)
  );
}

function layoutHeightForTrack(track) {
  return isLayoutVisible(track) ? expandedTrackHeight(track) : collapsedTrackHeight(track);
}

function moveTrackAfterUid(tracks, trackUid, afterUid) {
  const fromIndex = tracks.findIndex((track) => track.uid === trackUid);
  const afterIndex = tracks.findIndex((track) => track.uid === afterUid);
  if (fromIndex < 0 || afterIndex < 0 || fromIndex === afterIndex + 1) {
    return;
  }

  const [track] = tracks.splice(fromIndex, 1);
  const nextAfterIndex = tracks.findIndex((candidate) => candidate.uid === afterUid);
  tracks.splice(nextAfterIndex + 1, 0, track);
}

function normalizeTrackOrder(tracks) {
  if (!Array.isArray(tracks)) {
    return [];
  }

  tracks.forEach((track) => {
    const afterUid = track.options && track.options.layoutAfterUid;
    if (track.uid && afterUid) {
      moveTrackAfterUid(tracks, track.uid, afterUid);
    }
  });
  return tracks;
}

function calculatePositionedTracks(tracks, spacing = DEFAULT_LAYOUT_SPACING) {
  let currentY = 0;
  const trackOffsets = {};

  tracks.forEach((track, index) => {
    const height = layoutHeightForTrack(track);
    const key = track.uid || `${track.type || "track"}-${index}`;
    trackOffsets[key] = {
      height,
      visible: isLayoutVisible(track),
      y: currentY,
    };
    currentY += height + spacing;
  });

  return {
    trackAreaHeight: Math.max(0, currentY - (tracks.length ? spacing : 0)),
    trackOffsets,
  };
}

function summarizeViewLayout(view) {
  const topTracks = normalizeTrackOrder((view.tracks && view.tracks.top) || []);
  const centerTracks = normalizeTrackOrder((view.tracks && view.tracks.center) || []);
  const bottomTracks = normalizeTrackOrder((view.tracks && view.tracks.bottom) || []);
  const positioned = calculatePositionedTracks(
    topTracks.concat(centerTracks, bottomTracks)
  );
  const totalHeight = Math.max(
    MIN_CONTAINER_HEIGHT,
    positioned.trackAreaHeight + VIEW_CHROME_HEIGHT
  );

  return {
    bottomPadding: VIEW_CHROME_HEIGHT,
    clipHeight: totalHeight,
    coverageTrackY: positioned.trackOffsets["wakhan-coverage-track"]?.y,
    geneTrackY: positioned.trackOffsets["OHJakQICQD6gTD7skx4EWA"]?.y,
    hp1TrackY: positioned.trackOffsets["wakhan-coverage-track"]?.y,
    hp2TrackY: positioned.trackOffsets["wakhan-hp-sv-track"]?.y,
    phaseTrackY: positioned.trackOffsets["scanner-result-track-1"]?.y,
    topPadding: 0,
    totalHeight,
    trackAreaHeight: positioned.trackAreaHeight,
    trackOffsets: positioned.trackOffsets,
  };
}

export function calculateLayout(viewConfig) {
  const views = Array.isArray(viewConfig?.views) ? viewConfig.views : [viewConfig];
  const viewLayouts = views.filter(Boolean).map(summarizeViewLayout);
  const firstLayout = viewLayouts[0] || {
    clipHeight: 0,
    totalHeight: MIN_CONTAINER_HEIGHT,
    trackAreaHeight: 0,
    trackOffsets: {},
  };

  return {
    ...firstLayout,
    totalHeight: Math.max(...viewLayouts.map((layout) => layout.totalHeight), MIN_CONTAINER_HEIGHT),
    viewLayouts,
  };
}

function applyTrackOptions(viewConfig, trackOptionsByUid = {}) {
  const allTrackGroups = (viewConfig.views || [])
    .flatMap((view) => Object.values(view.tracks || {}))
    .filter(Array.isArray);

  allTrackGroups.forEach((tracks) => {
    tracks.forEach((track) => {
      const nextOptions = trackOptionsByUid[track.uid];
      if (!nextOptions) {
        return;
      }
      track.options = {
        ...(track.options || {}),
        ...nextOptions,
      };
    });
  });
}

function applyLayoutToViewConfig(viewConfig, actualHeight) {
  (viewConfig.views || []).forEach((view) => {
    let baseTotalHeight = 0;
    const visibleTracks = [];

    ["top", "center", "bottom"].forEach((position) => {
      const tracks = view.tracks && view.tracks[position];
      if (!Array.isArray(tracks)) {
        return;
      }

      normalizeTrackOrder(tracks);
      tracks.forEach((track) => {
        const height = layoutHeightForTrack(track);
        if (isLayoutVisible(track)) {
          baseTotalHeight += height;
          visibleTracks.push({ track, baseHeight: height });
        } else {
          track.height = height;
        }
      });
    });

    const targetTrackAreaHeight = actualHeight
      ? Math.max(baseTotalHeight, actualHeight - VIEW_CHROME_HEIGHT)
      : baseTotalHeight;
    const scale = targetTrackAreaHeight / Math.max(1, baseTotalHeight);

    visibleTracks.forEach(({ track, baseHeight }) => {
      track.height = Math.round(baseHeight * scale);
    });
  });
}

function resizeSvgLayers(layout) {
  const container = getContainer();
  if (!container) {
    return;
  }

  const width = Math.max(1, container.clientWidth || container.offsetWidth || 1);
  container
    .querySelectorAll("svg.higlass-svg")
    .forEach((svg) => {
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(layout.totalHeight));
      svg.setAttribute("viewBox", `0 0 ${width} ${layout.totalHeight}`);
      svg.querySelectorAll("clipPath rect").forEach((rect) => {
        rect.setAttribute("height", String(layout.clipHeight));
      });
    });
}

function resizeContainer(layout) {
  const container = getContainer();
  if (!container) {
    return;
  }

  container.style.height = `${layout.totalHeight}px`;
  container.dataset.layoutHeight = String(layout.totalHeight);
  resizeSvgLayers(layout);
}

function dispatchResize(layout) {
  window.__viscannerApplyingLayout = true;
  window.dispatchEvent(new Event("resize"));
  window.requestAnimationFrame(() => {
    resizeSvgLayers(layout);
    window.dispatchEvent(new Event("resize"));
    window.setTimeout(() => {
      window.__viscannerApplyingLayout = false;
    }, 100);
  });
}

function defaultDomainsForView(viewUid) {
  const view = initialViewConfig.viewConfig.views.find((candidate) => candidate.uid === viewUid);
  return {
    xDomain: view?.initialXDomain,
    yDomain: view?.initialYDomain,
  };
}

function zoomToDefaultLocation(api, viewUid) {
  const domains = defaultDomainsForView(viewUid);
  if (!domains.xDomain || !domains.yDomain) {
    return;
  }

  api.zoomTo(
    viewUid,
    domains.xDomain[0],
    domains.xDomain[1],
    domains.yDomain[0],
    domains.yDomain[1],
    0
  );
}

export function fitToContent(options = {}) {
  const api = getHiglassApi();
  if (!api) {
    return Promise.resolve(null);
  }

  let currentConfig;
  try {
    currentConfig = api.getViewConfig();
  } catch (error) {
    return Promise.resolve(null);
  }

  const viewUid = options.viewUid || currentConfig.views?.[0]?.uid || DEFAULT_VIEW_UID;
  
  const container = getContainer();
  const gridItem = container ? container.querySelector(".react-grid-item") : null;
  const actualHeight = gridItem ? gridItem.offsetHeight : null;

  const previousLocation =
    options.resetLocation || options.preserveLocation === false
      ? null
      : api.getLocation(viewUid);
  const nextConfig = cloneConfig(currentConfig);

  applyTrackOptions(nextConfig, options.trackOptionsByUid);
  applyLayoutToViewConfig(nextConfig, actualHeight);

  const layout = calculateLayout(nextConfig);
  resizeContainer(layout);

  const refresh = () => {
    dispatchResize(layout);
    if (options.resetLocation) {
      zoomToDefaultLocation(api, viewUid);
    } else if (previousLocation && previousLocation.xDomain && previousLocation.yDomain) {
      api.zoomTo(
        viewUid,
        previousLocation.xDomain[0],
        previousLocation.xDomain[1],
        previousLocation.yDomain[0],
        previousLocation.yDomain[1],
        0
      );
    }
    dispatchResize(layout);
    return layout;
  };

  try {
    const result = api.setViewConfig(nextConfig, true);
    if (result && typeof result.then === "function") {
      return result.then(refresh);
    }
  } catch (error) {
    return Promise.resolve(null);
  }

  return Promise.resolve(refresh());
}

export function scheduleFitToContent(options = {}) {
  const delay = numericValue(options.delay, 80);
  const nextOptions = { ...options };
  delete nextOptions.delay;

  if (scheduledFit !== null) {
    window.clearTimeout(scheduledFit);
  }

  scheduledFit = window.setTimeout(() => {
    scheduledFit = null;
    fitToContent(nextOptions);
  }, delay);
}

export function resetHiglassView() {
  return fitToContent({ resetLocation: true, preserveLocation: false });
}
