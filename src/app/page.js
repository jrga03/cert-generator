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
import { loadSettings, saveSettings, migrateLoadedSettings } from "@/utils/persistence";
import { updateElement as updateElementHelper, parseCertCsv } from "@/utils/elements";

import "./page.css";

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

      <main className="flex justify-center items-center p-16">
        <form className="w-full h-full" onSubmit={onSubmit} ref={formRef}>
          <div className="container flex flex-col mx-auto">
            <Field label="Download as:" labelFor="type">
              <div>
                <input
                  id="pdf"
                  name="type"
                  type="radio"
                  value="pdf"
                  required
                  checked={outputType === "pdf"}
                  onChange={() => setOutputType("pdf")}
                />
                <label htmlFor="pdf" className="ml-2">
                  PDF
                </label>
              </div>
              <div>
                <input
                  id="png"
                  name="type"
                  type="radio"
                  value="png"
                  required
                  checked={outputType === "png"}
                  onChange={() => setOutputType("png")}
                />
                <label htmlFor="png" className="ml-2">
                  PNG
                </label>
              </div>
            </Field>

            {/* Switch */}
            <div className="flex flex-row items-center mb-6 select-none">
              <input
                id="separate"
                name="separate"
                type="checkbox"
                checked={separate}
                onChange={(e) => setSeparate(e.target.checked)}
              />
              {/* <label htmlFor="separate" className="switch-toggle">
                Toggle
              </label> */}
              <label htmlFor="separate" className="ml-2 font-bold text-lg text-gray-900">
                Download as separate files?
              </label>
              <span className="ml-1 italic text-gray-900">(for PDF only)</span>
            </div>

            <Field
              label={
                <div>
                  <label htmlFor="names">Names (.csv) </label>
                  <a
                    className="text-xs text-blue-400 underline italic"
                    href="/sample_names.csv"
                    download
                  >
                    Download Sample
                  </a>
                </div>
              }
            >
              <input
                id="names"
                name="names"
                type="file"
                accept=".csv"
                required
                onChange={onChangeCsv}
              />
              {csvError && <p className="mt-1 text-sm text-red-600">{csvError}</p>}
            </Field>

            {csvRows && csvRows.length > 0 && (
              <Field label="Preview row" labelFor="previewRow">
                <select
                  id="previewRow"
                  className="border px-2 py-1 rounded"
                  value={previewRowIndex}
                  onChange={(e) => setPreviewRowIndex(Number(e.target.value))}
                >
                  {csvRows.map((row, i) => {
                    const label = row.filter(Boolean).join(" — ");
                    const truncated = label.length > 60 ? label.slice(0, 57) + "…" : label;
                    return (
                      <option key={i} value={i}>
                        {truncated || `Row ${i + 1}`}
                      </option>
                    );
                  })}
                </select>
              </Field>
            )}

            <div className="flex flex-row gap-4">
              <Field label="Background photo (.png, .jpg)" labelFor="bgPhoto">
                <input
                  id="bgPhoto"
                  name="bgPhoto"
                  type="file"
                  accept=".png, .jpg"
                  required
                  onChange={onChangeBgPhoto}
                />
              </Field>

              <div className="w-20 h-20">
                {bgPhoto && <img className="w-full h-full object-contain" src={bgPhoto} alt="" />}
              </div>
            </div>

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

            <div className="canvas-container w-full h-auto bg-gray-50 relative">
              <canvas
                className="w-full h-full touch-none"
                ref={canvasRef}
                onPointerDown={onPointerDownCanvas}
                onPointerMove={onPointerMoveCanvas}
                onPointerUp={onPointerUpCanvas}
                onPointerCancel={onPointerUpCanvas}
              />
              {!hasPreview && (
                <div className="absolute inset-0 border rounded italic uppercase flex items-center justify-center text-gray-400">
                  Preview
                </div>
              )}
            </div>

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
          </div>
        </form>
      </main>
    </>
  );
}
