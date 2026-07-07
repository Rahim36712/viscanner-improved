# ViScanner WAKHAN Integration Handoff README

This document summarizes what has been done to the ViScanner app during the WAKHAN/Severus integration work. It is intended as a handoff for another LLM or engineer so they can understand the current state without reading the full chat.

## Current Repo State

- Workspace: `D:\internship\ViScanner`
- Branch: `wakhan-hp-tracks`
- Remote branch shown locally: `improved/wakhan-hp-tracks`
- Current local changes are **not pushed**.
- Current uncommitted files at the time this README was written:
  - `dist/bundle.js`
  - `src/App.js`
  - `src/Uploader.js`
  - `src/WakhanCoverageTrack.js`
  - `src/WakhanStructuralVariationTrack.js`
  - `src/viewConfig.json`
- Build command used for verification:

```powershell
npx webpack --mode production
```

Build has passed repeatedly. The only warnings are existing webpack bundle-size warnings.

## Main Input Files

The WAKHAN-style upload expects these files, usually inside a real `.zip`:

```text
2009_2.36_0.97_0.8_copynumbers_segments_HP_1.bed
2009_2.36_0.97_0.8_copynumbers_segments_HP_2.bed
phase_corrected_coverage.csv
baf.csv
severus_somatic.vcf
```

Known working test zip:

```text
D:\internship\files\files-valid.zip
```

Important note: an earlier `files.zip` was actually a RAR archive renamed as `.zip`; its signature started with `Rar!`. ViScanner now detects this and shows a clear error instead of crashing. The app can also accept raw `.bed`, `.csv`, `.vcf`, and `.txt` files directly.

## WAKHAN Table Browser

The original HiScanner table was extended to support WAKHAN segment rows.

For WAKHAN uploads, the table now shows:

```text
Chrom
Start
End
HP1 coverage
HP1 CN
HP1 confidence
HP2 coverage
HP2 CN
HP2 confidence
Total CN
SV breakpoint IDs
Inspect region
```

The table is populated from the two HP BED files:

```text
*_copynumbers_segments_HP_1.bed
*_copynumbers_segments_HP_2.bed
```

The BED column `svs_breakpoints_ids` is preserved in the table and is later used for SV filtering.

Clicking the eye icon in `Inspect region` zooms HiGlass to the segment region.

## BAF Plot Changes

The B-allele frequency plot was changed to look more like WAKHAN:

- Phased BAF is colored olive/green.
- Y-axis range is `0` to `0.6`.
- Alternating grey/white chromosome background bands were added.
- The BAF track remains the existing scanner result track with WAKHAN-specific styling.

## HP1/HP2 Coverage Plot

A custom track was added:

```text
src/WakhanCoverageTrack.js
```

Track UID:

```text
wakhan-coverage-track
```

Purpose:

- Show HP1 and HP2 in one WAKHAN-like mirrored coverage plot.
- HP1 is above the center line.
- HP2 is below the center line.
- Left axis shows coverage depth.
- Right axis shows integer copy-number states.
- Alternating chromosome bands match the WAKHAN visual style.

### Visibility Controls

The sidebar has a `WAKHAN visibility` box with:

```text
HP1 plot
HP2 plot
Coverage points
```

These update immediately when checked/unchecked.

### Current Coverage/CN Scaling Logic

The professor requested that coverage be shown with respect to copy-number state.

Current implementation:

1. Coverage bins come from:

```text
phase_corrected_coverage.csv
```

2. HP1/HP2 BED segments provide:

```text
segment coverage
copy-number state
```

3. Each coverage point is matched to its overlapping HP1 or HP2 BED segment.

4. Each point is plotted using:

```text
copyNumberEquivalent = (rawCoverage / bedSegmentCoverage) * bedCopyNumberState
```

Example:

```text
raw coverage = 85
BED segment coverage = 90
BED copy number = 2

copyNumberEquivalent = (85 / 90) * 2 = 1.89
```

So the point appears near copy-number state `2` on the right axis.

