import { Graphviz } from "https://cdn.jsdelivr.net/npm/@hpcc-js/wasm-graphviz@1.7.0/dist/index.js";
"use strict";
// Content of the first small script block
const editorElement = document.getElementById('editor');
const reviewElement = document.getElementById('review');
const optionsElement = document.getElementById('options');
const toggleBtn = document.getElementById('toggle-btn');

let isCollapsed = false;

// Ensure resizeSVG is defined here or its definition is also moved
// and accessible when toggleBtn's event listener is set up.
function resizeSVG() {
  const svg = document.querySelector('#review svg');
  if (svg) {
    // svgPanZoom is a global from the svg-pan-zoom.min.js library
    const panZoomInstance = svgPanZoom(svg);
    panZoomInstance.resize();
    panZoomInstance.fit();
    panZoomInstance.center();

    svg.style.width = '100%';
    svg.style.height = '100%';
  }
}

toggleBtn.addEventListener('click', () => {
  isCollapsed = !isCollapsed;

  if (isCollapsed) {
    editorElement.classList.add('collapsed');
    reviewElement.classList.add('expanded');
    optionsElement.classList.add('expanded');
    toggleBtn.innerHTML = '▶';
  } else {
    editorElement.classList.remove('collapsed');
    reviewElement.classList.remove('expanded');
    optionsElement.classList.remove('expanded');
    toggleBtn.innerHTML = '◀';
  }

  setTimeout(resizeSVG, 300); // Call the moved resizeSVG
});

window.addEventListener('resize', resizeSVG); // Call the moved resizeSVG

