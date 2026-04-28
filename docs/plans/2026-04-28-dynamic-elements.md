# Dynamic Moveable Elements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the hardcoded `name`/`org` moveable elements in the certificate preview with a dynamic array driven by the uploaded CSV's columns.

**Architecture:** Introduce a single `elements` array in `page.js` state. Each element holds `{id, columnIndex, label, x, y, fontSize}`. CSV upload rebuilds the array from the header row (with `Field N` fallback) and stacks elements vertically at canvas center. Drag, hit-test, the form list, and all three renderers (`preview.js`, `pdf.js`, `png.js`) loop the array instead of branching on hardcoded names. Persistence drops position fields and keeps only `globalFontSize` / `outputType` / `separate`. New Jest test infra covers extracted pure helpers.

**Tech Stack:** Next.js 13 (App Router, client-only), React 18, PapaParse, PDFKit (loaded via CDN, accessed as `window.PDFDocument`), JSZip, Tailwind. Tests: Jest via `next/jest`, `jsdom` environment. Yarn classic.

**Reference:** `docs/plans/2026-04-28-dynamic-elements-design.md`

---

## Phase 1 — Test infrastructure

### Task 1: Install Jest dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install dev dependencies**

Run: `yarn add --dev jest@^29 jest-environment-jsdom@^29`

Expected: `package.json` gains `devDependencies` for `jest` and `jest-environment-jsdom`. `yarn.lock` updates.

**Step 2: Verify install**

Run: `yarn jest --version`
Expected: prints a version number starting with `29.`.

**Step 3: Commit**

```bash
git add package.json yarn.lock
git commit -m "chore: install jest and jsdom env"
```

---

### Task 2: Add Jest config and scripts

**Files:**
- Create: `jest.config.js`
- Modify: `package.json` (scripts)

**Step 1: Create `jest.config.js`**

```js
const nextJest = require("next/jest.js");

const createJestConfig = nextJest({
  dir: "./",
});

const config = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};

module.exports = createJestConfig(config);
```

Note: `next/jest` ships with Next.js 13 and is already on disk as part of the `next` dependency. No extra install needed.

**Step 2: Add scripts to `package.json`**

In the `"scripts"` block, add:

```json
"test": "jest --watch",
"test:run": "jest"
```

Final `"scripts"` should contain `dev`, `build`, `start`, `lint`, `test`, `test:run`.

**Step 3: Commit**

```bash
git add jest.config.js package.json
git commit -m "chore: configure jest with next/jest"
```

---

### Task 3: Verify Jest runs with a smoke test

**Files:**
- Create: `src/utils/__smoke__.test.js`

**Step 1: Write smoke test**

```js
describe("jest smoke", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

**Step 2: Run it**

Run: `yarn test:run`
Expected: `PASS  src/utils/__smoke__.test.js` and `Tests: 1 passed`.

**Step 3: Delete smoke test**

Run: `rm src/utils/__smoke__.test.js`

**Step 4: Commit**

```bash
git commit --allow-empty -m "chore: verify jest config (no files committed)"
```

(Or skip the commit entirely — the smoke test was throwaway.)

---

### Task 4: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

**Step 1: Replace the test framework line**

Find the line:
```
No test framework is configured.
```

Replace with:
```
- `yarn test` — run Jest in watch mode
- `yarn test:run` — run Jest once (CI-style)

Tests live next to the units they cover (`src/utils/*.test.js`). Test framework: Jest via `next/jest` with `jsdom`. We unit-test pure helpers; canvas/PDF/PNG rendering is verified by manual `yarn dev` runs.
```

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document jest test setup in CLAUDE.md"
```

---

## Phase 2 — Pure helpers (TDD)

### Task 5: `buildDefaultElements`

**Files:**
- Create: `src/utils/elements.js`
- Create: `src/utils/elements.test.js`

**Step 1: Write the failing tests**

Create `src/utils/elements.test.js`:

```js
import { buildDefaultElements } from "./elements";
import { PAGE_WIDTH, PAGE_HEIGHT } from "./page-size";

const DEFAULT_FONT_SIZE = 75;

describe("buildDefaultElements", () => {
  it("returns empty array for empty headers", () => {
    expect(buildDefaultElements([])).toEqual([]);
  });

  it("creates one element per header in order", () => {
    const els = buildDefaultElements(["Name", "Org", "Date"]);
    expect(els).toHaveLength(3);
    expect(els.map(e => e.label)).toEqual(["Name", "Org", "Date"]);
    expect(els.map(e => e.columnIndex)).toEqual([0, 1, 2]);
    expect(els.map(e => e.id)).toEqual(["el-0", "el-1", "el-2"]);
  });

  it("stacks elements vertically: first at center, each next + line height", () => {
    const els = buildDefaultElements(["A", "B", "C"]);
    expect(els[0].x).toBe(PAGE_WIDTH / 2);
    expect(els[0].y).toBe(PAGE_HEIGHT / 2);
    expect(els[1].y).toBe(PAGE_HEIGHT / 2 + DEFAULT_FONT_SIZE);
    expect(els[2].y).toBe(PAGE_HEIGHT / 2 + 2 * DEFAULT_FONT_SIZE);
    expect(els.every(e => e.x === PAGE_WIDTH / 2)).toBe(true);
  });

  it("initializes fontSize to null (inherit global)", () => {
    const [el] = buildDefaultElements(["Name"]);
    expect(el.fontSize).toBeNull();
  });
});
```

**Step 2: Run tests, verify they fail**