### Dynamic Coverage Axis

The fixed `coverageMax: 180` behavior was replaced internally with a dynamic value based on BED segment coverage.

Formula:

```text
coverageMax = max(180, nextMultipleOf30(maxBedSegmentCoverage))
```

For the current test data:

```text
max HP1 BED coverage = 320.22
max HP2 BED coverage = 164.2
dynamic coverage max = 330
```

This prevents the old high HP1 segment from clipping at `180`.

### Coverage Tooltip

Hover over coverage points now shows:

```text
Position
Haplotype
Raw coverage
Copy-number equivalent
BED copy number
BED segment coverage
```

Hover over segment bars shows:

```text
Position
Haplotype
BED segment coverage
BED copy number
Confidence
```

### SV Breakpoint Lines Inside The Coverage/CN Plot

The HP1/HP2 coverage plot now also supports a lightweight vertical SV breakpoint overlay.

Implementation:

```text
src/WakhanCoverageTrack.js
```

Behavior:

- The overlay uses the same parsed Severus VCF data as the structural-variation tracks.
- It draws only vertical breakpoint endpoint lines inside the HP1/HP2 coverage/copy-number plot.
- It does not draw arcs in the coverage plot.
- A paired or interval-like SV can contribute two vertical endpoint lines: one at `From`, one at `To`.
- `INS` and `sBND` usually contribute one vertical endpoint line.
- Colors follow the same SV type color map as the SV plot.
- Hovering a vertical line shows SV ID, type, endpoint, position, length, HP, VAF, and DV.

Sidebar control:

```text
SV visibility -> SV lines in copy-number plot
```

This checkbox enables/disables the vertical SV lines inside the coverage/CN plot.

The coverage/CN SV lines also respect:

```text
BED-matched SVs / All VCF SVs
DEL / INV / INS / BND / DUP / sBND type checkboxes
```

Performance behavior:

- The overlay only draws endpoint lines that are inside the current visible genomic window.
- It samples markers using `maxSvBreakpointMarkers` to avoid slowing the plot when many breakpoints are visible.

## Structural Variation Parsing

Severus structural variants are parsed from:

```text
severus_somatic.vcf
```

Parser location:

```text
src/Uploader.js
```

Relevant VCF fields:

```text
ID
CHROM
POS
ALT
FILTER
INFO/SVTYPE
INFO/SVLEN
INFO/END
INFO/MATE_ID
INFO/HP
FORMAT/VAF
FORMAT/DV
```

Rules:

- Only `PASS` variants are loaded.
- `BND` records are paired using `MATE_ID`.
- For `BND`, the mate coordinate is parsed from ALT or the mate record.
- `INS` and `sBND` are drawn as vertical markers.
- `BND`, `DEL`, `DUP`, and `INV` can be drawn as arcs.

Current Severus test counts:

```text
PASS VCF records: 1170
BED-linked SV IDs: 402
HP1 SVs: 543
HP2 SVs: 487
Missing/unassigned HP: 140
```

Missing HP means no `HP=1` or `HP=2` is written in the VCF INFO field. These variants are treated as unassigned.

## General Structural Variation Plot

A custom SV track was added:

```text
src/WakhanStructuralVariationTrack.js
```

General SV track UID:

```text
wakhan-sv-track
```

Location:

- Above the HP1/HP2 coverage plot.

Behavior:

- Shows a WAKHAN-like breakpoint/SV plot for HP1 only.
- Uses `INFO/HP=1` from the Severus VCF.
- Variants with `INFO/HP=2` or missing HP are not shown in this top SV plot.
- Uses pastel colors:

```text
DEL  = soft pink
INV  = soft blue
INS  = muted yellow
BND  = grey
DUP  = soft green
sBND = pale grey
```

The in-plot legend boxes were removed after user feedback. SV visibility is now controlled from the sidebar.

### General SV Filtering

The sidebar has `SV visibility` controls:

```text
BED-matched SVs
All VCF SVs
DEL
INV
INS
BND
DUP
sBND
HP2 SV plot
```

