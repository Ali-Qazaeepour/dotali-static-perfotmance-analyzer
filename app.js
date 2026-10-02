const htmlInput = document.getElementById("htmlInput");
const cssInput = document.getElementById("cssInput");
const analyzeBtn = document.getElementById("analyzeBtn");
const summaryEl = document.getElementById("summary");
const resultsList = document.getElementById("resultsList");
const scoreBox = document.getElementById("scoreBox");
const clsBadge = document.getElementById("clsBadge");
const lcpBadge = document.getElementById("lcpBadge");
const cssBadge = document.getElementById("cssBadge");
const downloadBtn = document.getElementById("downloadBtn");
const themeToggle = document.getElementById("themeToggle");
const dropZone = document.getElementById("dropZone");

let lastReport = null;

/* THEME TOGGLE ---------------------------------- */
themeToggle.addEventListener("click", () => {
  const body = document.body;
  const current = body.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  body.setAttribute("data-theme", next);
  themeToggle.textContent = next === "dark" ? "🌙 Dark" : "☀️ Light";
});

/* DRAG & DROP ----------------------------------- */
["dragover", "dragenter"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.add("drag-over");
  });
});

["dragleave", "dragend"].forEach((ev) => {
  dropZone.addEventListener(ev, (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.classList.remove("drag-over");
  });
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  e.stopPropagation();
  dropZone.classList.remove("drag-over");

  const files = [...e.dataTransfer.files];
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      if (file.name.endsWith(".html")) {
        htmlInput.value = text;
      } else if (file.name.endsWith(".css")) {
        cssInput.value = text;
      }
    };
    reader.readAsText(file);
  });
});

/* ANALYZE --------------------------------------- */
analyzeBtn.addEventListener("click", () => {
  const html = htmlInput.value.trim();
  const css = cssInput.value.trim();
  lastReport = createReport(html, css);

  if (!lastReport) {
    resultsList.innerHTML = "";
    summaryEl.textContent = "Nothing to analyze.";
    scoreBox.textContent = "Heuristic score: --";
    scoreBox.style.removeProperty("color");
    clsBadge.textContent = "CLS hints: --";
    lcpBadge.textContent = "LCP hints: --";
    cssBadge.textContent = "CSS weight: --";
    downloadBtn.disabled = true;
    return;
  }

  renderResults(lastReport.results, lastReport.meta);
  downloadBtn.disabled = false;
});

function createReport(html, css) {
  if (!html && !css) return null;

  const results = [];
  const meta = {
    score: 100,
    cls: html ? "no hint" : "not checked",
    lcp: html ? "no hint" : "not checked",
    cssWeight: "not checked",
    cssBytes: null,
    importantCount: null
  };

  // Both analyzers update the same metadata, preserving earlier deductions.
  if (html) analyzeHTML(html, results, meta);
  if (css) analyzeCSS(css, results, meta);
  meta.score = clampScore(meta.score);

  return {
    meta,
    results,
    raw: {
      htmlSample: html.slice(0, 4000),
      cssSample: css.slice(0, 4000)
    },
    timestamp: new Date().toISOString()
  };
}

function clampScore(score) {
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

function addResult(results, meta, result, penalty = 0) {
  results.push(result);
  meta.score = clampScore(meta.score - penalty);
}

/* HTML CHECKER ---------------------------------- */
function analyzeHTML(html, results, meta) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");

  analyzeImages(dom, results, meta);
  analyzeStylesheets(dom, results, meta);

  const inlineStyles = dom.querySelectorAll("[style]");
  if (inlineStyles.length) {
    addResult(results, meta, {
      type: "info",
      title: "Inline styles detected",
      message: `${inlineStyles.length} element(s) use inline styles. Sharing repeated declarations can reduce duplication, but inline styles are not inherently a performance problem.`
    });
  }
}

function hasPositiveDimension(img, attribute) {
  const value = (img.getAttribute(attribute) || "").trim();
  const number = Number(value);
  return /^\d+$/.test(value) && Number.isFinite(number) && number > 0;
}

function analyzeImages(dom, results, meta) {
  const imgs = [...dom.querySelectorAll("img")];
  const missingWH = imgs.filter((img) =>
    !hasPositiveDimension(img, "width") || !hasPositiveDimension(img, "height")
  );

  if (missingWH.length) {
    meta.cls = "review";
    addResult(results, meta, {
      type: "warning",
      title: "Images missing valid width/height",
      message: `${missingWH.length} image(s) lack positive integer width and/or height attributes. Reserve space with correct dimensions or CSS aspect-ratio to reduce layout shifts. CSS sizing is not verified by this check.`,
      highlight: missingWH.map((i) => i.outerHTML).join("\n\n")
    }, 20);
  }

  const defaultLoading = imgs.filter((img) =>
    !["lazy", "eager"].includes((img.getAttribute("loading") || "").toLowerCase())
  );

  if (defaultLoading.length) {
    meta.lcp = "review";
    addResult(results, meta, {
      type: "info",
      title: "Review image loading strategy",
      message: `${defaultLoading.length} image(s) use default loading. Keep above-the-fold and LCP/hero images eager (omit loading or use loading="eager"). Consider loading="lazy" only for images confirmed to start outside the viewport. This tool cannot determine image placement.`
    });
  }

  const lazyImages = imgs.filter((img) =>
    (img.getAttribute("loading") || "").toLowerCase() === "lazy"
  );
  if (lazyImages.length) {
    meta.lcp = "review";
    addResult(results, meta, {
      type: "info",
      title: "Review lazy-loaded images",
      message: `${lazyImages.length} image(s) use loading="lazy". If any are initially visible or are the LCP/hero image, use eager/default loading; lazy loading can delay them. Image order, dimensions, and fetch priority do not establish viewport placement.`
    });
  }
}

