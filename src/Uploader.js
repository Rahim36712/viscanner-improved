import React, { useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";
import { scheduleFitToContent } from "./higlassLayout";
import { registerDatasetExtents } from "./plotBounds";
import { LABELS, UI_COLORS } from "./labelsConfig";
import { DEFAULT_SETTINGS } from "./defaultSettings";

async function decompressBlob(blob) {
  let ds = new DecompressionStream("gzip");
  let decompressedStream = blob.stream().pipeThrough(ds);
  return await new Response(decompressedStream).text();
}

export const RAR_SIGNATURE = "526172211A07";

export function normalizeChromosome(chrom) {
  return chrom.startsWith("chr") ? chrom : "chr" + chrom;
}

function fileBaseName(filename) {
  const parts = filename.split(/[\\/]/);
  return parts[parts.length - 1];
}

export async function fileSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

export function parseHiglassData(v) {
  const result = v.trim().split(/\r?\n/);
  const higlassData = [];
  result.forEach((r, i) => {
    if (i === 0) {
      return;
    }
    const segment = r.split("\t");
    higlassData.push([
      normalizeChromosome(segment[0]),
      parseInt(segment[1], 10),
      parseInt(segment[2], 10),
      parseFloat(segment[3]),
      parseFloat(segment[4]),
      parseFloat(segment[5]),
      parseFloat(segment[6]),
      parseFloat(segment[7]),
      segment[8],
    ]);
  });
  return higlassData;
}

function dataForHaplotypeCopyNumberTrack(data, copyNumberIndex) {
  return data.map((segment) => {
    const copyNumber = segment[copyNumberIndex];
    return [
      segment[0],
      segment[1],
      segment[2],
      segment[3],
      segment[4],
      copyNumber,
      copyNumber,
      segment[7],
      segment[8],
    ];
  });
}

export function parseSnpData(v, delimiter = "\t") {
  const result = v.trim().split(/\r?\n/);
  const higlassData = [];
  result.forEach((r, i) => {
    if (!r || r.startsWith("#")) {
      return;
    }
    const segment = r.split(delimiter);
    const pos = parseInt(segment[1], 10);
    const value = parseFloat(segment[2]);
    if (Number.isNaN(pos) || Number.isNaN(value)) {
      return;
    }
    const chr = normalizeChromosome(segment[0]);
    const item = [chr, pos, value];
    item.chr = chr;
    item.pos = pos;
    item.yvalue = value;
    item.baf = value;
    higlassData.push(item);
  });
  return higlassData;
}

export function parseSampleMetadataCsv(text) {
  if (!text || typeof text !== "string") return null;
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return null;

  const delimiter = lines[0].includes("\t") ? "\t" : lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const values = lines[1].split(delimiter).map((v) => v.trim().replace(/['"]/g, ""));

  const fallbackName =
    (typeof window !== "undefined" && window._viscannerLoadedSampleName) || "Sample 2009";

  const meta = {
    sample_name: fallbackName,
    ploidy: "2.57",
    purity: "0.65",
    confidence: "0.86",
  };

  headers.forEach((header, idx) => {
    const val = values[idx];
    if (val === undefined || val === "") return;
    if (header.includes("sample") || header.includes("name") || header === "id") {
      meta.sample_name = val;
    } else if (header.includes("ploid")) {
      meta.ploidy = val;
    } else if (header.includes("purit")) {
      meta.purity = val;
    } else if (header.includes("confid")) {
      meta.confidence = val;
    }
  });

  return meta;
}

function parseInfoField(infoText) {
  const info = {};
  if (!infoText) {
    return info;
  }
  infoText.split(";").forEach((item) => {
    if (!item) {
      return;
    }
    const [key, ...valueParts] = item.split("=");
    info[key] = valueParts.length ? valueParts.join("=") : true;
  });
  return info;
}

function parseSampleField(formatText, sampleText) {
  const sample = {};
  if (!formatText || !sampleText) {
    return sample;
  }
  const keys = formatText.split(":");
  const values = sampleText.split(":");
  keys.forEach((key, index) => {
    sample[key] = values[index];
  });
  return sample;
}

export function parseBreakendAlt(alt) {
  const match = alt && alt.match(/[\[\]]([^:\[\]]+):(\d+)[\[\]]/);
  if (!match) {
    return null;
  }
  return {
    chr: normalizeChromosome(match[1]),
    pos: parseInt(match[2], 10),
  };
}

function parseNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBreakpointIds(value) {
  if (!value || value === "-") {
    return [];
  }
  return Array.from(value.matchAll(/severus_[A-Za-z0-9_]+/g)).map(
    (match) => match[0]
  );
}

export function parseSeverusVcf(v, options = {}) {
  const passOnly = options.passOnly !== false;
  const rawRecords = [];
  const recordsById = new Map();

  v.trim()
    .split(/\r?\n/)
    .forEach((line) => {
      if (!line || line.startsWith("#")) {
        return;
      }
      const segment = line.split("\t");
      if (segment.length < 8) {
        return;
      }

      const [chrom, posText, id, ref, alt, qual, filter, infoText, formatText, sampleText] = segment;
      if (passOnly && filter !== "PASS") {
        return;
      }

      const info = parseInfoField(infoText);
      const sample = parseSampleField(formatText, sampleText);
      const pos = parseInt(posText, 10);
      const type = info.SVTYPE || (alt || "").replace(/[<>]/g, "") || "BND";
      const end = parseNumber(info.END);
      const svlen = parseNumber(info.SVLEN);
      const bndMate = type === "BND" ? parseBreakendAlt(alt) : null;
      const record = {
        id,
        chr: normalizeChromosome(chrom),
        pos,
        chr2: bndMate ? bndMate.chr : normalizeChromosome(chrom),
        pos2: bndMate ? bndMate.pos : end || (svlen ? pos + Math.abs(svlen) : pos),
        type,
        svlen,
        end,
        filter,
        mateId: info.MATE_ID || null,
        strands: info.STRANDS || "-",
        detailedType: info.DETAILED_TYPE || "-",
        hp: info.HP || "-",
        vaf: sample.VAF || "-",
        dv: sample.DV || "-",
        qual,
        ref,
        alt,
      };

      if (Number.isFinite(record.pos)) {
        rawRecords.push(record);
        recordsById.set(record.id, record);
      }
    });

  const usedBndIds = new Set();
  return rawRecords
    .map((record) => {
      if (record.type !== "BND" || !record.mateId) {
        return record;
      }

      if (usedBndIds.has(record.id)) {
        return null;
      }

      const mate = recordsById.get(record.mateId);
      if (mate) {
        usedBndIds.add(record.id);
        usedBndIds.add(mate.id);
        return {
          ...record,
          chr2: mate.chr,
          pos2: mate.pos,
          mateId: mate.id,
        };
      }
      usedBndIds.add(record.id);
      return record;
    })
    .filter(Boolean);
}

export function parseWakhanCoverageData(v) {
  const rows = [];
  v.trim()
    .split(/\r?\n/)
    .forEach((r) => {
      if (!r || r.startsWith("#")) {
        return;
      }

      const segment = r.trim().split(/\s+/);
      rows.push({
        chr: normalizeChromosome(segment[0]),
        start: parseInt(segment[1], 10),
        end: parseInt(segment[2], 10),
        hp1: parseFloat(segment[3]),
        hp2: parseFloat(segment[4]),
        unphased: parseFloat(segment[5]),
      });
    });
  return rows;
}

export function parseMaskedRegionBed(v) {
  const rows = [];
  v.trim()
    .split(/\r?\n/)
    .forEach((r) => {
      if (!r || r.startsWith("#")) {
        return;
      }

      const segment = r.trim().split(/\s+/);
      const start = parseInt(segment[1], 10);
      const end = parseInt(segment[2], 10);
      if (!segment[0] || !Number.isFinite(start) || !Number.isFinite(end)) {
        return;
      }
      rows.push({
        chr: normalizeChromosome(segment[0]),
        start,
        end,
      });
    });
  return rows;
}

export function parseLohRegionBed(v) {
  return parseMaskedRegionBed(v);
}

export function parseWakhanSegmentBed(v, haplotypeKey) {
  const rows = [];
  v.trim()
    .split(/\r?\n/)
    .forEach((r) => {
      if (!r || r.startsWith("#")) {
        return;
      }
      const segment = r.split("\t");
      const breakpoints = segment.slice(6).join("\t") || "-";
      rows.push({
        chr: normalizeChromosome(segment[0]),
        start: parseInt(segment[1], 10),
        end: parseInt(segment[2], 10),
        coverage: parseFloat(segment[3]),
        [haplotypeKey]: parseFloat(segment[4]),
        confidence: parseFloat(segment[5]),
        breakpoints,
        breakpointIds: parseBreakpointIds(breakpoints),
      });
    });
  return rows;
}

function parseWakhanMatchedSvIds(...segmentGroups) {
  const ids = new Set();
  segmentGroups.forEach((segments) => {
    (segments || []).forEach((segment) => {
      (segment.breakpointIds || []).forEach((id) => ids.add(id));
    });
  });
  return Array.from(ids);
}

export function parseWakhanSegmentTableData(hp1Segments, hp2Segments) {
  const rowsByRegion = new Map();
  const addRows = (rows, haplotypeKey) => {
    rows.forEach((row) => {
      const key = [row.chr, row.start, row.end].join(":");
      const existing = rowsByRegion.get(key) || {
        chr: row.chr,
        start: row.start,
        end: row.end,
        hp1Coverage: "-",
        hp1CopyNumber: "-",
        hp1Confidence: "-",
        hp2Coverage: "-",
        hp2CopyNumber: "-",
        hp2Confidence: "-",
        breakpoints: "-",
      };

      existing[haplotypeKey + "Coverage"] = row.coverage;
      existing[haplotypeKey + "CopyNumber"] = row[haplotypeKey];
      existing[haplotypeKey + "Confidence"] = row.confidence;
      if (row.breakpoints && row.breakpoints !== "-") {
        existing.breakpoints = row.breakpoints;
      }
      rowsByRegion.set(key, existing);
    });
  };

  addRows(hp1Segments, "hp1");
  addRows(hp2Segments, "hp2");

  return Array.from(rowsByRegion.values()).sort(
    (a, b) => a.chr.localeCompare(b.chr, undefined, { numeric: true }) || a.start - b.start
  );
}

export function parseWakhanCopyNumberData(hp1Text, hp2Text) {
  const rowsByRegion = new Map();
  const addRows = (rows, haplotypeKey) => {
    rows.forEach((row) => {
      const key = [row.chr, row.start, row.end].join(":");
      const existing = rowsByRegion.get(key) || {
        chr: row.chr,
        start: row.start,
        end: row.end,
        hp1: 0,
        hp2: 0,
        hp1Coverage: 0,
        hp2Coverage: 0,
      };
      existing[haplotypeKey] = row[haplotypeKey];
      existing[haplotypeKey + "Coverage"] = row.coverage;
      rowsByRegion.set(key, existing);
    });
  };

  addRows(parseWakhanSegmentBed(hp1Text, "hp1"), "hp1");
  addRows(parseWakhanSegmentBed(hp2Text, "hp2"), "hp2");

  return Array.from(rowsByRegion.values())
    .sort((a, b) => a.chr.localeCompare(b.chr, undefined, { numeric: true }) || a.start - b.start)
    .map((row) => [
      row.chr,
      row.start,
      row.end,
      row.hp1,
      row.hp2,
      row.hp1 + row.hp2,
      row.hp1Coverage + row.hp2Coverage,
      Number.NaN,
      "Wakhan",
    ]);
}

function getTrackObject(hgc, trackUid) {
  try {
    return hgc.api.getTrackObject("aa", trackUid);
  } catch (error) {
    return null;
  }
}

function updateCopyNumberTracks(higlassData, includeBafSegments = true) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const t1 = getTrackObject(hgc, "scanner-result-track-1");
  if (t1) {
    t1.setData(includeBafSegments ? higlassData : []);
  }

  const hp1Track = getTrackObject(hgc, "scanner-result-track-hp1");
  if (hp1Track) {
    hp1Track.setData(dataForHaplotypeCopyNumberTrack(higlassData, 3));
  }

  const hp2Track = getTrackObject(hgc, "scanner-result-track-hp2");
  if (hp2Track) {
    hp2Track.setData(dataForHaplotypeCopyNumberTrack(higlassData, 4));
  }

  const wakhanTrack = getTrackObject(hgc, "wakhan-coverage-track");
  if (wakhanTrack) {
    wakhanTrack.setData({});
    if (wakhanTrack.setStructuralVariationData) {
      wakhanTrack.setStructuralVariationData({ variants: [], matchedIds: [] });
    }
  }

  const wakhanSvTrack = getTrackObject(hgc, "wakhan-sv-track");
  if (wakhanSvTrack) {
    wakhanSvTrack.setData([]);
  }
  const wakhanHpSvTrack = getTrackObject(hgc, "wakhan-hp-sv-track");
  if (wakhanHpSvTrack) {
    wakhanHpSvTrack.setData([]);
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function updateWakhanStructuralVariationTrack(data) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const variants = (data && data.variants) || [];
  let hp1Count = 0;
  let hp2Count = 0;
  let unphasedCount = 0;
  variants.forEach((v) => {
    if (!v) return;
    if (v.hp === "1") hp1Count++;
    else if (v.hp === "2") hp2Count++;
    else unphasedCount++;
  });
  const isOnlyUnphased = hp1Count === 0 && hp2Count === 0 && unphasedCount > 0;

  const wakhanSvTrack = getTrackObject(hgc, "wakhan-sv-track");
  if (wakhanSvTrack) {
    wakhanSvTrack.setData(data || { variants: [], matchedIds: [] });
  }
  const wakhanHpSvTrack = getTrackObject(hgc, "wakhan-hp-sv-track");
  if (wakhanHpSvTrack) {
    wakhanHpSvTrack.setData(data || { variants: [], matchedIds: [] });
  }
  const wakhanCoverageTrack = getTrackObject(hgc, "wakhan-coverage-track");
  if (wakhanCoverageTrack && wakhanCoverageTrack.setStructuralVariationData) {
    wakhanCoverageTrack.setStructuralVariationData(data || { variants: [], matchedIds: [] });
  }

  hgc.api.setViewConfig(viewconfCohort);

  if (
    DEFAULT_SETTINGS.enableHp2SvTrack === true &&
    variants.length > 0 &&
    typeof window.updateHpSvTrackVisibility === "function"
  ) {
    window.updateHpSvTrackVisibility(!isOnlyUnphased);
  }
}

function updateWakhanCoverageTracks(coverageRows, hp1Segments, hp2Segments, maskedRegions = [], lohRegions = [], maskedRegionsByBuild = {}, selectedBuild = "GRCh38") {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const bafTrack = getTrackObject(hgc, "scanner-result-track-1");
  if (bafTrack) {
    bafTrack.setData([]);
  }

  const wakhanTrack = getTrackObject(hgc, "wakhan-coverage-track");
  if (wakhanTrack) {
    if (wakhanTrack.chromInfo) {
      registerDatasetExtents(wakhanTrack.chromInfo, {
        coverage: coverageRows,
        hp1Segments,
        hp2Segments,
      });
    }
    const activeMaskedRegions = Array.isArray(maskedRegions) && maskedRegions.length > 0
      ? maskedRegions
      : (maskedRegionsByBuild[selectedBuild] || maskedRegionsByBuild.GRCh38 || []);

    wakhanTrack.setData({
      coverage: coverageRows,
      hp1Segments,
      hp2Segments,
      maskedRegions: activeMaskedRegions,
      maskedRegionsByBuild,
      selectedCentromereBuild: selectedBuild,
      lohRegions,
    });
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function updateBafSnpTrack(higlassData) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const t1 = getTrackObject(hgc, "scanner-result-track-1");
  if (t1) {
    if (t1.chromInfo) {
      registerDatasetExtents(t1.chromInfo, {
        snpData: higlassData,
        bafData: higlassData,
      });
    }
    t1.setSnpData(higlassData);
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function resetUploadSpinner() {
  const spinner = document.getElementById("upload-spinner");
  const overlay = document.getElementById("overlay");
  if (spinner) {
    spinner.classList.add("collapse");
  }
  if (overlay) {
    overlay.style.display = "none";
  }
}

function showUploadError(message) {
  resetUploadSpinner();
  window.alert(message);
}

function parseUploadedEntryTexts(entryTexts, props) {
  let matchedSvIds = [];
  const filenames = Object.keys(entryTexts);

  // 1. Detect centromere files for GRCh38, GRCh37, and CHM13
  const grch38Filename = filenames.find((f) => {
    const l = f.toLowerCase();
    return l === "grch38.cen_coord.curated.bed" || (l.includes("grch38") && l.includes("cen_coord"));
  });

  const grch37Filename = filenames.find((f) => {
    const l = f.toLowerCase();
    return l === "grch37.cen_coord.bed" || (l.includes("grch37") && l.includes("cen_coord"));
  });

  const chm13Filename = filenames.find((f) => {
    const l = f.toLowerCase();
    return l === "chm13v2_cen_coord.bed" || (l.includes("chm13") && l.includes("cen_coord"));
  });

  const genericCenFilename = filenames.find((f) => {
    const l = f.toLowerCase();
    return l.includes("cen_coord") && l.endsWith(".bed");
  });

  const maskedRegionsByBuild = {
    GRCh38: grch38Filename
      ? parseMaskedRegionBed(entryTexts[grch38Filename])
      : genericCenFilename && !grch37Filename && !chm13Filename
      ? parseMaskedRegionBed(entryTexts[genericCenFilename])
      : [],
    GRCh37: grch37Filename ? parseMaskedRegionBed(entryTexts[grch37Filename]) : [],
    CHM13: chm13Filename ? parseMaskedRegionBed(entryTexts[chm13Filename]) : [],
  };

  const availableCentromereBuilds = {
    GRCh38: maskedRegionsByBuild.GRCh38.length > 0,
    GRCh37: maskedRegionsByBuild.GRCh37.length > 0,
    CHM13: maskedRegionsByBuild.CHM13.length > 0,
  };

  const maskedRegions =
    maskedRegionsByBuild.GRCh38.length > 0
      ? maskedRegionsByBuild.GRCh38
      : maskedRegionsByBuild.GRCh37.length > 0
      ? maskedRegionsByBuild.GRCh37
      : maskedRegionsByBuild.CHM13;

  const lohRegionFilename = Object.keys(entryTexts).find((filename) => {
    const lowerFilename = filename.toLowerCase();
    return lowerFilename.includes("loh");
  });
  const lohRegions = lohRegionFilename
    ? parseLohRegionBed(entryTexts[lohRegionFilename])
    : [];

  if (entryTexts["cna_short.txt"]) {
    props.populateTable(parseHiglassData(entryTexts["cna_short.txt"]));
  }

  if (entryTexts["cna_long.txt"]) {
    updateCopyNumberTracks(parseHiglassData(entryTexts["cna_long.txt"]));
  } else {
    const hp1Filename = Object.keys(entryTexts).find((filename) =>
      filename.endsWith("copynumbers_segments_HP_1.bed")
    );
    const hp2Filename = Object.keys(entryTexts).find((filename) =>
      filename.endsWith("copynumbers_segments_HP_2.bed")
    );

    if (hp1Filename && hp2Filename) {
      const sampleMatch = hp1Filename.replace(/_copynumbers_segments_HP_1\.bed$/i, "");
      if (sampleMatch && typeof window !== "undefined") {
        window._viscannerLoadedSampleName = sampleMatch;
      }
      const hp1Segments = parseWakhanSegmentBed(
        entryTexts[hp1Filename],
        "hp1"
      );
      const hp2Segments = parseWakhanSegmentBed(
        entryTexts[hp2Filename],
        "hp2"
      );
      matchedSvIds = parseWakhanMatchedSvIds(hp1Segments, hp2Segments);
      const wakhanData = parseWakhanCopyNumberData(
        entryTexts[hp1Filename],
        entryTexts[hp2Filename]
      );
      props.populateTable({
        type: "wakhan",
        rows: parseWakhanSegmentTableData(hp1Segments, hp2Segments),
        maskedRegionsByBuild,
        availableCentromereBuilds,
      });
      if (entryTexts["phase_corrected_coverage.csv"]) {
        updateWakhanCoverageTracks(
          parseWakhanCoverageData(entryTexts["phase_corrected_coverage.csv"]),
          hp1Segments,
          hp2Segments,
          maskedRegions,
          lohRegions,
          maskedRegionsByBuild,
          availableCentromereBuilds.GRCh38 ? "GRCh38" : availableCentromereBuilds.GRCh37 ? "GRCh37" : "CHM13"
        );
      } else {
        updateCopyNumberTracks(wakhanData, false);
      }
    }
  }

  const severusVcfFilename = Object.keys(entryTexts).find((filename) =>
    filename.toLowerCase().endsWith(".vcf") &&
    filename.toLowerCase().includes("severus")
  );
  if (severusVcfFilename) {
    updateWakhanStructuralVariationTrack(
      {
        variants: parseSeverusVcf(entryTexts[severusVcfFilename], { passOnly: true }),
        matchedIds: matchedSvIds,
      }
    );
  } else {
    updateWakhanStructuralVariationTrack({ variants: [], matchedIds: [] });
  }

  if (entryTexts["snp.txt"]) {
    updateBafSnpTrack(parseSnpData(entryTexts["snp.txt"]));
  } else if (entryTexts["baf.csv"]) {
    updateBafSnpTrack(parseSnpData(entryTexts["baf.csv"], ","));
  }

  // Detect and parse sample metadata CSV if present
  const metadataFilename =
    Object.keys(entryTexts).find((filename) => {
      const lower = filename.toLowerCase();
      return (
        lower.endsWith(".csv") &&
        (lower.includes("metadata") ||
          lower.includes("metric") ||
          lower.includes("sample") ||
          lower.includes("qc") ||
          lower.includes("info"))
      );
    }) ||
    Object.keys(entryTexts).find((filename) => {
      if (!filename.toLowerCase().endsWith(".csv")) return false;
      const text = entryTexts[filename] || "";
      const firstLine = text.split(/\r?\n/)[0]?.toLowerCase() || "";
      return firstLine.includes("ploidy") || firstLine.includes("purity") || firstLine.includes("sample");
    });

  if (metadataFilename && entryTexts[metadataFilename]) {
    const meta = parseSampleMetadataCsv(entryTexts[metadataFilename]);
    if (meta) {
      window._viscannerSampleMetadata = meta;
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("viscanner:sample-metadata-updated", { detail: meta })
        );
      }
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("viscanner:reset-defaults"));
  }

  scheduleFitToContent({ resetLocation: true, preserveLocation: false, delay: 250 });
}

async function readZip(file, props) {
  const signature = await fileSignature(file);
  if (signature.startsWith(RAR_SIGNATURE)) {
    throw new Error(
      "This file is a RAR archive, not a real ZIP. Please create it using Windows 'Send to > Compressed (zipped) folder', or upload the BED/CSV/VCF files directly."
    );
  }

  const zipFileReader = new BlobReader(file);
  const zipReader = new ZipReader(zipFileReader);
  const entryTexts = {};

  try {
    const entries = await zipReader.getEntries();
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.directory) {
          return;
        }
        const writer = new TextWriter();
        entryTexts[fileBaseName(entry.filename)] = await entry.getData(writer);
      })
    );
  } catch (error) {
    throw new Error(
      "ViScanner could not read this archive as a ZIP file. Please remake the archive as a normal .zip, or upload the BED/CSV/VCF files directly."
    );
  } finally {
    await zipReader.close().catch(() => {});
  }

  parseUploadedEntryTexts(entryTexts, props);
}

async function readRawFiles(files, props) {
  const entryTexts = {};
  await Promise.all(
    files.map(async (file) => {
      entryTexts[fileBaseName(file.name)] = await file.text();
    })
  );

  parseUploadedEntryTexts(entryTexts, props);
}

async function readUploadedFiles(files, props) {
  if (!files.length) {
    return;
  }
  if (files.length === 1 && fileBaseName(files[0].name).toLowerCase().endsWith(".zip")) {
    await readZip(files[0], props);
    return;
  }
  await readRawFiles(files, props);
}

const baseStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px",
  borderWidth: 2,
  borderRadius: 2,
  borderColor: "#eeeeee",
  borderStyle: "dashed",
  backgroundColor: "#fafafa",
  color: "#bdbdbd",
  outline: "none",
  transition: "border .24s ease-in-out",
};

