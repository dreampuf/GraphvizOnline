// __mocks__/graphviz.js

// This mock assumes Graphviz might be expected as a global or can be injected.
// For the "import { Graphviz } from 'URL'" pattern, this mock might need
// to be explicitly mapped or provided via Jest's module mocking system
// if the test environment tries to resolve the URL.

const mockGraphvizInstance = {
  dot: jest.fn().mockReturnValue('mocked_svg_output_string'), // Default mock for dot
  // Add other methods of the Graphviz instance if used by app.js
};

export const Graphviz = {
  load: jest.fn().mockResolvedValue(mockGraphvizInstance),
};

// If app.js expects a default export or Graphviz directly on window after import:
// export default Graphviz;
// or ensure window.Graphviz is set up in tests.
// Given "import { Graphviz } from ...", the named export 'Graphviz' is primary.
// The module itself, if imported as `import * as G from '...'`, would be G.Graphviz.
// If the script tag method is used to load app.js, then `window.Graphviz` would need to be set.
// For now, providing the named export is the most direct mock of the import statement.
