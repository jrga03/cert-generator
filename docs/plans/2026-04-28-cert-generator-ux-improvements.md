# Cert-Generator UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement the four UX improvements from the design doc — drag-to-position, CSV-driven preview, localStorage persistence, and generation progress/errors — without adding dependencies.

**Architecture:** Single Next.js 13 client component (`src/app/page.js`) plus utility modules in `src/utils/` and `src/components/`. New state shape adds `selectedElement` and parsed CSV rows. `loader.jsx` (currently empty) becomes a real `<ProgressOverlay />`. Generators accept an optional `onProgress` callback and `throw` instead of swallowing errors. localStorage persists positioning settings under one versioned key.

**Tech Stack:** Next.js 13 (App Router, client component), React 18, Tailwind 3, PDFKit (loaded via `<Script>` from external URL — *do not change* in this plan), `papaparse`, `jszip`, `blob-stream`.

**Reference docs:**
- Design: `docs/plans/2026-04-28-cert-generator-ux-improvements-design.md`
- Existing entrypoint: `src/app/page.js`

**Testing approach:** No test framework is configured in this repo and adding one is out of scope. Each task ends with a manual browser verification step. Run `yarn dev` once at the start and keep it running.

**Sequencing:** Four features in the order below. Each feature is independent enough that you can stop after any of them and the app still works.

1. **Feature A** — Generation progress + errors (smallest diff, no preview changes)
2. **Feature B** — CSV-driven preview (sets up state shape needed by Feature C)
3. **Feature C** — Drag-to-position (depends on B)
4. **Feature D** — localStorage persistence (saves whatever final shape lands)

**Commit style:** Short, present-tense, lowercase prefix matching the existing log (`feat:`, `fix:`, `docs:`, `refactor:`). The user's global rule says **no `Co-Authored-By` line** in commits.

---

## Setup (one-time)

### Task 0: Start the dev server

**Step 1:** In a separate terminal, run:

```bash
cd /Users/jasonacido/repos/personal/cert-generator
yarn dev
```

**Expected:** Server listening on `http://localhost:3000`. Keep this running for the rest of the plan.

**Step 2:** Open `http://localhost:3000` and confirm the existing form renders (Download as / CSV / background photo / X-Y / font size / preview / Generate button).

**Step 3:** Grab the sample CSV at `http://localhost:3000/sample_names.csv` and a small PNG to use during manual verification of every later task. Keep them on hand.

---

## Feature A — Generation progress + errors

### Task A1: Make generators throw and accept onProgress

**Files:**
- Modify: `src/utils/pdf.js`
- Modify: `src/utils/png.js`
- Modify: `src/utils/download.js`

**Step 1:** In `src/utils/pdf.js`, change `downloadPDF` to accept `onProgress` and propagate errors. Find this block at the bottom:

```js
export async function downloadPDF(data) {
  try {
    const blob = await constructPDF(data);
    return blob;
  } catch (error) {
    console.log(error);
  }
}
```

Replace with:

```js
export async function downloadPDF(data, onProgress) {
  return constructPDF(data, onProgress);
}
```

**Step 2:** In the same file, update the `constructPDF` signature and call `onProgress` after each page. Find:

```js
const constructPDF = ({ names, orgs, img, fontSize, textX, textY, orgTextX, orgTextY }) =>
  new Promise(async (resolve, reject) => {
```

Replace with:

```js
const constructPDF = ({ names, orgs, img, fontSize, textX, textY, orgTextX, orgTextY }, onProgress) =>
  new Promise(async (resolve, reject) => {
```

Then, at the end of the `for (const [index, name] of names.entries())` loop body (just before the closing `}`), add:

```js
      onProgress?.(index + 1, names.length);
```

**Step 3:** In `src/utils/png.js`, do the equivalent. Find:

```js
export async function downloadAsPhoto(data) {
  try {
    const mime = "image/png";
    const zipBlob = await constructZip(mime, data);

    return zipBlob;
  } catch (error) {
    console.log(error);
  }
}
```

Replace with:

```js
export async function downloadAsPhoto(data, onProgress) {
  const mime = "image/png";
  return constructZip(mime, data, onProgress);
}
```

Update `constructZip` signature:

```js
const constructZip = async (
  mime,
  { names, orgs, img, fontSize, textX, textY, orgTextX, orgTextY },
  onProgress
) => {
```

After `await addPageToZip(zip, pageData, mime);` add:

