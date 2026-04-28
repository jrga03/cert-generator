# shadcn/ui Migration — Design

## Context

The cert-generator UI is a single-page Next.js 13 (App Router) client tool with a form-heavy layout: file inputs, radios, a checkbox, several number inputs, a select, and a submit button, plus a custom `Toast` and `ProgressOverlay`. Styling is Tailwind 3 with raw HTML elements and an indigo accent. Recent work introduced a dynamic `elements` list (each with `id`, `label`, `x`, `y`, optional `fontSize`) seeded from CSV headers, plus a separate `globalFontSize`.

The goal is to upgrade the visual quality and consistency of the form by adopting shadcn/ui (Tailwind + Radix primitives copied into the repo) and restructuring the page into grouped Card sections with a sticky preview on wide screens. shadcn was chosen over Mantine because the project is already on Tailwind and the surface area is small — copying a handful of components keeps the dependency footprint small and avoids an overlapping styling system.

## Scope

- Swap form controls to shadcn equivalents.
- Restructure the page into Card sections with a sticky preview beside the form on `lg+`.
- Replace custom `Toast` with Sonner.
- Replace custom `ProgressOverlay` with shadcn `Dialog` + `Progress`.
- Theme: shadcn defaults with the **blue** accent palette.

## Out of scope (YAGNI)

- Dark mode toggle.
- Form library (react-hook-form / zod). The form is small and the existing `FormData`-based submit works.
- Animations beyond shadcn defaults.
- Any changes to `src/utils/*` (PDF/PNG/preview renderers, persistence, elements helper, CSV parser).
- Replacing the PDFKit CDN script approach.

## Setup & dependencies

