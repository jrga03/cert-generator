"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Script from "next/script";
import Papa from "papaparse";

import { download } from "@/utils/download";
import { readAsDataURL } from "@/utils/data-url";
import { generatePreview } from "@/utils/preview";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/utils/page-size";
import { ProgressOverlay } from "@/components/progress-overlay";
import { Toast } from "@/components/toast";

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

export default function Home() {
  const [bgPhoto, setBgPhoto] = useState(null);
  const [hasPreview, setHasPreview] = useState(null);
  const [numberInputs, setNumberInputs] = useState({
    textX: PAGE_WIDTH / 2,
    textY: PAGE_HEIGHT / 2,
    orgTextX: PAGE_WIDTH / 2,
    orgTextY: PAGE_HEIGHT / 2 + DEFAULT_FONT_SIZE,
    fontSize: DEFAULT_FONT_SIZE,
  });
  const [progress, setProgress] = useState(null); // null | { current, total }
  const [error, setError] = useState(null);
  const isGenerating = progress !== null;
  const formRef = useRef(null);
  const canvasRef = useRef(null);

  useLayoutEffect(() => {
    function _generatePreview() {
      const updatePreview = () =>
        generatePreview(canvasRef.current, { bgPhoto, ...numberInputs }, setHasPreview);
      requestAnimationFrame(updatePreview);
    }

    window.addEventListener("resize", _generatePreview);
    return () => window.removeEventListener("resize", _generatePreview);
  }, [bgPhoto, numberInputs]);

  function onChangeBgPhoto(event) {
    const url = URL.createObjectURL(event.target.files[0]);
    setBgPhoto(url);

    const updatePreview = () =>
      generatePreview(canvasRef.current, { bgPhoto: url, ...numberInputs }, setHasPreview);
    requestAnimationFrame(updatePreview);
  }

  const onChangeNumberInput = (event) => {
    const { name, value } = event.target;

    setNumberInputs((prev) => {
      const newValues = {
        ...prev,
        [name]: Number(value),
      };

      const updatePreview = () =>
        generatePreview(canvasRef.current, { bgPhoto, ...newValues }, setHasPreview);

      requestAnimationFrame(updatePreview);

      return newValues;
    });
  };

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

  return (
    <>
      {progress && <ProgressOverlay current={progress.current} total={progress.total} />}
      <Toast message={error} onClose={() => setError(null)} />
      <Script
        src="https://github.com/foliojs/pdfkit/releases/download/v0.12.1/pdfkit.standalone.js"
        strategy="lazyOnload"
      />

      <main className="flex justify-center items-center p-16">
        <form className="w-full h-full" onSubmit={onSubmit} ref={formRef}>
          <div className="container flex flex-col mx-auto">
            <Field label="Download as:" labelFor="type">
              <div>
                <input id="pdf" name="type" type="radio" value="pdf" required />
                <label htmlFor="pdf" className="ml-2">
                  PDF
                </label>
              </div>
              <div>
                <input id="png" name="type" type="radio" value="png" required />
                <label htmlFor="png" className="ml-2">
                  PNG
                </label>
              </div>
            </Field>

            {/* Switch */}
            <div className="flex flex-row items-center mb-6 select-none">
              <input id="separate" name="separate" type="checkbox" />
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
              <input id="names" name="names" type="file" accept=".csv" required />
            </Field>

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

            <div className="flex justify-between items-center gap-4">
              <Field label="Text X" labelFor="textX">
                <input
                  className="border px-2 py-1 rounded"
                  id="textX"
                  name="textX"
                  type="number"
                  defaultValue={numberInputs.textX}
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  required
                  onChange={onChangeNumberInput}
                />
              </Field>

              <Field label="Text Y" labelFor="textY">
                <input
                  className="border px-2 py-1 rounded"
                  id="textY"
                  name="textY"
                  type="number"
                  defaultValue={numberInputs.textY}
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  required
                  onChange={onChangeNumberInput}
                />
              </Field>
            </div>

            <div className="flex justify-between items-center gap-4">
              <Field label="Org Text X" labelFor="orgTextX">
                <input
                  className="border px-2 py-1 rounded"
                  id="orgTextX"
                  name="orgTextX"
                  type="number"
                  defaultValue={numberInputs.orgTextX}
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  required
                  onChange={onChangeNumberInput}
                />
              </Field>

              <Field label="Org Text Y" labelFor="orgTextY">
                <input
                  className="border px-2 py-1 rounded"
                  id="orgTextY"
                  name="orgTextY"
                  type="number"
                  defaultValue={numberInputs.orgTextY}
                  min={0}
                  max={Number.MAX_SAFE_INTEGER}
                  step={1}
                  required
                  onChange={onChangeNumberInput}
                />
              </Field>
            </div>

            <Field label="Font size" labelFor="fontSize">
              <input
                className="border px-2 py-1 rounded"
                id="fontSize"
                name="fontSize"
                type="number"
                defaultValue={numberInputs.fontSize}
                min={1}
                max={Number.MAX_SAFE_INTEGER}
                step={1}
                required
                onChange={onChangeNumberInput}
              />
            </Field>

            <div className="canvas-container w-full h-auto bg-gray-50 relative">
              <canvas className="w-full h-full" ref={canvasRef} />
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