Run: `yarn test:run src/utils/elements.test.js`
Expected: FAIL with `Cannot find module './elements'`.

**Step 3: Implement `src/utils/elements.js`**

```js
import { PAGE_WIDTH, PAGE_HEIGHT } from "./page-size";

const DEFAULT_FONT_SIZE = 75;

export function buildDefaultElements(headers) {
  return headers.map((label, i) => ({
    id: `el-${i}`,
    columnIndex: i,
    label,
    x: PAGE_WIDTH / 2,
    y: PAGE_HEIGHT / 2 + i * DEFAULT_FONT_SIZE,
    fontSize: null,
  }));
}
```

**Step 4: Run tests, verify they pass**

Run: `yarn test:run src/utils/elements.test.js`
Expected: 4 passed.

**Step 5: Commit**

```bash
git add src/utils/elements.js src/utils/elements.test.js
git commit -m "feat: add buildDefaultElements helper"
```

---

### Task 6: `updateElement`

**Files:**
- Modify: `src/utils/elements.js`
- Modify: `src/utils/elements.test.js`

**Step 1: Add tests**

Append to `src/utils/elements.test.js`:

```js
import { buildDefaultElements, updateElement } from "./elements";

describe("updateElement", () => {
  const elements = [
    { id: "el-0", columnIndex: 0, label: "Name", x: 10, y: 20, fontSize: null },
    { id: "el-1", columnIndex: 1, label: "Org",  x: 30, y: 40, fontSize: 60   },
  ];

  it("patches matching element only", () => {
    const next = updateElement(elements, "el-0", { x: 100, y: 200 });
    expect(next[0]).toEqual({ ...elements[0], x: 100, y: 200 });
    expect(next[1]).toBe(elements[1]); // referential equality on untouched
  });

  it("returns a new array", () => {
    const next = updateElement(elements, "el-0", { x: 100 });
    expect(next).not.toBe(elements);
  });

  it("is a no-op when id is missing", () => {
    const next = updateElement(elements, "el-99", { x: 100 });
    expect(next).toEqual(elements);
  });

  it("can clear fontSize back to null", () => {
    const next = updateElement(elements, "el-1", { fontSize: null });
    expect(next[1].fontSize).toBeNull();
  });
});
```

(Update the import on line 1 of the test file from `import { buildDefaultElements }` to `import { buildDefaultElements, updateElement }`. The `describe("updateElement", ...)` block goes at the bottom of the file.)

**Step 2: Run tests, verify they fail**

Run: `yarn test:run src/utils/elements.test.js`
Expected: FAIL — `updateElement is not a function`.

**Step 3: Implement**

Append to `src/utils/elements.js`:

```js
export function updateElement(elements, id, patch) {
  return elements.map(el => el.id === id ? { ...el, ...patch } : el);
}
```

**Step 4: Run tests, verify they pass**

Run: `yarn test:run src/utils/elements.test.js`
Expected: all `buildDefaultElements` + `updateElement` tests pass.

**Step 5: Commit**

```bash
git add src/utils/elements.js src/utils/elements.test.js
git commit -m "feat: add updateElement helper"
```

---

### Task 7: `parseCertCsv`

**Files:**
- Modify: `src/utils/elements.js`
- Modify: `src/utils/elements.test.js`

**Step 1: Add tests**

Append to `src/utils/elements.test.js`:

```js
import { parseCertCsv } from "./elements";

describe("parseCertCsv", () => {
  it("splits header from data rows", () => {
    const result = parseCertCsv([
      ["Name", "Org"],
      ["Alice", "Acme"],
      ["Bob", "Beta"],
    ]);
    expect(result.headers).toEqual(["Name", "Org"]);
    expect(result.rows).toEqual([["Alice", "Acme"], ["Bob", "Beta"]]);
    expect(result.error).toBeUndefined();
  });

  it("creates one element per header column", () => {
    const result = parseCertCsv([
      ["Name", "Org", "Date"],
      ["Alice", "Acme", "2026-01-01"],
    ]);
    expect(result.elements).toHaveLength(3);
    expect(result.elements.map(e => e.label)).toEqual(["Name", "Org", "Date"]);
  });

  it("returns error when there are no data rows", () => {
    const result = parseCertCsv([["Name", "Org"]]);
    expect(result.error).toBe("CSV has no data rows.");
    expect(result.headers).toBeUndefined();
  });

  it("returns error for empty input", () => {
    const result = parseCertCsv([]);
    expect(result.error).toBe("CSV has no data rows.");
  });

  it("falls back to 'Field N' for blank header cells", () => {
    const result = parseCertCsv([
      ["Name", "", "  ", null],
      ["Alice", "x", "y", "z"],
    ]);
    expect(result.headers).toEqual(["Name", "Field 2", "Field 3", "Field 4"]);
  });

  it("preserves duplicate header labels", () => {
    const result = parseCertCsv([
      ["Date", "Date"],
      ["2026-01-01", "2026-12-31"],
    ]);
    expect(result.headers).toEqual(["Date", "Date"]);
    expect(result.elements.map(e => e.id)).toEqual(["el-0", "el-1"]);
  });
});
```

**Step 2: Run tests, verify they fail**

Run: `yarn test:run src/utils/elements.test.js`
Expected: FAIL — `parseCertCsv is not a function`.

**Step 3: Implement**

Append to `src/utils/elements.js`:

```js
export function parseCertCsv(parsedRows) {
  const [headerRow, ...dataRows] = parsedRows ?? [];
  if (!dataRows || dataRows.length === 0) {
    return { error: "CSV has no data rows." };
  }
  const headers = (headerRow ?? []).map((cell, i) =>
    (cell ?? "").toString().trim() || `Field ${i + 1}`
  );
  return {
    headers,
    rows: dataRows,
    elements: buildDefaultElements(headers),
  };
}
```

**Step 4: Run tests, verify they pass**

Run: `yarn test:run src/utils/elements.test.js`
Expected: all element tests pass.

**Step 5: Commit**

```bash
git add src/utils/elements.js src/utils/elements.test.js
git commit -m "feat: add parseCertCsv helper"
```

---

### Task 8: `migrateLoadedSettings`

**Files:**
- Modify: `src/utils/persistence.js`
- Create: `src/utils/persistence.test.js`

**Step 1: Write tests**

Create `src/utils/persistence.test.js`:

```js
import { migrateLoadedSettings } from "./persistence";

describe("migrateLoadedSettings", () => {
  it("returns null when input is null", () => {
    expect(migrateLoadedSettings(null)).toBeNull();
  });

  it("returns null when input is undefined", () => {
    expect(migrateLoadedSettings(undefined)).toBeNull();
  });

  it("passes through new shape", () => {
    const out = migrateLoadedSettings({
      globalFontSize: 80,
      outputType: "png",
      separate: true,
    });
    expect(out).toEqual({ globalFontSize: 80, outputType: "png", separate: true });
  });

  it("lifts numberInputs.fontSize → globalFontSize for old shape", () => {
    const out = migrateLoadedSettings({
      numberInputs: { fontSize: 90, textX: 1, textY: 2, orgTextX: 3, orgTextY: 4 },
      outputType: "pdf",
      separate: false,
    });
    expect(out.globalFontSize).toBe(90);
    expect(out.outputType).toBe("pdf");
    expect(out.separate).toBe(false);
    expect(out.numberInputs).toBeUndefined();
  });

  it("ignores old position fields entirely", () => {
    const out = migrateLoadedSettings({
      numberInputs: { textX: 1, textY: 2 },
    });
    expect(out.globalFontSize).toBeUndefined();
  });

  it("prefers new globalFontSize over old numberInputs.fontSize", () => {
    const out = migrateLoadedSettings({
      globalFontSize: 100,
      numberInputs: { fontSize: 50 },
    });
    expect(out.globalFontSize).toBe(100);
  });

  it("preserves boolean false for separate", () => {
    const out = migrateLoadedSettings({ separate: false });
    expect(out.separate).toBe(false);
  });
});
```

**Step 2: Run tests, verify they fail**

Run: `yarn test:run src/utils/persistence.test.js`
Expected: FAIL — `migrateLoadedSettings is not a function`.

**Step 3: Add `migrateLoadedSettings` to `persistence.js`**

Append to `src/utils/persistence.js`:

```js
export function migrateLoadedSettings(saved) {
  if (saved == null) return null;
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

**Step 4: Run tests, verify they pass**

Run: `yarn test:run src/utils/persistence.test.js`
Expected: 7 passed.

**Step 5: Commit**

```bash
git add src/utils/persistence.js src/utils/persistence.test.js
git commit -m "feat: add migrateLoadedSettings for old shape compat"
```

---

## Phase 3 — Preview renderer

### Task 9: Update `hitTest` to take `elementIds`

**Files:**
- Modify: `src/utils/preview.js`
- Create: `src/utils/preview.test.js`

**Step 1: Write tests**

Create `src/utils/preview.test.js`:

```js
import { hitTest } from "./preview";

const boxes = (overrides = {}) => ({
  "el-0": { x: 0,   y: 0,   width: 100, height: 50 },
  "el-1": { x: 50,  y: 25,  width: 100, height: 50 }, // overlaps el-0
  "el-2": { x: 200, y: 200, width: 50,  height: 50 },
  scale: 1,
  ...overrides,
});

