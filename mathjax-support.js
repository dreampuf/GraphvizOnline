// mathjax-support.js
(function () {
  async function mjxReady() {
    if (!window.MathJax) return false;
    if (MathJax.startup && MathJax.startup.promise) await MathJax.startup.promise;
    return true;
  }

  function extractFirstTeX(s) {
    let m = s.match(/\$([^$]+)\$/);
    if (m) return m[1].trim();
    m = s.match(/\\\((.+?)\\\)/);
    if (m) return m[1].trim();
    m = s.match(/\\\[(.+?)\\\]/);
    if (m) return m[1].trim();
    return null;
  }

  async function typesetMathInGraphSvg(svgRoot) {
    const ok = await mjxReady();
    if (!ok) return;

    const texts = Array.from(svgRoot.querySelectorAll("text"));
    for (const t of texts) {
      const raw = t.textContent || "";
      if (!/(\$[^$]+\$)|(\\\(.+?\\\))|(\\\[.+?\\\])/.test(raw)) continue;

      const tex = extractFirstTeX(raw);
      if (!tex) continue;

      // measure original
      const oldBox = t.getBBox();
      const cx = oldBox.x + oldBox.width / 2;
      const cy = oldBox.y + oldBox.height / 2;

      // TeX -> SVG
      const wrapper = await MathJax.tex2svgPromise(tex, { display: false });
      const mjxSvg = wrapper.querySelector("svg");
      if (!mjxSvg) continue;

      // Wrap in <g> in the graph's SVG namespace
      const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
      const imported = document.importNode(mjxSvg, true);
      g.appendChild(imported);

      // Insert so we can bbox it
      t.parentNode.insertBefore(g, t);

      const newBox = g.getBBox();
      const s = oldBox.height / (newBox.height || 1);
      const tx = cx - (newBox.x + newBox.width / 2) * s;
      const ty = cy - (newBox.y + newBox.height / 2) * s;
      g.setAttribute("transform", `translate(${tx} ${ty}) scale(${s})`);

      t.remove();
    }
  }

  window.typesetMathInGraphSvg = typesetMathInGraphSvg;
})();