```js
    onProgress?.(index + 1, names.length);
```

**Step 4:** In `src/utils/download.js`, accept and propagate `onProgress`. Replace the entire `download` function with:

```js
export async function download(data, onProgress) {
  const { type, names, orgs, separate } = data;

  switch (type) {
    case "pdf": {
      if (separate) {
        const zip = new JSZip();

        for (const [index, name] of names.entries()) {
          const pdf = await downloadPDF({
            ...data,
            names: [name],
            orgs: [orgs[index]],
          });

          const fileName = `${name}.pdf`;
          zip.file(fileName, pdf);
          onProgress?.(index + 1, names.length);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        downloadFile(blob, "certificates", "zip");
      } else {
        const pdf = await downloadPDF(data, onProgress);
        downloadFile(pdf, "certificates", "pdf");
      }

      break;
    }

    case "png": {
      const zip = await downloadAsPhoto(data, onProgress);
      downloadFile(zip, "certificates", "zip");
      break;
    }
  }
}
```

Note the removal of the `if (pdf)` / `if (zip)` guards — since errors now throw, undefined-blob paths can't happen.

**Step 5: Verify** — generate a PDF in the browser using the existing UI. The download should still work exactly as before (no visible change yet).

**Step 6: Commit**

```bash
git add src/utils/pdf.js src/utils/png.js src/utils/download.js
git commit -m "refactor: thread onProgress callback through generators"
```

---

### Task A2: Build the ProgressOverlay component

**Files:**
- Create: `src/components/progress-overlay.jsx`
- Delete: `src/components/loader.jsx` (empty file)

**Step 1:** Delete the empty placeholder:

```bash
rm src/components/loader.jsx
```

**Step 2:** Create `src/components/progress-overlay.jsx`:

```jsx
"use client";

export function ProgressOverlay({ current, total }) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-lg shadow-xl p-8 w-96 max-w-[90vw]">
        <h2 className="text-lg font-bold text-gray-900 mb-4">
          Generating certificates…
        </h2>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 transition-[width] duration-150"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-600 text-center">
          {current} of {total}
        </p>
      </div>
    </div>
  );
}
```

**Step 3: Verify** — no behavior change yet; run `yarn lint` to confirm no syntax errors.

```bash
yarn lint
```

**Expected:** No errors related to the new file.

**Step 4: Commit**

```bash
git add src/components/progress-overlay.jsx src/components/loader.jsx
git commit -m "feat: add ProgressOverlay component"
```

---

### Task A3: Build the Toast component

**Files:**
- Create: `src/components/toast.jsx`

**Step 1:** Create `src/components/toast.jsx`:

```jsx
"use client";

import { useEffect } from "react";

export function Toast({ message, onClose, autoDismissMs = 6000 }) {
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(onClose, autoDismissMs);
    return () => clearTimeout(id);
  }, [message, onClose, autoDismissMs]);

  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white rounded-md shadow-lg px-4 py-3 flex items-center gap-3 max-w-[90vw]">
      <span className="text-sm">{message}</span>
      <button
        type="button"
        onClick={onClose}
        className="text-white/80 hover:text-white text-lg leading-none"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
```

**Step 2: Verify** — `yarn lint` clean.

**Step 3: Commit**

```bash
git add src/components/toast.jsx
git commit -m "feat: add Toast component"
```

---

### Task A4: Wire ProgressOverlay and Toast into page.js

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Add imports near the top of `src/app/page.js`:

```js
import { ProgressOverlay } from "@/components/progress-overlay";
import { Toast } from "@/components/toast";
```

**Step 2:** Inside `Home`, add three new state variables alongside the existing ones:

```js
  const [progress, setProgress] = useState(null); // null | { current, total }
  const [error, setError] = useState(null);
  const isGenerating = progress !== null;
```

**Step 3:** Replace the body of `onSubmit` with progress + error wiring:

```js
  async function onSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const entries = Object.fromEntries(formData.entries());

    const img = await readAsDataURL(entries.bgPhoto);

    Papa.parse(entries.names, {
      skipEmptyLines: true,
      complete: async (res) => {
        const names = res.data.slice(1).map((row) => row[0]);
        const orgs = res.data.slice(1).map((row) => row[1]);

        const data = {
          ...entries,
          names,
          orgs,
          img,
          separate: entries.separate === "on",
        };

        try {
          setError(null);
          setProgress({ current: 0, total: names.length });
          await download(data, (current, total) =>
            setProgress({ current, total })
          );
        } catch (err) {
          setError(err?.message || "Failed to generate certificates.");
        } finally {
          setProgress(null);
        }
      },
    });
  }
```

