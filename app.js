import { Graphviz } from "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm-graphviz@1.7.0/dist/index.js"; // External library for Graphviz rendering
"use strict";

// --- DOM Element Cache ---
// This object holds references to frequently accessed DOM elements.
const domElements = {
  editor: document.getElementById('editor'), // ACE editor container
  review: document.getElementById('review'), // Review panel for SVG/PNG output
  options: document.getElementById('options'),
  toggleBtn: document.getElementById('toggle-btn'),
  status: document.getElementById("status"),
  downloadBtn: document.getElementById("download"),
  formatSelect: document.querySelector("#format select"),
  engineSelect: document.querySelector("#engine select"),
  rawInput: document.querySelector("#raw input"),
  shareBtn: document.querySelector("#share"),
  shareUrlInput: document.querySelector("#shareurl"),
  errorContainer: document.querySelector("#error"),
  rawContainer: document.querySelector("#raw") // Container for the "raw" output checkbox
};

// --- UI State ---
let isCollapsed = false; // Tracks the collapsed state of the editor panel

// --- Event Handlers (Attached to elements outside IIFE) ---

/**
 * Handles the click event on the toggle button to collapse/expand the editor panel.
 */
function handleToggleClick() {
  isCollapsed = !isCollapsed;

  if (isCollapsed) {
    domElements.editor.classList.add('collapsed');
    domElements.review.classList.add('expanded');
    domElements.options.classList.add('expanded');
    domElements.toggleBtn.innerHTML = '▶'; // Change icon to indicate "expand"
  } else {
    domElements.editor.classList.remove('collapsed');
    domElements.review.classList.remove('expanded');
    domElements.options.classList.remove('expanded');
    domElements.toggleBtn.innerHTML = '◀'; // Change icon to indicate "collapse"
  }

  // Adjust SVG size after a short delay to allow for CSS transitions.
  // resizeSVG is defined within the IIFE and will be accessible.
  setTimeout(resizeSVG, LAYOUT_ADJUST_DELAY_MS);
}

domElements.toggleBtn.addEventListener('click', handleToggleClick); // Attach click handler to the toggle button

// window.addEventListener('resize', resizeSVG); // This will be moved into IIFE after resizeSVG definition