Default mode:

```text
BED-matched SVs
```

BED-matched means:

- Parse `svs_breakpoints_ids` from both HP BED files.
- Show only VCF variants whose `ID` or `MATE_ID` appears in that BED ID list.

`All VCF SVs` shows all parsed `PASS` VCF variants.

### Large Arc / Wrong Tooltip Fix

Problem observed:

- Inspecting a local region for `severus_BND252_*` could show tooltip for `severus_BND163_1`.
- Reason: `BND163` is a huge arc from `chr1:45,930,110` to `chr1:153,159,499`, so it crossed many unrelated zoom windows.

Fix:

- In zoomed-in views, the SV track now only includes variants with an actual endpoint inside or near the visible window.
- Hover hit detection now chooses the nearest drawn SV instead of the first matching SV in VCF order.

This prevents giant crossing arcs from stealing hover/tooltip focus in unrelated inspected regions.

## HP2 Structural Variation Plot

A second instance of the same SV track was added below the HP1/HP2 coverage plot.

Track UID:

```text
wakhan-hp-sv-track
```

It is hidden by default.

Sidebar checkbox:

```text
HP2 SV plot
```

When enabled:

- A new plot appears under the HP1/HP2 coverage plot.
- Only HP2 SVs are drawn.
- The HP2 plot is flipped: its baseline is at the top and arcs/markers extend downward.
- The earlier double-lane HP1/HP2 layout was removed because the double axis looked crowded.
- Missing/unassigned HP variants are hidden from this HP2-specific plot.

Rules:

```text
INFO/HP=1 -> top SV plot above coverage
INFO/HP=2 -> optional HP2 SV plot below coverage
missing HP -> hidden from HP-specific plots
```

The missing HP variants remain hidden from these separated HP-specific SV plots.

The same SV type checkboxes also affect the HP2-specific plot.

## Sidebar Controls

The app now has two main WAKHAN-related control panels:

### WAKHAN visibility

```text
HP1 plot
HP2 plot
Coverage points
```

Controls the HP1/HP2 coverage track.

### SV visibility

```text
HP2 SV plot
BED-matched SVs
All VCF SVs
DEL
INV
INS
BND
DUP
sBND
```

Controls the general SV track and, for type filters, the HP-specific SV track as well.

## Layout / Plot Spacing

The plot stack was tightened after feedback that plots were too far apart.

Current relevant configured heights:

```text
BAF track:                170
General SV track:         200
HP1/HP2 coverage track:   310
HP1/HP2 SV track:         hidden at height 1, expands to 160 when enabled
```

The custom SV track internal padding was also reduced.

## Upload Behavior

Uploader file:

```text
src/Uploader.js
```

Supported paths:

1. Classic HiScanner zip:

```text
cna_short.txt
cna_long.txt
snp.txt
```

2. WAKHAN-style input:

```text
*_copynumbers_segments_HP_1.bed
*_copynumbers_segments_HP_2.bed
phase_corrected_coverage.csv
baf.csv
severus_somatic.vcf
```

3. Raw multiple-file upload:

```text
.bed
.csv
.vcf
.txt
```

4. Real `.zip` upload.

Bad archive handling:

- If a file named `.zip` is actually RAR, ViScanner shows a clear error.
- The app no longer crashes with `End of central directory not found`.

## Important Code Files

### `src/WakhanCoverageTrack.js`

Custom track for HP1/HP2 coverage and copy-number-relative plotting.

Key responsibilities:

- Dynamic BED-based coverage axis.
- Copy-number equivalent conversion.
- HP1/HP2 mirrored plotting.
- Coverage and segment hover tooltips.
- WAKHAN chromosome background bands.
- Visibility toggles.

### `src/WakhanStructuralVariationTrack.js`

Custom track for general and HP-specific structural variation plotting.

Key responsibilities:

- Severus SV arcs/markers.
- Type filtering.
- BED-matched vs all VCF filtering.
- Endpoint-aware viewport filtering.
- Nearest-hover behavior.
- Haplotype filtering for separated HP1 and HP2 SV plots.

