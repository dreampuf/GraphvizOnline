// __mocks__/lz-string.js

// This mock simulates the global LZString object.
const LZStringMock = {
  compressToEncodedURIComponent: jest.fn(input => `compressed_${input}`),
  decompressFromEncodedURIComponent: jest.fn(input => {
    // A simple mock: if it was "compressed_original", return "original"
    if (typeof input === 'string' && input.startsWith('compressed_')) {
      return input.substring('compressed_'.length);
    }
    return input; // Or some other default behavior for non-matching inputs
  }),
};

// If app.js expects it as a default export (e.g. import LZString from 'lz-string')
// export default LZStringMock;

// Since app.js uses it as a global (or IIFE parameter from global),
// this file might be used to manually set window.LZString in test setup.
// For Jest's auto-mocking or jest.mock('module-name'), the export matters.
// Let's export it in a way that's easy to assign globally.
module.exports = LZStringMock;
