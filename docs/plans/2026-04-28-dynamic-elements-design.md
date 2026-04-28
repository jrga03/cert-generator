# Dynamic Moveable Elements — Design

## Problem

The certificate generator hardcodes two moveable elements: `name` and `org`, mapped to CSV columns 0 and 1. We want N moveable elements driven by the CSV's column count, so a CSV with `Name, Organization, Date` produces three elements on the canvas, each independently positionable.

## Decisions (from brainstorm)

| # | Decision |
|---|---|
| Q1 | Element labels come from CSV header row; blank header cells fall back to `Field N`. |
| Q2 | One global font size with optional per-element override (`null` = inherit global). |
| Q3 | On CSV upload, elements stack vertically: first at canvas center, each next nudged down by ~1 line height. |
| Q4 | Positions reset to defaults on every CSV upload (no per-header position memory). |
| Q5 | Every CSV column gets a moveable element. No hide/opt-out UI — users prune their CSV. |
| Q6 | Form shows all element rows (label + X + Y + per-row font override) in a vertical list. |
| State management | Plain `useState` with a small `updateElement(id, patch)` helper — no reducer or custom hook. |
| Tests | Jest via `next/jest` for pure helpers. Canvas/PDF/PNG rendering verified manually. |

## Data shape

```js
// page.js state
const [elements, setElements] = useState([]);
const [globalFontSize, setGlobalFontSize] = useState(75);
const [selectedElementId, setSelectedElementId] = useState(null);
const [csvHeaders, setCsvHeaders] = useState([]);
const [csvRows, setCsvRows] = useState(null); // string[][]
```

```js
// element shape
{
  id: "el-0",          // stable within a CSV upload session
  columnIndex: 0,      // index into csvHeaders / row arrays
  label: "Name",       // from header, or "Field N" if blank
  x: 1275,             // PAGE_WIDTH/PAGE_HEIGHT pixel space
  y: 750,
  fontSize: null,      // null = inherit globalFontSize
}
```

Effective font size: `el.fontSize ?? globalFontSize`. Renderers use this helper.

## CSV parse → element construction

```js
function onChangeCsv(event) {
  // …
  Papa.parse(file, {
    skipEmptyLines: true,
    complete: (res) => {
      const [headerRow = [], ...dataRows] = res.data;
      if (dataRows.length === 0) { /* error */ return; }

      const headers = headerRow.map((cell, i) =>
        (cell ?? "").trim() || `Field ${i + 1}`
      );

      setCsvHeaders(headers);
      setCsvRows(dataRows);
      setElements(buildDefaultElements(headers));
      setSelectedElementId(null);
      setPreviewRowIndex(0);
    },
  });
}

function buildDefaultElements(headers) {
  const lineHeight = DEFAULT_FONT_SIZE; // 75
  return headers.map((label, i) => ({
    id: `el-${i}`,
    columnIndex: i,
    label,
    x: PAGE_WIDTH / 2,
    y: PAGE_HEIGHT / 2 + i * lineHeight,
    fontSize: null,
  }));
}
```

`csvRows` becomes a flat `string[][]`. The preview-row dropdown shows `csvRows[i].join(" — ")`, truncated.

## Preview renderer (`src/utils/preview.js`)

`generatePreview` accepts an `elements` array and a `rowCells` array. It loops elements, draws each centered at `(el.x * scale, el.y * scale)` using `el.fontSize ?? globalFontSize`. Empty cells render the element label as placeholder text. `boxesRef.current` becomes a map keyed by `id`, plus a `scale` field.

`hitTest` walks element ids in reverse so later (top-drawn) elements win on overlap:

```js
export function hitTest(boxes, x, y, elementIds) {
  for (let i = elementIds.length - 1; i >= 0; i--) {
    const b = boxes[elementIds[i]];
    if (b && x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height) {
      return elementIds[i];
    }
  }
  return null;
}
```

### Performance

For typical N (3–10), extra `measureText` and `fillText` calls are microseconds. The `drawImage` cost (the actual expensive op) is unchanged. Key invariants:
- Existing `requestAnimationFrame` debounce stays.
- `boxesRef` stays a ref (no re-render on mutation).
- Stable `el-${i}` ids keep React list keys cheap during drag.
- Background image cache (`imageCache`) stays.

Explicitly **not** doing now: `measureText` memoization, separate selection-overlay layer, off-canvas compositing.

## Drag interaction (`page.js`)

`updateElement` helper:

```js
const updateElement = (id, patch) =>
  setElements(prev => prev.map(el => el.id === id ? { ...el, ...patch } : el));
```

Used by drag, X/Y inputs, and font-size override changes.

`onPointerDownCanvas` stores `id` in `dragRef.current` instead of `element`. `onPointerMoveCanvas` calls `updateElement(id, { x, y })`. The `0.8` baseline-offset fudge factor stays as-is to preserve drag feel.

## UI form layout (`page.js`)

Hardcoded "Text X / Text Y / Org Text X / Org Text Y" blocks are removed. Replaced with a list rendered from `elements`:

```
[Name]            X: [____]  Y: [____]  Font: [____]  ⓧ
[Organization]    X: [____]  Y: [____]  Font: [____]  ⓧ
[Date]            X: [____]  Y: [____]  Font: [____]  ⓧ
```

- Label is read-only; clicking it selects the element.
- Selected row gets the existing `ring-2 ring-indigo-400` cue.
- Font input is empty by default with placeholder showing the global value (`"75 (global)"`); typing sets the override; clearing reverts to `null`.
- Inline ⓧ button appears only when `el.fontSize !== null` and clears the override.
- Global font-size input remains, relabeled "Font size (default)".

Empty state (no CSV yet): no element rows render. Canvas shows the existing "Preview" placeholder.

