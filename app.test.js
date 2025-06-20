/**
 * @jest-environment jsdom
 */

// Set a flag to indicate a testing environment for app.js
window.JEST_TEST_ENV = true;

// Mocks for global libraries used by app.js
// It's good practice to put these at the top or in a setup file.
// For this exercise, direct assignment before loading app.js.
// Note: __mocks__ directory should contain these files.
// Jest might auto-mock if named correctly, but explicit is clearer here.
// Corrected paths assuming __mocks__ is a sibling to app.test.js (both in root)
window.ace = require('./__mocks__/ace');
window.Graphviz = require('./__mocks__/graphviz').Graphviz; // Named export
window.svgPanZoom = require('./__mocks__/svg-pan-zoom');
window.LZString = require('./__mocks__/lz-string');


// Required for loading app.js content
const fs = require('fs');
const path = require('path');

describe('app.js tests', () => {
  let appScriptContent; // To store app.js content
  let appDomElements; // To store reference to domElements from app.js testingInterface
  let appConstants; // To store reference to constants from app.js
  let appInterface; // To store reference to all exposed functions

  beforeAll(() => {
    // Read app.js content once
    try {
      appScriptContent = fs.readFileSync(path.resolve(__dirname, 'app.js'), 'utf8');
    } catch (err) {
      console.error("Failed to read app.js for tests. Ensure the path is correct and file exists.", err);
      throw err; // Fail tests if app.js can't be read
    }
  });

  beforeEach(() => {
    // Set up the basic HTML structure that app.js expects
    document.body.innerHTML = `
      <div id="editor"></div>
      <div id="review"></div>
      <div id="options">
        <div id="format"><select><option value="svg">SVG</option><option value="png">PNG</option><option value="json">JSON</option></select></div>
        <div id="engine"><select><option value="dot">Dot</option><option value="circo">Circo</option></select></div>
        <div id="raw"><input type="checkbox" id="raw-checkbox-id"></div> <!-- Added id for direct access if needed -->
      </div>
      <button id="toggle-btn">◀</button>
      <div id="status"></div>
      <button id="download">Download</button>
      <button id="share">Share</button>
      <input type="text" id="shareurl" style="display: none;">
      <div id="error"></div>
    `;

    // Use fake timers for setTimeout/clearTimeout
    jest.useFakeTimers();

    // Execute app.js script content in the JSDOM environment
    // This will run the IIFE and attach event listeners, populate domElements, etc.
    // And also expose testingInterface due to window.JEST_TEST_ENV = true;
    const scriptEl = document.createElement('script');
    scriptEl.textContent = appScriptContent;
    document.body.appendChild(scriptEl); // Append to body to ensure execution context
    scriptEl.remove(); // Clean up script element after execution

    // Store references from the testing interface after app.js has run
    if (window.testingInterface) {
      appInterface = window.testingInterface;
      appDomElements = window.testingInterface.domElements;
      appConstants = window.testingInterface.constants;
    } else {
      throw new Error("testingInterface not exposed on window. Check app.js testing exposure logic.");
    }
  });

  afterEach(() => {
    jest.clearAllTimers(); // Clear any pending timers
    jest.restoreAllMocks();  // Clean up spies
    document.body.innerHTML = ''; // Clean up DOM
    delete window.testingInterface;
    // `isCollapsed` is a script-level var in app.js, not on window.
    // It gets reset when app.js script is re-executed in beforeEach.
  });

  describe('show_status', () => {
    let statusEl;
    beforeEach(() => { statusEl = appDomElements.status; });

    test('should display status message', () => {
      appInterface.show_status('Test message');
      expect(statusEl.innerHTML).toBe('Test message');
    });
    test('should clear status after hideDelay', () => {
      appInterface.show_status('Temporary message', 1000);
      expect(statusEl.innerHTML).toBe('Temporary message');
      jest.advanceTimersByTime(1000);
      expect(statusEl.innerHTML).toBe('');
    });
    test('should clear previous timeout if called again', () => {
      const clearTimeoutSpy = jest.spyOn(window, 'clearTimeout');
      appInterface.show_status('First message', 1000);
      appInterface.show_status('Second message', 500);
      expect(clearTimeoutSpy).toHaveBeenCalled();
    });
    test('should not clear status if hideDelay is 0 or not provided', () => {
      appInterface.show_status('Persistent message');
      expect(statusEl.innerHTML).toBe('Persistent message');
      jest.advanceTimersByTime(5000);
      expect(statusEl.innerHTML).toBe('Persistent message');
    });
  });

  describe('show_error', () => {
    let errorEl, reviewEl, statusEl;
    const STATUS_ERROR_AUTOHIDE_DELAY_MS = 500;

    beforeEach(() => {
      errorEl = appDomElements.errorContainer;
      reviewEl = appDomElements.review;
      statusEl = appDomElements.status;
      errorEl.innerHTML = '';
      reviewEl.classList.remove('error', 'working');
    });

    test('should display error message with title', () => {
      appInterface.show_error('Something broke', 'Test Error');
      expect(errorEl.textContent).toBe('Test Error: Something broke');
      expect(reviewEl.classList.contains('error')).toBe(true);
      expect(reviewEl.classList.contains('working')).toBe(false);
    });
    test('should use default title "Error" if not provided', () => {
      appInterface.show_error(new Error('Network failed'));
      expect(errorEl.textContent).toBe('Error: Network failed');
    });
    test('should display string error if error is not an Error object', () => {
      appInterface.show_error('A simple string error');
      expect(errorEl.textContent).toBe('Error: A simple string error');
    });
    test('should update status bar with title and clear it after delay', () => {
      appInterface.show_error('Bad stuff happened', 'Custom Error Title');
      expect(statusEl.innerHTML).toBe('Custom Error Title');
      jest.advanceTimersByTime(STATUS_ERROR_AUTOHIDE_DELAY_MS);
      expect(statusEl.innerHTML).toBe('');
    });
    test('should set review panel classes correctly', () => {
      reviewEl.classList.add('working');
      appInterface.show_error('Test error');
      expect(reviewEl.classList.contains('error')).toBe(true);
      expect(reviewEl.classList.contains('working')).toBe(false);
    });
  });

  describe('selectOptionFromUrlParams', () => {
    let mockSelectElement;
    let showErrorSpy;
    beforeEach(() => {
      mockSelectElement = document.createElement('select');
      mockSelectElement.innerHTML = `<option value="val1">Opt1</option><option value="val2">Opt2</option>`;
      document.body.appendChild(mockSelectElement);
      showErrorSpy = jest.spyOn(appInterface, 'show_error');
    });
    afterEach(() => {
      document.body.removeChild(mockSelectElement);
    });

    test('should select the correct option if param exists and value is valid', () => {
      const params = new URLSearchParams('?myparam=val2');
      appInterface.selectOptionFromUrlParams('myparam', mockSelectElement, params, appInterface.show_error);
      expect(mockSelectElement.value).toBe('val2');
      expect(showErrorSpy).not.toHaveBeenCalled();
    });
    test('should not change selection if param does not exist', () => {
      mockSelectElement.value = 'val1';
      const params = new URLSearchParams('?otherparam=val2');
      appInterface.selectOptionFromUrlParams('myparam', mockSelectElement, params, appInterface.show_error);
      expect(mockSelectElement.value).toBe('val1');
      expect(showErrorSpy).not.toHaveBeenCalled();
    });
    test('should call showErrorFn if param exists but value is invalid', () => {
      const params = new URLSearchParams('?myparam=invalidVal');
      mockSelectElement.value = 'val1';
      appInterface.selectOptionFromUrlParams('myparam', mockSelectElement, params, appInterface.show_error);
      expect(mockSelectElement.value).toBe('val1');
      expect(showErrorSpy).toHaveBeenCalledWith(expect.objectContaining({ message: "Invalid 'myparam' parameter: invalidVal" }), "URL Parameter Error");
    });
  });

  describe('handleToggleClick', () => {
    let toggleBtnEl, editorEl, reviewEl, optionsEl;
    let resizeSVGSpy;
    beforeEach(() => {
      toggleBtnEl = appDomElements.toggleBtn;
      editorEl = appDomElements.editor;
      reviewEl = appDomElements.review;
      optionsEl = appDomElements.options;
      editorEl.classList.remove('collapsed');
      reviewEl.classList.remove('expanded');
      optionsEl.classList.remove('expanded');
      toggleBtnEl.innerHTML = '◀';
      resizeSVGSpy = jest.spyOn(appInterface, 'resizeSVG');
    });

    test('should toggle to collapsed state on first click', () => {
      toggleBtnEl.click();
      expect(editorEl.classList.contains('collapsed')).toBe(true);
      expect(reviewEl.classList.contains('expanded')).toBe(true);
      expect(optionsEl.classList.contains('expanded')).toBe(true);
      expect(toggleBtnEl.innerHTML).toBe('▶');
      jest.advanceTimersByTime(appConstants.LAYOUT_ADJUST_DELAY_MS);
      expect(resizeSVGSpy).toHaveBeenCalledTimes(1);
    });
    test('should toggle back to expanded state on second click', () => {
      toggleBtnEl.click();
      jest.advanceTimersByTime(appConstants.LAYOUT_ADJUST_DELAY_MS);
      toggleBtnEl.click();
      expect(editorEl.classList.contains('collapsed')).toBe(false);
      expect(reviewEl.classList.contains('expanded')).toBe(false);
      expect(optionsEl.classList.contains('expanded')).toBe(false);
      expect(toggleBtnEl.innerHTML).toBe('◀');
      jest.advanceTimersByTime(appConstants.LAYOUT_ADJUST_DELAY_MS);
      expect(resizeSVGSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('resizeSVG', () => {
    let reviewEl;
    let mockSvgElement;
    let mockPanZoomInstance;
    beforeEach(() => {
      reviewEl = appDomElements.review;
      mockPanZoomInstance = { resize: jest.fn(), fit: jest.fn(), center: jest.fn() };
      window.svgPanZoom.mockReturnValue(mockPanZoomInstance);
      reviewEl.innerHTML = '<svg id="test-svg"></svg>';
      mockSvgElement = reviewEl.querySelector('svg');
    });
    afterEach(() => { reviewEl.innerHTML = ''; window.svgPanZoom.mockClear(); });

    test('should call svgPanZoom methods if SVG exists', () => {
      appInterface.resizeSVG();
      expect(window.svgPanZoom).toHaveBeenCalledWith(mockSvgElement);
      expect(mockPanZoomInstance.resize).toHaveBeenCalledTimes(1);
      expect(mockPanZoomInstance.fit).toHaveBeenCalledTimes(1);
      expect(mockPanZoomInstance.center).toHaveBeenCalledTimes(1);
      expect(mockSvgElement.style.width).toBe('100%');
      expect(mockSvgElement.style.height).toBe('100%');
    });
    test('should not throw or call svgPanZoom methods if SVG does not exist', () => {
      reviewEl.innerHTML = '';
      expect(() => appInterface.resizeSVG()).not.toThrow();
      expect(window.svgPanZoom).not.toHaveBeenCalled();
    });
  });

  describe('copyShareURL', () => {
    let shareBtnEl, shareUrlInputEl;
    let mockEditor;
    let showStatusSpy, copyToClipboardSpy, showErrorSpy;

    beforeEach(() => {
      shareBtnEl = appDomElements.shareBtn;
      shareUrlInputEl = appDomElements.shareUrlInput;
      mockEditor = window.ace.edit();

      showStatusSpy = jest.spyOn(appInterface, 'show_status');
      copyToClipboardSpy = jest.spyOn(appInterface, 'copyToClipboard');
      showErrorSpy = jest.spyOn(appInterface, 'show_error');

      shareBtnEl.disabled = false;
      shareBtnEl.value = 'Share';
      shareUrlInputEl.style.display = 'none';
      shareUrlInputEl.value = '';

      mockEditor.session.getDocument.mockReturnValue({ getValue: jest.fn().mockReturnValue('graph G {}') });
      window.LZString.compressToEncodedURIComponent.mockImplementation(input => `compressed_${input}`);
    });

    test('should generate, display share URL, and show success on copy', () => {
      copyToClipboardSpy.mockReturnValue(true);
      appInterface.copyShareURL();
      expect(window.LZString.compressToEncodedURIComponent).toHaveBeenCalledWith('graph G {}');
      const expectedShareUrl = new URL(window.location.href);
      expectedShareUrl.search = '';
      expectedShareUrl.hash = '';
      expectedShareUrl.searchParams.set('compressed', 'compressed_graph G {}');
      expectedShareUrl.searchParams.set('engine', appDomElements.engineSelect.value);
      expectedShareUrl.searchParams.set('format', appDomElements.formatSelect.value);
      expect(shareUrlInputEl.style.display).toBe('inline');
      expect(shareUrlInputEl.value).toBe(expectedShareUrl.toString());
      expect(copyToClipboardSpy).toHaveBeenCalledWith(expectedShareUrl.toString());
      expect(showStatusSpy).toHaveBeenCalledWith('Share URL copied to clipboard!', appConstants.STATUS_CLIPBOARD_AUTOHIDE_DELAY_MS);
      expect(shareBtnEl.disabled).toBe(true);
      jest.advanceTimersByTime(appConstants.LOADING_ANIMATION_INTERVAL_MS);
      expect(shareBtnEl.value).toMatch(/Loading\./);
      jest.runAllTimers();
      expect(shareBtnEl.disabled).toBe(false);
      expect(shareBtnEl.value).toBe('Share');
    });

    test('should show generated status if copyToClipboard fails', () => {
      copyToClipboardSpy.mockReturnValue(false);
      appInterface.copyShareURL();
      jest.runAllTimers();
      expect(showStatusSpy).toHaveBeenCalledWith('Share URL generated.', appConstants.STATUS_CLIPBOARD_AUTOHIDE_DELAY_MS);
    });

    test('should handle LZString compression error and reset UI', () => {
      window.LZString.compressToEncodedURIComponent.mockImplementation(() => {
        throw new Error('Test Compression failed');
      });
      appInterface.copyShareURL();
      jest.runAllTimers();
      expect(showErrorSpy).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Could not generate shareable URL. Content might be too large.' }),
        'URL Generation Failed'
      );
      expect(shareUrlInputEl.style.display).toBe('none');
      expect(shareUrlInputEl.value).toBe('');
      expect(shareBtnEl.disabled).toBe(false);
      expect(shareBtnEl.value).toBe('Share');
    });
  });

  describe('copyToClipboard', () => {
    let mockExecCommand;
    beforeEach(() => { mockExecCommand = jest.spyOn(document, 'execCommand'); });

    test('should attempt to copy string to clipboard and return true on success', () => {
        mockExecCommand.mockReturnValue(true);
        const result = appInterface.copyToClipboard('test string');
        expect(mockExecCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe(true);
    });
    test('should return false if execCommand fails', () => {
        mockExecCommand.mockReturnValue(false);
        const result = appInterface.copyToClipboard('test string');
        expect(mockExecCommand).toHaveBeenCalledWith('copy');
        expect(result).toBe(false);
    });
    test('should create and remove textarea for copying', () => {
        const testString = "to be copied";
        const appendChildSpy = jest.spyOn(document.body, 'appendChild');
        const removeChildSpy = jest.spyOn(document.body, 'removeChild');
        mockExecCommand.mockReturnValue(true);
        appInterface.copyToClipboard(testString);
        expect(appendChildSpy).toHaveBeenCalledWith(expect.any(HTMLTextAreaElement));
        const textArea = appendChildSpy.mock.calls[0][0];
        expect(textArea.value).toBe(testString);
        expect(textArea.hasAttribute('readonly')).toBe(true);
        expect(textArea.style.position).toBe('absolute');
        expect(removeChildSpy).toHaveBeenCalledWith(textArea);
    });
  });

  describe('Editor Change Handling (handleEditorChange)', () => {
    let mockEditor;
    let renderGraphSpy;
    beforeEach(() => {
      mockEditor = window.ace.edit();
      renderGraphSpy = jest.spyOn(appInterface, 'renderGraph');
      mockEditor.session.on.mockClear();
    });

    test('should call renderGraph after debounce period on editor change', () => {
      let changeCallback;
      const callWithChange = mockEditor.session.on.mock.calls.find(call => call[0] === 'change');
      if (callWithChange) { changeCallback = callWithChange[1]; }
      // This check might fail if app.js's event listener was attached to a *different* mock session object
      // than the one we get from window.ace.edit() *in this beforeEach*.
      // This depends on how the ace.edit mock is structured and if it returns the same session object.
      // The current ace mock returns a persistent mockEditor object.
      expect(changeCallback).toBeDefined();
      expect(changeCallback).toBe(appInterface.handleEditorChange);
      changeCallback();
      expect(renderGraphSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(appConstants.RENDER_DEBOUNCE_DELAY_MS - 1);
      expect(renderGraphSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(1);
      expect(renderGraphSpy).toHaveBeenCalledTimes(1);
    });

    test('should clear previous debounce timeout if changes occur rapidly', () => {
      let changeCallback;
      const callWithChange = mockEditor.session.on.mock.calls.find(call => call[0] === 'change');
      if (callWithChange) { changeCallback = callWithChange[1]; }
      expect(changeCallback).toBeDefined();
      changeCallback();
      jest.advanceTimersByTime(appConstants.RENDER_DEBOUNCE_DELAY_MS / 2);
      changeCallback();
      expect(renderGraphSpy).not.toHaveBeenCalled();
      jest.advanceTimersByTime(appConstants.RENDER_DEBOUNCE_DELAY_MS);
      expect(renderGraphSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Input Element Change Handling (format, engine, raw)', () => {
    let formatSelectEl, engineSelectEl, rawInputEl;
    let renderGraphSpy;
    beforeEach(() => {
      formatSelectEl = appDomElements.formatSelect;
      engineSelectEl = appDomElements.engineSelect;
      rawInputEl = appDomElements.rawInput;
      renderGraphSpy = jest.spyOn(appInterface, 'renderGraph');
    });

    test('should call renderGraph when formatEl changes', () => {
      formatSelectEl.dispatchEvent(new Event('change'));
      expect(renderGraphSpy).toHaveBeenCalledTimes(1);
    });
    test('should call renderGraph when engineEl changes', () => {
      engineSelectEl.dispatchEvent(new Event('change'));
      expect(renderGraphSpy).toHaveBeenCalledTimes(1);
    });
    test('should call renderGraph when rawEl changes', () => {
      rawInputEl.dispatchEvent(new Event('change'));
      expect(renderGraphSpy).toHaveBeenCalledTimes(1);
    });
  });

  // --- Tests for Graph Rendering Pipeline (SVG and Raw SVG) ---
  describe('Graph Rendering Pipeline (SVG and Raw SVG)', () => {
    let mockEditor;
    let mockGraphvizInstanceDotSpy;

    beforeEach(() => {
      mockEditor = window.ace.edit();
      mockEditor.session.getDocument.mockReturnValue({ getValue: jest.fn().mockReturnValue('graph G {}') });

      appDomElements.formatSelect.value = 'svg';
      appDomElements.engineSelect.value = 'dot';
      appDomElements.rawInput.checked = false;
      appDomElements.review.innerHTML = '';
      appDomElements.review.classList.remove('error', 'working');
      appDomElements.errorContainer.innerHTML = '';

      const resolvedGraphvizInstance = {
        dot: jest.fn().mockReturnValue('<svg><!-- mock SVG --></svg>')
      };
      mockGraphvizInstanceDotSpy = resolvedGraphvizInstance.dot;
      window.Graphviz.load.mockResolvedValue(resolvedGraphvizInstance);

      jest.spyOn(appInterface, 'updateOutput').mockClear();
      jest.spyOn(appInterface, 'show_error').mockClear();
      jest.spyOn(appInterface, 'show_status').mockClear();
      jest.spyOn(appInterface, '_displaySvgInReviewer').mockClear();
      jest.spyOn(appInterface, '_displayTextOutputInReviewer').mockClear();
      jest.spyOn(appInterface, 'clearReviewer').mockClear();
      jest.spyOn(appInterface, 'manageRawUI').mockClear();
      if (appInterface.updateState) {
          jest.spyOn(appInterface, 'updateState').mockClear();
      }
      window.svgPanZoom.mockClear().mockReturnValue({ resize: jest.fn(), fit: jest.fn(), center: jest.fn() });
    });

    describe('renderGraph (SVG output)', () => {
      test('should successfully render non-raw SVG output', async () => {
        await appInterface.renderGraph();
        expect(appInterface.show_status).toHaveBeenCalledWith('rendering...');
        expect(window.Graphviz.load).toHaveBeenCalledTimes(1);
        expect(mockGraphvizInstanceDotSpy).toHaveBeenCalledWith('graph G {}', { engine: 'dot' });
        expect(appInterface.updateOutput).toHaveBeenCalledTimes(1);
        const updateOutputArgs = appInterface.updateOutput.mock.calls[0][0];
        expect(updateOutputArgs instanceof Element && updateOutputArgs.tagName.toLowerCase() === 'svg').toBe(true);
        expect(updateOutputArgs.innerHTML).toContain('<!-- mock SVG -->');
        expect(appDomElements.review.classList.contains('working')).toBe(false);
        expect(appInterface.show_status).toHaveBeenCalledWith('done', appConstants.STATUS_DONE_AUTOHIDE_DELAY_MS);
        expect(appInterface.show_error).not.toHaveBeenCalled();
      });

      test('should successfully render raw SVG output (as text via updateOutput)', async () => {
        appDomElements.rawInput.checked = true;
        await appInterface.renderGraph();
        expect(mockGraphvizInstanceDotSpy).toHaveBeenCalledWith('graph G {}', { engine: 'dot' });
        expect(appInterface.updateOutput).toHaveBeenCalledTimes(1);
        const updateOutputArgs = appInterface.updateOutput.mock.calls[0][0];
        expect(updateOutputArgs instanceof Element && updateOutputArgs.tagName.toLowerCase() === 'svg').toBe(true);
      });

      test('should handle Graphviz rendering error (from dot method)', async () => {
        mockGraphvizInstanceDotSpy.mockImplementation(() => { throw new Error('Graphviz failed'); });
        await appInterface.renderGraph();
        expect(appInterface.show_error).toHaveBeenCalledWith(expect.any(Error), 'Graph Rendering Failed');
        expect(appDomElements.review.classList.contains('error')).toBe(true);
        expect(appDomElements.review.classList.contains('working')).toBe(false);
        expect(appInterface.updateOutput).not.toHaveBeenCalled();
      });

      test('should handle Graphviz.load() rejection', async () => {
        window.Graphviz.load.mockRejectedValue(new Error('Failed to load Graphviz'));
        await appInterface.renderGraph();
        expect(appInterface.show_error).toHaveBeenCalledWith(expect.any(Error), 'Graph Rendering Failed');
        expect(appDomElements.review.classList.contains('error')).toBe(true);
        expect(appDomElements.review.classList.contains('working')).toBe(false);
      });
    });

    describe('updateOutput (SVG/Raw SVG)', () => {
      let mockSvgElement;
      beforeEach(() => {
          const parser = new DOMParser();
          mockSvgElement = parser.parseFromString('<svg id="graphviz-svg"><g/></svg>', "image/svg+xml").documentElement;
      });

      test('should correctly display non-raw SVG', () => {
        appDomElements.formatSelect.value = 'svg';
        appDomElements.rawInput.checked = false;
        appInterface.updateOutput(mockSvgElement);
        expect(appInterface.manageRawUI).toHaveBeenCalledWith('svg');
        expect(appInterface.clearReviewer).toHaveBeenCalledTimes(1);
        expect(appInterface._displaySvgInReviewer).toHaveBeenCalledWith(mockSvgElement, appDomElements.review, appDomElements.downloadBtn, false);
        expect(appInterface._displayTextOutputInReviewer).not.toHaveBeenCalled();
        if (appInterface.updateState) expect(appInterface.updateState).toHaveBeenCalledTimes(1);
      });

      test('should correctly display raw SVG (as text)', () => {
        appDomElements.formatSelect.value = 'svg';
        appDomElements.rawInput.checked = true;
        appInterface.updateOutput(mockSvgElement);
        expect(appInterface.manageRawUI).toHaveBeenCalledWith('svg');
        expect(appInterface.clearReviewer).toHaveBeenCalledTimes(1);
        expect(appInterface._displayTextOutputInReviewer).toHaveBeenCalledWith('svg', mockSvgElement, appDomElements.review);
        expect(appInterface._displaySvgInReviewer).not.toHaveBeenCalled();
        if (appInterface.updateState) expect(appInterface.updateState).toHaveBeenCalledTimes(1);
      });
    });

    describe('_displaySvgInReviewer', () => {
      test('should append SVG and initialize svgPanZoom', () => {
          const reviewEl = appDomElements.review;
          const dlBtn = appDomElements.downloadBtn;
          const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
          reviewEl.innerHTML = '';
          appInterface._displaySvgInReviewer(svg, reviewEl, dlBtn, false);
          expect(reviewEl.querySelector('a > svg')).toBe(svg);
          expect(window.svgPanZoom).toHaveBeenCalledWith(svg, expect.objectContaining({ fit: true, center: true }));
          expect(dlBtn.href).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
          expect(dlBtn.download).toBe('graphviz.svg');
      });
    });

    describe('_displayTextOutputInReviewer (for raw SVG)', () => {
      test('should display serialized SVG string when format is svg (raw)', () => {
          const reviewEl = appDomElements.review;
          const svgString = '<svg><g id="mygroup"></g></svg>';
          const parser = new DOMParser();
          const svgElement = parser.parseFromString(svgString, "image/svg+xml").documentElement;
          reviewEl.innerHTML = '';
          appInterface._displayTextOutputInReviewer('svg', svgElement, reviewEl);
          const textDiv = reviewEl.querySelector('#text');
          expect(textDiv).not.toBeNull();
          expect(textDiv.textContent).toContain('<g id="mygroup"/>');
          expect(textDiv.textContent.trim().startsWith('<svg')).toBe(true);
      });
    });
  });
});

[end of app.test.js]