// --- Main Application Logic (IIFE) ---
// Encapsulates the core application logic to avoid polluting the global scope.
// LZString is passed as a parameter to make its usage explicit.
(function (document, LZString) { // LZString is an external library for string compression.
  "use strict";

  // --- Constants ---
  const RENDER_DEBOUNCE_DELAY_MS = 1500; // Delay for debouncing graph rendering on editor changes.
  const LAYOUT_ADJUST_DELAY_MS = 300;   // Delay for UI adjustments after layout changes (e.g., panel collapse).
  const LOADING_ANIMATION_INTERVAL_MS = 300; // Interval for the loading animation dots.
  const STATUS_AUTOHIDE_DELAY_MS = 500;    // Default auto-hide delay for status messages.
  const STATUS_DONE_AUTOHIDE_DELAY_MS = 500; // Auto-hide delay for "done" status.
  const STATUS_ERROR_AUTOHIDE_DELAY_MS = 500; // Auto-hide delay for error messages in status bar.
  const STATUS_CLIPBOARD_AUTOHIDE_DELAY_MS = 2000; // Auto-hide delay for clipboard-related messages.
  const MAX_LOADING_DOTS = 3; // Number of dots in the loading animation.

  // Polyfill for window.URL for browser compatibility.
  // Source: http://stackoverflow.com/a/10372280/398634
  window.URL = window.URL || window.webkitURL;

  // --- Core Functions & State ---

  /**
   * Resizes the SVG element in the review panel to fit and center its content.
   * Uses the svgPanZoom library.
   */
  function resizeSVG() {
    const svg = domElements.review.querySelector('svg');
    if (svg) {
      // svgPanZoom is an external global library.
      const panZoomInstance = svgPanZoom(svg);
      panZoomInstance.resize();
      panZoomInstance.fit();
      panZoomInstance.center();

      svg.style.width = '100%';
      svg.style.height = '100%';
    }
  }
  // Attach event listener for window resize to adjust SVG.
  window.addEventListener('resize', resizeSVG);

  let statusClearTimeoutId = -1; // Timeout ID for clearing the status message.
  const scale = window.devicePixelRatio || 1; // Device pixel ratio for scaling images.
  const editor = ace.edit("editor"); // ace is an external global library for code editing.
  let renderDebounceTimeoutId = -1; // Timeout ID for debouncing editor changes before rendering.
  let worker = null; // Placeholder for a potential future Web Worker.
  const parser = new DOMParser(); // Used for parsing XML/SVG strings.

  /**
   * Displays a status message in the status bar.
   * @param {string} text - The message to display.
   * @param {number} [hideDelay=0] - Delay in ms after which to hide the message. 0 means no auto-hide.
   */
  function show_status(text, hideDelay = 0) {
    clearTimeout(statusClearTimeoutId);
    domElements.status.innerHTML = text;
    if (hideDelay) {
      statusClearTimeoutId = setTimeout(() => {
        domElements.status.innerHTML = "";
      }, hideDelay);
    }
  }

  /**
   * Displays an error message in the error container and status bar.
   * @param {Error|string} error - The error object or error message string.
   * @param {string} [title="Error"] - A title for the error.
   */
  function show_error(error, title = "Error") {
    console.trace(); // Keep for debugging purposes.
    show_status(title, STATUS_ERROR_AUTOHIDE_DELAY_MS); // Show title in status bar.
    domElements.review.classList.remove("working"); // Update UI to show error state.
    domElements.review.classList.add("error");

    const message = error instanceof Error ? error.message : String(error);

    while (domElements.errorContainer.firstChild) {
      domElements.errorContainer.removeChild(domElements.errorContainer.firstChild);
    }
    domElements.errorContainer.appendChild(document.createTextNode(`${title}: ${message}`));
  }

  function svgXmlToImage(svgXml, callback) {
    const pngImage = new Image(), svgImage = new Image();

    function handleSvgImageLoad() {
      const canvas = document.createElement("canvas");
      canvas.width = svgImage.width * scale;
      canvas.height = svgImage.height * scale;

      const context = canvas.getContext("2d");
      context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

      pngImage.src = canvas.toDataURL("image/png");
      pngImage.width = svgImage.width;
      pngImage.height = svgImage.height;

      if (callback !== undefined) {
        callback(null, pngImage);
      }
    }

    function handleSvgImageError(e) {
      if (callback !== undefined) {
        // Pass a more descriptive error
        callback(new Error("Failed to load SVG image for PNG conversion"));
      }
    }

    svgImage.onload = handleSvgImageLoad;
    svgImage.onerror = handleSvgImageError;
    svgImage.src = svgXml;
  }

  /**
   * Generates a shareable URL with compressed graph data and current settings.
   * Displays the URL and attempts to copy it to the clipboard.
   */
  function copyShareURL() {
    let rawContent = editor.getSession().getDocument().getValue();

    domElements.shareBtn.disabled = true;
    let loadingDotsCount = 0;
    // Animate "Loading..." text on the share button.
    let animateId = setInterval(()=> {
        domElements.shareBtn.value = "Loading" + ".".repeat(loadingDotsCount++ % MAX_LOADING_DOTS);
    }, LOADING_ANIMATION_INTERVAL_MS);

    try {
        // LZString is an external library, passed as IIFE parameter.
        const compressedContent = LZString.compressToEncodedURIComponent(rawContent);
        const compressedUrl = new URL(location.href);
        compressedUrl.search = ''; // Clear existing search parameters.
        compressedUrl.hash = '';   // Clear existing hash.

        // Set URL parameters for sharing.
        compressedUrl.searchParams.set("compressed", compressedContent);
        compressedUrl.searchParams.set("engine", domElements.engineSelect.value);
        compressedUrl.searchParams.set("format", domElements.formatSelect.value);

        domElements.shareUrlInput.style.display = "inline";
        domElements.shareUrlInput.value = compressedUrl.toString();

        if (copyToClipboard(compressedUrl.toString())) {
            show_status("Share URL copied to clipboard!", STATUS_CLIPBOARD_AUTOHIDE_DELAY_MS);
        } else {
            show_status("Share URL generated.", STATUS_CLIPBOARD_AUTOHIDE_DELAY_MS);
        }

    } catch (err) {
        console.error("Error generating share URL:", err); // Log the actual error for debugging.
        // Pass an Error object and a title
        show_error(new Error("Could not generate shareable URL. Content might be too large."), "URL Generation Failed");
        domElements.shareUrlInput.style.display = "none";
        domElements.shareUrlInput.value = ''; // Clear value on error
    } finally {
        clearInterval(animateId);
        domElements.shareBtn.value = "Share";
        domElements.shareBtn.disabled = false;
    }
  }

  function copyToClipboard(str) {
    const el = document.createElement('textarea');
    el.value = str;
    el.setAttribute('readonly', '');
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const selected =
      document.getSelection().rangeCount > 0
        ? document.getSelection().getRangeAt(0)
        : false;
    el.select();
    const result = document.execCommand('copy');
    document.body.removeChild(el);
    if (selected) {
      document.getSelection().removeAllRanges();
      document.getSelection().addRange(selected);
    }
    return result;
  };

  function generateGraphOutput(graphviz, dotContent, currentFormat, currentEngine) {
    if (currentFormat === "svg" || currentFormat === "png") {
      const svgString = graphviz.dot(dotContent, { engine: currentEngine });
      // parser is available in the IIFE scope
      const svgElement = parser.parseFromString(svgString, "image/svg+xml").documentElement;
      return svgElement;
    } else {
      // For text-based formats (json, xdot, plain, ps)
      const textOutput = graphviz.dot(dotContent, { engine: currentEngine, format: currentFormat });
      return { output: textOutput }; // Wrap for compatibility with updateOutput
    }
  }

  async function renderGraph() {
    domElements.review.classList.add("working");
    domElements.review.classList.remove("error");
    show_status("rendering...");

    try {
      const graphviz = await Graphviz.load();
      const dotContent = editor.getSession().getDocument().getValue();
      const currentFormat = domElements.formatSelect.value;
      const currentEngine = domElements.engineSelect.value;
      const result = generateGraphOutput(graphviz, dotContent, currentFormat, currentEngine);
      updateOutput(result);
    } catch (err) {
      show_error(err, "Graph Rendering Failed");
    } finally {
      domElements.review.classList.remove("working");
      show_status("done", STATUS_DONE_AUTOHIDE_DELAY_MS);
    }
  }

  function updateState() {
    const updatedUrl = new URL(window.location)
    // Hash
    const content = encodeURIComponent(editor.getSession().getDocument().getValue());
    updatedUrl.hash = content
    // Search params
    updatedUrl.searchParams.set("engine", domElements.engineSelect.value)
    history.pushState({ "content": content, "engine": domElements.engineSelect.value }, "", updatedUrl.toString())
  }

  // Helper functions for updateOutput (already well-modularized for display)
  function _displaySvgInReviewer(svgElement, reviewerEl, downloadBtn, rawElChecked) {
    // rawElChecked is passed but not directly used here as this function is for !rawEl.checked
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElement);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    downloadBtn.href = url;
    downloadBtn.download = "graphviz.svg";

    const a = document.createElement("a");
    a.appendChild(svgElement);
    reviewerEl.appendChild(a);

    // svgPanZoom is an external global library
    svgPanZoom(svgElement, {
      zoomEnabled: true,
      controlIconsEnabled: true,
      fit: true,
      center: true,
    });
  }

  function _displayPngInReviewer(svgElementToConvert, reviewerEl, downloadBtn, scale, show_error_fn, svgXmlToImage_fn) {
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgElementToConvert);
    const resultWithPNGHeader = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(source)));

    svgXmlToImage_fn(resultWithPNGHeader, (err, image) => { // Use arrow function for callback
      if (err) {
        show_error_fn(err);
        return;
      }
      image.setAttribute("title", "graphviz");
      downloadBtn.href = image.src;
      downloadBtn.download = "graphviz.png";
      const a = document.createElement("a");
      a.appendChild(image);
      reviewerEl.appendChild(a);
    });
  }

  function _displayTextOutputInReviewer(currentFormat, resultValue, reviewerEl) {
    const textDiv = document.createElement("div");
    textDiv.id = "text";
    let resultText;

    if (currentFormat === "svg") { // This implies raw SVG output
      const serializer = new XMLSerializer();
      resultText = serializer.serializeToString(resultValue); // resultValue is an SVGElement
    } else {
      // For other text formats (json, xdot, plain, ps), resultValue is already the string
      resultText = resultValue;
    }
    textDiv.appendChild(document.createTextNode(resultText));
    reviewerEl.appendChild(textDiv);
  }

  function manageRawUI(currentFormat) {
    if (currentFormat === "svg") {
      domElements.rawContainer.classList.remove("disabled");
      domElements.rawInput.disabled = false;
    } else {
      domElements.rawContainer.classList.add("disabled");
      domElements.rawInput.disabled = true;
    }
  }

  function clearReviewer() {
    const existingText = domElements.review.querySelector("#text");
    if (existingText) {
      domElements.review.removeChild(existingText);
    }
    const existingA = domElements.review.querySelector("a");
    if (existingA) {
      domElements.review.removeChild(existingA);
    }
  }

  function updateOutput(result) {
    manageRawUI(domElements.formatSelect.value);
    clearReviewer();

    if (!result) {
      return;
    }

    domElements.review.classList.remove("working");
    domElements.review.classList.remove("error");

    const currentFormat = domElements.formatSelect.value;
    const rawChecked = domElements.rawInput.checked;

    if (currentFormat === "svg" && !rawChecked) {
      _displaySvgInReviewer(result, domElements.review, domElements.downloadBtn, rawChecked);
    } else if (currentFormat === "png") {
      // result is an SVGElement, _displayPngInReviewer handles the conversion
      _displayPngInReviewer(result, domElements.review, domElements.downloadBtn, scale, show_error, svgXmlToImage);
    } else {
      // For text formats (json, xdot, plain, ps) or raw SVG output.
      // If format is "svg" (raw), result is an SVGElement.
      // Otherwise, result is { output: "text" } from generateGraphOutput.
      let outputValue = (currentFormat === "svg" && rawChecked) ? result : result.output;
      _displayTextOutputInReviewer(currentFormat, outputValue, domElements.review);
    }

    updateState();
  }

  editor.setTheme("ace/theme/twilight");
  // --- Editor Setup ---
  editor.setTheme("ace/theme/twilight"); // Set ACE editor theme.
  editor.getSession().setMode("ace/mode/dot"); // Set ACE editor mode for DOT language.

  // --- Event Handlers (IIFE scope) ---

  /**
   * Handles changes in the ACE editor content, triggering a debounced graph rendering.
   */
  function handleEditorChange() {
    clearTimeout(renderDebounceTimeoutId);
    renderDebounceTimeoutId = setTimeout(renderGraph, RENDER_DEBOUNCE_DELAY_MS);
  }
  editor.getSession().on("change", handleEditorChange); // Attach change handler to editor.

  /**
   * Handles browser popstate events (e.g., back/forward button).
   * Updates editor content if state information is present.
   * @param {PopStateEvent} event - The popstate event.
   */
  function handlePopState(event) {
    if (event.state != null && event.state.content != undefined) {
      editor.getSession().setValue(decodeURIComponent(event.state.content));
    }
  }
  window.onpopstate = handlePopState; // Attach popstate handler.

  // Attach change handlers to form elements to re-render graph.
  domElements.formatSelect.addEventListener("change", renderGraph);
  domElements.engineSelect.addEventListener("change", renderGraph);
  domElements.rawInput.addEventListener("change", renderGraph);
  // Attach click handler for the share button.
  domElements.shareBtn.addEventListener("click", copyShareURL);

  // --- Polyfills & Prototypes ---
  // Note: HTMLOptionsCollection.prototype.indexOf polyfill was removed.
  // Modern browsers generally support direct iteration or Array.from() for such collections if needed.

  // --- Initialization Logic ---

  // Parse URL parameters to set initial graph content and settings.
  const params = new URLSearchParams(location.search.substring(1));

  function selectOptionFromUrlParams(paramName, selectElement, urlParams, showErrorFn) {
    if (urlParams.has(paramName)) {
      const value = urlParams.get(paramName);
      // Use Array.from() and findIndex() for broader compatibility as HTMLOptionsCollection.indexOf is not standard.
      const index = Array.from(selectElement.options).findIndex(option => option.value === value);
      if (index > -1) {
        selectElement.selectedIndex = index;
      } else {
        showErrorFn(new Error(`Invalid '${paramName}' parameter: ${value}`), "URL Parameter Error");
      }
    }
  }

  selectOptionFromUrlParams('engine', domElements.engineSelect, params, show_error);
  selectOptionFromUrlParams('format', domElements.formatSelect, params, show_error);

  if (params.has("presentation")) {
    document.body.classList.add("presentation");
  }

  if (params.has('raw')) {
    editor.getSession().setValue(params.get('raw')); // editor is const
    renderGraph(); // renderGraph is a function
  } else if (params.has('compressed')) {
    const compressed = params.get('compressed');
    // LZString is now passed as a parameter to the IIFE
    editor.getSession().setValue(LZString.decompressFromEncodedURIComponent(compressed));
  } else if (params.has('url')) {
    const urlToLoad = params.get('url');
    // Define an async function to use await for fetch
    async function loadInitialGraphFromUrl(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          // For HTTP errors, construct a specific message
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const text = await response.text();
        editor.getSession().setValue(text);
        renderGraph(); // renderGraph is already async, but it's fine to call it without await if we don't need to wait for its completion here
      } catch (e) {
        // For network errors or the error thrown above
        show_error(e, "Failed to Load from URL");
      }
    }
    loadInitialGraphFromUrl(urlToLoad); // Call the async function
  } else if (location.hash.length > 1) {
    editor.getSession().setValue(decodeURIComponent(location.hash.substring(1)));
  } else if (editor.getValue()) { // Init
    renderGraph();
  }

})(document, LZString); // Pass LZString global to the IIFE