## PDF renderer (`src/utils/pdf.js`)

Per-page work becomes a loop over `elements`. Per-column max-width is hoisted out of the row loop:

```js
const elementWidths = elements.map(el => {
  const fontSizePx = el.fontSize ?? globalFontSize;
  const colValues = rows.map(r => r[el.columnIndex] ?? "");
  return getLargestWidth(colValues, fontSizePx, "Arial");
});

for (const [rowIndex, row] of rows.entries()) {
  doc.addPage();
  doc.image(img, 0, 0, { width: pageWidth, height: pageHeight });

  for (const [i, el] of elements.entries()) {
    const cell = row[el.columnIndex] ?? "";
    const fontSizePx = el.fontSize ?? globalFontSize;
    const fontSizePt = pixelsToPoints(fontSizePx);
    const widthPx = elementWidths[i];

    doc.font("Arial").fontSize(fontSizePt).fillColor("#000")
       .text(cell,
             pixelsToPoints(el.x - widthPx / 2),
             pixelsToPoints(el.y - fontSizePx),
             { align: "center", width: pixelsToPoints(widthPx) });
  }

  onProgress?.(rowIndex + 1, rows.length);
}
```

## PNG renderer (`src/utils/png.js`)

Same structure, simpler — `ctx.textAlign = "center"` removes the need for width measurement:

```js
for (const el of elements) {
  const cell = row[el.columnIndex] ?? "";
  const fontSizePx = el.fontSize ?? globalFontSize;
  ctx.font = `${fontSizePx}px Arial`;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.fillText(cell, el.x, el.y);
}
```

Filename for separate PDFs / PNG zip entries: use `row[0]`, fall back to `cert-${rowIndex + 1}` when column 0 is empty.

## Persistence (`src/utils/persistence.js`)

Persisted shape: `{ globalFontSize, outputType, separate }`. Position fields drop out (Q4 means they're per-session only).

Migration of existing localStorage: read once on mount, lift `numberInputs.fontSize` → `globalFontSize`. Old position fields silently ignored.

Extract `migrateLoadedSettings(saved)` from inline page.js logic so it's testable:

```js
// persistence.js
export function migrateLoadedSettings(saved) {
  if (!saved) return null;
  const out = {};
  if (typeof saved.globalFontSize === "number") {
    out.globalFontSize = saved.globalFontSize;
  } else if (typeof saved.numberInputs?.fontSize === "number") {
    out.globalFontSize = saved.numberInputs.fontSize;
  }
  if (saved.outputType) out.outputType = saved.outputType;
  if (typeof saved.separate === "boolean") out.separate = saved.separate;
  return out;
}
```

## Edge cases

| Case | Behavior |
|---|---|
| Blank header cell | Labeled `Field N` |
| Duplicate header names | Allowed; labels repeat, ids stay unique |
| Empty cell in a row | Renders empty string in exports; preview shows label as placeholder |
| Header-only CSV (no data rows) | Existing error path: `setCsvError("CSV has no data rows.")` |
| Zero-column / fully empty CSV | `elements = []`; submit blocked by `csvError` |
| Sparse rows (fewer cells than headers) | `row[columnIndex] ?? ""` covers it |
| Extra cells beyond headers | Silently ignored |
| Re-uploading any CSV | Always rebuilds elements; selection clears |

## Testing

**Framework:** Jest via `next/jest`. Environment: `jsdom`.

**Dev deps to add:** `jest`, `jest-environment-jsdom`.

**Scripts:**
```json
{
  "test": "jest --watch",
  "test:run": "jest"
}
```

**Files extracted for testability:**
- `src/utils/elements.js` — `buildDefaultElements`, `updateElement`, `parseCertCsv`
- `src/utils/preview.js` — `hitTest` already exported
- `src/utils/persistence.js` — `migrateLoadedSettings` added

**Test files (colocated):**

1. `src/utils/elements.test.js`
   - `buildDefaultElements`: empty headers → empty array; 3 headers → ids `el-0..el-2`, correct `columnIndex`, stacked y; blank/whitespace headers → `Field N`; duplicate names preserved as labels.
   - `updateElement`: id match patches that element only; missing id is a no-op.
   - `parseCertCsv`: header + data rows → correct shape; only header → error; blank header cells → `Field N`; sparse rows survive access.

2. `src/utils/preview.test.js`
   - `hitTest`: no boxes → null; point in one box → its id; overlap → last id in `ids` order wins; outside all → null.

3. `src/utils/persistence.test.js`
   - `migrateLoadedSettings`: old shape with `numberInputs.fontSize` → produces `globalFontSize`; new shape passthrough; `null` / malformed → safe defaults.

**Explicitly not tested:**
- Canvas drawing in `generatePreview`, PDFKit calls in `pdf.js`, JSZip work in `png.js`. High-effort mocking, low value vs. manual `yarn dev` verification.
- React component behavior in `page.js`. Component is thin glue over the helpers above; testing it adds RTL setup for marginal coverage.
- PapaParse itself.

## CLAUDE.md update

The "Commands" section gains:

```
- `yarn test` — run Jest in watch mode
- `yarn test:run` — run Jest once (CI-style)
```

The "No test framework is configured." line becomes:

> Tests live next to the units they cover (`src/utils/*.test.js`). Test framework: Jest via `next/jest` with `jsdom`. We unit-test pure helpers; canvas/PDF/PNG rendering is verified by manual `yarn dev` runs.

## Out of scope

- Per-element text alignment (always center, as today).
- Per-element color/font-family.
- Reordering elements via drag in the form list.
- Position memory across CSV uploads (Q4 explicitly rejects this).
- Component tests for `page.js`.
