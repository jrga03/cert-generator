import JSZip from "jszip";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

/**
 * Attaches image to the canvas
 * @async
 * @param {CanvasRenderingContext2D} ctx
 * @param {{
 *  src: string,
 *  width: number,
 *  height: number,
 *  rotation: number,
 *  left: number,
 *  top: number
 * }} config
 */
export const attachImage = (ctx, { src, width, height, left, top }) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.width = width;
    img.height = height;

    img.addEventListener("load", function () {
      ctx.save();
      ctx.translate(left + width / 2, top + height / 2);
      ctx.drawImage(img, -width / 2, -height / 2, width, height);
      ctx.restore();

      resolve();
    });

    img.addEventListener("error", reject);
  });

/**
 *
 * @param {JSZip} zip
 * @param {*} pageData
 * @param {"image/png"|"image/jpeg"} mime
 * @returns
 */
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

/**
 * @param {{
 *   elements: Array<{id, columnIndex, label, x, y, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 * }} data
 */
export async function downloadAsPhoto(data, onProgress) {
  const mime = "image/png";
  return constructZip(mime, data, onProgress);
}
