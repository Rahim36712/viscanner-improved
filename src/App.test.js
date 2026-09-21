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

  test('badges have background colors matching SV_CONFIG and TRACK_COLORS', () => {
    window._viscannerDataLoaded = true;
    window._viscannerSampleMetadata = { sample_name: 'test' };

    ReactDOM.render(<SampleLegendBanner />, container);

    const spans = Array.from(container.querySelectorAll('span'));
    const findBadge = (text) => spans.find((s) => s.textContent.trim() === text);

    const centromereBadge = findBadge('Centromeres');
    expect(centromereBadge).toBeDefined();
    expect(centromereBadge.style.backgroundColor).toBe('rgb(126, 31, 20)'); // #7e1f14

    const lohBadge = findBadge('LOH Regions');
    expect(lohBadge).toBeDefined();
    expect(lohBadge.style.backgroundColor).toBe('rgb(41, 128, 185)'); // #2980b9

    const delBadge = findBadge('DEL');
    expect(delBadge).toBeDefined();
    expect(delBadge.style.backgroundColor).toBe('rgb(207, 7, 89)'); // #CF0759

    const invBadge = findBadge('INV');
    expect(invBadge).toBeDefined();
    expect(invBadge.style.backgroundColor).toBe('rgb(40, 48, 222)'); // #2830DE

    const insBadge = findBadge('INS');
    expect(insBadge).toBeDefined();
    expect(insBadge.style.backgroundColor).toBe('rgb(224, 207, 3)'); // #e0cf03

    const bndBadge = findBadge('BND');
    expect(bndBadge).toBeDefined();
    expect(bndBadge.style.backgroundColor).toBe('rgb(115, 115, 115)'); // #737373

    const dupBadge = findBadge('DUP');
    expect(dupBadge).toBeDefined();
    expect(dupBadge.style.backgroundColor).toBe('rgb(23, 129, 23)'); // #178117
  });
});