- `npx shadcn@latest init` with: JavaScript, Tailwind v3, base color **slate**, accent color **blue**, CSS variables: yes.
- Initialization creates: `components.json`, `src/lib/utils.js` (the `cn()` helper), shadcn CSS variables in `src/app/globals.css`, and theme extensions in `tailwind.config.js`.
- Add components: `npx shadcn@latest add button input label switch select tabs card progress dialog sonner`. Notably **not** `radio-group` (Tabs replaces it) or `checkbox` (Switch replaces it).
- New shadcn component files are written as `.jsx` to match the existing `src/components/*.jsx` convention.
- Mount `<Toaster />` (Sonner) once in `src/app/layout.js`.
- New runtime deps shadcn pulls in: `@radix-ui/*` primitives (per component used), `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `sonner`. Estimated added bundle: ~50–80 KB gzipped.
- The Jest test suite (`src/utils/elements.test.js`, `persistence.test.js`, `preview.test.js`) is unaffected — this migration only touches `src/app/page.js`, `src/app/layout.js`, `src/app/globals.css`, `src/components/*`, `src/components/ui/*`, `tailwind.config.js`, and the package manifest. Run `yarn test:run` after the migration to confirm.

## Layout

```
<main class="container mx-auto p-6 lg:p-10">
  <header>  Title  </header>

  <div class="grid lg:grid-cols-[minmax(0,480px)_1fr] gap-8">
    <form class="space-y-6">
      <Card>  Output                    (Tabs PDF/PNG, Switch separate) </Card>
      <Card>  Data
                CSV file (+ Download Sample link, csvError text)
                Background photo (file + thumbnail)
                Preview row Select         (shown when csvRows.length > 0)
      </Card>
      <Card>  Typography
                Global font size
                Elements list              (shown when elements.length > 0)
      </Card>
      <Button> Generate </Button>
    </form>

    <aside class="lg:sticky lg:top-6 self-start">
      <Card>  Canvas preview (aspect-ratio 1.7)  </Card>
      <p class="text-xs text-muted-foreground">Drag the text on the canvas to reposition. Click to select.</p>
    </aside>
  </div>
</main>
```

- On screens below `lg`, the grid collapses and the preview falls below the form.
- Form column max width is ~480px on `lg+`, which constrained the element-row layout choice below.

## Element-row layout

Each element renders as a small bordered row inside the Typography card. The selected element gets `ring-2 ring-ring` (shadcn token) — same selection signal pattern as today.

```
┌────────────────────────────────────────────────┐
│ ▸ Name                                  [reset]│  ← clickable label, full width
├──────────────┬───────────────┬─────────────────┤
│ X            │ Y             │ Font (optional) │
│ [  1275  ]   │ [   750  ]    │ [ 80          ] │
└──────────────┴───────────────┴─────────────────┘
```

- Label-as-button on its own row (selects the element and shows the full label without truncation).
- 3-col grid below with `<Label>` + `<Input type="number">` for X, Y, Font.
- Reset button appears next to the label only when `fontSize !== null`.
- Each element row is otherwise compact and fits cleanly inside the form column at the narrow `lg+` width.

## Per-control mapping

| Today | New |
|---|---|
| Two `<input type=radio>` (PDF/PNG) | `<Tabs value={outputType} onValueChange={setOutputType}>` with two `TabsTrigger`. Hidden `<input type=hidden name="type" value={outputType}>` so existing FormData submit continues to work. |
| `<input type=checkbox>` separate | `<Switch checked={separate} onCheckedChange={setSeparate}>` + `<Label>`. Disabled when `outputType === "png"` (consistent with the existing "(for PDF only)" helper text). |
| CSV file input + bg-photo file input | Keep native `<input type=file>` (shadcn has no file input); style to match shadcn `Input` tokens via `cn()`. |
| `<select>` preview row | shadcn `<Select>` |
| Global font size `<input type=number>` | shadcn `<Input type="number">` |
| Per-element X/Y/Font `<input type=number>` | shadcn `<Input type="number">` |
| Click-to-select element label `<button>` | shadcn `<Button variant="ghost" size="sm">` with `data-state` styling for selected |
| Reset button | shadcn `<Button variant="link" size="sm">` |
| `<button type=submit>` Generate | shadcn `<Button type="submit" size="lg">` |
| Custom `<Toast>` | `toast.error(message)` from Sonner; delete `src/components/toast.jsx` |
| Custom `<ProgressOverlay>` | shadcn `<Dialog open={isGenerating}>` (non-dismissable: empty `onOpenChange`, no overlay click-out) wrapping `<Progress value={(current/total)*100} />` and `Generating {current}/{total}…`; delete `src/components/progress-overlay.jsx` |
| `<label>` everywhere | shadcn `<Label htmlFor=...>` |
| `Field` wrapper component (page.js lines 18–28) | Delete; use shadcn `<Label>` + spacing utilities directly |

## Behavior preserved exactly

- Drag-on-canvas still calls `updateElement(id, {x, y})`. Element-row inputs reflect the new values.
- Click on an element label sets `selectedElementId`, which is also what the canvas hit-test sets — selection ring shows on the matching element row.
- localStorage persistence (`loadSettings` / `saveSettings` / `migrateLoadedSettings`) untouched.
- `papaparse` + `parseCertCsv` + PDFKit CDN script + PDF/PNG/preview renderers untouched.
- Form submit reads `FormData`. Hidden inputs are added for any controlled-only widgets (Tabs always; Switch only if Radix's checkbox state doesn't auto-submit `name=separate`).

## Files touched

- **New**: `components.json`, `src/lib/utils.js`, `src/components/ui/{button,input,label,switch,select,tabs,card,progress,dialog,sonner}.jsx`.
- **Modified**: `src/app/page.js` (large diff), `src/app/globals.css` (shadcn CSS vars), `src/app/layout.js` (mount `<Toaster />`), `tailwind.config.js` (shadcn theme extensions), `package.json` / `yarn.lock`.
- **Deleted**: `src/components/toast.jsx`, `src/components/progress-overlay.jsx`, `src/app/page.css` (the single `.canvas-container { aspect-ratio: 1.7 }` rule moves to the `aspect-[1.7]` Tailwind utility on the canvas wrapper).

## Verification

- `yarn lint` clean.
- `yarn test:run` clean (unchanged util tests still pass).
- `yarn dev` — manual smoke test:
  - Tabs switch PDF/PNG and a hidden `type` field is submitted with the right value.
  - Switch toggles `separate`; disabled when PNG is selected.
  - CSV upload populates the elements list; preview-row Select reflects rows.
  - Background photo upload renders thumbnail and live preview.
  - Drag a text element on the canvas; the corresponding element row's X/Y inputs update live.
  - Click an element row's label; selection ring appears on the row and the matching text on the canvas.
  - Per-element font size override + reset button works.
  - Generate produces the same PDF/PNG output as before (use a saved sample CSV + bg image).
  - Error path: trigger a failure (e.g., bad CSV) — Sonner toast appears.
  - Generation in progress: Dialog overlay shows progress and is non-dismissable; closes on completion.
  - localStorage persistence: refresh the page; output type, separate, and global font size restore.
