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
  //http://stackoverflow.com/a/10372280/398634
  window.URL = window.URL || window.webkitURL;
  var el_stetus = document.getElementById("status"),
    t_stetus = -1,
    reviewer = document.getElementById("review"),
    scale = window.devicePixelRatio || 1,
    downloadBtn = document.getElementById("download"),
    editor = ace.edit("editor"),
    lastHD = -1,
    worker = null,
    parser = new DOMParser(),
    showError = null,
    formatEl = document.querySelector("#format select"),
    engineEl = document.querySelector("#engine select"),
    rawEl = document.querySelector("#raw input"),
    shareEl = document.querySelector("#share"),
    shareURLEl = document.querySelector("#shareurl"),
    errorEl = document.querySelector("#error");

  function show_status(text, hide) {
    hide = hide || 0;
    clearTimeout(t_stetus);
    el_stetus.innerHTML = text;
    if (hide) {
      t_stetus = setTimeout(function () {
        el_stetus.innerHTML = "";
      }, hide);
    }
  }

  function show_error(e) {
    console.trace();
    show_status("error", 500);
    reviewer.classList.remove("working");
    reviewer.classList.add("error");
    var message = e.message === undefined ? "An error occurred while processing the graph input." : e.message;
    while (errorEl.firstChild) {
      errorEl.removeChild(errorEl.firstChild);
    }
    errorEl.appendChild(document.createTextNode(message));
  }

  function svgXmlToImage(svgXml, callback) {
    var pngImage = new Image(), svgImage = new Image();

    svgImage.onload = function () {
      var canvas = document.createElement("canvas");
      canvas.width = svgImage.width * scale;
      canvas.height = svgImage.height * scale;

      var context = canvas.getContext("2d");
      context.drawImage(svgImage, 0, 0, canvas.width, canvas.height);

      pngImage.src = canvas.toDataURL("image/png");
      pngImage.width = svgImage.width;
      pngImage.height = svgImage.height;

      if (callback !== undefined) {
        callback(null, pngImage);
      }
    }

    svgImage.onerror = function (e) {
      if (callback !== undefined) {
        callback(e);
      }
    }
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
    var result = document.execCommand('copy')
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
    hpccWasm.Graphviz.load().then(function (graphviz) {
      let dotContent = editor.getSession().getDocument().getValue();
      let result = null;
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

  function updateOutput(result) {
    if (formatEl.value === "svg") {
      document.querySelector("#raw").classList.remove("disabled");
      rawEl.disabled = false;
    } else {
      document.querySelector("#raw").classList.add("disabled");
      rawEl.disabled = true;
    }

    var text = reviewer.querySelector("#text");
    if (text) {
      reviewer.removeChild(text);
    }

    var a = reviewer.querySelector("a");
    if (a) {
      reviewer.removeChild(a);
    }

    if (!result) {
      return;
    }

    reviewer.classList.remove("working");
    reviewer.classList.remove("error");

    if (formatEl.value == "svg" && !rawEl.checked) {
      var serializer = new XMLSerializer();
      var source = serializer.serializeToString(result);
      // https://stackoverflow.com/questions/18925210/download-blob-content-using-specified-charset
      //const blob = new Blob(["\ufeff", svg], {type: 'image/svg+xml;charset=utf-8'});
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
      downloadBtn.href = url;
      downloadBtn.download = "graphviz.svg";
      var a = document.createElement("a");
      a.appendChild(result);
      reviewer.appendChild(a);
      svgPanZoom(result, {
        zoomEnabled: true,
        controlIconsEnabled: true,
        fit: true,
        center: true,
      });
    } else if (formatEl.value == "png") {
      var serializer = new XMLSerializer();
      var source = serializer.serializeToString(result);
      let resultWithPNGHeader = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(source)));
      svgXmlToImage(resultWithPNGHeader, function (err, image) {
        if (err) {
          show_error(err)
          return
        }
        image.setAttribute("title", "graphviz");
        downloadBtn.href = image.src;
        downloadBtn.download = "graphviz.png";
        var a = document.createElement("a");
        a.appendChild(image);
        reviewer.appendChild(a);
      })
    } else {
      var text = document.createElement("div");
      text.id = "text";
      if (formatEl.value == "svg") { // Raw SVG output
        let serializer = new XMLSerializer();
        resultText = serializer.serializeToString(result); // result is an SVGElement for raw SVG
      } else {
        // For other text formats (json, xdot, plain, ps), result is { output: "..." }
        resultText = result.output;
      }
      text.appendChild(document.createTextNode(resultText));
      reviewer.appendChild(text);
    }

    updateState()
  }

  editor.setTheme("ace/theme/twilight");
  editor.getSession().setMode("ace/mode/dot");
  editor.getSession().on("change", function () {
    clearTimeout(lastHD);
    lastHD = setTimeout(renderGraph, 1500);
  });

  window.onpopstate = function (event) {
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
    for (let i = 0; i < this.length; i++) {
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
    const index = engineEl.options.indexOf(engine);
    if (index > -1) { // if index exists
      engineEl.selectedIndex = index;
    } else {
      show_error({ message: `invalid engine ${engine} selected` });
    }
  }

  if (params.has('format')) {
    const format = params.get('format');
    const index = formatEl.options.indexOf(format);
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
    editor.getSession().setValue(params.get('raw'));
    renderGraph();
  } else if (params.has('compressed')) {
    const compressed = params.get('compressed');
    editor.getSession().setValue(LZString.decompressFromEncodedURIComponent(compressed));
  } else if (params.has('url')) {
    const url = params.get('url');
    let ok = false;
    fetch(url)
      .then(res => {
        ok = res.ok;
        return res.text();
      })
      .then(res => {
        if (!ok) {
          throw { message: res };
        }

        editor.getSession().setValue(res);
        renderGraph();
      }).catch(e => {
        show_error(e);
      });
  } else if (location.hash.length > 1) {
    editor.getSession().setValue(decodeURIComponent(location.hash.substring(1)));
  } else if (editor.getValue()) { // Init
    renderGraph();
  }

})(document);
