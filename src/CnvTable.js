"use strict";

import React from "react";
import Uploader from "./Uploader";
import { ChromosomeInfo } from "higlass/dist/hglib";
import { format } from "d3-format";
import Select from "react-select";
import { scheduleFitToContent } from "./higlassLayout";
import { LABELS } from "./labelsConfig";

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
    };
  }

  componentDidMount() {}

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
      if(a[value] === "-"){
        return -1
      }
      if(b[value] === "-"){
        return 1
      }
      return a[value] > b[value] ? 1 : b[value] > a[value] ? -1 : 0;
    });

    let sortedByOrder = this.state.sortedByOrder;

    if(this.state.sortedBy === value && sortedByOrder === "asc"){
      // Reverse sort
      console.log("reverse")
      sortedByOrder = "desc";
    }
    else{
      sortedByOrder = "asc";
    }

    this.setState({
      displayedVariants: displayedVariants,
      sortedBy: value,
      sortedByOrder: sortedByOrder
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
    const cnvRows = [];

    // const variantsToDisplay = this.state.displayedVariants.sort(
    //   (a, b) => a.posAbs - b.posAbs
    // );
    const variantsToDisplay = this.state.displayedVariants;
    const variantsToDisplaySliced = this.state.displayedVariants.slice(
      this.state.tablePage * PAGE_SIZE,
      (this.state.tablePage + 1) * PAGE_SIZE
    );

    variantsToDisplaySliced.forEach((variant) => {
      if (this.state.tableType === "wakhan") {
        cnvRows.push(
          <tr>
            <td>{variant.chr}</td>
            <td>{variant.startStr}</td>
            <td>{variant.endStr}</td>
            <td>{this.formatCell(variant.hp1Coverage, ".2f")}</td>
            <td>{this.formatCell(variant.hp1CopyNumber, ".1f")}</td>
            <td>{this.formatCell(variant.hp1Confidence, ".3f")}</td>
            <td>{this.formatCell(variant.hp2Coverage, ".2f")}</td>
            <td>{this.formatCell(variant.hp2CopyNumber, ".1f")}</td>
            <td>{this.formatCell(variant.hp2Confidence, ".3f")}</td>
            <td>{this.formatCell(variant.total_cn, ".1f")}</td>
            <td className="wakhan-breakpoints">{variant.breakpoints}</td>
            <td className="text-center">
              <i
                className="fa fa-eye fas px-1 pointer"
                onClick={() =>
                  this.goToHiglass(variant.chr, variant.start, variant.end)
                }
              ></i>
            </td>
          </tr>
        );
        return;
      }

      cnvRows.push(
        <tr>
          <td>{variant.chr}</td>
          <td>{variant.startStr}</td>
          <td>{variant.endStr}</td>
          <td>{variant.major_cn}</td>
          <td>{variant.minor_cn}</td>
          <td>{variant.total_cn}</td>
          <td>{variant.rdr}</td>
          <td>{variant.baf}</td>
          <td className="text-center">
            <i
              className="fa fa-eye fas px-1 pointer"
              onClick={() =>
                this.goToHiglass(variant.chr, variant.start, variant.end)
              }
            ></i>
          </td>
        </tr>
      );
    });

    const tbody =
      cnvRows.length > 0 ? (
        <tbody>{cnvRows}</tbody>
      ) : (
        <tbody>
          <tr>
            <td colSpan={this.state.tableType === "wakhan" ? 12 : 9} className="text-center p-5">
              <span className="text-secondary">
                <i className="fa fa-info-circle fas"></i>
              </span>
              <br />
              <span>
                Please upload the visualization output file
              </span>
            </td>
          </tr>
        </tbody>
      );

    const navButtons = [];

    if (
      variantsToDisplay.length > PAGE_SIZE &&
      (this.state.tablePage + 1) * PAGE_SIZE <= variantsToDisplay.length
    ) {
      navButtons.push(
        <button className="btn btn-primary btn-sm" onClick={this.nextPage}>
          Next
        </button>
      );
    }

    if (this.state.tablePage > 0) {
      navButtons.push(
        <button
          className="btn btn-primary btn-sm mx-2"
          onClick={this.previousPage}
        >
          Previous
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
              <div className="my-1">
                HiScanner visualization output file (required)
              </div>
              <div className="small text-muted mb-1">
                Include grch38.cen_coord.curated.bed to show masked regions
              </div>
              <Uploader populateTable={(d) => this.populateTable(d)} />
            </div>
          </div>
        </div>

        <div className="h3">
          {this.state.tableType === "wakhan" ? "WAKHAN segment browser" : "Variant browser"}
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
                <thead className="sticky-table-header bg-white">
                  {this.state.tableType === "wakhan" ? this.renderWakhanHeader() : this.renderHiScannerHeader()}
                </thead>
                {tbody}
              </table>
            </div>
          </div>
        </div>
      </React.Fragment>
    );
  }
}
