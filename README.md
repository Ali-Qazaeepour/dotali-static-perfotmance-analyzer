# DotAli Static Performance Analyzer

A small browser tool for reviewing HTML and CSS source. Pure HTML, CSS, and
vanilla JavaScript: no build step, server, or external dependencies.

## Use

1. Open `index.html` directly in a modern browser.
2. Paste HTML, CSS, or both, or drop a `.html` and/or `.css` file into the input area.
3. Click **Analyze** and review the findings and highlighted source.
4. Optionally download a JSON report with metadata, findings, a timestamp, and
   the first 4,000 characters of each input. The dark/light toggle changes the theme.

All analysis happens in the browser. No source is uploaded to a server. Each
analysis starts fresh; empty or whitespace-only input clears the previous result
and disables report download. If multiple files of the same type are dropped,
each replaces that input, so paste combined CSS yourself when needed.

## Checks

- **Image dimensions:** flags `<img>` tags missing positive integer `width` or
  `height` attributes. Correct dimensions or CSS that reserves space can reduce
  layout shifts; the tool cannot verify whether CSS already does this.
- **Image loading:** gives conditional advice for default and lazy loading.
  Missing `loading="lazy"` is not treated as an error. Images in the initial
  viewport, especially the LCP/hero image, should use eager/default loading.
  Lazy loading is for images confirmed to start outside the initial viewport.
- **Inline styles:** counts elements with a `style` attribute and suggests
  reviewing repeated declarations. Inline styles are not inherently slow.
- **Stylesheet links:** flags more than four non-empty stylesheet links,
  recognizing case-insensitive, space-separated `rel` tokens. Review unused
  CSS, caching, media conditions, and request timing before combining files.
- **Preload hints:** notes when linked CSS has no style/image preload hints.
  This is informational, not a defect. Preload only critical assets that
  measurements show are discovered late; existing HTML stylesheet links are
  already discoverable, and extra preloads can compete for bandwidth.
- **Pasted CSS size:** counts uncompressed UTF-8 bytes, including comments and
  whitespace. Labels CSS **small** below 5,000 bytes, **medium** from 5,000 to
  19,999 bytes, and **large** at 20,000 bytes or more.
- **`!important`:** reports an approximate count, ignoring comments and quoted
  strings and recognizing letter case and whitespace after `!`. This is a
  maintainability hint; it does not imply CLS risk or automatically slow rendering.

## Scoring and metadata

The heuristic score starts at 100 and stays between 0 and 100. Penalties apply
once per check, regardless of how many matching elements occur. HTML and CSS
deductions accumulate in a single report.

| Finding | Deduction |
| --- | ---: |
| One or more images missing valid dimension attributes | 20 |
| More than four stylesheet links | 5 |
| Pasted CSS at least 20,000 UTF-8 bytes | 5 |
| Image loading, inline styles, preloads, or `!important` advice | 0 |

Informational guidance is included in the finding count, even when it carries no
penalty. A score of 100 only means none of the scored heuristics matched the
supplied input; it does not prove the page is fast. Scores based on different
input coverage are not directly comparable.

The CLS/LCP badges are **hints**, not measurements: `review` means inspect the
page, `no hint` means no matching source hint, and `not checked` means no HTML
was supplied. CSS metadata includes `cssWeight`, `cssBytes`, and `importantCount`;
the latter two are `null` when no CSS was supplied.

## Limitations

- No page rendering, JavaScript execution, network timing, image byte-size or
  format analysis, compression measurement, or real Core Web Vitals measurement.
- Cannot identify the actual LCP element, viewport placement, computed sizing,
  responsive behavior, or whether an image causes a layout shift.
- Only pasted CSS is analyzed. Linked stylesheets, `@import` targets, `<style>`
  blocks, and CSS inside `style` attributes are not parsed for size or `!important`.
- The `!important` check is a lightweight text heuristic, not a complete CSS
  parser. It can miss unusual syntax or count tokens in unquoted URLs.
- Does not calculate rule counts, selector complexity, unused CSS, or stylesheet
  request cost. Size thresholds and score deductions are intentionally coarse.

Use browser DevTools, Lighthouse, or real-user measurements to verify actual
performance and the effect of any changes.

Further reading: [browser image loading](https://web.dev/articles/browser-level-image-lazy-loading)
and [preloading critical assets](https://web.dev/articles/preload-critical-assets).

## Files

```text
index.html  — interface and quick guide
style.css   — layout and themes
app.js      — checks, scoring, rendering, and report download
README.md   — usage and limitations
```

The project name uses **performance**. The GitHub repository URL retains its
original `perfotmance` spelling so existing links continue to work.