function analyzeStylesheets(dom, results, meta) {
  const links = [...dom.querySelectorAll("link[href]")].filter((link) =>
    link.getAttribute("href").trim()
  );
  const cssLinks = links.filter((link) =>
    link.rel.toLowerCase().split(/\s+/).includes("stylesheet")
  );
  if (cssLinks.length > 4) {
    addResult(results, meta, {
      type: "info",
      title: "Many external CSS files",
      message: `${cssLinks.length} stylesheet links detected. Review unused or duplicate CSS and render-blocking requests before combining files; caching, media conditions, and HTTP/2 or HTTP/3 can affect the tradeoff.`
    }, 5);
  }

  const preloads = links.filter((link) =>
    link.rel.toLowerCase().split(/\s+/).includes("preload") &&
    ["style", "image"].includes((link.getAttribute("as") || "").toLowerCase())
  );
  if (cssLinks.length && !preloads.length) {
    addResult(results, meta, {
      type: "info",
      title: "Preload needs measurement",
      message: "No style/image preload links detected. That is not a defect: stylesheets linked in HTML are already discoverable. Preload only critical resources that measurements show are discovered late; unnecessary preloads can compete for bandwidth."
    });
  }
}

/* CSS CHECKER ----------------------------------- */
function analyzeCSS(css, results, meta) {
  const bytes = new TextEncoder().encode(css).length;
  // A lightweight heuristic, not a full CSS parser. Ignore comments and strings.
  const declarations = css.replace(
    /\/\*[\s\S]*?\*\/|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    (token) => token.startsWith("/*") ? "" : " "
  );
  const importantCount = (declarations.match(/!\s*important\b/gi) || []).length;
  meta.cssBytes = bytes;
  meta.importantCount = importantCount;

  if (bytes < 5000) {
    meta.cssWeight = "small";
  } else if (bytes < 20000) {
    meta.cssWeight = "medium";
  } else {
    meta.cssWeight = "large";
    addResult(results, meta, {
      type: "info",
      title: "Large CSS source",
      message: `${bytes.toLocaleString()} bytes of uncompressed UTF-8 CSS supplied. Review unused rules and compression. The 20,000-byte threshold is a heuristic, not a measurement of transfer size or rendering cost.`
    }, 5);
  }

  if (importantCount > 0) {
    addResult(results, meta, {
      type: "info",
      title: "!important declarations detected",
      message: `${importantCount} !important declaration(s) detected. Review unnecessary overrides to keep the cascade maintainable. This alone does not prove slow rendering or cause layout shifts, so it does not reduce the score.`
    });
  }
}

/* RENDER ---------------------------------------- */
function renderResults(results, meta) {
  const score = meta.score;
  scoreBox.textContent = `Heuristic score: ${score}`;
  scoreBox.style.color =
    score >= 80 ? "var(--ok)" :
    score >= 50 ? "var(--warning)" :
    "var(--danger)";

  summaryEl.textContent = `${results.length} finding(s). Score reflects only the supplied input.`;

  clsBadge.textContent = `CLS hints: ${meta.cls}`;
  lcpBadge.textContent = `LCP hints: ${meta.lcp}`;
  cssBadge.textContent = `CSS weight: ${meta.cssWeight}` +
    (meta.cssBytes === null ? "" : ` (${meta.cssBytes.toLocaleString()} B)`);

  resultsList.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    li.className = "result-item";

    const badge = document.createElement("div");
    badge.className = `badge ${badgeClass(r.type)}`;
    badge.textContent = r.type.toUpperCase();
    const title = document.createElement("h3");
    title.textContent = r.title;
    const message = document.createElement("p");
    message.textContent = r.message;
    li.append(badge, title, message);

    if (r.highlight) {
      const h = document.createElement("div");
      h.className = "highlight-bad";
      h.textContent = r.highlight;
      li.appendChild(h);
    }

    resultsList.appendChild(li);
  });
}

function badgeClass(type) {
  return type === "warning"
    ? "badge-warning"
    : type === "ok"
    ? "badge-ok"
    : "badge-info";
}

/* DOWNLOAD JSON REPORT -------------------------- */
downloadBtn.addEventListener("click", () => {
  if (!lastReport) return;

  const blob = new Blob([JSON.stringify(lastReport, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "dotali-performance-report.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
