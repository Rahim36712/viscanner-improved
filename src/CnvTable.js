"use strict";

import React from "react";
import Uploader from "./Uploader";
import { ChromosomeInfo } from "higlass/dist/hglib";
import { format } from "d3-format";
import Select from "react-select";
import { scheduleFitToContent } from "./higlassLayout";
import { LABELS, UI_COLORS, SV_CONFIG } from "./labelsConfig";

function formatSvLength(svlen, pos, pos2) {
  let len = Number.isFinite(Number(svlen)) ? Math.abs(Number(svlen)) : null;
  if (!len && Number.isFinite(pos) && Number.isFinite(pos2) && pos !== pos2) {
    len = Math.abs(pos2 - pos);
  }
  if (!len) return "-";
  if (len >= 1000000) {
    return (len / 1000000).toFixed(2) + " Mb";
  }
  if (len >= 1000) {
    return (len / 1000).toFixed(1) + " kb";
  }
  return len + " bp";
}

function formatNumber(val, decimals) {
  if (val === "-" || val === undefined || val === null || Number.isNaN(val)) {
    return "-";
  }
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val);
  if (typeof decimals === "number") {
    return num.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }
  return num.toLocaleString();
}

const SV_BADGE_COLORS = {
  DEL: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.DEL) || "#CF0759",
  INV: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.INV) || "#2830DE",
  INS: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.INS) || "#e0cf03",
  BND: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.BND) || "#737373",
  DUP: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.DUP) || "#178117",
  sBND: (SV_CONFIG && SV_CONFIG.TYPE_COLORS && SV_CONFIG.TYPE_COLORS.sBND) || "#737373",
};

const PAGE_SIZE = 20;

const ALL_CHROM = { value: "All", label: "All" };

const CHROMS = [
  { value: "All", label: "All" },
  { value: "chr1", label: "chr1" },
  { value: "chr2", label: "chr2" },
  { value: "chr3", label: "chr3" },
  { value: "chr4", label: "chr4" },
  { value: "chr5", label: "chr5" },
  { value: "chr6", label: "chr6" },
  { value: "chr7", label: "chr7" },
  { value: "chr8", label: "chr8" },
  { value: "chr9", label: "chr9" },
  { value: "chr10", label: "chr10" },
  { value: "chr11", label: "chr11" },
  { value: "chr12", label: "chr12" },
  { value: "chr13", label: "chr13" },
  { value: "chr14", label: "chr14" },
  { value: "chr15", label: "chr15" },
  { value: "chr16", label: "chr16" },
  { value: "chr17", label: "chr17" },
  { value: "chr18", label: "chr18" },
  { value: "chr19", label: "chr19" },
  { value: "chr20", label: "chr20" },
  { value: "chr21", label: "chr21" },
  { value: "chr22", label: "chr22" },
];

