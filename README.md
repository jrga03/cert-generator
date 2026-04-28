# Certificate Generator

Browser-based bulk certificate generator. Upload a background image and a CSV of recipients, position the text, and download the certificates as a single PDF, a ZIP of per-person PDFs, or a ZIP of PNGs.

**Live:** https://cert-generator-two.vercel.app/

## Features

- Bulk-generate certificates from a CSV (name + organization per row)
- A4 landscape output at 300 DPI
- PDF or PNG output, single combined file or one file per recipient (zipped)
- Live preview as you adjust text position and font size
- Runs entirely in the browser — no upload, no server-side processing

## Usage

1. Open the app.
2. Choose output format: **PDF** or **PNG**. For PDFs, optionally tick *Download as separate files* to get one PDF per recipient inside a ZIP.
3. Upload a `.csv` of recipients. Format:
   ```csv
   Name,Organization
   John Doe,Sa Puso Mo
   Jane Doe,Krusty Krabs
   ```
   The first row is treated as a header and skipped. A sample is downloadable from the UI (`/sample_names.csv`).
4. Upload a background image (`.png` or `.jpg`) sized for A4 landscape.
5. Adjust **Text X/Y**, **Org Text X/Y**, and **Font size**. Coordinates are in pixels against a 2550 × 1500 canvas; the preview scales live.
6. Click **Generate** to download.

## Running locally

Requires Node.js. Install dependencies and start the dev server:

```bash
yarn install
yarn dev
```

Open http://localhost:3000.

Other scripts:

```bash
yarn build   # production build
yarn start   # serve the production build
yarn lint    # next lint
```

## How it works

- **PDF output** uses [PDFKit](https://pdfkit.org/) loaded from CDN at runtime (not bundled). The font in `public/arial.ttf` is registered with the document, and pixel coordinates are converted to PDF points at 300 DPI.
- **PNG output** renders each certificate to a `<canvas>`, exports as PNG, and packs the set into a ZIP via [JSZip](https://stuk.github.io/jszip/).
- **CSV parsing** uses [PapaParse](https://www.papaparse.com/).

Page dimensions are defined once in `src/utils/page-size.js` and shared by the PDF, PNG, and preview renderers.

## Tech stack

Next.js 13 (App Router) · React 18 · Tailwind CSS · PDFKit · JSZip · PapaParse