describe("hitTest", () => {
  it("returns null when boxes is null", () => {
    expect(hitTest(null, 10, 10, ["el-0"])).toBeNull();
  });

  it("returns the id of the only box hit", () => {
    expect(hitTest(boxes(), 210, 210, ["el-0", "el-1", "el-2"])).toBe("el-2");
  });

  it("returns null when point is outside all boxes", () => {
    expect(hitTest(boxes(), 500, 500, ["el-0", "el-1", "el-2"])).toBeNull();
  });

  it("prefers later id in elementIds order on overlap (later draws on top)", () => {
    // (60, 30) is inside both el-0 and el-1. el-1 drew last → wins.
    expect(hitTest(boxes(), 60, 30, ["el-0", "el-1"])).toBe("el-1");
  });

  it("respects elementIds order, not insertion order of boxes", () => {
    // Same boxes, reversed ids → el-0 wins.
    expect(hitTest(boxes(), 60, 30, ["el-1", "el-0"])).toBe("el-0");
  });

  it("ignores ids without a corresponding box", () => {
    expect(hitTest(boxes(), 10, 10, ["missing", "el-0"])).toBe("el-0");
  });
});
```

**Step 2: Run tests, verify they fail**

Run: `yarn test:run src/utils/preview.test.js`
Expected: FAIL — current `hitTest` signature is `(boxes, x, y)` and hardcodes `name`/`org`.

**Step 3: Replace `hitTest` in `preview.js`**

Find:

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

Replace with:

```js
export function hitTest(boxes, canvasX, canvasY, elementIds) {
  if (!boxes || !elementIds) return null;
  for (let i = elementIds.length - 1; i >= 0; i--) {
    const b = boxes[elementIds[i]];
    if (!b) continue;
    if (
      canvasX >= b.x &&
      canvasX <= b.x + b.width &&
      canvasY >= b.y &&
      canvasY <= b.y + b.height
    ) {
      return elementIds[i];
    }
  }
  return null;
}
```

**Step 4: Run tests, verify they pass**

Run: `yarn test:run src/utils/preview.test.js`
Expected: 6 passed.

**Step 5: Commit**

```bash
git add src/utils/preview.js src/utils/preview.test.js
git commit -m "refactor: hitTest accepts elementIds for dynamic elements"
```

---

### Task 10: Rewrite `generatePreview` to consume `elements`

**Files:**
- Modify: `src/utils/preview.js`

This is a manual refactor; verification is by `yarn dev` later in the plan. No new automated tests (rendering on a real canvas is out of unit-test scope per the design doc).

**Step 1: Replace `generatePreview` body**

Replace the whole `generatePreview` function with:

```js
export function generatePreview(
  canvas,
  { bgPhoto, globalFontSize, elements, rowCells, selectedElementId },
  successCb,
  boxesRef
) {
  if (
    !canvas ||
    !bgPhoto ||
    typeof globalFontSize !== "number" ||
    !Array.isArray(elements)
  ) {
    successCb?.(false);
    return;
  }

  const computedStyles = getComputedStyle(canvas);
  const canvasWidth = parseInt(computedStyles.width, 10);
  const canvasHeight = parseInt(computedStyles.height, 10);

  const scale = Math.min(canvasWidth / PAGE_WIDTH, canvasHeight / PAGE_HEIGHT);
  const image = getCachedImage(bgPhoto);

  function draw() {
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    const boxes = { scale };

    for (const el of elements) {
      const fontSize = (el.fontSize ?? globalFontSize) * scale;
      ctx.font = `${fontSize}px Arial`;

      const cell = rowCells?.[el.columnIndex];
      const text = (cell != null && cell !== "") ? cell : el.label;

      const x = el.x * scale;
      const y = el.y * scale;
      ctx.fillText(text, x, y);

      const m = ctx.measureText(text);
      const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.8;
      const descent = m.actualBoundingBoxDescent ?? fontSize * 0.2;
      boxes[el.id] = {
        x: x - m.width / 2,
        y: y - ascent,
        width: m.width,
        height: ascent + descent,
      };
    }

    if (boxesRef) boxesRef.current = boxes;

    if (selectedElementId && boxes[selectedElementId]) {
      const b = boxes[selectedElementId];
      ctx.save();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
      ctx.restore();
    }
  }

  if (image.complete && image.naturalWidth > 0) {
    draw();
  } else {
    image.addEventListener("load", draw, { once: true });
  }

  successCb?.(true);
}
```

**Step 2: Verify build still type-checks (sort of — no TS, so just lint/build)**

Run: `yarn lint`
Expected: no new errors. (The file change won't be referenced from `page.js` until Phase 4, so the build will compile but the page will be broken until then. That's expected and resolved in Phase 4.)

**Step 3: Run all tests**

Run: `yarn test:run`
Expected: all existing tests still pass (we didn't touch anything they cover beyond `hitTest`).

**Step 4: Commit**

```bash
git add src/utils/preview.js
git commit -m "refactor: generatePreview consumes elements array"
```

---

## Phase 4 — Page state and UI

### Task 11: Update `page.js` state shape

**Files:**
- Modify: `src/app/page.js`

**Step 1: Replace state declarations**

In the `Home` component, find:

```js
const [hasPreview, setHasPreview] = useState(null);
const [numberInputs, setNumberInputs] = useState({
  textX: PAGE_WIDTH / 2,
  textY: PAGE_HEIGHT / 2,
  orgTextX: PAGE_WIDTH / 2,
  orgTextY: PAGE_HEIGHT / 2 + DEFAULT_FONT_SIZE,
  fontSize: DEFAULT_FONT_SIZE,
});
const [progress, setProgress] = useState(null);
const [error, setError] = useState(null);
const [csvRows, setCsvRows] = useState(null);
const [csvError, setCsvError] = useState(null);
const [previewRowIndex, setPreviewRowIndex] = useState(0);
const [selectedElement, setSelectedElement] = useState(null);
const [outputType, setOutputType] = useState("pdf");
const [separate, setSeparate] = useState(false);
```

Replace with:

```js
const [hasPreview, setHasPreview] = useState(null);
const [globalFontSize, setGlobalFontSize] = useState(DEFAULT_FONT_SIZE);
const [elements, setElements] = useState([]);
const [csvHeaders, setCsvHeaders] = useState([]);
const [csvRows, setCsvRows] = useState(null); // string[][]
const [progress, setProgress] = useState(null);
const [error, setError] = useState(null);
const [csvError, setCsvError] = useState(null);
const [previewRowIndex, setPreviewRowIndex] = useState(0);
const [selectedElementId, setSelectedElementId] = useState(null);
const [outputType, setOutputType] = useState("pdf");
const [separate, setSeparate] = useState(false);
```

**Step 2: Add `updateElement` import and usage**

At the top of the file, add to the imports:

```js
import { updateElement as updateElementHelper, parseCertCsv } from "@/utils/elements";
```

Inside the component (near other helpers), add:

```js
const updateElement = (id, patch) =>
  setElements(prev => updateElementHelper(prev, id, patch));
