# 🧬 ViScanner

**ViScanner** is an interactive, high-performance web visualizer for single-cell **Copy Number Alterations (CNA)**, **B-Allele Frequencies (BAF)**, **Haplotype-Specific Coverage (HP1 / HP2)**, and **Structural Variant (SV)** breakpoint exploration.

[![Live Demo](https://img.shields.io/badge/GitHub%20Pages-Live%20Demo-brightgreen.svg?logo=github)](https://wakhan-visualization.github.io/wakhan_visualization.github.io/)
[![Nature Communications](https://img.shields.io/badge/Nature%20Communications-2025-0066CC.svg)](https://www.nature.com/articles/s41467-025-60446-5)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

[**🌐 Live Application Demo**](https://wakhan-visualization.github.io/wakhan_visualization.github.io/) &nbsp;|&nbsp; [**📄 Read the Paper**](https://www.nature.com/articles/s41467-025-60446-5)

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

### Standard Push (Single Repository)
To commit your changes and push to GitHub in one line:
```bash
git add . ; git commit -m "Describe your changes" ; git push origin main
```
*(On Linux/macOS, replace `;` with `&&`)*

### Dual-Repository Push Setup (Optional)
If you maintain two repository remotes (e.g. `wakhan-visualization` and `Rahim36712`) and want to push to **both** simultaneously in a single command:

1. **Configure `origin` to push to both remotes**:
   ```bash
   git remote set-url --add --push origin https://github.com/wakhan-visualization/wakhan-visualization.github.io.git
   git remote set-url --add --push origin https://github.com/Rahim36712/viscanner-improved.git
   ```

2. **Push to both repositories simultaneously**:
   ```bash
   git add . ; git commit -m "Update code across both repositories" ; git push origin main
   ```

---

## 📜 Citation & Credits

If you use **ViScanner** in your research, please cite:

```bibtex
@article{viscanner2025,
  title={Single-cell copy number alteration profiling at scale with HiScanner},
  journal={Nature Communications},
  year={2025},
  url={https://www.nature.com/articles/s41467-025-60446-5}
}
```

Developed by **Park Lab** (Harvard Medical School) & **Kolmogorov Lab**.
