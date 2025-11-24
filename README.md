# DotAli Static Performance Analyzer

A tiny, static, no-build tool to quickly review basic front-end performance issues
from your HTML and CSS.

## What it does

- Checks `<img>` tags for:
  - missing `width` / `height`
  - missing `loading="lazy"` on non-small images
- Counts external CSS files
- Detects inline styles and `<style>` blocks
- Suggests using `<link rel="preload">` for critical CSS / hero assets
- Reads raw CSS and reports:
  - approximate size and rule count
  - number of `!important` usages
  - rough count of complex selectors

All in **pure HTML + CSS + vanilla JS**, no bundlers, no dependencies.

## How to use

1. Open `index.html` in a browser (double-click is enough).
2. Paste your HTML and optional CSS.
3. Click **Analyze**.
4. Read the report on the right side.

## Folder structure

```text
dotali-static-performance-analyzer/
  index.html
  style.css
  app.js
  README.md