**Step 4:** Update the Generate button to disable during generation. Find:

```jsx
<button
  type="submit"
  className={
    "mt-8 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500" +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
  }
>
  Generate
</button>
```

Replace with:

```jsx
<button
  type="submit"
  disabled={isGenerating}
  className={
    "mt-8 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:bg-gray-400 disabled:cursor-not-allowed " +
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
  }
>
  {isGenerating ? "Generating…" : "Generate"}
</button>
```

(Note the trailing space added to the first concatenated string — the original code is missing it.)

**Step 5:** Render the overlay and toast. At the top of the returned JSX (just inside the outer `<>`):

```jsx
      {progress && <ProgressOverlay current={progress.current} total={progress.total} />}
      <Toast message={error} onClose={() => setError(null)} />
```

**Step 6: Verify** — In the browser:
1. Upload the sample CSV and any PNG, click Generate. The overlay should appear with "X of N" updating.
2. Force an error by selecting an invalid file (e.g., rename a `.txt` to `.csv`) — toast should show.
3. Confirm the Generate button is disabled and shows "Generating…" during the run.

**Step 7: Commit**

```bash
git add src/app/page.js
git commit -m "feat: show progress overlay and error toast during generation"
```

---

## Feature B — CSV-driven preview

### Task B1: Parse CSV on upload

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Add new state next to existing state:

```js
  const [csvRows, setCsvRows] = useState(null); // null | [{name, org}]
  const [csvError, setCsvError] = useState(null);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
```

**Step 2:** Add an `onChange` handler for the CSV input:

```js
  function onChangeCsv(event) {
    const file = event.target.files[0];
    if (!file) {
      setCsvRows(null);
      setCsvError(null);
      return;
    }

    Papa.parse(file, {
      skipEmptyLines: true,
      complete: (res) => {
        const rows = res.data.slice(1).map((row) => ({
          name: row[0] ?? "",
          org: row[1] ?? "",
        }));
        if (rows.length === 0) {
          setCsvRows(null);
          setCsvError("CSV has no data rows.");
        } else {
          setCsvRows(rows);
          setCsvError(null);
          setPreviewRowIndex(0);
        }
      },
      error: (err) => {
        setCsvRows(null);
        setCsvError(err?.message || "Failed to parse CSV.");
      },
    });
  }
```

**Step 3:** Wire the handler onto the existing CSV input. Find:

```jsx
<input id="names" name="names" type="file" accept=".csv" required />
```

Replace with:

```jsx
<input
  id="names"
  name="names"
  type="file"
  accept=".csv"
  required
  onChange={onChangeCsv}
/>
{csvError && <p className="mt-1 text-sm text-red-600">{csvError}</p>}
```

**Step 4:** Simplify `onSubmit` to reuse parsed rows. Replace the `Papa.parse(entries.names, ...)` block with:

```js
    if (!csvRows) {
      setError("Please upload a CSV first.");
      return;
    }

    const names = csvRows.map((r) => r.name);
    const orgs = csvRows.map((r) => r.org);
    const data = {
      ...entries,
      names,
      orgs,
      img,
      separate: entries.separate === "on",
    };

    try {
      setError(null);
      setProgress({ current: 0, total: names.length });
      await download(data, (current, total) => setProgress({ current, total }));
    } catch (err) {
      setError(err?.message || "Failed to generate certificates.");
    } finally {
      setProgress(null);
    }
```

Remove the now-unused `import Papa from "papaparse";` if your IDE flags it — *but* keep it because we still need it inside `onChangeCsv`. Confirm the import remains.

**Step 5: Verify** — Upload the sample CSV. No visible change yet (dropdown comes next), but submitting the form should still produce the same PDF/PNG output.

**Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "refactor: parse CSV on upload instead of submit"
```

---

### Task B2: Add preview-row dropdown

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Just below the CSV input's error display, add the dropdown. Find the closing `</Field>` of the CSV input's Field, and insert *before* it (still inside the Field):

Actually, simpler: add it as a new sibling block right after the CSV `<Field>` block:

```jsx
{csvRows && csvRows.length > 0 && (
  <Field label="Preview row" labelFor="previewRow">
    <select
      id="previewRow"
      className="border px-2 py-1 rounded"
      value={previewRowIndex}
      onChange={(e) => setPreviewRowIndex(Number(e.target.value))}
    >
      {csvRows.map((row, i) => {
        const label = `${row.name}${row.org ? ` — ${row.org}` : ""}`;
        const truncated = label.length > 60 ? label.slice(0, 57) + "…" : label;
        return (
          <option key={i} value={i}>
            {truncated}
          </option>
        );
      })}
    </select>
  </Field>
)}
```

**Step 2: Verify** — Upload sample CSV. Dropdown appears with sample rows. Switching it doesn't yet change the preview (next task wires that up).

**Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "feat: add preview row selector"
```

---

### Task B3: Drive preview from selected CSV row

**Files:**
- Modify: `src/utils/preview.js`
- Modify: `src/app/page.js`

**Step 1:** In `src/utils/preview.js`, accept `nameText` and `orgText` and use them. Replace the entire function with:

```js
import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

const FALLBACK_NAME = "Juan dela Cruz";
const FALLBACK_ORG = "Organization";

export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY, nameText, orgText },
  successCb
) {
  if (
    canvas &&
    bgPhoto &&
    typeof fontSize === "number" &&
    typeof textX === "number" &&
    typeof textY === "number"
  ) {
    const computedStyles = getComputedStyle(canvas);
    const canvasWidth = parseInt(computedStyles.width, 10);
    const canvasHeight = parseInt(computedStyles.height, 10);

    const scale = Math.min(canvasWidth / PAGE_WIDTH, canvasHeight / PAGE_HEIGHT);
    const scaledFontSize = fontSize * scale;
    const scaledTextX = textX * scale;
    const scaledTextY = textY * scale;
    const scaledOrgTextX = orgTextX * scale;
    const scaledOrgTextY = orgTextY * scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const image = new Image();
    image.src = bgPhoto;
    image.width = canvasWidth;
    image.height = canvasHeight;
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

      ctx.font = `${scaledFontSize}px Arial`;
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      ctx.fillText(nameText || FALLBACK_NAME, scaledTextX, scaledTextY);
      ctx.fillText(orgText || FALLBACK_ORG, scaledOrgTextX, scaledOrgTextY);
    };

    successCb?.(true);
    return;
  }
  successCb?.(false);
}
```

**Step 2:** In `src/app/page.js`, derive the current preview text and pass it. First, after the state declarations:

```js
  const previewName = csvRows?.[previewRowIndex]?.name;
  const previewOrg = csvRows?.[previewRowIndex]?.org;
```

Then update the three places that call `generatePreview` (in `useLayoutEffect`, `onChangeBgPhoto`, and `onChangeNumberInput`) to include `nameText` and `orgText`:

In the `useLayoutEffect`:

```js
const updatePreview = () =>
  generatePreview(
    canvasRef.current,
    { bgPhoto, ...numberInputs, nameText: previewName, orgText: previewOrg },
    setHasPreview
  );
```

In `onChangeBgPhoto`:

```js
const updatePreview = () =>
  generatePreview(
    canvasRef.current,
    { bgPhoto: url, ...numberInputs, nameText: previewName, orgText: previewOrg },
    setHasPreview
  );
```

In `onChangeNumberInput`:

```js
const updatePreview = () =>
  generatePreview(
    canvasRef.current,
    { bgPhoto, ...newValues, nameText: previewName, orgText: previewOrg },
    setHasPreview
  );
```

**Step 3:** Add `previewName` and `previewOrg` to the `useLayoutEffect` dependency array so the effect re-runs when the user picks a different row. The effect is currently keyed on `[bgPhoto, numberInputs]`. Wait — that effect only attaches a resize listener; it doesn't render on row change.

To re-render when `previewRowIndex` changes, add a dedicated effect:

```js
  useLayoutEffect(() => {
    requestAnimationFrame(() =>
      generatePreview(
        canvasRef.current,
        { bgPhoto, ...numberInputs, nameText: previewName, orgText: previewOrg },
        setHasPreview
      )
    );
  }, [previewRowIndex, bgPhoto, numberInputs, previewName, previewOrg]);
```

(`previewName` and `previewOrg` are derived from `previewRowIndex` and `csvRows`, but listing them is harmless and clearer.)

