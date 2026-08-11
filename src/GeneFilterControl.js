"use strict";

import React from "react";
import _ from "underscore";
import axios from "axios";
import { LABELS } from "./labelsConfig";

const PRESET_TERT_CANCER = [
  "TERT", "TP53", "MYC", "EGFR", "KRAS", "PIK3CA", "PTEN", "BRCA1", "BRCA2", "ERBB2"
];

const PRESET_DNA_REPAIR = [
  "BRCA1", "BRCA2", "ATM", "ATR", "PALB2", "RAD51", "CHEK2"
];

export class GeneFilterControl extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      inputValue: "",
      selectedGenes: [],
      suggestions: [],
      showDropdown: false,
      loading: false,
    };

    this.debouncedFetchSuggestions = _.debounce(
      this.fetchSuggestions.bind(this),
      300
    );
  }

  fetchSuggestions() {
    const query = this.state.inputValue.trim();
    if (query.length < 2) {
      this.setState({ suggestions: [], showDropdown: false, loading: false });
      return;
    }

    this.setState({ loading: true });
    const url = `https://higlass.io/api/v1/suggest/?d=OHJakQICQD6gTD7skx4EWA&ac=${encodeURIComponent(
      query
    )}`;

    axios
      .get(url)
      .then((res) => {
        if (res && res.data && Array.isArray(res.data)) {
          this.setState({
            suggestions: res.data.slice(0, 8),
            showDropdown: res.data.length > 0,
            loading: false,
          });
        } else {
          this.setState({ suggestions: [], showDropdown: false, loading: false });
        }
      })
      .catch(() => {
        this.setState({ suggestions: [], showDropdown: false, loading: false });
      });
  }

  handleInputChange = (evt) => {
    const val = evt.target.value;
    this.setState({ inputValue: val }, () => {
      this.debouncedFetchSuggestions();
    });
  };

  handleKeyDown = (evt) => {
    if (evt.key === "Enter") {
      evt.preventDefault();
      this.addGene(this.state.inputValue);
    }
  };

  addGene = (geneNameRaw) => {
    const gene = geneNameRaw ? geneNameRaw.trim().toUpperCase() : "";
    if (!gene) return;

    if (!this.state.selectedGenes.includes(gene)) {
      const updated = [...this.state.selectedGenes, gene];
      this.setState(
        {
          selectedGenes: updated,
          inputValue: "",
          suggestions: [],
          showDropdown: false,
        },
        () => {
          if (this.props.onFilterChange) {
            this.props.onFilterChange(updated);
          }
        }
      );
    } else {
      this.setState({ inputValue: "", suggestions: [], showDropdown: false });
    }
  };

  removeGene = (geneToRemove) => {
    const updated = this.state.selectedGenes.filter((g) => g !== geneToRemove);
    this.setState({ selectedGenes: updated }, () => {
      if (this.props.onFilterChange) {
        this.props.onFilterChange(updated);
      }
    });
  };

  applyPreset = (presetList) => {
    const uppercasePreset = presetList.map((g) => String(g).toUpperCase());
    this.setState(
      {
        selectedGenes: uppercasePreset,
        inputValue: "",
        suggestions: [],
        showDropdown: false,
      },
      () => {
        if (this.props.onFilterChange) {
          this.props.onFilterChange(uppercasePreset);
        }
      }
    );
  };

  applyVisibleGenesPreset = () => {
    if (this.props.onFetchVisibleGenes) {
      const visibleGenes = this.props.onFetchVisibleGenes();
      if (Array.isArray(visibleGenes) && visibleGenes.length > 0) {
        this.applyPreset(visibleGenes);
      }
    }
  };

  clearFilter = () => {
    this.setState(
      {
        selectedGenes: [],
        inputValue: "",
        suggestions: [],
        showDropdown: false,
      },
      () => {
        if (this.props.onFilterChange) {
          this.props.onFilterChange([]);
        }
      }
    );
  };

  handleSelectSuggestion = (geneName) => {
    this.addGene(geneName);
  };

  render() {
    const { inputValue, selectedGenes, suggestions, showDropdown, loading } =
      this.state;
    const { onZoomToGene, onFetchVisibleGenes } = this.props;
    const labels = LABELS.geneFilter || {};

    return (
      <div className="gene-filter-control mb-3">
        <div className="d-flex justify-content-between align-items-center mb-1">
          <small className="font-weight-bold text-muted">
            {labels.filterLabel || "Filter visible genes on track"}
          </small>
          {selectedGenes.length > 0 ? (
            <span className="badge badge-info" style={{ fontSize: "75%" }}>
              {(labels.showingFiltered || "Filtered: {count}").replace(
                "{count}",
                selectedGenes.length
              )}
            </span>
          ) : (
            <span className="badge badge-light text-muted" style={{ fontSize: "75%" }}>
              {labels.showingAll || "Showing all genes"}
            </span>
          )}
        </div>

        {/* Input box with add button and autocomplete dropdown */}
        <div className="position-relative">
          <div className="input-group input-group-sm mb-2">
            <input
              type="text"
              className="form-control"
              placeholder={labels.inputPlaceholder || "Add gene (e.g. TERT, TP53)"}
              value={inputValue}
              onChange={this.handleInputChange}
              onKeyDown={this.handleKeyDown}
            />
            <div className="input-group-append">
              <button
                className="btn btn-outline-primary btn-sm"
                type="button"
                onClick={() => this.addGene(inputValue)}
                disabled={!inputValue.trim()}
              >
                {loading ? <i className="fa fa-spinner fa-spin fas" /> : <i className="fa fa-plus fas" />}
              </button>
            </div>
          </div>

          {/* Autocomplete Dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <div
              className="list-group position-absolute w-100 shadow-sm"
              style={{
                zIndex: 1050,
                maxHeight: "160px",
                overflowY: "auto",
                top: "100%",
                left: 0,
              }}
            >
              {suggestions.map((item, idx) => {
                const gName = item.geneName || item.name || item;
                return (
                  <button
                    key={idx}
                    type="button"
                    className="list-group-item list-group-item-action py-1 px-2 text-left"
                    style={{ fontSize: "0.85rem" }}
                    onClick={() => this.handleSelectSuggestion(gName)}
                  >
                    <strong>{gName}</strong>{" "}
                    {item.chr ? (
                      <small className="text-muted">
                        ({item.chr}:{item.txStart})
                      </small>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Gene Tags */}
        {selectedGenes.length > 0 && (
          <div
            className="d-flex flex-wrap gap-1 mb-2 p-1 border rounded bg-white"
            style={{ maxHeight: "110px", overflowY: "auto" }}
          >
            {selectedGenes.map((gene) => (
              <span
                key={gene}
                className="badge badge-primary d-inline-flex align-items-center mr-1 mb-1"
                style={{ fontSize: "0.82rem", padding: "0.35em 0.55em", fontWeight: 500 }}
              >
                <span>{gene}</span>

                {/* Zoom shortcut icon */}
                {onZoomToGene && (
                  <i
                    className="fa fa-search-plus fas ml-1 mr-1 text-light opacity-75"
                    style={{ cursor: "pointer" }}
                    title={(labels.zoomToGeneTooltip || "Zoom to gene") + ` ${gene}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onZoomToGene(gene);
                    }}
                  />
                )}

                {/* Remove icon */}
                <i
                  className="fa fa-times fas ml-1"
                  style={{ cursor: "pointer" }}
                  title={(labels.removeGeneTooltip || "Remove gene") + ` ${gene}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    this.removeGene(gene);
                  }}
                />
              </span>
            ))}
          </div>
        )}

        {/* Preset Buttons */}
        <div className="mt-1">
          <div className="text-muted mb-1 d-flex justify-content-between align-items-center" style={{ fontSize: "0.75rem" }}>
            <span>{labels.presetsTitle || "Presets:"}</span>
            {selectedGenes.length > 0 && (
              <button
                type="button"
                className="btn btn-link text-danger p-0 border-0"
                style={{ fontSize: "0.75rem", textDecoration: "none" }}
                onClick={this.clearFilter}
              >
                <i className="fa fa-times-circle fas mr-1" />
                {labels.clearFilter || "Clear"}
              </button>
            )}
          </div>
          <div className="d-flex flex-column gap-1">
            {onFetchVisibleGenes && (
              <button
                type="button"
                className="btn btn-outline-success btn-sm btn-block py-1 mb-1"
                style={{ fontSize: "0.78rem" }}
                onClick={this.applyVisibleGenesPreset}
                title="Filter by genes currently loaded in the plot view"
              >
                <i className="fa fa-eye fas mr-1" />
                {labels.presetVisiblePlot || "Filter by Genes in Current Plot"}
              </button>
            )}
            <div className="btn-group btn-group-sm w-100" role="group">
              <button
                type="button"
                className="btn btn-outline-info py-0 px-1"
                style={{ fontSize: "0.75rem" }}
                onClick={() => this.applyPreset(PRESET_TERT_CANCER)}
                title="Filter by TERT & cancer driver genes"
              >
                {labels.presetCancer || "TERT & Drivers"}
              </button>
              <button
                type="button"
                className="btn btn-outline-info py-0 px-1"
                style={{ fontSize: "0.75rem" }}
                onClick={() => this.applyPreset(PRESET_DNA_REPAIR)}
                title="Filter by DNA repair genes"
              >
                {labels.presetDnaRepair || "DNA Repair"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }
}
