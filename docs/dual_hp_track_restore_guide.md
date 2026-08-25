# ViScanner Dual HP-1 / HP-2 Structural Variation Track Restore Guide

This document explains the architecture of the Structural Variation (SV) breakpoint tracks in ViScanner and provides step-by-step instructions on how to switch between **Single Unified Track Mode** (active default) and **Dual HP-1 / HP-2 Track Mode** (legacy backup).

---

## 1. Background & Modes

### Active Mode: Single Unified "Breakpoints" Plot (`enableHp2SvTrack: false`)
- **Top Track (`wakhan-sv-track`)**: Displays all structural variants (`HP-1`, `HP-2`, and `unphased`) simultaneously as upward arcs from the bottom baseline, labeled as **"Breakpoints"**.
- **Middle Track (`wakhan-coverage-track`)**: Displays mirrored copy numbers and coverage with **full-height** vertical dashed breakpoint marker lines spanning both sections.
- **Bottom Track (`wakhan-hp-sv-track`)**: Disabled and omitted from the active layout and UI.
- **Sidebar**: Features a single clean checkbox labeled **"Breakpoints plot"** to show or collapse the top track.

### Legacy Mode: Dual Phased SV Tracks (`enableHp2SvTrack: true`)
- **Top Track (`wakhan-sv-track`)**: Displays `HP-1` phased variants curving upward, labeled **"HP-1 breakpoints"**.
- **Middle Track (`wakhan-coverage-track`)**: Displays mirrored copy numbers and coverage with **half-height** vertical lines (`HP-1` on top, `HP-2` on bottom).
- **Bottom Track (`wakhan-hp-sv-track`)**: Displays `HP-2` phased variants curving downward, labeled **"HP-2 breakpoints"**.
- **Sidebar**: Features the **"Phased HP2 SV's plot"** checkbox to toggle the bottom track.

---

## 2. How to Re-Enable the Dual HP-1 / HP-2 Tracks

All the code and rendering mechanisms for the dual-track system are preserved in the codebase. To restore the bottom HP-2 track and dual-track controls:

1. Open [`src/defaultSettings.js`](file:///d:/internship/ViScanner/src/defaultSettings.js).
2. Change `enableHp2SvTrack` from `false` to `true`:

```diff
 export const DEFAULT_SETTINGS = {
   // =========================================================================
   // 2. STRUCTURAL VARIATION (SV) PLOTS & REGION OVERLAYS
   // =========================================================================
-  enableHp2SvTrack: false,
+  enableHp2SvTrack: true,

   showSvTrack: true,             // Top Breakpoints / Structural Variations plot
   showHpSvTrack: true,           // Legacy bottom HP-2 SV track
```

3. Save the file. The app will automatically initialize both tracks on the next page load or data upload.

---

## 3. How the Feature Flag Works Under the Hood

When `enableHp2SvTrack` is toggled:
- **`src/HiglassBrowser.js`**: `getInitializedViewConfig()` inspects `DEFAULT_SETTINGS.enableHp2SvTrack`.
  - When `false`: Dynamically filters out `wakhan-hp-sv-track` and sets `wakhan-sv-track`'s `hpFilter` to `null` (rendering all SVs in one track).
  - When `true`: Keeps both `wakhan-sv-track` (`hpFilter: "1"`) and `wakhan-hp-sv-track` (`hpFilter: "2"`) in the top track array.
- **`src/App.js`**: `SvVisibilityControls` automatically renders `"Breakpoints plot"` when `false`, or `"Phased HP2 SV's plot"` when `true`.
- **`src/WakhanCoverageTrack.js`**: `drawSvBreakpoints()` automatically draws full-height lines when `false`, or half-height per-HP lines when `true`.
- **`src/Uploader.js`**: Safely routes variant data to active tracks.
