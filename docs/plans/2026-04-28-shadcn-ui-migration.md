# shadcn/ui Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate the cert-generator UI from raw HTML + Tailwind to shadcn/ui components with a restructured Card-based layout and a sticky preview on wide screens, while preserving all existing behavior (drag, persistence, CSV parsing, PDF/PNG/preview rendering, jest tests).

**Architecture:** shadcn/ui copies React component source (built on Radix primitives + Tailwind) into `src/components/ui/`. We re-theme the page via shadcn CSS variables (slate base, blue accent), wrap form sections in `Card`, replace radios with `Tabs`, the checkbox with `Switch`, native `<select>` with `Select`, all numeric/text inputs with `Input`, the custom `Toast` with Sonner's `toast`, and the custom `ProgressOverlay` with `Dialog` + `Progress`. Layout switches to a 2-column grid on `lg+` with the form on the left and a sticky preview aside on the right.

**Tech Stack:** Next.js 13 (App Router, JS), Tailwind 3, React 18, shadcn/ui, Radix UI, Sonner, lucide-react, Jest (existing util tests must continue to pass).

**Companion design doc:** `docs/plans/2026-04-28-shadcn-ui-migration-design.md`

---

## Pre-flight notes (read before starting)

- The existing `onSubmit` (page.js lines 218–248) reads `outputType`, `separate`, `csvRows`, `elements`, `globalFontSize` from **React state** and only `entries.bgPhoto` from `FormData`. So:
  - Tabs (controlled) needs **no** hidden input.
  - Switch (controlled) needs **no** hidden input.
  - Only the background-photo file input must remain a plain `<input type=file name="bgPhoto">` inside the `<form>`.
- Jest util tests (`src/utils/elements.test.js`, `persistence.test.js`, `preview.test.js`) must keep passing throughout. Run `yarn test:run` after every meaningful change.
- After every UI change, run `yarn dev` and visually verify in the browser. The frontend cannot be auto-tested.
- Do **not** touch `src/utils/*.js` — renderers, persistence, elements helper, CSV parser are out of scope.
- Commit after every task. Use `feat:` for net-new behavior, `refactor:` for like-for-like swaps, `chore:` for tooling, `style:` for pure visual.

---

## Task 1: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `src/lib/utils.js`
- Modify: `src/app/globals.css`, `tailwind.config.js`, `package.json`, `yarn.lock`

**Step 1: Run the shadcn init wizard**

Run: `npx shadcn@latest init`

Answer prompts as follows (the CLI may have minor wording variations across versions — prefer these answers):
- "Which style would you like to use?" → **Default**
- "Which color would you like to use as the base color?" → **Slate**
- "Would you like to use CSS variables for theming?" → **yes**
- TypeScript? → **No** (this project is JS)
- Tailwind CSS file → `src/app/globals.css`
- tailwind.config location → `tailwind.config.js`
- Components alias → `@/components`
- Utils alias → `@/lib/utils`
- React Server Components → **No** (page is `"use client"`)

**Step 2: Verify the init created/changed files correctly**

Expected new files:
- `components.json` (root)
- `src/lib/utils.js` exporting `cn()`

