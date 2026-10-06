import React, { useState } from "react";
import { LABELS } from "./labelsConfig";

const DEFAULT_COMMANDS = [
  "git clone https://github.com/wakhan-visualization/wakhan-visualization.github.io.git",
  "cd wakhan-visualization.github.io",
  "npm install",
  "npm start",
];

export function LocalRunInstructions() {
  const [copied, setCopied] = useState(false);
  const commands = LABELS?.localRunCommands || DEFAULT_COMMANDS;
  const fullText = commands.join("\n");

  const fallbackCopy = (text) => {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // ignore
    }
  };

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator?.clipboard?.writeText) {
      navigator.clipboard
        .writeText(fullText)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch(() => {
          fallbackCopy(fullText);
        });
    } else {
      fallbackCopy(fullText);
    }
  };

  return (
    <div
      className="local-run-instructions mx-auto my-3"
      style={{
        maxWidth: "680px",
        borderRadius: "8px",
        overflow: "hidden",
        backgroundColor: "#1e1e24",
        border: "1px solid #343a40",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
      }}
    >
      <div
        className="d-flex justify-content-between align-items-center px-3 py-2"
        style={{
          backgroundColor: "#16161a",
          borderBottom: "1px solid #2d3139",
          fontSize: "12px",
          color: "#9ca3af",
          userSelect: "none",
        }}
      >
        <div className="d-flex align-items-center">
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#ff5f56",
              marginRight: "6px",
            }}
          />
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#ffbd2e",
              marginRight: "6px",
            }}
          />
          <span
            style={{
              display: "inline-block",
              width: "10px",
              height: "10px",
              borderRadius: "50%",
              backgroundColor: "#27c93f",
              marginRight: "10px",
            }}
          />
          <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#cbd5e1" }}>
            Run locally
          </span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="btn btn-sm btn-outline-light py-0 px-2"
          style={{
            fontSize: "11px",
            lineHeight: "1.6",
            borderRadius: "4px",
            borderColor: copied ? "#28a745" : "#4b5563",
            color: copied ? "#28a745" : "#e2e8f0",
            backgroundColor: copied ? "rgba(40, 167, 69, 0.1)" : "transparent",
            transition: "all 0.15s ease-in-out",
          }}
          title="Copy commands to clipboard"
        >
          {copied ? (
            <>
              <i className="fa fa-check mr-1" aria-hidden="true"></i> Copied!
            </>
          ) : (
            <>
              <i className="fa fa-clone mr-1" aria-hidden="true"></i> Copy
            </>
          )}
        </button>
      </div>
      <div
        className="p-3 text-left"
        style={{
          margin: 0,
          fontFamily:
            'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontSize: "13px",
          lineHeight: "1.6",
          color: "#f8f9fa",
          overflowX: "auto",
        }}
      >
        {commands.map((cmd, idx) => (
          <div
            key={idx}
            className="text-nowrap"
            style={{ display: "flex", alignItems: "baseline" }}
          >
            <span
              style={{
                color: "#6c757d",
                userSelect: "none",
                marginRight: "10px",
                fontFamily: "monospace",
              }}
            >
              $
            </span>
            <span style={{ color: "#e2e8f0" }}>{cmd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default LocalRunInstructions;