const focusedStyle = {
  borderColor: "#2196f3",
};

const acceptStyle = {
  borderColor: "#00e676",
};

const rejectStyle = {
  borderColor: "#ff1744",
};

export async function loadExampleData(props) {
  const spinner = document.getElementById("upload-spinner");
  const overlay = document.getElementById("overlay");
  if (spinner) {
    spinner.classList.remove("collapse");
  }
  if (overlay) {
    overlay.style.display = "block";
  }

  try {
    const { getExampleEntryTexts } = await import("./exampleData");
    const entryTexts = await getExampleEntryTexts();
    parseUploadedEntryTexts(entryTexts, props);
    setTimeout(() => {
      resetUploadSpinner();
    }, 1500);
  } catch (error) {
    showUploadError(error.message || "Failed to load example data.");
  }
}

const Uploader = (props) => {
  const [loadingExample, setLoadingExample] = React.useState(false);

  const onDrop = useCallback((acceptedFiles) => {
    readUploadedFiles(acceptedFiles, props)
      .then(() => {
        setTimeout(() => {
          resetUploadSpinner();
        }, 2000);
      })
      .catch((error) => {
        showUploadError(error.message || "ViScanner could not read the uploaded file.");
      });
  }, [props]);

  const onDropAccepted = () => {
    const spinner = document.getElementById("upload-spinner");
    if (spinner) spinner.classList.remove("collapse");
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.style.display = "block";
  };

  const handleLoadExample = useCallback(async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setLoadingExample(true);
    const spinner = document.getElementById("upload-spinner");
    if (spinner) spinner.classList.remove("collapse");
    const overlay = document.getElementById("overlay");
    if (overlay) overlay.style.display = "block";

    try {
      const { getExampleEntryTexts } = await import("./exampleData");
      const entryTexts = await getExampleEntryTexts();
      parseUploadedEntryTexts(entryTexts, props);
      setTimeout(() => {
        resetUploadSpinner();
        setLoadingExample(false);
      }, 1500);
    } catch (error) {
      setLoadingExample(false);
      showUploadError(error.message || "Failed to load example data.");
    }
  }, [props]);

  const { getRootProps, getInputProps, isFocused, isDragAccept, isDragReject } =
    useDropzone({
      accept: {
        "application/zip": [".zip"],
        "text/csv": [".csv"],
        "text/plain": [".txt", ".bed", ".vcf"],
        "application/octet-stream": [".bed", ".vcf"],
      },
      maxFiles: 10,
      onDrop,
      onDropAccepted,
    });

  const style = useMemo(
    () => ({
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject]
  );

  return (
    <div className="d-flex flex-column align-items-center">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <button
          type="button"
          className="btn btn-outline-primary"
          style={{
            color: UI_COLORS.uploaderButtonText,
            borderColor: UI_COLORS.uploaderButtonBorder,
          }}
        >
          <i
            id="upload-spinner"
            className="fas fa fa-spinner fa-spin mr-1 collapse"
          ></i>
          {LABELS.uploader.buttonText}
        </button>
      </div>
      <div className="my-1 text-muted" style={{ fontSize: "14px" }}>
        {LABELS.uploader.orDividerText || "or"}
      </div>
      <button
        type="button"
        id="load-example-button"
        className="btn btn-outline-primary"
        onClick={handleLoadExample}
        disabled={loadingExample}
        style={{
          color: UI_COLORS.uploaderButtonText,
          borderColor: UI_COLORS.uploaderButtonBorder,
          minWidth: "160px",
        }}
      >
        <i
          id="example-spinner"
          className={`fas fa fa-spinner fa-spin mr-1 ${loadingExample ? "" : "collapse"}`}
        ></i>
        {loadingExample
          ? "Loading..."
          : LABELS.uploader.exampleButtonText || "Load example data"}
      </button>
    </div>
  );
};

export { readZip, readRawFiles, readUploadedFiles, parseUploadedEntryTexts, resetUploadSpinner, showUploadError };
export default Uploader;
