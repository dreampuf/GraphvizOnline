// __mocks__/svg-pan-zoom.js

// This mock simulates the global svgPanZoom function.
const mockSvgPanZoomInstance = {
  resize: jest.fn(),
  fit: jest.fn(),
  center: jest.fn(),
  destroy: jest.fn(),
  // Add other methods if app.js uses them on the instance returned by svgPanZoom()
};

const svgPanZoomMock = jest.fn().mockReturnValue(mockSvgPanZoomInstance);

// If app.js expects it as a default export (e.g. import svgPanZoom from 'svg-pan-zoom')
// export default svgPanZoomMock;

// Since app.js uses it as a global directly (svgPanZoom(...)),
// this file might be used to manually set window.svgPanZoom in test setup.
// For Jest's auto-mocking or jest.mock('module-name'), the export matters.
// Let's export it in a way that's easy to assign globally.
module.exports = svgPanZoomMock;
