import React from 'react';
import ReactDOM from 'react-dom';
import App, { SampleLegendBanner } from './App';

describe('App component', () => {
  test('is defined and exports a React component function', () => {
    expect(App).toBeDefined();
    expect(typeof App).toBe('function');
  });
});

describe('SampleLegendBanner component', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
    delete window._viscannerDataLoaded;
    delete window._viscannerSampleMetadata;
  });

  test('does not render when no data is loaded', () => {
    ReactDOM.render(<SampleLegendBanner />, container);
    expect(container.innerHTML).toBe('');
  });

  test('renders legend swatches and badges without sample ID or ploidy when metadata is present', () => {
    window._viscannerDataLoaded = true;
    window._viscannerSampleMetadata = {
      sample_name: 'H2009',
      ploidy: '2.3',
      purity: '1.0',
      confidence: '0.71',
    };

    ReactDOM.render(<SampleLegendBanner />, container);

    const text = container.textContent;
    // Sample ID and QC metrics must NOT be rendered
    expect(text).not.toContain('H2009');
    expect(text).not.toContain('Ploidy');
    expect(text).not.toContain('Purity');
    expect(text).not.toContain('Confidence');

    // Upper row dots & lines
    expect(text).toContain('HP-1');
    expect(text).toContain('HP-2');
    expect(text).toContain('BAF');

    // Row 1: SV badges
    expect(text).toContain('DEL');
    expect(text).toContain('INV');
    expect(text).toContain('INS');
    expect(text).toContain('BND');
    expect(text).toContain('DUP');

    // Row 2: Region badges
    expect(text).toContain('LOH Regions');
    expect(text).toContain('Centromeres');
  });
});
