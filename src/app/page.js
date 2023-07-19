"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import Papa from "papaparse";
// import debounce from "lodash/debounce";

import { download } from "@/utils/download";
import { readAsDataURL } from "@/utils/data-url";
import { generatePreviewImg } from "@/utils/preview";

import "./page.css";

function Field({ label, labelFor, children, helperText }) {
  return (
    <div className="flex flex-col mb-6 select-none">
      <label htmlFor={labelFor} className="mb-2 font-bold text-lg text-gray-900">
        {label}
        {helperText}
      </label>
      {children}
    </div>
  );
}

export default function Home() {
  const [bgPhoto, setBgPhoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const formRef = useRef(null);

  const generatePreview = useCallback(
    async function () {
      if (formRef.current) {
        const { fontSize, textX, textY } = Object.fromEntries(
          new FormData(formRef.current).entries()
        );

        if (bgPhoto && fontSize && textX && textY) {
          setPreviewLoading(true);

          try {
            const preview = await generatePreviewImg({ bgPhoto, fontSize, textX, textY });
            setPreview(preview);
          } catch (error) {
            console.log(error);
          } finally {
            setPreviewLoading(false);
          }
        }
      }
    },
    [bgPhoto]
  );

  useEffect(() => {
    const form = formRef.current;

    if (form) {
      form.addEventListener("change", generatePreview);
    }
    return () => {
      if (form) {
        form.removeEventListener("change", generatePreview);
      }
    };
  }, [generatePreview]);

  function onChangeBgPhoto(event) {
    const url = URL.createObjectURL(event.target.files[0]);
    setBgPhoto(url);
  }

  async function onSubmit(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const entries = Object.fromEntries(formData.entries());

    const img = await readAsDataURL(entries.bgPhoto);

    Papa.parse(entries.names, {
      skipEmptyLines: true,
      complete: async (res) => {
        const names = res.data.slice(1).map((row) => row[0]);

        const data = {
          ...entries,
          names,
          img,
          separate: entries.separate === "on",
        };

        await download(data);
      },
    });
  }

  return (
    <>
      <Script
        src="https://github.com/foliojs/pdfkit/releases/download/v0.12.1/pdfkit.standalone.js"
        strategy="lazyOnload"
      />

      <main className="flex justify-center items-center p-16">
        <form onSubmit={onSubmit} ref={formRef}>
          <div className="container flex flex-col mx-auto">
            <Field label="Download as:" labelFor="type">
              <div>
                <input id="pdf" name="type" type="radio" value="pdf" defaultChecked required />
                <label htmlFor="pdf" className="ml-2">
                  PDF
                </label>
              </div>
              <div>
                <input id="png" name="type" type="radio" value="png" />
                <label htmlFor="png" className="ml-2">
                  PNG
                </label>
              </div>
            </Field>

            {/* Switch */}
            <div className="switch flex flex-row items-center mb-6 select-none">
              <input id="separate" name="separate" type="checkbox" />
              <label htmlFor="separate" className="toggle mr-2">
                Toggle
              </label>
              <label htmlFor="separate" className="font-bold text-lg text-gray-900">
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

            <Field
              label="Text X"
              labelFor="textX"
              helperText={
                <span className="text-base font-normal ml-1 italic text-gray-900">
                  (for PNG only)
                </span>
              }
            >
              <input
                className="border px-2 py-1 rounded"
                id="textX"
                name="textX"
                type="number"
                accept=".png, .jpg"
                defaultValue={0}
                min={0}
                max={Number.MAX_SAFE_INTEGER}
                step={1}
                required
              />
            </Field>

            <Field label="Text Y" labelFor="textY">
              <input
                className="border px-2 py-1 rounded"
                id="textY"
                name="textY"
                type="number"
                accept=".png, .jpg"
                defaultValue={0}
                min={0}
                max={Number.MAX_SAFE_INTEGER}
                step={1}
                required
              />
            </Field>

            <Field label="Font size" labelFor="fontSize">
              <input
                className="border px-2 py-1 rounded"
                id="fontSize"
                name="fontSize"
                type="number"
                accept=".png, .jpg"
                defaultValue={75}
                min={1}
                max={Number.MAX_SAFE_INTEGER}
                step={1}
                required
              />
            </Field>

            <div className="w-full h-60 bg-gray-50">
              {previewLoading && (
                <div className="w-full h-full flex items-center justify-center">
                  <div class="loader-1">
                    <span></span>
                  </div>
                </div>
              )}
              {!previewLoading && (
                <>
                  {preview && <img className="w-full h-full object-contain" src={preview} />}
                  {!preview && (
                    <div className="w-full h-full border rounded italic uppercase flex items-center justify-center text-gray-400">
                      Preview
                    </div>
                  )}
                </>
              )}
            </div>

            <button
              type="submit"
              className={
                "mt-8 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500" +
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              }
            >
              Generate
            </button>
          </div>
        </form>
      </main>
    </>
  );
}