**Step 4: Verify** — Upload sample CSV + a background image. Preview should now show the first CSV row's name & org. Pick a different row from the dropdown — preview updates.

**Step 5: Commit**

```bash
git add src/utils/preview.js src/app/page.js
git commit -m "feat: drive preview text from selected CSV row"
```

---

## Feature C — Drag-to-position

### Task C1: Refactor preview to expose text bounding boxes via ref

**Files:**
- Modify: `src/utils/preview.js`

**Goal:** Make `generatePreview` populate a `boxes` ref the page component owns, so click handlers can hit-test.

**Step 1:** Change the function signature to accept a `boxesRef`:

```js
export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY, nameText, orgText },
  successCb,
  boxesRef
) {
```

**Step 2:** Inside `image.onload`, after both `fillText` calls, measure and store boxes. Replace:

```js
ctx.fillText(nameText || FALLBACK_NAME, scaledTextX, scaledTextY);
ctx.fillText(orgText || FALLBACK_ORG, scaledOrgTextX, scaledOrgTextY);
```

With:

```js
const drawnName = nameText || FALLBACK_NAME;
const drawnOrg = orgText || FALLBACK_ORG;

ctx.fillText(drawnName, scaledTextX, scaledTextY);
ctx.fillText(drawnOrg, scaledOrgTextX, scaledOrgTextY);

if (boxesRef) {
  const nameMetrics = ctx.measureText(drawnName);
  const orgMetrics = ctx.measureText(drawnOrg);

  // textBaseline default is "alphabetic"; Y is the baseline.
  // Approximate the bounding box using actualBoundingBox metrics where available.
  const nameAscent = nameMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
  const nameDescent = nameMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
  const orgAscent = orgMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
  const orgDescent = orgMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

  // textAlign is "center", so origin X is the midpoint.
  boxesRef.current = {
    name: {
      x: scaledTextX - nameMetrics.width / 2,
      y: scaledTextY - nameAscent,
      width: nameMetrics.width,
      height: nameAscent + nameDescent,
    },
    org: {
      x: scaledOrgTextX - orgMetrics.width / 2,
      y: scaledOrgTextY - orgAscent,
      width: orgMetrics.width,
      height: orgAscent + orgDescent,
    },
    scale,
  };
}
```

**Step 3:** Also export a small helper for hit-testing, so the page doesn't duplicate the math:

```js
export function hitTest(boxes, canvasX, canvasY) {
  if (!boxes) return null;
  const inside = (b) =>
    canvasX >= b.x &&
    canvasX <= b.x + b.width &&
    canvasY >= b.y &&
    canvasY <= b.y + b.height;
  // org draws after name, so prefer org on overlap
  if (inside(boxes.org)) return "org";
  if (inside(boxes.name)) return "name";
  return null;
}
```

**Step 4: Verify** — `yarn lint` clean. No visible behavior change yet.

**Step 5: Commit**

```bash
git add src/utils/preview.js
git commit -m "refactor: expose text bounding boxes from preview"
```

---

### Task C2: Add selectedElement state + click-to-select

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Add the import for `hitTest`:

```js
import { generatePreview, hitTest } from "@/utils/preview";
```

**Step 2:** Add new state and a ref for boxes:

```js
  const [selectedElement, setSelectedElement] = useState(null); // null | "name" | "org"
  const boxesRef = useRef(null);
```

**Step 3:** Pass `boxesRef` through to every `generatePreview` call. Each call site adds a fourth argument:

```js
generatePreview(canvasRef.current, { ... }, setHasPreview, boxesRef);
```

(Update the three existing call sites and the one added in Task B3.)

**Step 4:** Add a `pointerdown` handler that hit-tests and sets the selected element. Add this above `return` in `Home`:

```js
  function getCanvasPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function onPointerDownCanvas(event) {
    if (!boxesRef.current) {
      setSelectedElement(null);
      return;
    }
    const { x, y } = getCanvasPoint(event);
    const hit = hitTest(boxesRef.current, x, y);
    setSelectedElement(hit);
  }
```

**Step 5:** Wire onto the canvas element. Find:

```jsx
<canvas className="w-full h-full" ref={canvasRef} />
```

Replace with:

```jsx
<canvas
  className="w-full h-full touch-none"
  ref={canvasRef}
  onPointerDown={onPointerDownCanvas}
/>
```

**Step 6: Verify** — Click on the name in the preview. No visible cue yet, but you can confirm via React DevTools that `selectedElement` becomes `"name"`. Click outside text → `null`.

