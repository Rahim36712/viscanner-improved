// 1. Polyfill TextEncoder and TextDecoder from Node util if missing
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// 2. Polyfill TransformStream for @zip.js/zip.js in Node/JSDOM
if (typeof global.TransformStream === 'undefined') {
  try {
    const { TransformStream, ReadableStream, WritableStream } = require('stream/web');
    global.TransformStream = TransformStream;
    if (typeof global.ReadableStream === 'undefined') global.ReadableStream = ReadableStream;
    if (typeof global.WritableStream === 'undefined') global.WritableStream = WritableStream;
  } catch (e) {
    global.TransformStream = class TransformStream {
      constructor() {
        this.readable = {};
        this.writable = {};
      }
    };
  }
}

// 3. Polyfill crypto.getRandomValues for uuid/higlass in Node/JSDOM
if (typeof global.crypto === 'undefined' || typeof global.crypto.getRandomValues === 'undefined') {
  const crypto = require('crypto');
  global.crypto = global.crypto || {};
  global.crypto.getRandomValues = function (buffer) {
    return crypto.randomFillSync(buffer);
  };
}

// 4. Polyfill Blob.prototype.arrayBuffer if missing in JSDOM
if (typeof Blob !== 'undefined' && typeof Blob.prototype.arrayBuffer === 'undefined') {
  Blob.prototype.arrayBuffer = function () {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(this);
    });
  };
}

// 5. Mock window.URL object creation methods
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

// 6. Mock HTMLCanvasElement 2D context for PixiJS / safeRendering / PDF exports
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

// 7. Mock DecompressionStream for gzip blob decompression in Uploader.js
if (typeof global.DecompressionStream === 'undefined') {
  global.DecompressionStream = class DecompressionStream {
    constructor(format) {
      this.format = format;
    }
  };
}

// 8. Mock global fetch API
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

// 9. Mock Element.prototype.scrollIntoView
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView === 'undefined') {
  Element.prototype.scrollIntoView = jest.fn();
}

// 10. Global HiGlass container object initialization
if (typeof window !== 'undefined') {
  window.hgc = window.hgc || { current: null };
}

// 11. Mock ES module dependencies that use import/export syntax in node_modules
jest.mock('smaht-higlass-misc/es/BaseTrack', () => {
  return function MockBaseTrack(HGC, ...args) {
    return class {
      constructor(context, options) {
        this.context = context;
        this.options = options;
      }
    };
  };
}, { virtual: true });

jest.mock('smaht-higlass-misc/es/ScannerResultTrack', () => {
  return function MockScannerResultTrack() {};
}, { virtual: true });

jest.mock('smaht-higlass-misc/es/chrom-utils', () => ({
  ChromosomeInfo: jest.fn(),
  chrToAbs: jest.fn(),
}), { virtual: true });

jest.mock('smaht-higlass-misc/es/legend-utils', () => ({}), { virtual: true });
jest.mock('smaht-higlass-misc/es/misc-utils', () => ({}), { virtual: true });

jest.mock('d3-format', () => ({
  format: jest.fn((fmt) => (val) => String(val)),
}), { virtual: true });

jest.mock('d3-scale', () => ({
  scaleLinear: jest.fn(() => {
    const scale = (x) => x;
    scale.domain = jest.fn().mockReturnThis();
    scale.range = jest.fn().mockReturnThis();
    scale.invert = jest.fn((x) => x);
    return scale;
  }),
}), { virtual: true });

jest.mock('higlass-text/es/TextTrack', () => {
  return function MockTextTrack() {};
}, { virtual: true });

jest.mock('axios', () => ({
  get: jest.fn(() => Promise.resolve({ data: {} })),
  post: jest.fn(() => Promise.resolve({ data: {} })),
}), { virtual: true });