Expected modifications:
- `src/app/globals.css` — should now have `@layer base` block with shadcn HSL CSS variables for `:root` and `.dark`, plus `@layer base { * { @apply border-border; } body { @apply bg-background text-foreground; } }`
- `tailwind.config.js` — should now reference `darkMode`, the shadcn `theme.extend.colors` map (background, foreground, primary, secondary, muted, accent, destructive, border, input, ring, etc.), `borderRadius`, and require `tailwindcss-animate`
- `package.json` — new deps: `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `tailwindcss-animate`

**Step 3: Switch base color to blue accent**

The shadcn CSS variables for blue need to live in `globals.css`. Edit `src/app/globals.css` and replace the `--primary`, `--primary-foreground`, `--ring` HSL values inside the `:root` block with the blue palette values from https://ui.shadcn.com/themes (the "Blue" preset). Easiest path: re-run `npx shadcn@latest init` and pick **Blue** as the base color, accepting overwrite of `globals.css`. If the CLI doesn't expose Blue as a base, manually paste the `:root` block from the Blue theme JSON into `globals.css` at the top of the existing `@layer base` block.

After editing, the `:root` block should include (HSL values):
```css
--primary: 221.2 83.2% 53.3%;
--primary-foreground: 210 40% 98%;
--ring: 221.2 83.2% 53.3%;
```

**Step 4: Remove the legacy gradient body styling left over from create-next-app**

Edit `src/app/globals.css`:
- Delete the old `--foreground-rgb`, `--background-start-rgb`, `--background-end-rgb` variables.
- Delete the old commented `@media (prefers-color-scheme: dark)` block.
- Delete the old `body { color: ...; background: linear-gradient(...) }` rule (the new shadcn `body { @apply bg-background text-foreground }` replaces it).

**Step 5: Sanity-check**

Run: `yarn lint`
Expected: clean (or any pre-existing warnings, no new ones).

Run: `yarn test:run`
Expected: all existing util tests pass.

Run: `yarn dev` and open http://localhost:3000
Expected: page still renders. Background changes from the old blue-grey gradient to the shadcn neutral background. Existing form still works.

**Step 6: Commit**

```bash
git add components.json src/lib/utils.js src/app/globals.css tailwind.config.js package.json yarn.lock
git commit -m "chore: initialize shadcn/ui with blue accent"
```

---

## Task 2: Add shadcn components

**Files:**
- Create: `src/components/ui/{button,input,label,switch,select,tabs,card,progress,dialog,sonner}.jsx`

**Step 1: Add components in one batch**

Run: `npx shadcn@latest add button input label switch select tabs card progress dialog sonner`

The CLI will prompt for overwrites (none should exist yet). Accept defaults. shadcn writes files as `.tsx` by default in TypeScript projects, but since we initialized with JS in Task 1, files should land as `.jsx` in `src/components/ui/`.

**Step 2: Verify the files exist as `.jsx`**

Run: `ls src/components/ui/`
Expected output:
```
button.jsx  card.jsx  dialog.jsx  input.jsx  label.jsx  progress.jsx  select.jsx  sonner.jsx  switch.jsx  tabs.jsx
```

If any landed as `.tsx`, rename to `.jsx` and verify they have no TS-only syntax — shadcn JS variants don't. If the CLI generated TypeScript despite Task 1, re-run init and confirm "No" for TypeScript.

**Step 3: Verify package.json picked up Radix deps**

Run: `cat package.json | grep "@radix-ui"`
Expected: entries for at least `@radix-ui/react-dialog`, `react-label`, `react-progress`, `react-select`, `react-slot`, `react-switch`, `react-tabs`. Also `sonner` and `lucide-react`.

**Step 4: Sanity-check**

Run: `yarn build`
Expected: build succeeds. (We aren't using the new components yet, but they shouldn't break the build.)

**Step 5: Commit**

```bash
git add src/components/ui package.json yarn.lock
git commit -m "chore: add shadcn ui components"
```

---

## Task 3: Mount the Sonner Toaster

**Files:**
- Modify: `src/app/layout.js`

**Step 1: Edit `src/app/layout.js`**

Add the Toaster import and render it inside `<body>` after `{children}`:

```jsx
import "./globals.css";
import { Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Certificate Generator",
  description: "Generate certificates from a CSV and a background image.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
```

**Step 2: Verify it renders**

Run: `yarn dev`
Open http://localhost:3000. Expected: page renders unchanged. Open devtools and verify the document body contains a `[data-sonner-toaster]` element.

**Step 3: Commit**

```bash
git add src/app/layout.js
git commit -m "chore: mount sonner toaster in root layout"
```

---

## Task 4: Replace custom Toast with Sonner

**Files:**
- Modify: `src/app/page.js`
- Delete: `src/components/toast.jsx`

**Step 1: Edit `src/app/page.js` — swap Toast for sonner**

Remove these lines:
```jsx
import { Toast } from "@/components/toast";
```

Add this import (group with other library imports):
```jsx
import { toast } from "sonner";
```

Remove the `error` state and the `<Toast .../>` render. Replace the existing `setError(msg)` calls with `toast.error(msg)`:

In `onSubmit`:
- Replace `setError("Please upload a CSV first.");` with `toast.error("Please upload a CSV first.");`
- Replace `setError(null);` (the optimistic clear) with nothing — Sonner manages its own lifecycle.
- Replace `setError(err?.message || "Failed to generate certificates.");` with `toast.error(err?.message || "Failed to generate certificates.");`

Remove the `<Toast message={error} onClose={() => setError(null)} />` element from the return.

Remove `const [error, setError] = useState(null);`.

**Step 2: Delete the legacy file**

```bash
rm src/components/toast.jsx
```

**Step 3: Smoke test**

Run: `yarn dev`. In the browser:
- Click Generate without uploading a CSV. Expected: red Sonner toast appears at top-center with "Please upload a CSV first." Auto-dismisses after a few seconds.
- Trigger a generation failure (e.g., upload a malformed bg image, or temporarily break the renderer with a `throw new Error("test")` in `download.js` and revert). Expected: error toast appears.

**Step 4: Verify util tests still pass**

Run: `yarn test:run`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/app/page.js src/components/toast.jsx
git commit -m "refactor: replace custom Toast with sonner"
```

---

## Task 5: Replace ProgressOverlay with Dialog + Progress

**Files:**
- Modify: `src/app/page.js`
- Delete: `src/components/progress-overlay.jsx`

**Step 1: Edit `src/app/page.js` — swap ProgressOverlay for Dialog + Progress**

Remove:
```jsx
import { ProgressOverlay } from "@/components/progress-overlay";
```

Add:
```jsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
```

Replace the `{progress && <ProgressOverlay .../>}` line with:

```jsx
<Dialog open={isGenerating} onOpenChange={() => {}}>
  <DialogContent
    className="sm:max-w-md"
    onInteractOutside={(e) => e.preventDefault()}
    onEscapeKeyDown={(e) => e.preventDefault()}
    hideClose
  >
    <DialogHeader>
      <DialogTitle>Generating certificates…</DialogTitle>
    </DialogHeader>
    <Progress
      value={progress && progress.total > 0 ? (progress.current / progress.total) * 100 : 0}
    />
    <p className="text-sm text-muted-foreground text-center">
      {progress?.current ?? 0} of {progress?.total ?? 0}
    </p>
  </DialogContent>
</Dialog>
```

**Step 2: Make Dialog hide the close button**

shadcn's generated `dialog.jsx` always renders a close `X` button inside `DialogContent`. We need to hide it during generation. Edit `src/components/ui/dialog.jsx`:

Find the `DialogContent` definition. It includes a hardcoded `<DialogPrimitive.Close>` block with the X icon. Wrap that block in `{!hideClose && (...)}` and accept a `hideClose` prop on `DialogContent`. The signature change looks like:

```jsx
const DialogContent = React.forwardRef(({ className, children, hideClose = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content ref={ref} className={cn(...)} {...props}>
      {children}
      {!hideClose && (
        <DialogPrimitive.Close className="...">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </DialogPortal>
));
```

(Keep all other generated code intact; just add the `hideClose` prop and wrap the existing Close block.)

**Step 3: Delete the legacy file**

```bash
rm src/components/progress-overlay.jsx
```

**Step 4: Smoke test**

Run: `yarn dev`. In the browser:
- Upload a CSV with 5+ rows and a bg image. Click Generate.
- Expected: Dialog opens with the title, a filling Progress bar, "X of N" text. No close X. Pressing Escape or clicking outside does **not** dismiss it.
- Expected: when generation completes, the Dialog closes and the file download triggers.

**Step 5: Verify util tests still pass**

Run: `yarn test:run`
Expected: PASS.

**Step 6: Commit**

```bash
git add src/app/page.js src/components/ui/dialog.jsx src/components/progress-overlay.jsx
git commit -m "refactor: replace ProgressOverlay with shadcn Dialog and Progress"
```

---

## Task 6: Restructure page layout (Card + sticky preview grid)

**Files:**
- Modify: `src/app/page.js`
- Delete: `src/app/page.css`

This task only restructures the wrapper markup — control swaps happen in Tasks 7–10. Keep the existing form controls in place inside the new Card sections for now.

**Step 1: Add Card import**

In `src/app/page.js`:
```jsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
```

Remove `import "./page.css";`.

**Step 2: Replace the `<main>` body with the new layout**

Replace the existing `<main>...</main>` block with:

```jsx
<main className="container mx-auto p-6 lg:p-10">
  <header className="mb-8">
    <h1 className="text-2xl font-semibold tracking-tight">Certificate Generator</h1>
    <p className="text-sm text-muted-foreground">
      Upload a CSV and a background image, position your text, then export PDF or PNG.
    </p>
  </header>

  <div className="grid gap-8 lg:grid-cols-[minmax(0,480px)_1fr]">
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Output</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* paste existing PDF/PNG radios + separate checkbox here unchanged for now */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* paste CSV file Field, bg photo Field, preview row Field here unchanged */}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {/* paste Global font size Field + Elements Field here unchanged */}
        </CardContent>
      </Card>

      {/* paste existing submit button here */}
    </form>

    <aside className="lg:sticky lg:top-6 self-start space-y-2">
      <Card>
        <CardContent className="p-4">
          <div className="aspect-[1.7] w-full bg-muted relative">
            <canvas
              className="w-full h-full touch-none"
              ref={canvasRef}
              onPointerDown={onPointerDownCanvas}
              onPointerMove={onPointerMoveCanvas}
              onPointerUp={onPointerUpCanvas}
              onPointerCancel={onPointerUpCanvas}
            />
            {!hasPreview && (
              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground italic uppercase text-sm">
                Preview
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Drag the text on the canvas to reposition. Click to select.
      </p>
    </aside>
  </div>
</main>
```

Move (cut and paste) the existing controls from the old layout into the placeholder comments above. Don't change any control code yet — just relocate it. The `Field` wrapper and the old radios/checkbox/Selects/inputs all keep working.

**Step 3: Delete `src/app/page.css`**

```bash
rm src/app/page.css
```

The only rule it contained (`.canvas-container { aspect-ratio: 1.7 }`) is replaced by `aspect-[1.7]` on the canvas wrapper.

**Step 4: Smoke test**

Run: `yarn dev`. Resize the browser:
- `lg+` width: form on the left (max ~480px), preview on the right, preview sticks while you scroll the form.
- `<lg`: stacks vertically with form first, preview below.
- All form controls still work: CSV upload, drag-on-canvas, generate, etc. Util tests still green.

Run: `yarn test:run` — still passes.

**Step 5: Commit**

```bash
git add src/app/page.js src/app/page.css
git commit -m "refactor: restructure page into card sections with sticky preview"
```

---

## Task 7: Output card — Tabs + Switch

**Files:**
- Modify: `src/app/page.js`

**Step 1: Add imports**

```jsx
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
```

**Step 2: Replace radios with Tabs**

In the Output card, replace the entire PDF/PNG radio block (`<Field label="Download as:">...</Field>`) with:

```jsx
<div className="space-y-2">
  <Label>Format</Label>
  <Tabs value={outputType} onValueChange={setOutputType} className="w-full">
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="pdf">PDF</TabsTrigger>
      <TabsTrigger value="png">PNG</TabsTrigger>
    </TabsList>
  </Tabs>
</div>
```

**Step 3: Replace separate-files checkbox with Switch**

Replace the entire separate-files block (the `<div className="flex flex-row items-center mb-6 select-none">...</div>`) with:

```jsx
<div className="flex items-center gap-3">
  <Switch
    id="separate"
    checked={separate}
    onCheckedChange={setSeparate}
    disabled={outputType === "png"}
  />
  <Label htmlFor="separate" className="font-normal">
    Download as separate files
    <span className="text-muted-foreground"> (PDF only)</span>
  </Label>
</div>
```

**Step 4: Smoke test**

Run: `yarn dev`. In the browser:
- Click PDF / PNG tabs — `outputType` state changes; verify by reloading and confirming localStorage persists the chosen tab (the existing persistence effect runs).
- Toggle Switch — `separate` state changes.
- Switch to PNG — Switch becomes disabled and visually muted.
- Run a full PDF generation with `separate=true` and confirm the existing zip-of-PDFs path still works.

Run: `yarn test:run` — still passes.

**Step 5: Commit**

```bash
git add src/app/page.js
git commit -m "refactor: use shadcn Tabs and Switch for output format and separate flag"
```

---

## Task 8: Data card — file inputs + Select

**Files:**
- Modify: `src/app/page.js`

**Step 1: Add Select imports**

```jsx
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
```

**Step 2: Replace CSV file Field with shadcn Label + native file input styled to match**

Replace the existing CSV `<Field>` block with:

```jsx
<div className="space-y-2">
  <div className="flex items-baseline gap-2">
    <Label htmlFor="names">Names (.csv)</Label>
    <a className="text-xs text-primary underline italic" href="/sample_names.csv" download>
      Download sample
    </a>
  </div>
  <Input id="names" name="names" type="file" accept=".csv" required onChange={onChangeCsv} />
  {csvError && <p className="text-sm text-destructive">{csvError}</p>}
</div>
```

shadcn's `Input` renders a native `<input>` with shadcn classes; passing `type="file"` works and inherits the styled border/padding.

**Step 3: Replace background photo Field**

Replace the existing bg photo `<Field>` + thumbnail block with:

```jsx
<div className="space-y-2">
  <Label htmlFor="bgPhoto">Background photo (.png, .jpg)</Label>
  <div className="flex items-center gap-3">
    <Input
      id="bgPhoto"
      name="bgPhoto"
      type="file"
      accept=".png, .jpg"
      required
      onChange={onChangeBgPhoto}
      className="flex-1"
    />
    <div className="w-16 h-16 rounded border bg-muted overflow-hidden flex-shrink-0">
      {bgPhoto && <img className="w-full h-full object-contain" src={bgPhoto} alt="" />}
    </div>
  </div>
</div>
```

**Step 4: Replace preview row `<select>` with shadcn Select**

Replace the existing preview-row `<Field>` block with:

```jsx
{csvRows && csvRows.length > 0 && (
  <div className="space-y-2">
    <Label htmlFor="previewRow">Preview row</Label>
    <Select
      value={String(previewRowIndex)}
      onValueChange={(v) => setPreviewRowIndex(Number(v))}
    >
      <SelectTrigger id="previewRow"><SelectValue /></SelectTrigger>
      <SelectContent>
        {csvRows.map((row, i) => {
          const label = row.filter(Boolean).join(" — ");
          const truncated = label.length > 60 ? label.slice(0, 57) + "…" : label;
          return (
            <SelectItem key={i} value={String(i)}>
              {truncated || `Row ${i + 1}`}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  </div>
)}
```

**Step 5: Smoke test**

Run: `yarn dev`. In the browser:
- Upload a sample CSV. The "Preview row" Select appears with rows. Open it; entries render. Choose a row; preview canvas updates.
- Upload a bg photo. The 16×16 thumbnail appears next to the file input. Preview canvas updates.
- Cause a CSV parse error (e.g., upload an empty file). Expected: red `csvError` text appears below the file input.

Run: `yarn test:run` — still passes.

**Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "refactor: use shadcn Input and Select for data card"
```

---

## Task 9: Typography card — global font + dynamic elements list

**Files:**
- Modify: `src/app/page.js`

**Step 1: Replace global font size Field**

Replace the existing global font `<Field>` block with:

```jsx
<div className="space-y-2">
  <Label htmlFor="globalFontSize">Default font size</Label>
  <Input
    id="globalFontSize"
    type="number"
    value={globalFontSize}
    min={1}
    step={1}
    required
    onChange={(e) => setGlobalFontSize(Number(e.target.value))}
    className="w-32"
  />
</div>
```

**Step 2: Replace the elements list with the Option-A row layout**

Replace the entire `{elements.length > 0 && (<Field label="Elements">...)` block with:

```jsx
{elements.length > 0 && (
  <div className="space-y-3">
    <Label>Elements</Label>
    <div className="space-y-2">
      {elements.map((el) => {
        const selected = el.id === selectedElementId;
        return (
          <div
            key={el.id}
            className={cn(
              "rounded-md border p-3 space-y-3",
              selected && "ring-2 ring-ring"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedElementId(el.id)}
                className="text-sm font-semibold text-left flex-1 truncate hover:text-primary"
              >
                {el.label}
              </button>
              {el.fontSize !== null && (
                <button
                  type="button"
                  onClick={() => updateElement(el.id, { fontSize: null })}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  aria-label={`Reset font size for ${el.label}`}
                  title="Reset to global"
                >
                  reset
                </button>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label htmlFor={`x-${el.id}`} className="text-xs text-muted-foreground">X</Label>
                <Input
                  id={`x-${el.id}`}
                  type="number"
                  value={el.x}
                  min={0}
                  step={1}
                  onChange={(e) => updateElement(el.id, { x: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`y-${el.id}`} className="text-xs text-muted-foreground">Y</Label>
                <Input
                  id={`y-${el.id}`}
                  type="number"
                  value={el.y}
                  min={0}
                  step={1}
                  onChange={(e) => updateElement(el.id, { y: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor={`f-${el.id}`} className="text-xs text-muted-foreground">Font</Label>
                <Input
                  id={`f-${el.id}`}
                  type="number"
                  placeholder={`${globalFontSize}`}
                  value={el.fontSize ?? ""}
                  min={1}
                  step={1}
                  onChange={(e) => {
                    const v = e.target.value;
                    updateElement(el.id, { fontSize: v === "" ? null : Number(v) });
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  </div>
)}
```

**Step 3: Add the `cn` import**

Add to imports:
```jsx
import { cn } from "@/lib/utils";
```

**Step 4: Smoke test**

Run: `yarn dev`. In the browser:
- Upload a CSV with 2+ columns. Element rows appear, one per column.
- Click an element row's label — selection ring appears, and the matching text on the canvas highlights.
- Drag the text on the canvas — the corresponding row's X/Y inputs update live.
- Type a number into Font; the canvas updates. Click "reset"; the Font input clears and the placeholder shows the global value.
- Change global font size — non-overridden elements visibly resize.

Run: `yarn test:run` — still passes.

**Step 5: Commit**

```bash
git add src/app/page.js
git commit -m "refactor: use shadcn Input for typography card and elements list"
```

---

## Task 10: Submit button + final cleanup

**Files:**
- Modify: `src/app/page.js`

**Step 1: Add Button import**

```jsx
import { Button } from "@/components/ui/button";
```

**Step 2: Replace the Generate `<button>` with shadcn Button**

Replace the existing Generate `<button>` block with:

```jsx
<Button type="submit" size="lg" disabled={isGenerating} className="w-full">
  {isGenerating ? "Generating…" : "Generate"}
</Button>
```

**Step 3: Delete the now-unused `Field` component definition**

In `src/app/page.js`, delete the `function Field({ label, labelFor, children, helperText }) { ... }` block (lines ~17–27 of the pre-migration file).

**Step 4: Confirm no other references to `Field` remain**

Run: `grep -n "<Field" src/app/page.js`
Expected: no matches.

**Step 5: Smoke test**

Run: `yarn dev`. Full end-to-end:
- Page loads cleanly with header, three Cards (Output, Data, Typography), sticky preview.
- Tabs / Switch / file inputs / Select / number inputs / element rows all work.
- Generate runs the full pipeline, shows Dialog + Progress, downloads the file.
- Refresh; persisted settings (output type, separate, global font size) restore.

Run: `yarn lint`
Expected: clean.

Run: `yarn test:run`
Expected: PASS.

Run: `yarn build`
Expected: build succeeds.

**Step 6: Commit**

```bash
git add src/app/page.js
git commit -m "refactor: use shadcn Button for submit and remove Field wrapper"
```

---

## Task 11: Final verification

**Files:** none

**Step 1: Run the verification-before-completion skill**

Use superpowers:verification-before-completion. Confirm with evidence:

- `yarn lint` — clean.
- `yarn test:run` — PASS.
- `yarn build` — succeeds.
- `yarn dev` — manual smoke test of every feature listed in the design doc's "Verification" section.

**Step 2: Confirm zero references to deleted modules**

Run:
```bash
grep -rn "components/toast" src/ || true
grep -rn "components/progress-overlay" src/ || true
grep -rn "page.css" src/ || true
grep -rn "<Field" src/ || true
```
Expected: all empty.

**Step 3: If anything fails**

Do **not** mark the task complete. Add a follow-up task describing what's broken and fix it before declaring done.

**Step 4: Commit (only if you made fixups in this task)**

```bash
git add -A
git commit -m "fix: address verification follow-ups"
```

---

## Plan complete

If everything passes, the migration is done. Open a PR with title `refactor: migrate UI to shadcn/ui`. Body should link to both the design doc and this plan.
