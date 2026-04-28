# Cert-Generator UX Improvements — Design

**Date:** 2026-04-28
**Scope:** Four UX/feature improvements to the existing single-page cert-generator app. No tech-debt cleanup or new output formats in this round.

## Goals

1. Replace clunky X/Y typing with **drag-to-position** on the preview.
2. Drive the preview from the **actual uploaded CSV** instead of hardcoded sample text.
3. **Persist positioning settings** so a refresh doesn't lose work.
4. Show **progress and errors** during generation instead of a frozen UI and silent `console.log`s.

Out of scope: font/color picker, multi-column CSV schema, dependency upgrades, page-size correctness, tests.

## Architecture

The app stays a single client component (`src/app/page.js`) with three utility modules (`preview.js`, `pdf.js`, `png.js`, `download.js`). No new dependencies. Changes:

- **One new piece of state:** `selectedElement: "name" | "org" | null`. Drives drag selection and input highlighting.
- **CSV parsed on upload, not on submit.** Parsed rows live in state; submit reuses them. Enables CSV-driven preview and the row-picker dropdown.
- **`preview.js` becomes interactive.** It already renders to canvas; it gains hit-testing, pointer event handlers, and accepts dynamic name/org strings rather than literals.
- **`loader.jsx` (currently empty) becomes `<ProgressOverlay />`.** A determinate progress overlay shown during generation.
- **Generators accept an optional `onProgress(current, total)` callback** and `throw` on error rather than swallowing.
- **localStorage hook** auto-saves position/font/output-type settings under one versioned key.

## Feature 1 — Drag-to-position

**Interaction:**

- Click a text element on the preview → it becomes selected (thin dashed bounding box).
- Click outside any element → deselect.
- Drag a selected element → live X/Y update; corresponding number inputs stay in sync.
- Number inputs continue to work; the selected element's input pair is visually highlighted.

**Implementation:**

- Hit-testing: cache each rendered text's canvas-space bounding box on every render. On `pointerdown`, walk back-to-front; first hit wins.
- Drag math: capture pointer offset on `pointerdown`; on `pointermove`, divide by the existing `scale` to get page coordinates; clamp to `[0, PAGE_WIDTH]` / `[0, PAGE_HEIGHT]`.
- Pointer Events (works on touch).
- Cursor: `move` over text, `default` elsewhere.

## Feature 2 — CSV-driven preview

**Behavior:**

- On CSV upload, parse immediately into `[{name, org}, ...]` and store in state.
- A **"Preview row"** dropdown appears below the CSV input once parsing succeeds. Default is row 0; options show `"{name} — {org}"` (truncated).
- Submit reuses the parsed rows.
- No CSV → preview falls back to current hardcoded sample.

**Implementation:**

- Move the existing `Papa.parse` call from `onSubmit` to the CSV input's `onChange`.
- `generatePreview` signature gains `nameText` / `orgText` params instead of literal strings on lines 47–50.
- Parse errors surface inline next to the CSV input.

## Feature 3 — localStorage persistence

**Saved:** the five number inputs (`textX`, `textY`, `orgTextX`, `orgTextY`, `fontSize`), output type (`pdf` / `png`), and the `separate` checkbox. Nothing else.

**Mechanics:**

- One key: `cert-generator:settings`. Single JSON blob with `version: 1`.
- Hydrate from localStorage in a `useEffect` after mount (avoids SSR hydrate mismatch). Brief flicker of defaults is acceptable.
- Write on change, debounced 250ms so dragging doesn't thrash storage.
- Wrong/missing version → silently fall back to defaults. No migration code in v1.
- No reset button in v1.

## Feature 4 — Generation progress + errors

**UI:**

- `loader.jsx` becomes `<ProgressOverlay />`: heading "Generating certificates…", determinate progress bar, "{current} of {total}" text.
- "Generate" button disabled with text "Generating…" while running.
- Success: overlay closes, download fires.
- Error: overlay closes, error toast appears (auto-dismiss ~6s, manual close button).

**Wiring:**

- `download(data, onProgress)` passes the callback through to `downloadPDF` / `downloadAsPhoto`.
- `pdf.js` and `png.js` call `onProgress(index + 1, total)` after each loop iteration.
- For the "separate PDFs" path, progress fires per file in `download.js`.
- Replace `console.log(error)` with `throw`; submit handler in `page.js` wraps in `try/catch`.

**Toast:**

- Lightweight inline component driven by `{ message, type } | null` state. No new dependency.

## Risks & open questions

- **Drag precision on small previews.** With the canvas scaled down, a 1-pixel pointer move maps to several page pixels. Power users keep the number inputs as a fallback — fine.
- **localStorage flicker.** The hydrate-after-mount approach means the user sees defaults for one frame before saved values load. Acceptable for a settings-only app; not worth SSR cookie storage gymnastics.
- **Throwing from generators changes existing behavior.** Today a font-load failure silently produces no download. After this change it will produce a visible error toast — that's the intended improvement, not a regression.

## Sequencing

The four features are mostly independent and can ship as separate PRs:

1. Generation progress + errors — smallest diff, immediate UX win, no preview changes.
2. CSV-driven preview — parsing-on-upload sets up the state shape needed by drag.
3. Drag-to-position — depends on `selectedElement` state and CSV-driven preview.
4. localStorage persistence — last; saves whatever final state shape lands.
