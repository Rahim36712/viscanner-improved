import React, { useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { BlobReader, TextWriter, ZipReader } from "@zip.js/zip.js";

async function decompressBlob(blob) {
  let ds = new DecompressionStream("gzip");
  let decompressedStream = blob.stream().pipeThrough(ds);
  return await new Response(decompressedStream).text();
}

const RAR_SIGNATURE = "526172211A07";

function normalizeChromosome(chrom) {
  return chrom.startsWith("chr") ? chrom : "chr" + chrom;
}

function fileBaseName(filename) {
  const parts = filename.split(/[\\/]/);
  return parts[parts.length - 1];
}

async function fileSignature(file) {
  const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0").toUpperCase())
    .join("");
}

function parseHiglassData(v) {
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

function parseSnpData(v, delimiter = "\t") {
  const result = v.trim().split(/\r?\n/);
  const higlassData = [];
  result.forEach((r, i) => {
    if (!r || r.startsWith("#")) {
      return;
    }
    const segment = r.split(delimiter);
    const pos = parseInt(segment[1], 10);
    const value = parseFloat(segment[2]);
    if (i === 0 && (Number.isNaN(pos) || Number.isNaN(value))) {
      return;
    }
    higlassData.push([normalizeChromosome(segment[0]), pos, value]);
  });
  return higlassData;
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

function parseBreakendAlt(alt) {
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

function parseSeverusVcf(v, options = {}) {
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

function parseWakhanCoverageData(v) {
  const rows = [];
  v.trim()
    .split(/\r?\n/)
    .forEach((r) => {
      if (!r || r.startsWith("#")) {
        return;
      }

      const segment = r.split("\t");
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

function parseWakhanSegmentBed(v, haplotypeKey) {
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

function parseWakhanSegmentTableData(hp1Segments, hp2Segments) {
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

function parseWakhanCopyNumberData(hp1Text, hp2Text) {
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
  }

  const wakhanSvTrack = getTrackObject(hgc, "wakhan-sv-track");
  if (wakhanSvTrack) {
    wakhanSvTrack.setData([]);
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function updateWakhanStructuralVariationTrack(data) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const wakhanSvTrack = getTrackObject(hgc, "wakhan-sv-track");
  if (wakhanSvTrack) {
    wakhanSvTrack.setData(data || { variants: [], matchedIds: [] });
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function updateWakhanCoverageTracks(coverageRows, hp1Segments, hp2Segments) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const bafTrack = getTrackObject(hgc, "scanner-result-track-1");
  if (bafTrack) {
    bafTrack.setData([]);
  }

  const wakhanTrack = getTrackObject(hgc, "wakhan-coverage-track");
  if (wakhanTrack) {
    wakhanTrack.setData({
      coverage: coverageRows,
      hp1Segments,
      hp2Segments,
    });
  }

  hgc.api.setViewConfig(viewconfCohort);
}

function updateBafSnpTrack(higlassData) {
  const hgc = window.hgc.current;
  const viewconfCohort = hgc.api.getViewConfig();

  const t1 = getTrackObject(hgc, "scanner-result-track-1");
  if (t1) {
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
      });
      if (entryTexts["phase_corrected_coverage.csv"]) {
        updateWakhanCoverageTracks(
          parseWakhanCoverageData(entryTexts["phase_corrected_coverage.csv"]),
          hp1Segments,
          hp2Segments
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

const Uploader = (props) => {
  const onDrop = useCallback((acceptedFiles) => {
    readUploadedFiles(acceptedFiles, props)
      .then(() => {
        setTimeout(() => {
          resetUploadSpinner();
        }, "2000");
      })
      .catch((error) => {
        showUploadError(error.message || "ViScanner could not read the uploaded file.");
      });
  }, []);

  const onDropAccepted = () => {
    const spinner = document.getElementById("upload-spinner");
    spinner.classList.remove("collapse");
    document.getElementById("overlay").style.display = "block";
  };

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
      ///...baseStyle,
      ...(isFocused ? focusedStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isFocused, isDragAccept, isDragReject]
  );

  return (
    <div className="d-inline-block">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        <button className="btn btn-outline-primary ">
          <i
            id="upload-spinner"
            className="fas fa fa-spinner fa-spin mr-1 collapse"
          ></i>
          Click to upload
        </button>
      </div>
    </div>
  );
};

export default Uploader;

// import "react-dropzone-uploader/dist/styles.css";
// import Dropzone from "react-dropzone-uploader";
// import React from "react";

// // var fileReaderStream = require('filereader-stream')
// // window.Buffer = window.Buffer || require("buffer").Buffer;
// // window.process = {}

// async function decompressBlob(blob) {
//   let ds = new DecompressionStream("gzip");
//   let decompressedStream = blob.stream().pipeThrough(ds);
//   return await new Response(decompressedStream).text();
// }

// const Uploader = () => {
//   // specify upload params and url for your files
//   const getUploadParams = ({ meta }) => {
//     return { url: "https://httpbin.org/post" };
//   };

//   // called every time a file's `status` changes
//   const handleChangeStatus = ({ meta, file }, status) => {
//     console.log(status, meta, file);
//     if (status === "done") {
//       decompressBlob(file).then((v) => console.log(v));
//     }
//   };

//   // receives array of files that are done uploading when submit button is clicked
//   const handleSubmit = (files, allFiles) => {
//     //console.log(files.map(f => f.meta))
//     console.log(files);
//     //allFiles.forEach(f => f.remove())
//   };

//   return (
//     <Dropzone
//       getUploadParams={getUploadParams}
//       onChangeStatus={handleChangeStatus}
//       onSubmit={handleSubmit}
//     />
//   );
// };

// export default Uploader;