```

**Step 3: Update derived values**

Find:
```js
const previewName = csvRows?.[previewRowIndex]?.name;
const previewOrg = csvRows?.[previewRowIndex]?.org;
```

Replace with:
```js
const rowCells = csvRows?.[previewRowIndex];
```

**Step 4: Don't run yet — `page.js` won't compile cleanly until Task 12-14 are done**

Skip running until later tasks finish. Do not commit yet.

---

### Task 12: Wire `onChangeCsv` to `parseCertCsv`

**Files:**
- Modify: `src/app/page.js`

**Step 1: Replace `onChangeCsv` body**

Find the entire `onChangeCsv` function and replace with:

```js
function onChangeCsv(event) {
  const file = event.target.files[0];
  if (!file) {
    setCsvHeaders([]);
    setCsvRows(null);
    setCsvError(null);
    setElements([]);
    setSelectedElementId(null);
    return;
  }

  Papa.parse(file, {
    skipEmptyLines: true,
    complete: (res) => {
      const result = parseCertCsv(res.data);
      if (result.error) {
        setCsvHeaders([]);
        setCsvRows(null);
        setElements([]);
        setSelectedElementId(null);
        setCsvError(result.error);
        return;
      }
      setCsvHeaders(result.headers);
      setCsvRows(result.rows);
      setElements(result.elements);
      setSelectedElementId(null);
      setCsvError(null);
      setPreviewRowIndex(0);
    },
    error: (err) => {
      setCsvRows(null);
      setElements([]);
      setSelectedElementId(null);
      setCsvError(err?.message || "Failed to parse CSV.");
    },
  });
}
```

**Step 2: Update the preview-row dropdown**

Find:

```jsx
{csvRows.map((row, i) => {
  const label = `${row.name}${row.org ? ` — ${row.org}` : ""}`;
  const truncated = label.length > 60 ? label.slice(0, 57) + "…" : label;
  return (
    <option key={i} value={i}>
      {truncated}
    </option>
  );
})}
```

Replace with:

```jsx
{csvRows.map((row, i) => {
  const label = row.filter(Boolean).join(" — ");
  const truncated = label.length > 60 ? label.slice(0, 57) + "…" : label;
  return (
    <option key={i} value={i}>
      {truncated || `Row ${i + 1}`}
    </option>
  );
})}
```

Skip running and committing yet — Task 13 finishes the form changes.

---

### Task 13: Replace hardcoded form fields with the element list

**Files:**
- Modify: `src/app/page.js`

**Step 1: Remove the four hardcoded position blocks**

Delete the JSX blocks for `textX`, `textY`, `orgTextX`, `orgTextY` — i.e. both `<div className="flex justify-between items-center gap-4">` blocks containing those fields.

**Step 2: Remove the existing `Font size` field**

Delete the `<Field label="Font size" labelFor="fontSize">…</Field>` block.

**Step 3: Remove `onChangeNumberInput` and `inputCls`**

Delete these helpers (`onChangeNumberInput` and `inputCls`) from the component — the new element list uses `updateElement` directly.

**Step 4: Add the new element list and global font size field**

Insert this JSX where the deleted fields used to be (just before the canvas container):

```jsx
<Field label="Font size (default)" labelFor="globalFontSize">
  <input
    className="border px-2 py-1 rounded"
    id="globalFontSize"
    name="globalFontSize"
    type="number"
    value={globalFontSize}
    min={1}
    step={1}
    required
    onChange={(e) => setGlobalFontSize(Number(e.target.value))}
  />
</Field>