// Main script block (IIFE)
(function (document) {
  "use strict";
  //http://stackoverflow.com/a/10372280/398634
  window.URL = window.URL || window.webkitURL;
  const el_stetus = document.getElementById("status");
  let t_stetus = -1;
  const reviewer = document.getElementById("review");
  const scale = window.devicePixelRatio || 1;
  const downloadBtn = document.getElementById("download");
  const editor = ace.edit("editor");
  let lastHD = -1;
  let worker = null; // Assuming it might be assigned later
  const parser = new DOMParser();
  // showError is a function declaration, so it's hoisted and effectively constant.
  // const showError = null; // This would be if it were a variable meant to be assigned a function expression.
  const formatEl = document.querySelector("#format select");
  const engineEl = document.querySelector("#engine select");
  const rawEl = document.querySelector("#raw input");
  const shareEl = document.querySelector("#share");
  const shareURLEl = document.querySelector("#shareurl");
  const errorEl = document.querySelector("#error");

  function show_status(text, hide) {
    hide = hide || 0;
    clearTimeout(t_stetus);
    el_stetus.innerHTML = text;
    if (hide) {
      t_stetus = setTimeout(() => {
        el_stetus.innerHTML = "";
      }, hide);
    }
  }

  function show_error(e) {
    console.trace();
    show_status("error", 500);
    reviewer.classList.remove("working");
    reviewer.classList.add("error");
    const message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;
    while (errorEl.firstChild) {
      errorEl.removeChild(errorEl.firstChild);
    }
    errorEl.appendChild(document.createTextNode(message));
  }

  function svgXmlToImage(svgXml, callback) {
    const pngImage = new Image(), svgImage = new Image();

    svgImage.onload = () => {
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
    };

    svgImage.onerror = (e) => {
      if (callback !== undefined) {
        callback(e);
      }
    };
    svgImage.src = svgXml;
  }

  function copyShareURL(e) {
    let rawContent = editor.getSession().getDocument().getValue();

    shareEl.disabled = true;
    let n = 0;
    // animateId is declared in the IIFE scope if not already.
    // If it's local to this function, its declaration should be `let animateId = ...`
    // Assuming animateId is accessible from outer scope as per instructions.
    let animateId = setInterval(()=> { shareEl.value = "Loading" + ".".repeat(n++%3)}, 300);

    try {
        const compressedContent = LZString.compressToEncodedURIComponent(rawContent);
        const compressedUrl = new URL(location.href); // Base URL
        compressedUrl.search = ''; // Clear existing search parameters
        compressedUrl.hash = '';   // Clear existing hash

        compressedUrl.searchParams.set("compressed", compressedContent);
        compressedUrl.searchParams.set("engine", engineEl.value);
        compressedUrl.searchParams.set("format", formatEl.value);

        shareURLEl.style.display = "inline";
        shareURLEl.value = compressedUrl.toString();

        if (copyToClipboard(compressedUrl.toString())) {
            show_status("Share URL copied to clipboard!", 2000);
        } else {
            show_status("Share URL generated.", 2000);
        }

    } catch (err) {
        console.error("Error generating share URL:", err);
        show_error({ message: "Could not generate shareable URL. The content might be too large even after compression." });
        shareURLEl.style.display = "none";
        shareURLEl.value = ''; // Clear value on error
    } finally {
        clearInterval(animateId);
        shareEl.value = "Share";
        shareEl.disabled = false;
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

  function renderGraph() {
    reviewer.classList.add("working");
    reviewer.classList.remove("error");

    show_status("rendering...");
    Graphviz.load().then((graphviz) => {
      let dotContent = editor.getSession().getDocument().getValue();
      let result = null; // Needs to be let as it's reassigned
      const currentFormat = formatEl.value;
      const currentEngine = engineEl.value;

      try {
        if (currentFormat === "svg" || currentFormat === "png") {
          const svgString = graphviz.dot(dotContent, { engine: currentEngine });
          const parser = new DOMParser();
          const svgElement = parser.parseFromString(svgString, "image/svg+xml").documentElement;
          result = svgElement;
        } else {
          // For text-based formats (json, xdot, plain, ps)
          const textOutput = graphviz.dot(dotContent, { engine: currentEngine, format: currentFormat });
          result = { output: textOutput }; // Wrap for compatibility with updateOutput
        }
        updateOutput(result);
      } catch (err) {
        show_error(err);
      }
    }).catch((err) => {
      show_error(err);
    }).finally(() => {
      reviewer.classList.remove("working");
      show_status("done", 500)
    });
  }

  function updateState() {
    const updatedUrl = new URL(window.location)
    // Hash
    const content = encodeURIComponent(editor.getSession().getDocument().getValue());
    updatedUrl.hash = content
    // Search params
    updatedUrl.searchParams.set("engine", engineEl.value)
    history.pushState({ "content": content, "engine": engineEl.value }, "", updatedUrl.toString())
  }

  // Helper functions for updateOutput
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

    svgPanZoom(svgElement, { // svgPanZoom is global
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

  function updateOutput(result) {
    // Enable/disable raw output checkbox
    if (formatEl.value === "svg") {
      document.querySelector("#raw").classList.remove("disabled");
      rawEl.disabled = false;
    } else {
      document.querySelector("#raw").classList.add("disabled");
      rawEl.disabled = true;
    }

    // Clear previous output
    const existingText = reviewer.querySelector("#text");
    if (existingText) {
      reviewer.removeChild(existingText);
    }
    const existingA = reviewer.querySelector("a");
    if (existingA) {
      reviewer.removeChild(existingA);
    }

    if (!result) {
      return;
    }

    reviewer.classList.remove("working");
    reviewer.classList.remove("error");

    // Delegate to helper functions
    if (formatEl.value === "svg" && !rawEl.checked) {
      _displaySvgInReviewer(result, reviewer, downloadBtn, rawEl.checked);
    } else if (formatEl.value === "png") {
      _displayPngInReviewer(result, reviewer, downloadBtn, scale, show_error, svgXmlToImage);
    } else {
      // For text formats (json, xdot, plain, ps) or raw SVG output.
      // If format is "svg" (raw), result is an SVGElement.
      // Otherwise, result is { output: "text" } from renderGraph.
      let outputValue = (formatEl.value === "svg" && rawEl.checked) ? result : result.output;
      _displayTextOutputInReviewer(formatEl.value, outputValue, reviewer);
    }

    updateState();
  }

  editor.setTheme("ace/theme/twilight");
  editor.getSession().setMode("ace/mode/dot");
  editor.getSession().on("change", () => {
    clearTimeout(lastHD);
    lastHD = setTimeout(renderGraph, 1500);
  });

  window.onpopstate = (event) => {
    if (event.state != null && event.state.content != undefined) {
      editor.getSession().setValue(decodeURIComponent(event.state.content));
    }
  };

  formatEl.addEventListener("change", renderGraph);
  engineEl.addEventListener("change", renderGraph);
  rawEl.addEventListener("change", renderGraph);
  share.addEventListener("click", copyShareURL);

  // Since apparently HTMLCollection does not implement the oh so convenient array functions
  HTMLOptionsCollection.prototype.indexOf = function (name) {
    for (let i = 0; i < this.length; i++) { // Changed var to let
      if (this[i].value == name) {
        return i;
      }
    }

    return -1;
  };

  /* parsing from URL sharing */
  const params = new URLSearchParams(location.search.substring(1));
  if (params.has('engine')) {
    const engine = params.get('engine');
    const index = engineEl.options.indexOf(engine); // engineEl is const
    if (index > -1) { // if index exists
      engineEl.selectedIndex = index;
    } else {
      show_error({ message: `invalid engine ${engine} selected` }); // show_error is a function
    }
  }

  if (params.has('format')) {
    const format = params.get('format');
    const index = formatEl.options.indexOf(format); // formatEl is const
    if (index > -1) {
      formatEl.selectedIndex = index;
    } else {
      show_error({ message: `Invalid format ${format} selected` });
    }
  }

  if (params.has("presentation")) {
    document.body.classList.add("presentation");
  }

  if (params.has('raw')) {
    editor.getSession().setValue(params.get('raw')); // editor is const
    renderGraph(); // renderGraph is a function
  } else if (params.has('compressed')) {
    const compressed = params.get('compressed');
    editor.getSession().setValue(LZString.decompressFromEncodedURIComponent(compressed)); // LZString is global
  } else if (params.has('url')) {
    const url = params.get('url');
    let ok = false; // ok is reassigned
    fetch(url)
      .then(res => { // Arrow function
        ok = res.ok;
        return res.text();
      })
      .then(res => { // Arrow function
        if (!ok) {
          throw { message: res };
        }
        editor.getSession().setValue(res);
        renderGraph();
      }).catch(e => { // Arrow function
        show_error(e);
      });
  } else if (location.hash.length > 1) {
    editor.getSession().setValue(decodeURIComponent(location.hash.substring(1)));
  } else if (editor.getValue()) { // Init
    renderGraph();
  }

})(document);