export class CnvTable extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      activeTab: "copyNumber",
      variants: [],
      displayedVariants: [],
      tablePage: 0,
      selectedChrom: ALL_CHROM,
      sortedBy: "",
      sortedByOrder: "asc",
      tableType: "hiscanner",
      selectedCentromereBuild: "GRCh38",
      availableCentromereBuilds: { GRCh38: true, GRCh37: true, CHM13: true },
      maskedRegionsByBuild: null,
      activeRowKey: null,
      svVariants: [],
      displayedSvVariants: [],
      svTablePage: 0,
      svSelectedChrom: ALL_CHROM,
      svSortedBy: "",
      svSortedByOrder: "asc",
    };
  }

  componentDidMount() {
    this.handleSvVariantsLoaded = (e) => {
      if (e && e.detail && Array.isArray(e.detail.variants)) {
        this.populateSvVariants(e.detail.variants);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("viscanner:sv-variants-loaded", this.handleSvVariantsLoaded);
      if (
        window._viscannerSvVariants &&
        Array.isArray(window._viscannerSvVariants) &&
        window._viscannerSvVariants.length > 0 &&
        this.state.svVariants.length === 0
      ) {
        this.populateSvVariants(window._viscannerSvVariants);
      }

      // Pre-cache ChromosomeInfo immediately so eye icon clicks never wait for network!
      if (!this.chromInfo && !window._viscannerChromInfo && typeof ChromosomeInfo === "function") {
        try {
          const p = ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv");
          if (p && typeof p.then === "function") {
            p.then((ci) => {
              this.chromInfo = ci;
              window._viscannerChromInfo = ci;
            }).catch(() => {});
          }
        } catch (e) {}
      }
    }
  }

  getChromInfo = () => {
    if (this.chromInfo) return this.chromInfo;
    if (typeof window !== "undefined" && window._viscannerChromInfo) {
      this.chromInfo = window._viscannerChromInfo;
      return this.chromInfo;
    }
    const hgc = typeof window !== "undefined" && window.hgc && window.hgc.current;
    if (hgc && hgc.api) {
      try {
        const track =
          hgc.api.getTrackObject("aa", "wakhan-coverage-track") ||
          hgc.api.getTrackObject("aa", "wakhan-sv-track");
        if (track && track.chromInfo) {
          this.chromInfo = track.chromInfo;
          if (typeof window !== "undefined") window._viscannerChromInfo = track.chromInfo;
          return this.chromInfo;
        }
      } catch (e) {}
    }
    return null;
  };

  componentWillUnmount() {
    if (typeof window !== "undefined" && this.handleSvVariantsLoaded) {
      window.removeEventListener("viscanner:sv-variants-loaded", this.handleSvVariantsLoaded);
    }
  }

  handleCentromereBuildChange = (build) => {
    this.setState({ selectedCentromereBuild: build }, () => {
      const hgc = window.hgc && window.hgc.current;
      if (!hgc || !hgc.api) return;
      try {
        const wakhanTrack = hgc.api.getTrackObject("aa", "wakhan-coverage-track");
        if (wakhanTrack && wakhanTrack.setVisibilityOptions) {
          wakhanTrack.setVisibilityOptions({ selectedCentromereBuild: build });
        }
      } catch (e) {}
    });
  };

  nextPage = () => {
    this.setState((prevState) => ({
      tablePage: prevState.tablePage + 1,
    }));
  };

  previousPage = () => {
    this.setState((prevState) => ({
      tablePage: Math.max(0, prevState.tablePage - 1),
    }));
  };

  goToPage = (page) => {
    this.setState({
      tablePage: Math.max(0, page),
    });
  };

  sortTable = (value) => {
    const displayedVariants = JSON.parse(JSON.stringify(this.state.displayedVariants));
    displayedVariants.sort((a, b) => {
      if (a[value] === "-") return -1;
      if (b[value] === "-") return 1;
      return a[value] > b[value] ? 1 : a[value] < b[value] ? -1 : 0;
    });

    let sortedByOrder = this.state.sortedByOrder;
    if (this.state.sortedBy === value && sortedByOrder === "asc") {
      sortedByOrder = "desc";
      displayedVariants.reverse();
    } else {
      sortedByOrder = "asc";
    }

    this.setState({
      displayedVariants: displayedVariants,
      sortedBy: value,
      sortedByOrder: sortedByOrder,
    });
  };

  exportCsv = () => {
    if (this.state.activeTab === "breakpoints") {
      if (!this.state.displayedSvVariants || this.state.displayedSvVariants.length === 0) return;
      const variants = this.state.displayedSvVariants;
      const headers = ["ID", "Chrom1", "Pos1", "Chrom2", "Pos2", "SV_Type", "Length", "Haplotype", "VAF", "DV_Reads", "Filter"];
      const rows = variants.map((v) =>
        [
          JSON.stringify(v.id || ""),
          JSON.stringify(v.chr || ""),
          JSON.stringify(v.pos ?? ""),
          JSON.stringify(v.chr2 || ""),
          JSON.stringify(v.pos2 ?? ""),
          JSON.stringify(v.type || ""),
          JSON.stringify(v.svlenStr || ""),
          JSON.stringify(v.hp || ""),
          JSON.stringify(v.vaf || ""),
          JSON.stringify(v.dv || ""),
          JSON.stringify(v.filter || ""),
        ].join(",")
      );
      const csvContent = [headers.join(","), ...rows].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `structural_variation_breakpoints.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!this.state.displayedVariants || this.state.displayedVariants.length === 0) return;
    const variants = this.state.displayedVariants;
    const keys = Object.keys(variants[0]);
    const header = keys.join(",");
    const rows = variants.map((v) =>
      keys.map((k) => JSON.stringify(v[k] !== undefined && v[k] !== null ? v[k] : "")).join(",")
    );
    const csvContent = [header, ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${this.state.tableType}_cnv_segments.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  populateSvVariants = (rawSvList) => {
    if (!Array.isArray(rawSvList)) return;
    const svVariants = [];
    rawSvList.forEach((v, index) => {
      if (!v) return;
      const chr = v.chr || "chr1";
      const pos = Number.isFinite(v.pos) ? v.pos : 0;
      const chr2 = v.chr2 || chr;
      const pos2 = Number.isFinite(v.pos2) ? v.pos2 : pos;
      const type = (v.type || "BND").toUpperCase();
      const svlenStr = formatSvLength(v.svlen, pos, pos2);
      const hp = v.hp === "1" ? "HP-1" : v.hp === "2" ? "HP-2" : "Unphased";
      const vaf = Number.isFinite(Number(v.vaf)) ? Number(v.vaf).toFixed(2) : (v.vaf || "-");
      const dv = v.dv || "-";

      svVariants.push({
        id: v.id || `sv_${index + 1}`,
        chr,
        pos,
        chr2,
        pos2,
        posStr: formatNumber(pos),
        pos2Str: formatNumber(pos2),
        type,
        svlen: Number.isFinite(Number(v.svlen)) ? Math.abs(Number(v.svlen)) : (Math.abs(pos2 - pos) || 0),
        svlenStr,
        hp,
        vaf,
        dv,
        filter: v.filter || "PASS",
        raw: v,
      });
    });

    svVariants.sort((a, b) => {
      if (a.chr !== b.chr) return a.chr.localeCompare(b.chr, undefined, { numeric: true });
      return a.pos - b.pos;
    });

    this.setState({
      svVariants: svVariants,
      displayedSvVariants: svVariants,
      svSelectedChrom: ALL_CHROM,
      svSortedBy: "",
      svSortedByOrder: "asc",
      svTablePage: 0,
    });
  };

  nextSvPage = () => {
    this.setState((prevState) => ({
      svTablePage: prevState.svTablePage + 1,
    }));
  };

  previousSvPage = () => {
    this.setState((prevState) => ({
      svTablePage: Math.max(0, prevState.svTablePage - 1),
    }));
  };

  goToSvPage = (page) => {
    this.setState({
      svTablePage: Math.max(0, page),
    });
  };

  renderPagination = (currentPage, totalItems, pageSize, onPageChange) => {
    const totalPages = Math.ceil(totalItems / pageSize);
    if (totalPages <= 1 && totalItems === 0) return null;

    const pages = [];
    const maxVisiblePages = 7;

    if (totalPages <= maxVisiblePages) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      // IMDb-style smart pagination with numbered tabs and ellipsis
      if (currentPage < 4) {
        for (let i = 0; i < 5; i++) pages.push(i);
        pages.push("ellipsis-right");
        pages.push(totalPages - 1);
      } else if (currentPage >= totalPages - 4) {
        pages.push(0);
        pages.push("ellipsis-left");
        for (let i = totalPages - 5; i < totalPages; i++) pages.push(i);
      } else {
        pages.push(0);
        pages.push("ellipsis-left");
        pages.push(currentPage - 1);
        pages.push(currentPage);
        pages.push(currentPage + 1);
        pages.push("ellipsis-right");
        pages.push(totalPages - 1);
      }
    }

    return (
      <div className="d-flex flex-wrap justify-content-between align-items-center mt-3 mb-2 px-3 py-2 bg-light border rounded">
        <div
          className="text-muted small py-1"
          title={`Total ${totalPages} pages (${totalItems} total items)`}
          style={{ cursor: "default" }}
        >
          <span>
            Page <strong className="text-dark">{currentPage + 1}</strong> of{" "}
            <span
              className="badge badge-secondary ml-1 mr-1"
              style={{ fontSize: "12px", cursor: "pointer" }}
              title={`Total pages: ${totalPages}`}
            >
              {totalPages}
            </span>
          </span>
          <span className="text-secondary ml-1">({totalItems} items)</span>
        </div>

        <nav aria-label="Table pagination">
          <ul className="pagination pagination-sm mb-0">
            <li className={`page-item ${currentPage === 0 ? "disabled" : ""}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => currentPage > 0 && onPageChange(currentPage - 1)}
                disabled={currentPage === 0}
                aria-label="Previous page"
                style={{ cursor: currentPage === 0 ? "not-allowed" : "pointer" }}
              >
                &laquo; Prev
              </button>
            </li>

            {pages.map((p, idx) => {
              if (typeof p === "string") {
                return (
                  <li key={`${p}-${idx}`} className="page-item disabled">
                    <span className="page-link" style={{ cursor: "default" }}>&hellip;</span>
                  </li>
                );
              }
              const isActive = p === currentPage;
              return (
                <li
                  key={p}
                  className={`page-item ${isActive ? "active font-weight-bold" : ""}`}
                >
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => onPageChange(p)}
                    title={`Page ${p + 1} of ${totalPages}`}
                    style={{ cursor: "pointer" }}
                  >
                    {p + 1}
                  </button>
                </li>
              );
            })}

            <li className={`page-item ${currentPage >= totalPages - 1 ? "disabled" : ""}`}>
              <button
                type="button"
                className="page-link"
                onClick={() => currentPage < totalPages - 1 && onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages - 1}
                aria-label="Next page"
                style={{ cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer" }}
              >
                Next &raquo;
              </button>
            </li>
          </ul>
        </nav>
      </div>
    );
  };

  selectSvChrom = (selectedChrom) => {
    if (!selectedChrom || selectedChrom.value === "All") {
      this.setState({
        displayedSvVariants: this.state.svVariants,
        svSelectedChrom: ALL_CHROM,
        svTablePage: 0,
      });
      return;
    }

    const filtered = this.state.svVariants.filter(
      (v) => v.chr === selectedChrom.value || v.chr2 === selectedChrom.value
    );

    this.setState({
      displayedSvVariants: filtered,
      svSelectedChrom: selectedChrom,
      svTablePage: 0,
    });
  };

  sortSvTable = (sortKey) => {
    const displayed = JSON.parse(JSON.stringify(this.state.displayedSvVariants));
    displayed.sort((a, b) => {
      if (a[sortKey] === "-") return -1;
      if (b[sortKey] === "-") return 1;
      return a[sortKey] > b[sortKey] ? 1 : a[sortKey] < b[sortKey] ? -1 : 0;
    });

    let svSortedByOrder = this.state.svSortedByOrder;
    if (this.state.svSortedBy === sortKey && svSortedByOrder === "asc") {
      svSortedByOrder = "desc";
      displayed.reverse();
    } else {
      svSortedByOrder = "asc";
    }

    this.setState({
      displayedSvVariants: displayed,
      svSortedBy: sortKey,
      svSortedByOrder: svSortedByOrder,
    });
  };

  selectChrom = (selectedChrom) => {
    //this.state.displayedVariants.sort((a, b) => a.posAbs - b.posAbs);
    if (selectedChrom.value === "All") {
      this.setState({
        displayedVariants: this.state.variants,
        selectedChrom: ALL_CHROM,
        tablePage: 0,
      });
      return;
    }

    const displayedVariants = [];
    this.state.variants.forEach((v) => {
      if (v.chr === selectedChrom.value) {
        displayedVariants.push(v);
      }
    });

    this.setState({
      displayedVariants: displayedVariants,
      selectedChrom: selectedChrom,
      tablePage: 0,
    });
  };

  populateTable = (data) => {
    const variants = [];
    let tableType = "hiscanner";
    let rows = [];
    let svVariantsRaw = [];

    if (data && typeof data === "object") {
      if (data.type === "wakhan") {
        tableType = "wakhan";
        rows = data.rows || [];
        svVariantsRaw = data.svVariants || [];
      } else if (data.type === "hiscanner") {
        tableType = "hiscanner";
        rows = data.rows || [];
        svVariantsRaw = data.svVariants || [];
      } else if (Array.isArray(data)) {
        rows = data;
        tableType = "hiscanner";
      }
    }

    if (svVariantsRaw && svVariantsRaw.length > 0) {
      this.populateSvVariants(svVariantsRaw);
    } else if (
      typeof window !== "undefined" &&
      window._viscannerSvVariants &&
      Array.isArray(window._viscannerSvVariants) &&
      window._viscannerSvVariants.length > 0
    ) {
      this.populateSvVariants(window._viscannerSvVariants);
    }

    const processRows = (chromInfo) => {
      this.chromInfo = chromInfo;
      const chrToAbsFn = (chromInfo && typeof chromInfo.chrToAbs === "function")
        ? (c, p) => chromInfo.chrToAbs([c, p])
        : (c, p) => p;

      rows.forEach((variant) => {
        if (tableType === "wakhan") {
          const totalCn =
            Number.isFinite(variant.hp1CopyNumber) && Number.isFinite(variant.hp2CopyNumber)
              ? variant.hp1CopyNumber + variant.hp2CopyNumber
              : "-";
          variants.push({
            posAbs: chrToAbsFn(variant.chr, variant.start),
            chr: variant.chr,
            start: variant.start,
            end: variant.end,
            startStr: formatNumber(variant.start),
            endStr: formatNumber(variant.end),
            hp1Coverage: variant.hp1Coverage,
            hp1CopyNumber: variant.hp1CopyNumber,
            hp1Confidence: variant.hp1Confidence,
            hp2Coverage: variant.hp2Coverage,
            hp2CopyNumber: variant.hp2CopyNumber,
            hp2Confidence: variant.hp2Confidence,
            total_cn: totalCn,
            breakpoints: variant.breakpoints || "-",
          });
          return;
        }

        const chrom = variant[0];
        const start = variant[1];
        const end = variant[2];
        const major_cn = variant[3];
        const minor_cn = variant[4];
        const total_cn = variant[5];
        const rdr = variant[6] || "-";
        const baf = variant[7] || "-";

        variants.push({
          posAbs: chrToAbsFn(chrom, start),
          chr: chrom,
          start: start,
          end: end,
          startStr: formatNumber(start),
          endStr: formatNumber(end),
          major_cn: major_cn,
          minor_cn: minor_cn,
          total_cn: total_cn,
          rdr: rdr,
          baf: baf,
        });
      });

      variants.sort((a, b) => a.posAbs - b.posAbs);

      this.setState({
        variants: variants,
        displayedVariants: variants,
        selectedChrom: ALL_CHROM,
        sortedBy: "",
        sortedByOrder: "asc",
        tablePage: 0,
        tableType: tableType,
      });
    };

    if (this.chromInfo) {
      processRows(this.chromInfo);
      return;
    }

    try {
      const p = typeof ChromosomeInfo === "function"
        ? ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
        : null;
      if (p && typeof p.then === "function") {
        p.then(processRows).catch((err) => {
          console.error("Error loading ChromosomeInfo:", err);
          processRows(null);
        });
        return;
      }
    } catch (e) {
      console.error("Error invoking ChromosomeInfo:", e);
    }
    processRows(null);
  };

  formatCell = (value, formatter = ".3f") => {
    if (value === "-" || value === undefined || value === null || Number.isNaN(value)) {
      return "-";
    }
    if (!Number.isFinite(value)) return value;
    try {
      if (typeof format === "function") {
        const fn = format(formatter);
        if (typeof fn === "function") {
          return fn(value);
        }
      }
    } catch (e) {}
    const decimals = formatter === ".2f" ? 2 : formatter === ".3f" ? 3 : 0;
    return formatNumber(value, decimals);
  };

  sortableHeader = (label, sortKey) => (
    <th scope="col">
      {label}{" "}
      <i
        className="fas fa fa-sort fa-fw sort-table-icon"
        onClick={() => this.sortTable(sortKey)}
      ></i>
    </th>
  );

  chromosomeHeader = () => (
    <th scope="col">
      Chrom.{" "}
      <Select
        className="basic-single d-inline-block"
        value={this.state.selectedChrom}
        onChange={this.selectChrom}
        options={CHROMS}
        closeMenuOnSelect={true}
        placeholder="Select ..."
        menuPortalTarget={document.body}
        styles={{
          menuPortal: (base) => ({ ...base, zIndex: 9999 }),
        }}
      />
    </th>
  );

  renderHiScannerHeader = () => (
    <tr>
      {this.chromosomeHeader()}
      {this.sortableHeader("Start", "start")}
      {this.sortableHeader("End", "end")}
      {this.sortableHeader("major_cn", "major_cn")}
      {this.sortableHeader("minor_cn", "minor_cn")}
      {this.sortableHeader("total_cn", "total_cn")}
      {this.sortableHeader("RDR", "rdr")}
      {this.sortableHeader("BAF", "baf")}
      <th className="text-center" scope="col">
        Inspect region
      </th>
    </tr>
  );

  renderWakhanHeader = () => (
    <tr>
      {this.chromosomeHeader()}
      {this.sortableHeader("Start", "start")}
      {this.sortableHeader("End", "end")}
      {this.sortableHeader("HP1 coverage", "hp1Coverage")}
      {this.sortableHeader("HP1 CN", "hp1CopyNumber")}
      {this.sortableHeader("HP1 confidence", "hp1Confidence")}
      {this.sortableHeader("HP2 coverage", "hp2Coverage")}
      {this.sortableHeader("HP2 CN", "hp2CopyNumber")}
      {this.sortableHeader("HP2 confidence", "hp2Confidence")}
      {this.sortableHeader("Total CN", "total_cn")}
      <th scope="col">SV breakpoint IDs</th>
      <th className="text-center" scope="col">
        Inspect region
      </th>
    </tr>
  );

  goToHiglass = (chr, start, end, rowKey) => {
    if (rowKey) {
      this.setState({ activeRowKey: rowKey });
    }

    const hgc = window.hgc && window.hgc.current;
    if (!hgc || !hgc.api) {
      console.warn("Higlass component not found.");
      return;
    }
    const targetElement = document.getElementById("sec:visualization");
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      window.scrollTo({
        top: Math.max(0, scrollTop + rect.top - 15),
        behavior: "smooth",
      });
    }

    const executeZoom = (chromInfo) => {
      try {
        const viewconf = hgc.api.getViewConfig();
        const viewUid = viewconf && viewconf.views && viewconf.views[0] ? viewconf.views[0].uid : "aa";

        const chrSizes = (chromInfo && (chromInfo.chromSizes || chromInfo.chromLengths)) || {};
        const chrLength = chrSizes[chr] || 250000000;
        const startNum = Math.max(0, Math.min(chrLength, Number(start) || 0));
        const endNum = Math.max(startNum, Math.min(chrLength, Number(end) || startNum));
        const span = endNum - startNum;

        let zoomStart;
        let zoomEnd;
        if (span < 50000) {
          // Focus tightly on small breakpoints / narrow segments with a 50kb window
          const center = (startNum + endNum) / 2;
          const halfWindow = 25000;
          zoomStart = Math.max(0, Math.round(center - halfWindow));
          zoomEnd = Math.min(chrLength, Math.round(center + halfWindow));
        } else {
          // Add 15% padding on each side for larger segments
          const pad = Math.round(span * 0.15);
          zoomStart = Math.max(0, startNum - pad);
          zoomEnd = Math.min(chrLength, endNum + pad);
        }

        if (zoomEnd <= zoomStart + 100) {
          zoomEnd = Math.min(chrLength, zoomStart + 1000);
        }

        const chrToAbsFn = (chromInfo && typeof chromInfo.chrToAbs === "function")
          ? (c, p) => chromInfo.chrToAbs([c, p])
          : (c, p) => p;

        const startAbs = chrToAbsFn(chr, zoomStart);
        const endAbs = chrToAbsFn(chr, zoomEnd);

        hgc.api.zoomTo(
          viewUid,
          startAbs,
          endAbs,
          0,
          1000,
          800
        );
      } catch (e) {
        console.error("Error navigating to region in HiGlass:", e);
      }
    };

    const chromInfo = this.getChromInfo();
    if (chromInfo) {
      executeZoom(chromInfo);
      return;
    }

    try {
      const p = typeof ChromosomeInfo === "function"
        ? ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
        : null;
      if (p && typeof p.then === "function") {
        p.then((ci) => {
          this.chromInfo = ci;
          if (typeof window !== "undefined") window._viscannerChromInfo = ci;
          executeZoom(ci);
        }).catch((err) => {
          console.error("Error loading ChromosomeInfo for breakpoint inspection:", err);
          executeZoom(null);
        });
        return;
      }
    } catch (err) {
      console.error("Error loading ChromosomeInfo:", err);
    }
    executeZoom(null);
  };

  goToBreakpoint = (chr, pos, chr2, pos2, type, rowKey, variantId) => {
    if (rowKey) {
      this.setState({ activeRowKey: rowKey });
    }

    if (variantId && typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("viscanner:inspect-variant", {
          detail: { id: variantId, chr, pos, chr2, pos2, type },
        })
      );
    }

    const hgc = window.hgc && window.hgc.current;
    if (!hgc || !hgc.api || typeof hgc.api.zoomTo !== "function") {
      console.warn("HiGlass component not found for breakpoint navigation.");
      return;
    }

    const targetElement = document.getElementById("sec:visualization");
    if (targetElement) {
      const rect = targetElement.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      window.scrollTo({
        top: Math.max(0, scrollTop + rect.top - 15),
        behavior: "smooth",
      });
    }

    const executeZoom = (chromInfo) => {
      try {
        const viewconf = hgc.api.getViewConfig();
        const viewUid = viewconf && viewconf.views && viewconf.views[0] ? viewconf.views[0].uid : "aa";

        const chrSizes = (chromInfo && (chromInfo.chromSizes || chromInfo.chromLengths)) || {};
        const chrLength = chrSizes[chr] || 250000000;
        const posNum = Math.max(0, Math.min(chrLength, Number(pos) || 0));
        const pos2Num = Number.isFinite(Number(pos2)) ? Math.max(0, Math.min(chrLength, Number(pos2))) : posNum;

        const chrToAbsFn = (chromInfo && typeof chromInfo.chrToAbs === "function")
          ? (c, p) => chromInfo.chrToAbs([c, p])
          : (c, p) => p;

        // Check if inter-chromosomal translocation across two different chromosomes
        if (chr2 && chr2 !== chr) {
          const chr2Length = chrSizes[chr2] || 250000000;
          const clampedPos2 = Math.max(0, Math.min(chr2Length, pos2Num));
          const abs1 = chrToAbsFn(chr, posNum);
          const abs2 = chrToAbsFn(chr2, clampedPos2);
          const minAbs = Math.min(abs1, abs2);
          const maxAbs = Math.max(abs1, abs2);
          const span = maxAbs - minAbs;
          const pad = Math.max(50000, Math.round(span * 0.05));
          const zoomStart = Math.max(0, minAbs - pad);
          const zoomEnd = maxAbs + pad;
          hgc.api.zoomTo(viewUid, zoomStart, zoomEnd, 0, 1000, 800);
          return;
        }

        // Intra-chromosomal SV on the same chromosome
        if (type === "INS" || posNum === pos2Num) {
          // Point insertion or point breakend
          const zoomStart = Math.max(0, Math.round(posNum - 25000));
          const zoomEnd = Math.min(chrLength, Math.round(posNum + 25000));
          const startAbs = chrToAbsFn(chr, zoomStart);
          const endAbs = chrToAbsFn(chr, zoomEnd);
          hgc.api.zoomTo(viewUid, startAbs, endAbs, 0, 1000, 800);
          return;
        }

        // Deletion, Inversion, Duplication spanning a region
        const minPos = Math.min(posNum, pos2Num);
        const maxPos = Math.max(posNum, pos2Num);
        const span = maxPos - minPos;
        let zoomStart, zoomEnd;

        if (span < 50000) {
          const center = (minPos + maxPos) / 2;
          zoomStart = Math.max(0, Math.round(center - 25000));
          zoomEnd = Math.min(chrLength, Math.round(center + 25000));
        } else {
          // 25% padding so the whole arc curve and both feet are completely framed
          const pad = Math.round(span * 0.25);
          zoomStart = Math.max(0, minPos - pad);
          zoomEnd = Math.min(chrLength, maxPos + pad);
        }

        if (zoomEnd <= zoomStart + 100) {
          zoomEnd = Math.min(chrLength, zoomStart + 1000);
        }

        const startAbs = chrToAbsFn(chr, zoomStart);
        const endAbs = chrToAbsFn(chr, zoomEnd);
        hgc.api.zoomTo(viewUid, startAbs, endAbs, 0, 1000, 800);
      } catch (e) {
        console.error("Error navigating to breakpoint in HiGlass:", e);
      }
    };

    const chromInfo = this.getChromInfo();
    if (chromInfo) {
      executeZoom(chromInfo);
      return;
    }

    try {
      const p = typeof ChromosomeInfo === "function"
        ? ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
        : null;
      if (p && typeof p.then === "function") {
        p.then((ci) => {
          this.chromInfo = ci;
          if (typeof window !== "undefined") window._viscannerChromInfo = ci;
          executeZoom(ci);
        }).catch((err) => {
          console.error("Error loading ChromosomeInfo for breakpoint inspection:", err);
          executeZoom(null);
        });
        return;
      }
    } catch (err) {
      console.error("Error loading ChromosomeInfo:", err);
    }
    executeZoom(null);
  };

  render() {
    let variantsToDisplay = this.state.displayedVariants || [];
    let tableHead = null;
    let tableBody = null;

    if (this.state.tableType === "wakhan") {
      tableHead = (
        <thead>
          <tr>
            <th onClick={() => this.sortTable("chr")}>
              {LABELS.cnvTable.columns.chr}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("start")}>
              {LABELS.cnvTable.columns.start}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("end")}>
              {LABELS.cnvTable.columns.end}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp1Coverage")}>
              HP1 Coverage <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp1CopyNumber")}>
              HP1 CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp1Confidence")}>
              HP1 Conf <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp2Coverage")}>
              HP2 Coverage <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp2CopyNumber")}>
              HP2 CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("hp2Confidence")}>
              HP2 Conf <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("total_cn")}>
              Total CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th>{LABELS.cnvTable.columns.breakpoints}</th>
            <th className="text-center" scope="col">
              {LABELS.cnvTable.columns.inspectRegion || "Inspect region"}
            </th>
          </tr>
        </thead>
      );

      const pageStart = this.state.tablePage * PAGE_SIZE;
      const pageEnd = pageStart + PAGE_SIZE;
      const pageVariants = variantsToDisplay.slice(pageStart, pageEnd);

      tableBody = (
        <tbody>
          {pageVariants.map((v, i) => {
            const rowKey = `wakhan-${v.chr}-${v.start}-${v.end}-${i}`;
            const isActive = this.state.activeRowKey === rowKey;
            return (
              <tr
                key={rowKey}
                className={isActive ? "table-primary font-weight-bold" : ""}
                style={isActive ? { backgroundColor: "#e3f2fd" } : {}}
              >
                <td>{v.chr}</td>
                <td>{v.startStr}</td>
                <td>{v.endStr}</td>
                <td>{this.formatCell(v.hp1Coverage)}</td>
                <td>{this.formatCell(v.hp1CopyNumber, ".2f")}</td>
                <td>{this.formatCell(v.hp1Confidence, ".3f")}</td>
                <td>{this.formatCell(v.hp2Coverage)}</td>
                <td>{this.formatCell(v.hp2CopyNumber, ".2f")}</td>
                <td>{this.formatCell(v.hp2Confidence, ".3f")}</td>
                <td>{this.formatCell(v.total_cn, ".2f")}</td>
                <td style={{ maxWidth: "220px", wordBreak: "break-word" }}>{v.breakpoints}</td>
                <td className="text-center">
                  <i
                    className="fa fa-eye fas text-primary pointer px-1"
                    title="Inspect region in visualization"
                    style={{ cursor: "pointer" }}
                    onClick={() => this.goToHiglass(v.chr, v.start, v.end, rowKey)}
                  ></i>
                </td>
              </tr>
            );
          })}
        </tbody>
      );
    } else {
      tableHead = (
        <thead>
          <tr>
            <th onClick={() => this.sortTable("chr")}>
              {LABELS.cnvTable.columns.chr}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("start")}>
              {LABELS.cnvTable.columns.start}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("end")}>
              {LABELS.cnvTable.columns.end}{" "}
              <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("major_cn")}>
              Major CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("minor_cn")}>
              Minor CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("total_cn")}>
              Total CN <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("rdr")}>
              RDR <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th onClick={() => this.sortTable("baf")}>
              BAF <i className="fa fa-fw fa-sort fas text-muted"></i>
            </th>
            <th className="text-center" scope="col">
              {LABELS.cnvTable.columns.inspectRegion || "Inspect region"}
            </th>
          </tr>
        </thead>
      );

      const pageStart = this.state.tablePage * PAGE_SIZE;
      const pageEnd = pageStart + PAGE_SIZE;
      const pageVariants = variantsToDisplay.slice(pageStart, pageEnd);

      tableBody = (
        <tbody>
          {pageVariants.map((v, i) => {
            const rowKey = `hiscanner-${v.chr}-${v.start}-${v.end}-${i}`;
            const isActive = this.state.activeRowKey === rowKey;
            return (
              <tr
                key={rowKey}
                className={isActive ? "table-primary font-weight-bold" : ""}
                style={isActive ? { backgroundColor: "#e3f2fd" } : {}}
              >
                <td>{v.chr}</td>
                <td>{v.startStr}</td>
                <td>{v.endStr}</td>
                <td>{this.formatCell(v.major_cn, ".2f")}</td>
                <td>{this.formatCell(v.minor_cn, ".2f")}</td>
                <td>{this.formatCell(v.total_cn, ".2f")}</td>
                <td>{this.formatCell(v.rdr, ".3f")}</td>
                <td>{this.formatCell(v.baf, ".3f")}</td>
                <td className="text-center">
                  <i
                    className="fa fa-eye fas text-primary pointer px-1"
                    title="Inspect region in visualization"
                    style={{ cursor: "pointer" }}
                    onClick={() => this.goToHiglass(v.chr, v.start, v.end, rowKey)}
                  ></i>
                </td>
              </tr>
            );
          })}
        </tbody>
      );
    }

    if (!variantsToDisplay || variantsToDisplay.length === 0) {
      tableBody = (
        <tbody>
          <tr>
            <td colSpan={this.state.tableType === "wakhan" ? 12 : 9} className="text-center">
              <span className="text-secondary">
                <i className="fa fa-info-circle fas"></i>
              </span>
              <br />
              <span>Please upload the visualization output file</span>
            </td>
          </tr>
        </tbody>
      );
    }

    let message = "";
    if (variantsToDisplay.length > 0) {
      message = `Displaying variants ${
        this.state.tablePage * PAGE_SIZE + 1
      }-${Math.min(
        (this.state.tablePage + 1) * PAGE_SIZE,
        variantsToDisplay.length
      )} of ${variantsToDisplay.length}`;
    }

    // Breakpoints Table headers & body
    const svTableHead = (
      <thead>
        <tr>
          <th onClick={() => this.sortSvTable("id")}>
            ID <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th scope="col">
            Chrom.{" "}
            <Select
              className="basic-single d-inline-block"
              value={this.state.svSelectedChrom}
              onChange={this.selectSvChrom}
              options={CHROMS}
              closeMenuOnSelect={true}
              placeholder="Select ..."
              menuPortalTarget={document.body}
              styles={{
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />
          </th>
          <th onClick={() => this.sortSvTable("pos")}>
            Position / Range <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th onClick={() => this.sortSvTable("type")}>
            SV Type <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th onClick={() => this.sortSvTable("svlen")}>
            Length <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th onClick={() => this.sortSvTable("hp")}>
            Haplotype <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th onClick={() => this.sortSvTable("vaf")}>
            VAF <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th onClick={() => this.sortSvTable("dv")}>
            Support (DV) <i className="fa fa-fw fa-sort fas text-muted"></i>
          </th>
          <th className="text-center" scope="col">
            Inspect breakpoint
          </th>
        </tr>
      </thead>
    );

    const svVariantsToDisplay = this.state.displayedSvVariants || [];
    const svPageStart = this.state.svTablePage * PAGE_SIZE;
    const svPageEnd = svPageStart + PAGE_SIZE;
    const svPageVariants = svVariantsToDisplay.slice(svPageStart, svPageEnd);

    const svTableBody = (
      <tbody>
        {svPageVariants.length === 0 ? (
          <tr>
            <td colSpan={9} className="text-center text-muted py-4">
              <i className="fa fa-info-circle fas mr-1"></i>
              No structural variation breakpoints available. Upload a Severus VCF or load example data.
            </td>
          </tr>
        ) : (
          svPageVariants.map((v, i) => {
            const rowKey = `sv-${v.id}-${v.chr}-${v.pos}-${i}`;
            const isActive = this.state.activeRowKey === rowKey;
            const badgeColor = SV_BADGE_COLORS[v.type] || "#6c757d";
            const isDifferentChr = v.chr2 && v.chr2 !== v.chr;
            const rangeDisplay = isDifferentChr
              ? `${v.chr}:${v.posStr} ➔ ${v.chr2}:${v.pos2Str}`
              : v.pos !== v.pos2
              ? `${v.posStr} – ${v.pos2Str}`
              : v.posStr;

            return (
              <tr
                key={rowKey}
                className={isActive ? "table-primary font-weight-bold" : ""}
                style={isActive ? { backgroundColor: "#e3f2fd" } : {}}
              >
                <td className="font-italic small text-secondary">{v.id}</td>
                <td>
                  <span className="badge badge-light border">{v.chr}</span>
                  {isDifferentChr && (
                    <span className="badge badge-light border ml-1">➔ {v.chr2}</span>
                  )}
                </td>
                <td>{rangeDisplay}</td>
                <td>
                  <span
                    className="badge text-white px-2 py-1"
                    style={{ backgroundColor: badgeColor, letterSpacing: "0.5px" }}
                  >
                    {v.type}
                  </span>
                </td>
                <td>{v.svlenStr}</td>
                <td>
                  <span
                    className={`badge ${
                      v.hp === "HP-1"
                        ? "badge-danger"
                        : v.hp === "HP-2"
                        ? "badge-primary"
                        : "badge-secondary"
                    }`}
                  >
                    {v.hp}
                  </span>
                </td>
                <td>{v.vaf}</td>
                <td>{v.dv}</td>
                <td className="text-center">
                  <i
                    className="fa fa-eye fas text-primary pointer px-1"
                    title="Inspect breakpoint in visualization"
                    style={{ cursor: "pointer", fontSize: "16px" }}
                    onClick={() =>
                      this.goToBreakpoint(v.chr, v.pos, v.chr2, v.pos2, v.type, rowKey, v.id)
                    }
                  ></i>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    );

    let svMessage = "";
    if (svVariantsToDisplay.length > 0) {
      svMessage = `Displaying breakpoints ${
        this.state.svTablePage * PAGE_SIZE + 1
      }-${Math.min(
        (this.state.svTablePage + 1) * PAGE_SIZE,
        svVariantsToDisplay.length
      )} of ${svVariantsToDisplay.length}`;
    }

    const cnCount = this.state.variants ? this.state.variants.length : 0;
    const svCount = this.state.svVariants ? this.state.svVariants.length : 0;

    return (
      <React.Fragment>
        <div className="row mt-4 mb-4">
          <div className="col-12 ">
            <div className="text-center">
              <div className="my-1" style={{ color: UI_COLORS.uploaderTitleColor }}>
                {LABELS.uploader.title}
              </div>
              <div className="d-inline-flex flex-row align-items-center justify-content-center my-2 p-2 rounded border bg-light">
                <span className="mr-3 font-weight-bold" style={{ fontSize: "14px", color: UI_COLORS.uploaderSubtitleColor }}>
                  {LABELS.uploader.centromereBuildTitle || "Centromere Masking Build:"}
                </span>
                {["GRCh38", "GRCh37", "CHM13"].map((build) => {
                  const isAvailable = this.state.availableCentromereBuilds
                    ? this.state.availableCentromereBuilds[build] !== false
                    : true;
                  return (
                    <label
                      key={build}
                      className={`mr-3 mb-0 d-inline-flex align-items-center ${!isAvailable ? "text-muted" : ""}`}
                      style={{ cursor: isAvailable ? "pointer" : "not-allowed" }}
                      title={!isAvailable ? "File not included in upload" : `Show ${build} centromere regions`}
                    >
                      <input
                        type="radio"
                        name="centromere-build-selector"
                        value={build}
                        checked={this.state.selectedCentromereBuild === build}
                        disabled={!isAvailable}
                        onChange={() => this.handleCentromereBuildChange(build)}
                        className="mr-1"
                      />
                      <span className="font-weight-bold">{build}</span>
                    </label>
                  );
                })}
              </div>
              <div>
                <Uploader populateTable={(d) => this.populateTable(d)} />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs for Copy Number vs Breakpoints */}
        <div className="d-flex flex-wrap justify-content-between align-items-center border-bottom mb-3 pt-2">
          <ul className="nav nav-tabs border-bottom-0" role="tablist">
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link font-weight-bold ${this.state.activeTab === "copyNumber" ? "active text-primary" : "text-secondary"}`}
                style={{
                  borderTop: this.state.activeTab === "copyNumber" ? "3px solid #007bff" : "3px solid transparent",
                  fontSize: "15px",
                  cursor: "pointer",
                }}
                onClick={() => this.setState({ activeTab: "copyNumber", activeRowKey: null })}
              >
                <i className="fa fa-chart-bar fas mr-2"></i>
                Copy Number
                <span className={`badge ${this.state.activeTab === "copyNumber" ? "badge-primary" : "badge-secondary"} badge-pill ml-2`} style={{ fontSize: "11px" }}>
                  {cnCount}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                type="button"
                className={`nav-link font-weight-bold ${this.state.activeTab === "breakpoints" ? "active text-primary" : "text-secondary"}`}
                style={{
                  borderTop: this.state.activeTab === "breakpoints" ? "3px solid #007bff" : "3px solid transparent",
                  fontSize: "15px",
                  cursor: "pointer",
                }}
                onClick={() => this.setState({ activeTab: "breakpoints", activeRowKey: null })}
              >
                <i className="fa fa-bezier-curve fas mr-2"></i>
                Breakpoints
                <span className={`badge ${this.state.activeTab === "breakpoints" ? "badge-primary" : "badge-secondary"} badge-pill ml-2`} style={{ fontSize: "11px" }}>
                  {svCount}
                </span>
              </button>
            </li>
          </ul>

          <div className="text-muted small py-2">
            {this.state.activeTab === "copyNumber" ? (
              <span><i className="fa fa-info-circle fas mr-1"></i>Showing phased copy number segments &amp; coverage</span>
            ) : (
              <span><i className="fa fa-info-circle fas mr-1"></i>Showing structural variation breakpoints</span>
            )}
          </div>
        </div>

        {this.state.activeTab === "copyNumber" ? (
          <React.Fragment>
            <div className="h3">
              {this.state.tableType === "wakhan" ? LABELS.cnvTable.wakhanTitle : LABELS.cnvTable.variantTitle}
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="text-muted small">{message}</div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={this.exportCsv}
              >
                <i className="fa fa-download fas mr-1"></i>
                {LABELS.cnvTable.exportCsvButton}
              </button>
            </div>
            <div className="row">
              <div className="col-12">
                <div className="table-responsive-lg">
                  <table className="table table-hover table-sm">
                    {tableHead}
                    {tableBody}
                  </table>
                </div>
                {this.renderPagination(
                  this.state.tablePage,
                  variantsToDisplay.length,
                  PAGE_SIZE,
                  this.goToPage
                )}
              </div>
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment>
            <div className="h3">
              Structural Variation Breakpoints
            </div>

            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="text-muted small">{svMessage}</div>
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={this.exportCsv}
              >
                <i className="fa fa-download fas mr-1"></i>
                {LABELS.cnvTable.exportCsvButton}
              </button>
            </div>
            <div className="row">
              <div className="col-12">
                <div className="table-responsive-lg">
                  <table className="table table-hover table-sm">
                    {svTableHead}
                    {svTableBody}
                  </table>
                </div>
                {this.renderPagination(
                  this.state.svTablePage,
                  svVariantsToDisplay.length,
                  PAGE_SIZE,
                  this.goToSvPage
                )}
              </div>
            </div>
          </React.Fragment>
        )}
      </React.Fragment>
    );
  }
}
