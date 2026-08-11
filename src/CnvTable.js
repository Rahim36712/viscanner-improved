"use strict";

import React from "react";
import Uploader from "./Uploader";
import { ChromosomeInfo } from "higlass/dist/hglib";
import { format } from "d3-format";
import Select from "react-select";
import { scheduleFitToContent } from "./higlassLayout";
import { LABELS, UI_COLORS } from "./labelsConfig";

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
    };
  }

  componentDidMount() {}

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
      tablePage: prevState.tablePage - 1,
    }));
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
    const tableType = data && data.type === "wakhan" ? "wakhan" : "hiscanner";
    const rows = tableType === "wakhan" ? data.rows : data;

    ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
      // Now we can use the chromInfo object to convert
      .then((chromInfo) => {
        rows.forEach((variant) => {
          if (tableType === "wakhan") {
            const totalCn =
              Number.isFinite(variant.hp1CopyNumber) && Number.isFinite(variant.hp2CopyNumber)
                ? variant.hp1CopyNumber + variant.hp2CopyNumber
                : "-";
            variants.push({
              posAbs: chromInfo.chrToAbs([variant.chr, variant.start]),
              chr: variant.chr,
              start: variant.start,
              end: variant.end,
              startStr: format(",.0f")(variant.start),
              endStr: format(",.0f")(variant.end),
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
            posAbs: chromInfo.chrToAbs([chrom, start]),
            chr: chrom,
            start: start,
            end: end,
            startStr: format(",.0f")(start),
            endStr: format(",.0f")(end),
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
      });
  };

  formatCell = (value, formatter = ".3f") => {
    if (value === "-" || value === undefined || value === null || Number.isNaN(value)) {
      return "-";
    }
    return Number.isFinite(value) ? format(formatter)(value) : value;
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

  goToHiglass = (chr, start, end) => {
    const hgc = window.hgc.current;
    if (!hgc) {
      console.warn("Higlass component not found.");
      return;
    }
    document.getElementById("sec:visualization").scrollIntoView(true);

    setTimeout(() => {
      const viewconf = hgc.api.getViewConfig();

      ChromosomeInfo("https://s3.amazonaws.com/pkerp/data/hg19/chromSizes.tsv")
        // Now we can use the chromInfo object to convert
        .then((chromInfo) => {
          hgc.api.zoomTo(
            viewconf.views[0].uid,
            chromInfo.chrToAbs([chr, start]),
            chromInfo.chrToAbs([chr, end]),
            chromInfo.chrToAbs(["chr1", 0]),
            chromInfo.chrToAbs(["chr1", 1000]),
            2500 // Animation time
          );
          scheduleFitToContent({ delay: 2600 });
        });
    }, "500");
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
          </tr>
        </thead>
      );

      const pageStart = this.state.tablePage * PAGE_SIZE;
      const pageEnd = pageStart + PAGE_SIZE;
      const pageVariants = variantsToDisplay.slice(pageStart, pageEnd);

      tableBody = (
        <tbody>
          {pageVariants.map((v, i) => (
            <tr key={`wakhan-${v.chr}-${v.start}-${i}`}>
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
            </tr>
          ))}
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
          </tr>
        </thead>
      );

      const pageStart = this.state.tablePage * PAGE_SIZE;
      const pageEnd = pageStart + PAGE_SIZE;
      const pageVariants = variantsToDisplay.slice(pageStart, pageEnd);

      tableBody = (
        <tbody>
          {pageVariants.map((v, i) => (
            <tr key={`hiscanner-${v.chr}-${v.start}-${i}`}>
              <td>{v.chr}</td>
              <td>{v.startStr}</td>
              <td>{v.endStr}</td>
              <td>{this.formatCell(v.major_cn, ".2f")}</td>
              <td>{this.formatCell(v.minor_cn, ".2f")}</td>
              <td>{this.formatCell(v.total_cn, ".2f")}</td>
              <td>{this.formatCell(v.rdr, ".3f")}</td>
              <td>{this.formatCell(v.baf, ".3f")}</td>
            </tr>
          ))}
        </tbody>
      );
    }

    if (!variantsToDisplay || variantsToDisplay.length === 0) {
      tableBody = (
        <tbody>
          <tr>
            <td colSpan="11" className="text-center">
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

    const navButtons = [];

    if (
      variantsToDisplay.length > PAGE_SIZE &&
      (this.state.tablePage + 1) * PAGE_SIZE <= variantsToDisplay.length
    ) {
      navButtons.push(
        <button className="btn btn-primary btn-sm" onClick={this.nextPage} key="next-btn">
          {LABELS.cnvTable.nextButton}
        </button>
      );
    }

    if (this.state.tablePage > 0) {
      navButtons.push(
        <button
          className="btn btn-primary btn-sm mx-2"
          onClick={this.previousPage}
          key="prev-btn"
        >
          {LABELS.cnvTable.previousButton}
        </button>
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

    return (
      <React.Fragment>
        <div className="row mt-4 mb-5">
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

        <div className="h3">
          {this.state.tableType === "wakhan" ? LABELS.cnvTable.wakhanTitle : LABELS.cnvTable.variantTitle}
        </div>

        <div className="d-flex flex-row-reverse mb-2">
          {navButtons}
          <button
            type="button"
            className="btn btn-outline-secondary btn-sm mx-2"
            onClick={this.exportCsv}
          >
            <i className="fa fa-download fas mr-1"></i>
            {LABELS.cnvTable.exportCsvButton}
          </button>
          <div className="pt-1 mx-2">{message}</div>
        </div>
        <div className="row">
          <div className="col-12">
            <div className="table-responsive-lg">
              <table className="table table-hover table-sm">
                {tableHead}
                {tableBody}
              </table>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
