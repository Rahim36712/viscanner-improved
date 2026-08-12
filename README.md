# 🧬 ViScanner

**ViScanner** is an interactive, high-performance web visualizer for single-cell **Copy Number Alterations (CNA)**, **B-Allele Frequencies (BAF)**, **Haplotype-Specific Coverage (HP1 / HP2)**, and **Structural Variant (SV)** breakpoint exploration.

[![Live Demo](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen.svg?logo=github)](https://wakhan-visualization.github.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[**🌐 Live Application Demo**](https://wakhan-visualization.github.io/wakhan_visualization.github.io/)

---

## ✨ Key Features

- 🔬 **Multi-Pipeline Integration**: Native ingestion of **WAKHAN** haplotype phasing, **Severus** structural variants, and classic **HiScanner** outputs (raw files or `.zip` archives).
- 🔀 **Mirrored Haplotype Track**: Dual-axis mirrored coverage for HP1 and HP2 with live depth/CN point scaling and LOH region overlays.
- 🎯 **Phased Structural Variant Arcs**: Haplotype-aware Severus SV breakpoint arcs (`DEL`, `INS`, `INV`, `DUP`, `BND`).
- 🧬 **Multi-Build Centromere Masking**: Dynamic switching between **GRCh38**, **GRCh37**, and **CHM13** reference genome builds.
- 📊 **Interactive Segment Browser**: Filterable table with 1-click region inspection (`👁️`) and dynamic canvas navigation.

---

## 📸 Interface Previews

### Multi-Track Genome Browser
![ViScanner Multi-Track Visualizer](docs/images/tracks_preview.png)

### Segment Table & Uploader
![WAKHAN Segment Browser & Upload Interface](docs/images/table_preview.png)

---

## 📁 Supported Input Files

Upload raw individual files or a single `.zip` archive containing:

| File Name | Format | Description |
| :--- | :--- | :--- |
| `phase_corrected_coverage.csv` | CSV | Dense phase coverage depth points (`chr`, `start`, `end`, `hp1`, `hp2`, `unphased`) |
| `*_copynumbers_segments_HP_1/2.bed` | BED | HP1 / HP2 copy-number segments & confidence scores |
| `baf.csv` | CSV | B-Allele Frequency values (`chr`, `start`, `end`, `baf`) |
| `severus_somatic.vcf` | VCF | Severus somatic structural variants (`PASS` filtered) |
| `grch38.cen_coord.curated.bed` / `grch37` / `chm13` | BED | Centromere masked region coordinates |
| `*_LOH*.bed` | BED | Loss of Heterozygosity (LOH) region coordinates |
| `cna_long.txt` / `cna_short.txt` | TSV | Classic HiScanner CNA segment files |

---

## 🛠️ Development & Deployment Guide

### Prerequisites
- **Node.js**: `v16.x` or `v18.x`
- **npm**: `v8.x`+

### 1. Clone & Install
```bash
git clone https://github.com/wakhan-visualization/wakhan-visualization.github.io.git
cd wakhan-visualization.github.io
npm install
```

### 2. Local Development
Start the dev server at `http://localhost:3030`:
```bash
npm start
```

### 3. Run Tests
```bash
npm test
```

### 4. Build & Deploy Live Site
Build the production bundle and publish live to GitHub Pages:
```bash
npm run deploy
```

---

## 🚀 How to Commit and Push Changes to GitHub

To commit your changes and push to GitHub in one command line:
```bash
git add . ; git commit -m "Describe your changes" ; git push origin main
```
*(On Linux/macOS bash shell, you can use `git add . && git commit -m "..." && git push origin main`)*
