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

  const results = [];
  let meta = {
    score: 100,
    cls: "OK",
    lcp: "OK",
    cssWeight: "--"
  };

  if (!html && !css) {
    resultsList.innerHTML = "";
    summaryEl.textContent = "Nothing to analyze.";
    scoreBox.textContent = "Score: --";
    clsBadge.textContent = "CLS: --";
    lcpBadge.textContent = "LCP: --";
    cssBadge.textContent = "CSS weight: --";
    downloadBtn.disabled = true;
    lastReport = null;
    return;
  }

  if (html) meta = analyzeHTML(html, results, meta);
  if (css) meta = analyzeCSS(css, results, meta);

  renderResults(results, meta);

  lastReport = {
    meta,
    results,
    raw: {
      htmlSample: html.slice(0, 4000),
      cssSample: css.slice(0, 4000)
    },
    timestamp: new Date().toISOString()
  };
  downloadBtn.disabled = false;
});

/* HTML CHECKER ---------------------------------- */
function analyzeHTML(html, results, meta) {
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, "text/html");

  const imgs = [...dom.querySelectorAll("img")];
  const missingWH = imgs.filter((img) => !img.getAttribute("width") || !img.getAttribute("height"));

  if (missingWH.length) {
    meta.score -= 20;
    meta.cls = "risk";
    results.push({
      type: "warning",
      title: "Images missing width/height",
      message: `${missingWH.length} <img> tag(s) without dimensions. This can hurt CLS.`,
      highlight: missingWH.map((i) => i.outerHTML).join("\n\n")
    });
  }

  const lazyMissing = imgs.filter((img) => {
    const src = img.getAttribute("src") || "";
    const isSmall = img.getAttribute("width") && Number(img.getAttribute("width")) <= 120;
    return src && !isSmall && !img.hasAttribute("loading");
  });

  if (lazyMissing.length) {
    meta.score -= 10;
    meta.lcp = "risk";
    results.push({
      type: "info",
      title: "Images missing lazy-loading",
      message: `${lazyMissing.length} image(s) without loading="lazy". This can affect LCP.`
    });
  }

  const inlineStyles = dom.querySelectorAll("[style]");
  if (inlineStyles.length) {
    meta.score -= 5;
    results.push({
      type: "info",
      title: "Inline styles detected",
      message: `${inlineStyles.length} element(s) using inline styles. Repeated ones should go to CSS.`
    });
  }

  const cssLinks = dom.querySelectorAll('link[rel="stylesheet"]');
  if (cssLinks.length > 4) {
    meta.score -= 5;
    results.push({
      type: "info",
      title: "Many external CSS files",
      message: `${cssLinks.length} external stylesheets. Consider merging some for fewer requests.`
    });
  }

  const preloads = dom.querySelectorAll('link[rel="preload"][as="style"], link[rel="preload"][as="image"]');
  if (cssLinks.length && !preloads.length) {
    results.push({
      type: "info",
      title: "No preload hints",
      message: "No <link rel=\"preload\"> found for critical CSS / hero image. Adding one can help LCP."
    });
  }

  meta.score = Math.max(meta.score, 0);
  return meta;
}

/* CSS CHECKER ----------------------------------- */
function analyzeCSS(css, metaBase) {
  const meta = { ...metaBase };

  const length = css.length;
  const importantCount = (css.match(/!important/g) || []).length;

  if (length < 5000) {
    meta.cssWeight = "small";
  } else if (length < 20000) {
    meta.cssWeight = "medium";
  } else {
    meta.cssWeight = "large";
    meta.score -= 5;
  }

  if (importantCount > 0) {
    meta.score -= 10;
    meta.cls = meta.cls === "OK" ? "mixed" : meta.cls;
    resultsList;
    meta._importantCount = importantCount; // used in report
  }

  return meta;
}

/* RENDER ---------------------------------------- */
function renderResults(results, meta) {
  const score = Math.max(0, meta.score);
  scoreBox.textContent = `Score: ${score}`;
  scoreBox.style.color =
    score >= 80 ? "#38c172" :
    score >= 50 ? "#ffb020" :
    "#ff3b3b";

  summaryEl.textContent = `${results.length} issue(s) detected.`;

  clsBadge.textContent = `CLS: ${meta.cls}`;
  lcpBadge.textContent = `LCP: ${meta.lcp}`;
  cssBadge.textContent = `CSS weight: ${meta.cssWeight}`;

  resultsList.innerHTML = "";
  results.forEach((r) => {
    const li = document.createElement("li");
    li.className = "result-item";

    li.innerHTML = `
      <div class="badge ${badgeClass(r.type)}">${r.type.toUpperCase()}</div>
      <h3>${r.title}</h3>
      <p>${r.message}</p>
    `;

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
