"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Script from "next/script";
import Papa from "papaparse";

import { download } from "@/utils/download";
import { readAsDataURL } from "@/utils/data-url";
import { generatePreview, hitTest } from "@/utils/preview";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/utils/page-size";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { loadSettings, saveSettings, migrateLoadedSettings } from "@/utils/persistence";
import { updateElement as updateElementHelper, parseCertCsv } from "@/utils/elements";

function Field({ label, labelFor, children, helperText }) {
  return (
    <div className="flex flex-col flex-1 mb-6 select-none">
      <label htmlFor={labelFor} className="mb-2 font-bold text-lg text-gray-900">
        {label}
        {helperText}
      </label>
      {children}
    </div>
  );
}

const DEFAULT_FONT_SIZE = 75;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export default function Home() {
  const [bgPhoto, setBgPhoto] = useState(null);
  const [hasPreview, setHasPreview] = useState(null);
  const [globalFontSize, setGlobalFontSize] = useState(DEFAULT_FONT_SIZE);
  const [elements, setElements] = useState([]);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvRows, setCsvRows] = useState(null); // string[][]
  const [progress, setProgress] = useState(null);
  const [csvError, setCsvError] = useState(null);
  const [previewRowIndex, setPreviewRowIndex] = useState(0);
  const [selectedElementId, setSelectedElementId] = useState(null);
  const [outputType, setOutputType] = useState("pdf");
  const [separate, setSeparate] = useState(false);
  const isGenerating = progress !== null;
  const rowCells = csvRows?.[previewRowIndex];
  const formRef = useRef(null);
  const canvasRef = useRef(null);
  const boxesRef = useRef(null);
  const dragRef = useRef(null); // null | { id, offsetX, offsetY, scale }

  const updateElement = (id, patch) =>
    setElements(prev => updateElementHelper(prev, id, patch));

  useEffect(() => {
    const saved = migrateLoadedSettings(loadSettings());
    if (!saved) return;
    if (typeof saved.globalFontSize === "number") setGlobalFontSize(saved.globalFontSize);
    if (saved.outputType) setOutputType(saved.outputType);
    if (typeof saved.separate === "boolean") setSeparate(saved.separate);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => {
      saveSettings({ globalFontSize, outputType, separate });
    }, 250);
    return () => clearTimeout(id);
  }, [globalFontSize, outputType, separate]);

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

  function onChangeBgPhoto(event) {
    const url = URL.createObjectURL(event.target.files[0]);
    setBgPhoto(url);

    const updatePreview = () =>
      generatePreview(
        canvasRef.current,
        { bgPhoto: url, globalFontSize, elements, rowCells, selectedElementId },
        setHasPreview,
        boxesRef
      );
    requestAnimationFrame(updatePreview);
  }

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

  function getCanvasPoint(event) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

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

  async function onSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const entries = Object.fromEntries(formData.entries());

    const img = await readAsDataURL(entries.bgPhoto);

    if (!csvRows || csvRows.length === 0) {
      toast.error("Please upload a CSV first.");
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
      setProgress({ current: 0, total: csvRows.length });
      await download(data, (current, total) => setProgress({ current, total }));
    } catch (err) {
      toast.error(err?.message || "Failed to generate certificates.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <>
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
      <Script
        src="https://github.com/foliojs/pdfkit/releases/download/v0.12.1/pdfkit.standalone.js"
        strategy="lazyOnload"
      />

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
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Tabs value={outputType} onValueChange={setOutputType} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="pdf">PDF</TabsTrigger>
                      <TabsTrigger value="png">PNG</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

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
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Data</CardTitle></CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Typography</CardTitle></CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

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
    </>
  );
}