**Step 7: Commit**

```bash
git add src/app/page.js src/utils/preview.js
git commit -m "feat: click-to-select preview text element"
```

---

### Task C3: Add drag handling

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Track drag state with a ref (avoids re-render churn during drag):

```js
  const dragRef = useRef(null); // null | { element, offsetX, offsetY }
```

**Step 2:** Update `onPointerDownCanvas` to start drag:

```js
  function onPointerDownCanvas(event) {
    if (!boxesRef.current) {
      setSelectedElement(null);
      return;
    }
    const { x, y } = getCanvasPoint(event);
    const hit = hitTest(boxesRef.current, x, y);
    setSelectedElement(hit);
    if (!hit) return;

    const box = boxesRef.current[hit];
    dragRef.current = {
      element: hit,
      offsetX: x - box.x,
      offsetY: y - box.y,
      scale: boxesRef.current.scale,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
```

**Step 3:** Add `onPointerMove` and `onPointerUp` handlers:

```js
  function onPointerMoveCanvas(event) {
    if (!dragRef.current) return;
    const { x, y } = getCanvasPoint(event);
    const { element, offsetX, offsetY, scale } = dragRef.current;
    const box = boxesRef.current[element];

    // New top-left in canvas-space
    const newCanvasX = x - offsetX;
    const newCanvasY = y - offsetY;

    // Convert top-left back to the text origin used by fillText (center-x, baseline-y)
    const originCanvasX = newCanvasX + box.width / 2;
    const originCanvasY = newCanvasY + (box.height * 0.8); // ascent ratio approximation

    // Convert to page coordinates
    const pageX = clamp(Math.round(originCanvasX / scale), 0, PAGE_WIDTH);
    const pageY = clamp(Math.round(originCanvasY / scale), 0, PAGE_HEIGHT);

    setNumberInputs((prev) => {
      const next = { ...prev };
      if (element === "name") {
        next.textX = pageX;
        next.textY = pageY;
      } else {
        next.orgTextX = pageX;
        next.orgTextY = pageY;
      }
      return next;
    });
  }

  function onPointerUpCanvas(event) {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }
```

**Step 4:** Add the `clamp` helper at module level (above `Home`):

```js
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
```

**Step 5:** Wire pointer move/up onto the canvas:

```jsx
<canvas
  className="w-full h-full touch-none"
  ref={canvasRef}
  onPointerDown={onPointerDownCanvas}
  onPointerMove={onPointerMoveCanvas}
  onPointerUp={onPointerUpCanvas}
  onPointerCancel={onPointerUpCanvas}
/>
```

**Step 6:** Sync the number inputs with state. The current inputs use `defaultValue={numberInputs.textX}`, which means they don't update when state changes externally. Switch them to controlled inputs. For each of the five number `<input>`s, change:

```jsx
defaultValue={numberInputs.textX}
```

To:

```jsx
value={numberInputs.textX}
```

(Repeat for `textY`, `orgTextX`, `orgTextY`, `fontSize`.)

**Step 7: Verify** — In the browser:
1. Upload sample CSV + image.
2. Click the name on the preview, drag it. Text follows the pointer; X/Y inputs update live.
3. Drag toward the edge — values clamp at 0 and PAGE_WIDTH/PAGE_HEIGHT.
4. Click the org, drag it — different element moves.
5. Type in an X input — preview updates as before.

**Step 8: Commit**

```bash
git add src/app/page.js
git commit -m "feat: drag preview text to update position"
```

---

### Task C4: Add visual selection cue and cursor

**Files:**
- Modify: `src/utils/preview.js`
- Modify: `src/app/page.js`

**Step 1:** In `generatePreview`, accept a `selectedElement` arg and draw a dashed bounding box. Update signature:

```js
export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY, nameText, orgText, selectedElement },
  successCb,
  boxesRef
) {
```

**Step 2:** Inside `image.onload`, after computing boxes (still inside the `if (boxesRef)` block — but the dashed box should draw regardless of whether boxesRef is provided, so move the metrics calculation out of the `if`). Refactor as:

```js
const drawnName = nameText || FALLBACK_NAME;
const drawnOrg = orgText || FALLBACK_ORG;

ctx.fillText(drawnName, scaledTextX, scaledTextY);
ctx.fillText(drawnOrg, scaledOrgTextX, scaledOrgTextY);

const nameMetrics = ctx.measureText(drawnName);
const orgMetrics = ctx.measureText(drawnOrg);
const nameAscent = nameMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
const nameDescent = nameMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
const orgAscent = orgMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
const orgDescent = orgMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

const boxes = {
  name: {
    x: scaledTextX - nameMetrics.width / 2,
    y: scaledTextY - nameAscent,
    width: nameMetrics.width,
    height: nameAscent + nameDescent,
  },
  org: {
    x: scaledOrgTextX - orgMetrics.width / 2,
    y: scaledOrgTextY - orgAscent,
    width: orgMetrics.width,
    height: orgAscent + orgDescent,
  },
  scale,
};

if (boxesRef) {
  boxesRef.current = boxes;
}

if (selectedElement && boxes[selectedElement]) {
  const b = boxes[selectedElement];
  ctx.save();
  ctx.strokeStyle = "#4f46e5";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
  ctx.restore();
}
```

**Step 3:** In `src/app/page.js`, pass `selectedElement` into every `generatePreview` call. Add it to each config object:

```js
{ bgPhoto, ...numberInputs, nameText: previewName, orgText: previewOrg, selectedElement }
```

(Four call sites: the resize listener, `onChangeBgPhoto`, `onChangeNumberInput`, and the row-change effect.)

**Step 4:** Add `selectedElement` to the row-change effect's dependency array so the cue redraws on selection change:

```js
}, [previewRowIndex, bgPhoto, numberInputs, previewName, previewOrg, selectedElement]);
```

**Step 5:** Add a hover cursor. Track hover state with a small handler:

```js
  function onPointerHover(event) {
    if (dragRef.current) return; // already in `move` cursor while dragging
    if (!boxesRef.current || !canvasRef.current) return;
    const { x, y } = getCanvasPoint(event);
    const hit = hitTest(boxesRef.current, x, y);
    canvasRef.current.style.cursor = hit ? "move" : "default";
  }
```

Wire it in alongside `onPointerMoveCanvas`. Combine: in the existing `onPointerMoveCanvas`, call `onPointerHover(event)` first when not dragging:

```js
  function onPointerMoveCanvas(event) {
    if (!dragRef.current) {
      onPointerHover(event);
      return;
    }
    // ...existing drag logic
  }
```

**Step 6:** Highlight the input pair for the selected element. Build a small helper:

```js
  const inputCls = (element) =>
    "border px-2 py-1 rounded " +
    (selectedElement === element ? "ring-2 ring-indigo-400" : "");
```

Update each of the four position inputs:

- `textX`, `textY` → `className={inputCls("name")}`
- `orgTextX`, `orgTextY` → `className={inputCls("org")}`

(Leave `fontSize` with its existing class.)

**Step 7: Verify** — In the browser:
1. Hover the name → cursor becomes "move".
2. Click name → dashed indigo box appears around it; the X/Y inputs for name get an indigo ring.
3. Click org → ring jumps to org's inputs; bbox jumps to org.
4. Click outside text → cue disappears, no input is highlighted.

**Step 8: Commit**

```bash
git add src/utils/preview.js src/app/page.js
git commit -m "feat: visual cue and cursor for drag selection"
```

---

## Feature D — localStorage persistence

### Task D1: Build the persistence module

**Files:**
- Create: `src/utils/persistence.js`

**Step 1:** Create `src/utils/persistence.js`:

```js
const KEY = "cert-generator:settings";
const VERSION = 1;

export function loadSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveSettings(data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: VERSION, data })
    );
  } catch {
    // quota errors etc — ignore
  }
}
```

**Step 2: Verify** — `yarn lint` clean.

**Step 3: Commit**

```bash
git add src/utils/persistence.js
git commit -m "feat: add localStorage settings persistence module"
```

---

### Task D2: Hydrate settings on mount

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Add the import:

```js
import { loadSettings, saveSettings } from "@/utils/persistence";
```

**Step 2:** Add a hydration effect right after the existing state declarations. We also need state for output type and separate (currently uncontrolled) — but per design we save those, so promote them:

```js
  const [outputType, setOutputType] = useState("pdf");
  const [separate, setSeparate] = useState(false);
```

**Step 3:** Add hydration. Place this `useEffect` after state declarations but before the existing `useLayoutEffect`:

