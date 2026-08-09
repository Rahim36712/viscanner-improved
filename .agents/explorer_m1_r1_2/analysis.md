# ViScanner Jest Execution Environment Analysis

## Executive Summary
This report analyzes the Jest execution environment requirements for running White-Box unit and integration tests for **ViScanner**. It evaluates the existing dependencies in `package.json`, `.babelrc` configuration, test script options, and browser API mock requirements for `src/setupTests.js`.

---

## 1. Package Dependencies and Babel Configuration Analysis

### 1.1 Dependency Examination (`package.json`)
An inspection of `package.json` reveals the following relevant packages:
- **`react-scripts`**: `"5.0.1"` (in `dependencies`). Includes Jest 27+, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`, and Webpack/Babel integration.
- **Babel Core & Presets** (in `devDependencies`):
  - `@babel/core`: `"^7.22.11"`
  - `@babel/preset-env`: `"^7.22.14"`
  - `@babel/preset-react`: `"^7.22.5"`
- **Testing Libraries**:
  - `@testing-library/jest-dom`: `"^5.17.0"` (transitive/included with `react-scripts`, referenced in `src/setupTests.js`)
  - `@playwright/test`: `"^1.62.1"` (for E2E testing in M2)

### 1.2 Babel Configuration (`.babelrc`)
The root `.babelrc` file contains:
```json
{
  "presets": ["@babel/preset-env", "@babel/preset-react"]
}
```
This configuration ensures ES6+ modules and React JSX syntax are properly transpiled by Babel.

### 1.3 Current `package.json` Scripts Status
The current `scripts` section in `package.json` is:
```json
"scripts": {
  "start": "webpack serve --mode development",
  "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && webpack --mode production",
  "deploy": "node scripts/deploy.js",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```
**Key Finding**: There is currently **no `"test"` script** defined in `package.json`. Adding `"test"` is required for Milestone M1 and M3 compliance.

---

## 2. Test Runner Configuration Choice (`npm test`)

### 2.1 Option Comparison

| Metric | Option A: `react-scripts test --watchAll=false` | Option B: `jest --watchAll=false` |
|---|---|---|
| **Dependency Requirement** | Already installed (`react-scripts: 5.0.1`) | Requires custom `jest.config.js` and babel-jest mapping |
| **Babel/JSX Processing** | Built-in via CRA / `.babelrc` support | Requires explicit `transform` rules in `jest.config.js` |
| **CSS / Asset Importing** | Handled out-of-the-box (mocks CSS modules automatically) | Requires `identity-obj-proxy` and module name mapping |
| **`setupTests.js` Auto-loading** | Auto-detects `src/setupTests.js` | Must be configured via `setupFilesAfterEnv` |
| **CI / Non-Interactive** | `--watchAll=false` flag ensures single run & exit code 0 | `--watchAll=false` or `--ci` flag |

### 2.2 Recommended Configuration
**Recommendation**: Use **`"test": "react-scripts test --watchAll=false"`**.

Rationale:
1. ViScanner is structured around standard React CRA conventions (`eslintConfig`: `["react-app", "react-app/jest"]`, `src/setupTests.js` existing).
2. `react-scripts test` automatically executes `src/setupTests.js` prior to running test files (`src/*.test.js`).
3. Adding `--watchAll=false` prevents Jest from entering interactive watch mode in CI/automated runner environments, ensuring clean execution and standard exit codes.

### 2.3 `package.json` Target Change
In `package.json`, update `"scripts"`:
```json
"scripts": {
  "start": "webpack serve --mode development",
  "build": "node -e \"require('fs').rmSync('dist',{recursive:true,force:true})\" && webpack --mode production",
  "test": "react-scripts test --watchAll=false",
  "deploy": "node scripts/deploy.js",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui"
}
```

---

## 3. Required Browser API Mocks in `src/setupTests.js`

Jsdom does not implement several modern browser APIs used across ViScanner's data parsers, custom tracks, and UI export features. To prevent test failures caused by `TypeError` or `Not implemented` errors, `src/setupTests.js` must be expanded with the following global mocks.

### 3.1 Required Mocks Matrix

| API / Feature | Affected Modules in `src/` | Cause of Error in JSDOM | Mock Requirement |
|---|---|---|---|
| **`window.URL.createObjectURL` & `revokeObjectURL`** | `Uploader.js`, `pdfExport.js`, `App.js` | JSDOM does not implement Blob URL generation | Mock with `jest.fn(() => 'blob:mock-url')` |
| **`HTMLCanvasElement.prototype.getContext`** | `safeRendering.js`, `pdfExport.js`, `WakhanStructuralVariationTrack.js` | JSDOM canvas 2D context is missing by default | Mock 2D context methods (`fillRect`, `moveTo`, `lineTo`, etc.) |
| **`TextEncoder` & `TextDecoder`** | `Uploader.js` (`@zip.js/zip.js` processing) | Node/JSDOM global scope mapping | Polyfill from Node `util` module |
| **`DecompressionStream`** | `Uploader.js` (`decompressBlob` gzip handler) | Browser Stream API missing in JSDOM | Mock stub class `DecompressionStream` |
| **`fetch` API** | `GeneSearchBox.js`, `AlignedChromosomeLabelsTrack.js` | `fetch` is undefined in JSDOM environment | Global `jest.fn()` mock returning resolved Response |
| **`Element.prototype.scrollIntoView`** | `CnvTable.js` (`scrollIntoView` call) | JSDOM layout engine does not implement scrolling | Mock with `jest.fn()` |
| **`window.hgc`** | `App.js`, `CnvTable.js`, `Uploader.js`, `GeneSearchBox.js` | Global HiGlass component reference | Initialize `window.hgc = window.hgc || { current: null }` |

### 3.2 Recommended Content for `src/setupTests.js`

```javascript
import '@testing-library/jest-dom';

// 1. Polyfill TextEncoder and TextDecoder from Node util if missing
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// 2. Mock window.URL object creation methods
if (typeof window !== 'undefined') {
  if (typeof window.URL.createObjectURL === 'undefined') {
    Object.defineProperty(window.URL, 'createObjectURL', {
      value: jest.fn(() => 'blob:mock-url'),
      writable: true,
    });
  }
  if (typeof window.URL.revokeObjectURL === 'undefined') {
    Object.defineProperty(window.URL, 'revokeObjectURL', {
      value: jest.fn(),
      writable: true,
    });
  }
}

// 3. Mock HTMLCanvasElement 2D context for PixiJS / safeRendering / PDF exports
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
    fillRect: jest.fn(),
    clearRect: jest.fn(),
    getImageData: jest.fn(() => ({ data: new Uint8Array(4) })),
    putImageData: jest.fn(),
    createImageData: jest.fn(() => []),
    setTransform: jest.fn(),
    drawImage: jest.fn(),
    save: jest.fn(),
    fillText: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    closePath: jest.fn(),
    stroke: jest.fn(),
    translate: jest.fn(),
    scale: jest.fn(),
    rotate: jest.fn(),
    arc: jest.fn(),
    fill: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    transform: jest.fn(),
    rect: jest.fn(),
    clip: jest.fn(),
  }));
}

// 4. Mock DecompressionStream for gzip blob decompression in Uploader.js
if (typeof global.DecompressionStream === 'undefined') {
  global.DecompressionStream = class DecompressionStream {
    constructor(format) {
      this.format = format;
    }
  };
}

// 5. Mock global fetch API
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
      text: () => Promise.resolve(''),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    })
  );
}

// 6. Mock Element.prototype.scrollIntoView
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

// 7. Global HiGlass container object initialization
if (typeof window !== 'undefined') {
  window.hgc = window.hgc || { current: null };
}
```

---

## 4. Implementation Steps for Milestone M1

When implementation begins, the following tasks should be performed in order:
1. Update `package.json` scripts to add `"test": "react-scripts test --watchAll=false"`.
2. Replace `src/setupTests.js` content with the mock setup defined in section 3.2.
3. Verify that existing unit tests (`src/safeRendering.test.js`) pass cleanly with `npm test`.
4. Proceed with authoring new unit test files (`src/Uploader.test.js`, `src/plotBounds.test.js`, `src/WakhanStructuralVariationTrack.test.js`).