{elements.length > 0 && (
  <Field label="Elements">
    <div className="flex flex-col gap-2">
      {elements.map((el) => {
        const selected = el.id === selectedElementId;
        const rowCls =
          "flex flex-row items-center gap-3 p-2 rounded border " +
          (selected ? "ring-2 ring-indigo-400" : "");
        return (
          <div key={el.id} className={rowCls}>
            <button
              type="button"
              className="font-semibold text-left flex-1 truncate"
              onClick={() => setSelectedElementId(el.id)}
            >
              {el.label}
            </button>
            <label className="text-sm text-gray-700">
              X
              <input
                className="border px-2 py-1 rounded ml-1 w-24"
                type="number"
                value={el.x}
                min={0}
                step={1}
                onChange={(e) =>
                  updateElement(el.id, { x: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm text-gray-700">
              Y
              <input
                className="border px-2 py-1 rounded ml-1 w-24"
                type="number"
                value={el.y}
                min={0}
                step={1}
                onChange={(e) =>
                  updateElement(el.id, { y: Number(e.target.value) })
                }
              />
            </label>
            <label className="text-sm text-gray-700">
              Font
              <input
                className="border px-2 py-1 rounded ml-1 w-24"
                type="number"
                placeholder={`${globalFontSize} (global)`}
                value={el.fontSize ?? ""}
                min={1}
                step={1}
                onChange={(e) => {
                  const v = e.target.value;
                  updateElement(el.id, {
                    fontSize: v === "" ? null : Number(v),
                  });
                }}
              />
            </label>
            {el.fontSize !== null && (
              <button
                type="button"
                className="text-xs text-gray-500 underline"
                onClick={() => updateElement(el.id, { fontSize: null })}
                aria-label={`Reset font size for ${el.label}`}
                title="Reset to global"
              >
                reset
              </button>
            )}
          </div>
        );
      })}
    </div>
  </Field>
)}
```

Skip running yet — Task 14 finishes the wiring.

---

### Task 14: Update drag handlers + preview effects

**Files:**
- Modify: `src/app/page.js`

**Step 1: Update preview-effect dependencies and arguments**

Find the `useLayoutEffect` that sets up the resize listener:

```js
useLayoutEffect(() => {
  function _generatePreview() {
    const updatePreview = () =>
      generatePreview(
        canvasRef.current,
        { bgPhoto, ...numberInputs, nameText: previewName, orgText: previewOrg, selectedElement },
        setHasPreview,
        boxesRef
      );
    requestAnimationFrame(updatePreview);
  }

  window.addEventListener("resize", _generatePreview);
  return () => window.removeEventListener("resize", _generatePreview);
}, [bgPhoto, numberInputs, previewName, previewOrg, selectedElement]);
```

Replace with:

```js
useLayoutEffect(() => {
  function _generatePreview() {
    const updatePreview = () =>
      generatePreview(
        canvasRef.current,
        { bgPhoto, globalFontSize, elements, rowCells, selectedElementId },
        setHasPreview,
        boxesRef
      );
    requestAnimationFrame(updatePreview);
  }

  window.addEventListener("resize", _generatePreview);
  return () => window.removeEventListener("resize", _generatePreview);
}, [bgPhoto, globalFontSize, elements, rowCells, selectedElementId]);
```

**Step 2: Update the second `useLayoutEffect`**

Find:

```js
useLayoutEffect(() => {
  requestAnimationFrame(() =>
    generatePreview(
      canvasRef.current,
      { bgPhoto, ...numberInputs, nameText: previewName, orgText: previewOrg, selectedElement },
      setHasPreview,
      boxesRef
    )
  );
}, [previewRowIndex, bgPhoto, numberInputs, previewName, previewOrg, selectedElement]);
```

Replace with:

```js
useLayoutEffect(() => {
  requestAnimationFrame(() =>
    generatePreview(
      canvasRef.current,
      { bgPhoto, globalFontSize, elements, rowCells, selectedElementId },
      setHasPreview,
      boxesRef
    )
  );
}, [previewRowIndex, bgPhoto, globalFontSize, elements, rowCells, selectedElementId]);
```

**Step 3: Update `onChangeBgPhoto`**

Find the inner `updatePreview` block in `onChangeBgPhoto` and replace its argument object with the new shape:

```js
generatePreview(
  canvasRef.current,
  { bgPhoto: url, globalFontSize, elements, rowCells, selectedElementId },
  setHasPreview,
  boxesRef
);
```

**Step 4: Replace pointer handlers**

Replace `onPointerDownCanvas`, `onPointerHover`, `onPointerMoveCanvas`, `onPointerUpCanvas`:

```js
function onPointerDownCanvas(event) {
  if (!boxesRef.current) {
    setSelectedElementId(null);
    return;
  }
  const { x, y } = getCanvasPoint(event);
  const ids = elements.map(e => e.id);
  const hit = hitTest(boxesRef.current, x, y, ids);
  setSelectedElementId(hit);
  if (!hit) return;

  const box = boxesRef.current[hit];
  dragRef.current = {
    id: hit,
    offsetX: x - box.x,
    offsetY: y - box.y,
    scale: boxesRef.current.scale,
  };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function onPointerHover(event) {
  if (dragRef.current) return;
  if (!boxesRef.current || !canvasRef.current) return;
  const { x, y } = getCanvasPoint(event);
  const ids = elements.map(e => e.id);
  const hit = hitTest(boxesRef.current, x, y, ids);
  canvasRef.current.style.cursor = hit ? "move" : "default";
}

function onPointerMoveCanvas(event) {
  if (!dragRef.current) {
    onPointerHover(event);
    return;
  }
  const { x, y } = getCanvasPoint(event);
  const { id, offsetX, offsetY, scale } = dragRef.current;
  const box = boxesRef.current[id];

  const newCanvasX = x - offsetX;
  const newCanvasY = y - offsetY;
  const originCanvasX = newCanvasX + box.width / 2;
  const originCanvasY = newCanvasY + box.height * 0.8;

  const pageX = clamp(Math.round(originCanvasX / scale), 0, PAGE_WIDTH);
  const pageY = clamp(Math.round(originCanvasY / scale), 0, PAGE_HEIGHT);

  updateElement(id, { x: pageX, y: pageY });
}

function onPointerUpCanvas(event) {
  dragRef.current = null;
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}
```

**Step 5: Verify build**

Run: `yarn lint`
Expected: no errors.

Run: `yarn build`
Expected: build succeeds.

**Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "feat: wire dynamic elements through page.js state and UI"
```

---

## Phase 5 — Renderers

### Task 15: Update `download.js` dispatcher

**Files:**
- Modify: `src/utils/download.js`

**Step 1: Replace `download` function**

Replace the entire `download` function with:

```js
export async function download(data, onProgress) {
  const { type, separate, rows } = data;

  switch (type) {
    case "pdf": {
      if (separate) {
        const zip = new JSZip();

        for (const [index, row] of rows.entries()) {
          const pdf = await downloadPDF({ ...data, rows: [row] });
          const baseName = (row[0] && String(row[0]).trim()) || `cert-${index + 1}`;
          const fileName = `${baseName}.pdf`;
          zip.file(fileName, pdf);
          onProgress?.(index + 1, rows.length);
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

**Step 2: Update the JSDoc above `download`** (optional but keep it accurate):

```js
/**
 * @param {{
 *   type: "pdf" | "png",
 *   elements: Array<{id: string, columnIndex: number, label: string, x: number, y: number, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 *   separate: boolean,
 * }} data
 */
```

**Step 3: Commit**

```bash
git add src/utils/download.js
git commit -m "refactor: dispatcher accepts rows + elements shape"
```

---

### Task 16: Update `pdf.js`

**Files:**
- Modify: `src/utils/pdf.js`

**Step 1: Replace `constructPDF`**

Replace the body of `constructPDF` with:

```js
const constructPDF = ({ elements, globalFontSize, rows, img }, onProgress) =>
  new Promise(async (resolve, reject) => {
    const pageWidth = pixelsToPoints(PAGE_WIDTH);
    const pageHeight = pixelsToPoints(PAGE_HEIGHT);

    const options = {
      layout: "landscape",
      size: [pageHeight, pageWidth],
      margin: 0,
      autoFirstPage: false,
      info: undefined,
    };

    const doc = new window.PDFDocument(options);
    await loadFont(doc, "Arial", "ttf", "/arial.ttf");
    const stream = doc.pipe(blobStream());

    // Hoisted: per-element max width (depends on font + column data, not the row)
    const elementWidthsPx = elements.map((el) => {
      const fontSizePx = el.fontSize ?? globalFontSize;
      const colValues = rows.map((r) => r[el.columnIndex] ?? "");
      return getLargestWidth(colValues, fontSizePx, "Arial");
    });

    for (const [rowIndex, row] of rows.entries()) {
      doc.addPage();
      doc.image(img, 0, 0, {
        align: "center",
        valign: "center",
        width: pageWidth,
        height: pageHeight,
      });

      for (const [i, el] of elements.entries()) {
        const fontSizePx = el.fontSize ?? globalFontSize;
        const fontSizePt = pixelsToPoints(fontSizePx);
        const widthPx = elementWidthsPx[i];
        const cell = row[el.columnIndex] ?? "";

        doc
          .font("Arial")
          .fontSize(fontSizePt)
          .strokeColor("#000")
          .fillColor("#000")
          .text(
            cell,
            pixelsToPoints(el.x - widthPx / 2),
            pixelsToPoints(el.y - fontSizePx),
            {
              align: "center",
              width: pixelsToPoints(widthPx),
            }
          );
      }

      onProgress?.(rowIndex + 1, rows.length);
    }

    doc.end();
    stream.on("finish", () => resolve(stream.toBlob("application/pdf")));
    stream.on("error", reject);
  });
```

**Step 2: Update the JSDoc**

```js
/**
 * @param {{
 *   elements: Array<{id, columnIndex, label, x, y, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 * }} data
 */
```

**Step 3: Commit**

```bash
git add src/utils/pdf.js
git commit -m "refactor: pdf renderer loops elements + rows"
```

---

### Task 17: Update `png.js`

**Files:**
- Modify: `src/utils/png.js`

**Step 1: Replace `addPageToZip` and `constructZip`**

Replace `addPageToZip` body:

```js
const addPageToZip = (
  zip,
  { row, rowIndex, elements, globalFontSize, pageWidth, pageHeight, img: src },
  mime
) =>
  new Promise(async (resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await attachImage(ctx, {
      src,
      width: pageWidth,
      height: pageHeight,
      left: 0,
      top: 0,
    });

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    for (const el of elements) {
      const fontSizePx = el.fontSize ?? globalFontSize;
      ctx.font = `${fontSizePx}px Arial`;
      const cell = row[el.columnIndex] ?? "";
      ctx.fillText(cell, el.x, el.y);
    }

    const img = new Image();
    img.src = canvas.toDataURL(mime, 1.0);
    img.width = canvas.width;
    img.height = canvas.height;

    img.addEventListener("load", function () {
      const baseName = (row[0] && String(row[0]).trim()) || `cert-${rowIndex + 1}`;
      const fileName = `${baseName}.png`;
      const base64 = img.src.split(",")[1];
      zip.file(fileName, base64, { base64: true });
      resolve();
    });

    img.addEventListener("error", reject);
  });
```

Replace `constructZip` body:

```js
const constructZip = async (mime, { elements, globalFontSize, rows, img }, onProgress) => {
  const pageWidth = PAGE_WIDTH;
  const pageHeight = PAGE_HEIGHT;
  const zip = new JSZip();

  for (const [rowIndex, row] of rows.entries()) {
    await addPageToZip(
      zip,
      { row, rowIndex, elements, globalFontSize, pageWidth, pageHeight, img },
      mime
    );
    onProgress?.(rowIndex + 1, rows.length);
  }

  return zip.generateAsync({ type: "blob" });
};
```

**Step 2: Update the JSDoc on `downloadAsPhoto`**

```js
/**
 * @param {{
 *   elements: Array<{id, columnIndex, label, x, y, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 * }} data
 */
```

**Step 3: Commit**

```bash
git add src/utils/png.js
git commit -m "refactor: png renderer loops elements + rows"
```

---

### Task 18: Wire `onSubmit` to new data shape

**Files:**
- Modify: `src/app/page.js`

**Step 1: Replace `onSubmit`**

```js
async function onSubmit(event) {
  event.preventDefault();
  const formData = new FormData(event.target);
  const entries = Object.fromEntries(formData.entries());

  const img = await readAsDataURL(entries.bgPhoto);

  if (!csvRows || csvRows.length === 0) {
    setError("Please upload a CSV first.");
    return;
  }

  const data = {
    type: outputType,
    separate,
    rows: csvRows,
    elements,
    globalFontSize,
    img,
  };

  try {
    setError(null);
    setProgress({ current: 0, total: csvRows.length });
    await download(data, (current, total) => setProgress({ current, total }));
  } catch (err) {
    setError(err?.message || "Failed to generate certificates.");
  } finally {
    setProgress(null);
  }
}
```

**Step 2: Run lint and build**

Run: `yarn lint && yarn build`
Expected: both succeed.

**Step 3: Commit**

```bash
git add src/app/page.js
git commit -m "feat: pass elements + rows to download dispatcher"
```

---

## Phase 6 — Persistence wiring

### Task 19: Update load/save to new shape

**Files:**
- Modify: `src/app/page.js`

**Step 1: Add `migrateLoadedSettings` import**

Update the persistence import:

```js
import { loadSettings, saveSettings, migrateLoadedSettings } from "@/utils/persistence";
```

**Step 2: Replace the load `useEffect`**

Find:

```js
useEffect(() => {
  const saved = loadSettings();
  if (!saved) return;
  if (saved.numberInputs) {
    setNumberInputs((prev) => ({ ...prev, ...saved.numberInputs }));
  }
  if (saved.outputType) setOutputType(saved.outputType);
  if (typeof saved.separate === "boolean") setSeparate(saved.separate);
}, []);
```

Replace with:

```js
useEffect(() => {
  const saved = migrateLoadedSettings(loadSettings());
  if (!saved) return;
  if (typeof saved.globalFontSize === "number") setGlobalFontSize(saved.globalFontSize);
  if (saved.outputType) setOutputType(saved.outputType);
  if (typeof saved.separate === "boolean") setSeparate(saved.separate);
}, []);
```

**Step 3: Replace the save `useEffect`**

Find:

```js
useEffect(() => {
  const id = setTimeout(() => {
    saveSettings({ numberInputs, outputType, separate });
  }, 250);
  return () => clearTimeout(id);
}, [numberInputs, outputType, separate]);
```

Replace with:

```js
useEffect(() => {
  const id = setTimeout(() => {
    saveSettings({ globalFontSize, outputType, separate });
  }, 250);
  return () => clearTimeout(id);
}, [globalFontSize, outputType, separate]);
```

**Step 4: Run lint, build, tests**

```bash
yarn lint
yarn build
yarn test:run
```

All three should succeed. The Jest test suite should report all helper tests passing.

**Step 5: Commit**

```bash
git add src/app/page.js
git commit -m "feat: persist globalFontSize and migrate old settings shape"
```

---

## Phase 7 — Manual verification

### Task 20: End-to-end smoke test

**Files:** none.

**Step 1: Start the dev server**

Run: `yarn dev`
Expected: server boots at http://localhost:3000.

**Step 2: Test each path**

Open http://localhost:3000 in a browser. Walk through these scenarios and confirm each works:

1. **Initial state** — no CSV, no bg photo. Canvas shows the "Preview" placeholder. Element list is hidden. Global font-size input is visible.
2. **Upload `public/sample_names.csv`** — CSV has 2 columns (Name, Organization). Two element rows appear ("Name" and "Organization") stacked vertically at canvas center. Preview shows the two cells centered.
3. **Upload a 3-column CSV** — Create one inline (e.g. via a file `/tmp/three-col.csv`):
   ```
   Name,Organization,Date
   Alice,Acme,2026-01-01
   Bob,Beta,2026-02-01
   ```
   Three element rows appear, three text labels render in the preview, stacked at center. Switching the "Preview row" dropdown swaps the displayed cells.
4. **Drag** — Click and drag any element on the canvas. Its X/Y inputs update live. Cursor turns to "move" while hovering an element.
5. **Selection ring** — Clicking an element highlights its row in the form list (indigo ring) and draws a dashed outline on the canvas. Clicking empty canvas clears the selection.
6. **Override font size** — Type a number in one element's "Font" input. Preview updates with that size. Click "reset" — input clears and preview returns to global size.
7. **Change global font size** — Update the "Font size (default)" input. All elements without an override resize. Elements with an override stay put.
8. **Upload a CSV with blank headers** (e.g. `,,Date\nA,B,2026-01-01`) — labels show as `Field 1`, `Field 2`, `Date`.
9. **Upload a CSV with no data rows** — error shows: "CSV has no data rows."; element list disappears.
10. **PDF download** — Pick PDF, "Download as separate files?" off. Click Generate. Confirm `certificates.pdf` downloads with one page per row, each row rendering all element columns at their positions.
11. **PDF separate download** — Same with separate on. Confirm `certificates.zip` containing one PDF per row, filenames using column 0 (e.g. `Alice.pdf`). For a row with empty column 0, expect `cert-N.pdf`.
12. **PNG download** — Pick PNG. Confirm `certificates.zip` of PNGs, same naming rules.
13. **Reload page after positioning** — Refresh. Global font size, output type, and separate flag persist. Positions reset (CSV must be re-uploaded; this is by design per Q4).

**Step 3: Run all tests one more time**

Run: `yarn test:run`
Expected: all suites pass.

**Step 4: Done — no commit needed (no files changed)**

If any of the manual checks reveal a bug, file a follow-up task and fix before merge.

---

## Cleanup checklist

Before considering this complete:

- [ ] `yarn lint` passes
- [ ] `yarn build` passes
- [ ] `yarn test:run` reports all tests passing
- [ ] Manual smoke test (Task 20) passes every scenario
- [ ] `CLAUDE.md` reflects the new test commands
- [ ] No stray references to `numberInputs`, `textX`, `orgTextX`, `selectedElement` (the old name) remain in the codebase

Quick verification:

```bash
yarn lint
yarn build
yarn test:run
# Then check for stale references:
```

Run a Grep search for `numberInputs`, `orgTextX`, `previewName`, `previewOrg` and confirm zero results.
