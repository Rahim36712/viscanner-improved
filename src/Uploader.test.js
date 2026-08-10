import {
  normalizeChromosome,
  fileSignature,
  parseHiglassData,
  parseSnpData,
  parseBreakendAlt,
  parseSeverusVcf,
  parseWakhanCoverageData,
  parseMaskedRegionBed,
  parseLohRegionBed,
  parseWakhanSegmentBed,
  parseWakhanSegmentTableData,
  parseWakhanCopyNumberData,
  RAR_SIGNATURE,
} from "./Uploader";

describe("Uploader Data Parsers and Utilities", () => {
  describe("normalizeChromosome", () => {
    test("prefixes numeric chromosome strings with 'chr'", () => {
      expect(normalizeChromosome("1")).toBe("chr1");
      expect(normalizeChromosome("22")).toBe("chr22");
    });

    test("leaves chromosome strings already starting with 'chr' unchanged", () => {
      expect(normalizeChromosome("chr1")).toBe("chr1");
      expect(normalizeChromosome("chrX")).toBe("chrX");
      expect(normalizeChromosome("chrM")).toBe("chrM");
    });

    test("handles edge case chromosome names (e.g., 'MT', 'X')", () => {
      expect(normalizeChromosome("MT")).toBe("chrMT");
      expect(normalizeChromosome("X")).toBe("chrX");
    });
  });

  describe("fileSignature and RAR Detection", () => {
    test("detects RAR archive magic bytes (526172211A07)", async () => {
      const rarHeader = new Uint8Array([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x00, 0x00]);
      const blob = new Blob([rarHeader]);
      const sig = await fileSignature(blob);
      expect(sig).toBe("526172211A070000");
      expect(sig.startsWith(RAR_SIGNATURE)).toBe(true);
    });

    test("returns correct hex signature for valid ZIP files (504B0304)", async () => {
      const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const blob = new Blob([zipHeader]);
      const sig = await fileSignature(blob);
      expect(sig).toBe("504B030414000000");
      expect(sig.startsWith(RAR_SIGNATURE)).toBe(false);
    });
  });

  describe("parseBreakendAlt", () => {
    test("parses standard BND ALT format (e.g., ]chr2:123456]N)", () => {
      expect(parseBreakendAlt("]chr2:123456]N")).toEqual({ chr: "chr2", pos: 123456 });
      expect(parseBreakendAlt("N[chrX:789012[")).toEqual({ chr: "chrX", pos: 789012 });
    });

    test("normalizes chromosome name in breakend ALT", () => {
      expect(parseBreakendAlt("]1:500000]A")).toEqual({ chr: "chr1", pos: 500000 });
    });

    test("returns null for non-BND ALT strings or malformed patterns", () => {
      expect(parseBreakendAlt("<DEL>")).toBeNull();
      expect(parseBreakendAlt("<INV>")).toBeNull();
      expect(parseBreakendAlt("A")).toBeNull();
      expect(parseBreakendAlt(null)).toBeNull();
      expect(parseBreakendAlt(undefined)).toBeNull();
    });
  });

  describe("parseSeverusVcf", () => {
    const validVcfContent = [
      "##fileformat=VCFv4.2",
      "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tSAMPLE",
      "chr1\t1000\tseverus_1\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000;SVLEN=-1000;HP=1\tGT:VAF:DV\t0/1:0.45:15",
      "chr1\t3000\tseverus_2\tN\t]chr1:5000]N\t50\tPASS\tSVTYPE=BND;MATE_ID=severus_3;HP=2\tGT:VAF:DV\t0/1:0.30:10",
      "chr1\t5000\tseverus_3\tN\tN[chr1:3000[\t50\tPASS\tSVTYPE=BND;MATE_ID=severus_2;HP=2\tGT:VAF:DV\t0/1:0.30:10",
      "chr2\t8000\tseverus_4\tN\t<DUP>\t30\tLowQual\tSVTYPE=DUP;END=9000;SVLEN=1000\tGT:VAF:DV\t0/1:0.10:2",
    ].join("\n");

    test("parses PASS variants correctly when passOnly is true (default)", () => {
      const records = parseSeverusVcf(validVcfContent);
      expect(records).toHaveLength(2); // 1 DEL + 1 mated BND pair (severus_2 & severus_3 merged)
      expect(records[0].id).toBe("severus_1");
      expect(records[0].type).toBe("DEL");
      expect(records[0].hp).toBe("1");
      expect(records[0].vaf).toBe("0.45");
      expect(records[0].dv).toBe("15");
    });

    test("includes non-PASS variants when passOnly is false", () => {
      const records = parseSeverusVcf(validVcfContent, { passOnly: false });
      const lowQualRecord = records.find((r) => r.id === "severus_4");
      expect(lowQualRecord).toBeDefined();
      expect(lowQualRecord.filter).toBe("LowQual");
    });

    test("correctly mates BND records using MATE_ID", () => {
      const records = parseSeverusVcf(validVcfContent);
      const bndRecord = records.find((r) => r.id === "severus_2");
      expect(bndRecord).toBeDefined();
      expect(bndRecord.chr2).toBe("chr1");
      expect(bndRecord.pos2).toBe(5000);
      expect(bndRecord.mateId).toBe("severus_3");
    });

    test("handles missing HP field by defaulting to '-'", () => {
      const vcfWithoutHp = "chr1\t1000\tseverus_9\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000\tGT\t0/1";
      const records = parseSeverusVcf(vcfWithoutHp);
      expect(records[0].hp).toBe("-");
    });

    test("handles corrupted VCF header lines and malformed columns without throwing", () => {
      const corruptedVcf = [
        "##corrupted_header_without_equals",
        "invalid_line_without_tabs",
        "chr1\tnot_a_number\tseverus_err\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL",
        "chr1\t1000", // too few columns
      ].join("\n");

      expect(() => parseSeverusVcf(corruptedVcf)).not.toThrow();
      expect(parseSeverusVcf(corruptedVcf)).toEqual([]);
    });

    test("handles non-finite positions gracefully (NaN pos)", () => {
      const nanVcf = "chr1\tNaN\tseverus_nan\tN\t<DEL>\t60\tPASS\tSVTYPE=DEL;END=2000\tGT\t0/1";
      expect(parseSeverusVcf(nanVcf)).toEqual([]);
    });
  });

  describe("parseHiglassData", () => {
    test("parses segment TSV skipping header row 0", () => {
      const tsv = "chrom\tstart\tend\tcn1\tcn2\tcn3\tcn4\tcn5\tsample\nchr1\t100\t200\t1.5\t2.0\t0.5\t1.0\t0.8\tS1";
      const parsed = parseHiglassData(tsv);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual(["chr1", 100, 200, 1.5, 2.0, 0.5, 1.0, 0.8, "S1"]);
    });
  });

  describe("parseSnpData", () => {
    test("parses TSV and CSV SNP data correctly", () => {
      const tsv = "#Comment\nchr1\t1000\t0.45\n2\t2000\t0.55";
      const parsedTsv = parseSnpData(tsv, "\t");
      expect(parsedTsv).toHaveLength(2);
      expect(parsedTsv[0].chr).toBe("chr1");
      expect(parsedTsv[1].chr).toBe("chr2");

      const csv = "chr1,1000,0.45";
      const parsedCsv = parseSnpData(csv, ",");
      expect(parsedCsv[0].baf).toBe(0.45);
    });

    test("skips header row if row 0 has NaN pos or value", () => {
      const dataWithHeader = "chr\tpos\tbaf\nchr1\t1000\t0.50";
      const parsed = parseSnpData(dataWithHeader, "\t");
      expect(parsed).toHaveLength(1);
      expect(parsed[0].pos).toBe(1000);
    });

    test("skips comment lines preceding text column headers", () => {
      const dataWithCommentAndHeader = "# Comment line\nchr\tpos\tbaf\nchr1\t500\t0.33\nchr2\t1500\t0.66";
      const parsed = parseSnpData(dataWithCommentAndHeader, "\t");
      expect(parsed).toHaveLength(2);
      expect(parsed[0].chr).toBe("chr1");
      expect(parsed[0].pos).toBe(500);
      expect(parsed[0].baf).toBe(0.33);
      expect(parsed[1].chr).toBe("chr2");
      expect(parsed[1].pos).toBe(1500);
      expect(parsed[1].baf).toBe(0.66);
    });
  });

  describe("parseWakhanCoverageData", () => {
    test("parses coverage CSV/TSV data", () => {
      const coverageText = "chr1 100 200 12.5 13.0 1.2";
      const rows = parseWakhanCoverageData(coverageText);
      expect(rows[0]).toEqual({
        chr: "chr1",
        start: 100,
        end: 200,
        hp1: 12.5,
        hp2: 13.0,
        unphased: 1.2,
      });
    });

    test("skips empty and comment lines", () => {
      const coverageText = "#header\n\nchr1 100 200 12.5 13.0 1.2";
      const rows = parseWakhanCoverageData(coverageText);
      expect(rows).toHaveLength(1);
    });
  });

  describe("parseMaskedRegionBed", () => {
    test("parses valid masked region BED lines", () => {
      const bedText = "chr1 1000 2000 centromere";
      const rows = parseMaskedRegionBed(bedText);
      expect(rows).toEqual([{ chr: "chr1", start: 1000, end: 2000 }]);
    });

    test("skips invalid start/end or missing chrom", () => {
      const bedText = "chr1 NaN 2000\n\t1000\t2000";
      const rows = parseMaskedRegionBed(bedText);
      expect(rows).toEqual([]);
    });
  });

  describe("parseLohRegionBed", () => {
    test("parses valid LOH BED file lines", () => {
      const bedText = "chr2\t5000\t15000\tLOH_region_1";
      const rows = parseLohRegionBed(bedText);
      expect(rows).toEqual([{ chr: "chr2", start: 5000, end: 15000 }]);
    });

    test("skips invalid rows and comments in LOH BED file", () => {
      const bedText = "# header\nchrX\t100\t200\nchr1\tinvalid\t300";
      const rows = parseLohRegionBed(bedText);
      expect(rows).toEqual([{ chr: "chrX", start: 100, end: 200 }]);
    });
  });

  describe("parseWakhanSegmentBed", () => {
    test("parses HP segment BED and extracts severus breakpoint IDs", () => {
      const bedText = "chr1\t100\t500\t10.5\t2.0\t0.95\tseverus_1,severus_2";
      const rows = parseWakhanSegmentBed(bedText, "hp1");
      expect(rows[0].hp1).toBe(2.0);
      expect(rows[0].breakpointIds).toEqual(["severus_1", "severus_2"]);
    });

    test("handles empty/dash breakpoints", () => {
      const bedText = "chr1\t100\t500\t10.5\t2.0\t0.95";
      const rows = parseWakhanSegmentBed(bedText, "hp2");
      expect(rows[0].hp2).toBe(2.0);
      expect(rows[0].breakpoints).toBe("-");
      expect(rows[0].breakpointIds).toEqual([]);
    });
  });

  describe("parseWakhanSegmentTableData", () => {
    test("merges HP1 and HP2 segment BED records by genomic region key", () => {
      const hp1 = [{ chr: "chr1", start: 100, end: 500, coverage: 10, hp1: 2, confidence: 0.9, breakpoints: "severus_1" }];
      const hp2 = [{ chr: "chr1", start: 100, end: 500, coverage: 12, hp2: 1, confidence: 0.85, breakpoints: "severus_1" }];
      const merged = parseWakhanSegmentTableData(hp1, hp2);
      expect(merged).toHaveLength(1);
      expect(merged[0].hp1CopyNumber).toBe(2);
      expect(merged[0].hp2CopyNumber).toBe(1);
    });
  });

  describe("parseWakhanCopyNumberData", () => {
    test("combines HP1 and HP2 text inputs into track segment rows", () => {
      const hp1Text = "chr1\t100\t500\t10.0\t2.0\t0.95\t-";
      const hp2Text = "chr1\t100\t500\t12.0\t1.0\t0.90\t-";
      const copyNumData = parseWakhanCopyNumberData(hp1Text, hp2Text);
      expect(copyNumData).toHaveLength(1);
      expect(copyNumData[0]).toEqual(["chr1", 100, 500, 2.0, 1.0, 3.0, 22.0, NaN, "Wakhan"]);
    });
  });
});
