import React from "react";
import ReactDOM from "react-dom";
import { CnvTable } from "./CnvTable";

// Mock higlass ChromosomeInfo
jest.mock("higlass/dist/hglib", () => ({
  ChromosomeInfo: jest.fn(() =>
    Promise.resolve({
      chromLengths: { chr1: 249250621, chr2: 243199373 },
      chromSizes: { chr1: 249250621, chr2: 243199373 },
      chrToAbs: jest.fn(([chr, pos]) => (chr === "chr1" ? pos : 249250621 + pos)),
    })
  ),
}));

// Mock Uploader child component
jest.mock("./Uploader", () => {
  return function DummyUploader() {
    return <div data-testid="mock-uploader">Uploader Mock</div>;
  };
});

describe("CnvTable Component - Dual Tab System & Inspection", () => {
  let container;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    window.hgc = {
      current: {
        api: {
          getViewConfig: jest.fn(() => ({ views: [{ uid: "aa" }] })),
          zoomTo: jest.fn(),
        },
      },
    };
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
    window.scrollTo = jest.fn();
  });

  afterEach(() => {
    ReactDOM.unmountComponentAtNode(container);
    document.body.removeChild(container);
    container = null;
    delete window.hgc;
  });

  test("renders dual navigation tabs: Copy Number and Breakpoints", () => {
    ReactDOM.render(<CnvTable />, container);
    const buttons = container.querySelectorAll(".nav-tabs button");
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain("Copy Number");
    expect(buttons[1].textContent).toContain("Breakpoints");
  });

  test("populates SV variants and updates count badges", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    tableInstance.populateTable({
      type: "wakhan",
      rows: [
        {
          chr: "chr1",
          start: 100000,
          end: 200000,
          hp1Coverage: 30,
          hp1CopyNumber: 1,
          hp1Confidence: 0.95,
          hp2Coverage: 60,
          hp2CopyNumber: 2,
          hp2Confidence: 0.98,
          breakpoints: "severus_1",
        },
      ],
      svVariants: [
        {
          id: "severus_DEL_1",
          chr: "chr1",
          pos: 150000,
          chr2: "chr1",
          pos2: 180000,
          type: "DEL",
          svlen: 30000,
          hp: "1",
          vaf: "0.42",
          dv: "18",
          filter: "PASS",
        },
        {
          id: "severus_BND_2",
          chr: "chr2",
          pos: 500000,
          chr2: "chr1",
          pos2: 200000,
          type: "BND",
          svlen: 0,
          hp: "2",
          vaf: "0.33",
          dv: "12",
          filter: "PASS",
        },
      ],
    });

    expect(tableInstance.state.variants.length).toBe(1);
    expect(tableInstance.state.svVariants.length).toBe(2);
  });

  test("switching to Breakpoints tab renders structural variation table", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    tableInstance.populateSvVariants([
      {
        id: "severus_DEL_1",
        chr: "chr1",
        pos: 150000,
        chr2: "chr1",
        pos2: 180000,
        type: "DEL",
        svlen: 30000,
        hp: "1",
        vaf: "0.42",
        dv: "18",
        filter: "PASS",
      },
    ]);

    tableInstance.setState({ activeTab: "breakpoints" });

    expect(container.innerHTML).toContain("Structural Variation Breakpoints");
    expect(container.innerHTML).toContain("severus_DEL_1");
    expect(container.innerHTML).toContain("DEL");
  });

  test("clicking tab buttons switches between Copy Number and Breakpoints views", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    const buttons = container.querySelectorAll(".nav-tabs button");
    expect(tableInstance.state.activeTab).toBe("copyNumber");

    // Click Breakpoints tab
    buttons[1].click();
    expect(tableInstance.state.activeTab).toBe("breakpoints");

    // Click Copy Number tab
    buttons[0].click();
    expect(tableInstance.state.activeTab).toBe("copyNumber");
  });

  test("SV table filtering by chromosome and sorting works correctly", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    tableInstance.populateSvVariants([
      { id: "sv_b", chr: "chr2", pos: 3000, type: "DEL", svlen: 500, hp: "1", vaf: "0.2" },
      { id: "sv_a", chr: "chr1", pos: 1000, type: "INS", svlen: 200, hp: "2", vaf: "0.5" },
      { id: "sv_c", chr: "chr1", pos: 2000, type: "INV", svlen: 1000, hp: "1", vaf: "0.8" },
    ]);

    // Filter by chr1
    tableInstance.selectSvChrom({ value: "chr1", label: "chr1" });
    expect(tableInstance.state.displayedSvVariants.length).toBe(2);

    // Filter by All
    tableInstance.selectSvChrom({ value: "All", label: "All" });
    expect(tableInstance.state.displayedSvVariants.length).toBe(3);

    // Sort by type ascending then descending
    tableInstance.sortSvTable("type");
    expect(tableInstance.state.svSortedBy).toBe("type");
    expect(tableInstance.state.svSortedByOrder).toBe("asc");

    tableInstance.sortSvTable("type");
    expect(tableInstance.state.svSortedByOrder).toBe("desc");
  });

  test("clicking the eye icon on a Breakpoint row calls goToBreakpoint", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    tableInstance.populateSvVariants([
      { id: "sv_1", chr: "chr1", pos: 120000, chr2: "chr1", pos2: 150000, type: "DEL", svlen: 30000, hp: "1", vaf: "0.4" },
    ]);
    tableInstance.setState({ activeTab: "breakpoints" });

    const eyeIcon = container.querySelector("tbody tr td i.fa-eye");
    expect(eyeIcon).not.toBeNull();

    const goToSpy = jest.spyOn(tableInstance, "goToBreakpoint");
    eyeIcon.click();
    expect(goToSpy).toHaveBeenCalledWith("chr1", 120000, "chr1", 150000, "DEL", expect.any(String));
  });

  test("exportCsv works for breakpoints without errors", () => {
    let tableInstance;
    ReactDOM.render(
      <CnvTable
        ref={(inst) => {
          tableInstance = inst;
        }}
      />,
      container
    );

    tableInstance.populateSvVariants([
      { id: "sv_1", chr: "chr1", pos: 120000, chr2: "chr1", pos2: 150000, type: "DEL", svlen: 30000, hp: "1", vaf: "0.4" },
    ]);
    tableInstance.setState({ activeTab: "breakpoints" });

    expect(() => tableInstance.exportCsv()).not.toThrow();
  });
});