### `src/Uploader.js`

Parses uploaded files and sends data into tracks.

Key responsibilities:

- ZIP/raw upload handling.
- RAR detection.
- WAKHAN BED parsing.
- WAKHAN coverage parsing.
- BAF parsing.
- Severus VCF parsing.
- BED breakpoint ID extraction.
- Track data updates.

### `src/App.js`

Sidebar controls:

- WAKHAN visibility.
- SV visibility.
- HP2 SV plot show/hide.

### `src/CnvTable.js`

WAKHAN segment table browser and inspect-region navigation.

### `src/ScannerResultTrackPatched.js`

Patched/styled scanner result track, especially for BAF.

### `src/viewConfig.json`

Defines track layout and custom track instances:

```text
scanner-result-track-1
wakhan-sv-track
wakhan-coverage-track
wakhan-hp-sv-track
```

### `src/HiglassBrowser.js`

Registers custom HiGlass tracks:

```text
ScannerResultTrack
WakhanCoverageTrack
WakhanStructuralVariationTrack
```

## How to Run Locally

From:

```powershell
D:\internship\ViScanner
```

Run:

```powershell
npm start
```

Open:

```text
http://localhost:3030
```

Upload:

```text
D:\internship\files\files-valid.zip
```

## How to Build

From:

```powershell
D:\internship\ViScanner
```

Run:

```powershell
npx webpack --mode production
```

This updates:

```text
dist/bundle.js
```

## What Not To Do Without Permission

- Do not push current changes unless explicitly asked.
- Do not revert unrelated user changes.
- Do not treat missing VCF `HP` as HP1 or HP2.
- Do not use raw coverage CSV max for the coverage axis; it has extreme outliers and flattens the plot.
- Do not show giant crossing SV arcs in zoomed local views unless their breakpoint endpoint is near the visible region.

## Known Scientific/Visualization Decisions

1. Missing HP variants are unassigned.
   - They are hidden from the HP-specific SV plot.
   - They remain visible in the general SV plot.

2. Insertions are vertical markers.
   - They usually have one genomic coordinate in the VCF.
   - Drawing an arc would imply a second endpoint that may not exist.

3. BND variants are paired with `MATE_ID`.
   - Paired BNDs are drawn as one arc when possible.

4. Coverage dots are no longer raw coverage-positioned.
   - They are positioned by copy-number equivalent relative to the BED segment.
   - Raw coverage is still shown in tooltip.

5. BED-matched SV mode is default.
   - It keeps the general SV plot biologically tied to WAKHAN copy-number segments.

## Current Test Checklist

After running the app and uploading `files-valid.zip`:

1. Table should show `WAKHAN segment browser`.
2. BAF plot should be green/olive with y-axis `0` to `0.6`.
3. General SV plot should appear above HP1/HP2 coverage.
4. HP1/HP2 coverage plot should appear below general SV plot.
5. Coverage axis should dynamically extend to around `330` for current files.
6. Right copy-number axis should show integer states.
7. Coverage hover should show raw coverage and copy-number equivalent.
8. `BED-matched SVs` should show fewer SVs than `All VCF SVs`.
9. Inspecting the `BND252` region should not incorrectly show `BND163` just because its long arc crosses the window.
10. The top SV plot should show only `INFO/HP=1` variants.
11. Checking `HP2 SV plot` should reveal a new track under the coverage plot.
12. The lower HP2 SV plot should show only `INFO/HP=2` variants.
13. Missing HP variants should not appear in the HP-specific SV plots.

## Data Facts From Current Test Files

From the current test data:

```text
PASS Severus VCF records: 1170
BED-linked SV IDs: 402
HP1 SVs: 543
HP2 SVs: 487
Missing/unassigned HP: 140
Max HP1 BED coverage: 320.22
Max HP2 BED coverage: 164.2
Dynamic coverage max: 330
```

These numbers are useful sanity checks for future debugging.
