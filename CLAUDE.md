# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — start Next.js dev server at http://localhost:3000
- `yarn build` — production build
- `yarn start` — serve the production build
- `yarn lint` — run `next lint` (ESLint, `next/core-web-vitals` config)

No test framework is configured.

## Architecture

Single-page Next.js 13 (App Router) client tool that takes a CSV of names + organizations plus a background image and emits certificates as a single PDF, a ZIP of per-name PDFs, or a ZIP of PNGs. All rendering happens in the browser; there is no server-side logic beyond Next's static serving.

Entry point is `src/app/page.js` (`"use client"`). It collects form inputs, parses the CSV with `papaparse` (skipping the header row, taking column 0 as name and column 1 as org), reads the background image as a data URL, and dispatches to `src/utils/download.js`. That dispatcher branches on `type` (`pdf` | `png`) and `separate` (boolean) and calls either `downloadPDF` (`src/utils/pdf.js`) or `downloadAsPhoto` (`src/utils/png.js`), then triggers a browser download via an anchor + `URL.createObjectURL`.

Two rendering paths that must stay visually consistent:

- **PDF** (`src/utils/pdf.js`): uses **PDFKit loaded from CDN** via `next/script` in `page.js`, accessed as `window.PDFDocument` — it is NOT a bundled dependency, so calling it before the script loads will fail. Coordinates are converted from pixels to PDF points via `pixelsToPoints(px) = px * 72 / 300` (i.e. the canvas units are treated as 300 DPI). The Arial font is fetched from `/public/arial.ttf` via `XMLHttpRequest` and registered with `doc.registerFont`. Text is centered by measuring the largest width across all names/orgs (via an offscreen canvas) and offsetting `textX`/`orgTextX` by half that width — change one centering rule and you must mirror it in the other path.
- **PNG** (`src/utils/png.js`): renders each certificate to a `<canvas>` at full `PAGE_WIDTH × PAGE_HEIGHT`, exports as PNG data URL, and packs into a JSZip. Uses `ctx.textAlign = "center"` so it does not need the largest-width measurement that the PDF path does.
- **Preview** (`src/utils/preview.js`): a third renderer that scales the same coordinate system down to the on-page `<canvas>` for live preview. It uses placeholder text ("Juan dela Cruz" / "Organization") rather than real CSV data.

Page size is fixed A4 landscape, defined in pixels at `src/utils/page-size.js` (`PAGE_WIDTH = 2550`, `PAGE_HEIGHT = 1500`, ~300 DPI). All three renderers consume these constants — change them in one place.

### Path alias
`jsconfig.json` maps `@/*` → `./src/*`. Use `@/utils/...` style imports.

### Styling
Tailwind CSS (`tailwind.config.js`) plus per-route CSS (`src/app/page.css`, `src/app/globals.css`).

### Assets
`public/arial.ttf` is required by the PDF renderer. `public/sample_names.csv` is linked from the UI as a downloadable template.
