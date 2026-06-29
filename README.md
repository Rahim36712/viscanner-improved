# ViScanner
This tool was designed to visualize copy number alterations in single cells. It seamlessly integrates with HiScanner (find our paper <a href="https://www.nature.com/articles/s41467-025-60446-5" target="_blank">here</a>) and allows interactive visualization of HiScanner CNA calls at any resolution.

## Expected file format

The tool works out of the box with the visualization output file from HiScanner, which needs to be loaded into the ViScanner website (https://compbio.hms.harvard.edu/ViScanner/). However, you can also use it with your own data (that is not output of HiScanner). 

Important: The tool expects a **zip-compressed file** that contains the following 3 text files:

### cna_long.txt

This file contains bin-level data, meaning each row corresponds to a genomic bin (columns are tab delimited).

Example:
```
chrom	start	end	major_cn	minor_cn	total_cn	rdr	baf	cell
1	10027	870642	0	0	0	0.258	0.602	5823PFC-B
1	870643	974114	0	0	0	0.002	0.0	5823PFC-B
1	974115	1080276	0	0	0	0.002	0.0	5823PFC-B
```
where
- major_cn: major copy number
- minor_cn: minor copy number
- total_cn: total copy number (major_cn + minor_cn)
- rdr: read depth ratio (a measure of the relative read depth in the segment/bin compared to a baseline)
- baf: B allele frequency
- cell: cell identifier

### cna_short.txt

This file contains segment-level data, meaning each row corresponds to a segment (which may span multiple bins) that has the same copy number state  (columns are tab delimited).

Example:
```
chrom	start	end	major_cn	minor_cn	total_cn	rdr	baf	cell
1	10027	1519210	0	0	0	0.025	0.057	5823PFC-B
1	1519211	1992970	1	0	1	0.378	0.003	5823PFC-B
1	1992971	168586434	1	1	2	1.27	0.431	5823PFC-B
```

### snp.txt

This file contains SNP locations for a specific cell  (columns are tab delimited).

Example:
```
chrom	pos	5823PFC-B
1	566870	0.0
1	729679	1.0
1	752566	1.0
```

### WAKHAN HP1/HP2 coverage plotting

When a WAKHAN output zip is uploaded, ViScanner uses one interactive HiGlass track for both HP1 and HP2. HP1 is drawn above the center line and HP2 is mirrored below it. The left axis is coverage depth, and the right axis is copy number inferred from the HP1/HP2 BED segment states.

For WAKHAN output, upload a zip containing:

```
phase_corrected_coverage.csv
*_copynumbers_segments_HP_1.bed
*_copynumbers_segments_HP_2.bed
baf.csv
```

The `phase_corrected_coverage.csv` file is interpreted as `chr`, `start`, `end`, `hp1`, `hp2`, and `unphased` coverage. It provides dense HP1 and HP2 coverage points inside the zoomable HiGlass track. The WAKHAN BED files are interpreted as `chr`, `start`, `end`, `coverage`, `copynumber_state`, and `confidence`; the `coverage` column provides the broader HP1 and HP2 median coverage segments, while `copynumber_state` supplies the right-side copy-number tick labels. Coverage values are clipped to `180` so extreme outlier bins do not flatten the main pattern.



## Available Scripts (when developing ViScanner)

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3030](http://localhost:3030) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm run deploy`

Deploys the app on Github pages, so that it is available on https://parklab.github.io/HiScanner/