```js
  useEffect(() => {
    const saved = loadSettings();
    if (!saved) return;
    setNumberInputs((prev) => ({ ...prev, ...saved.numberInputs }));
    if (saved.outputType) setOutputType(saved.outputType);
    if (typeof saved.separate === "boolean") setSeparate(saved.separate);
  }, []);
```

Add `useEffect` to the import line at the top:

```js
import { useEffect, useLayoutEffect, useRef, useState } from "react";
```

**Step 4:** Convert the radio + checkbox to controlled. Find the type radios:

```jsx
<input id="pdf" name="type" type="radio" value="pdf" required />
```

Replace both radios with controlled versions:

```jsx
<input
  id="pdf"
  name="type"
  type="radio"
  value="pdf"
  required
  checked={outputType === "pdf"}
  onChange={() => setOutputType("pdf")}
/>
```

```jsx
<input
  id="png"
  name="type"
  type="radio"
  value="png"
  required
  checked={outputType === "png"}
  onChange={() => setOutputType("png")}
/>
```

Find the separate checkbox:

```jsx
<input id="separate" name="separate" type="checkbox" />
```

Replace:

```jsx
<input
  id="separate"
  name="separate"
  type="checkbox"
  checked={separate}
  onChange={(e) => setSeparate(e.target.checked)}
/>
```

**Step 5: Verify** — Reload the page. No saved settings yet, so defaults still apply. Then in DevTools console set:

```js
localStorage.setItem("cert-generator:settings", JSON.stringify({version:1,data:{numberInputs:{textX:500,textY:500,orgTextX:500,orgTextY:600,fontSize:100},outputType:"png",separate:true}}))
```

Reload — values should hydrate (PNG selected, checkbox checked, position inputs show 500/500/etc).

**Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "feat: hydrate position settings from localStorage"
```

---

### Task D3: Auto-save settings (debounced)

**Files:**
- Modify: `src/app/page.js`

**Step 1:** Add a debounced save effect. Place after the hydration effect:

```js
  useEffect(() => {
    const id = setTimeout(() => {
      saveSettings({ numberInputs, outputType, separate });
    }, 250);
    return () => clearTimeout(id);
  }, [numberInputs, outputType, separate]);
```

**Step 2: Verify** — In the browser:
1. Drag the name to a new position. Wait ~300ms. Open DevTools Application tab → Local Storage → confirm `cert-generator:settings` reflects the new X/Y.
2. Toggle the separate checkbox; check storage updates.
3. Switch radio to PNG; check storage updates.
4. Reload — drag position, output type, and checkbox state all persist.
5. Manually set a wrong version: `localStorage.setItem("cert-generator:settings", JSON.stringify({version:99,data:{}}))`. Reload — defaults restore (no crash).

**Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "feat: auto-save settings to localStorage"
```

---

## Final smoke test

### Task Z: End-to-end verification

**Step 1:** Hard-refresh `http://localhost:3000` (Cmd-Shift-R). Confirm:

1. Defaults render correctly (positions centered, font size 75, PDF selected, separate unchecked).
2. Upload `/sample_names.csv` → preview-row dropdown appears, first row's name + org show in preview after image upload.
3. Upload a background PNG → preview renders with image + selected row's text.
4. Drag name → bbox + cursor + input ring all work; X/Y update live.
5. Drag org → same.
6. Switch preview row → preview text changes, bbox stays on currently-selected element.
7. Click Generate (PDF, not separate) → progress overlay shows, increments, downloads `certificates.pdf`. Open it → all rows present, positions match what you saw in preview.
8. Switch to separate PDFs → generate → downloads `certificates.zip` containing per-name PDFs.
9. Switch to PNG → generate → downloads `certificates.zip` of PNGs.
10. Reload → all positioning + radio + checkbox restore from localStorage.
11. Trigger an error: rename a `.txt` to `.csv` and try to upload. Toast appears with a readable message.

**Step 2:** Final cleanup commit, if any whitespace/lint issues remain:

```bash
yarn lint
git status
```

If nothing to commit, you're done.

---

## Out of scope (intentionally not in this plan)

- Test framework setup
- Font/color picker
- Multi-column CSV schema (date, course title, signatory)
- Page-size correction (the "A4 landscape" comment vs `2550x1500` mismatch)
- PDFKit dependency hosting (currently loaded from `github.com/foliojs/pdfkit/releases/...` — fragile, but per the design doc we leave it alone)
- Next.js / React / ESLint upgrades
- Tests
