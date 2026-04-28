// import PDFDocument from "pdfkit";
import blobStream from "blob-stream";
import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

function pixelsToPoints(pixel) {
  return (pixel * 72) / 300;
}

function measureTextWidth(text, fontSize, fontFamily) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  context.font = fontSize + "px " + fontFamily;
  return context.measureText(text).width;
}

function getLargestWidth(data, fontSize, fontFamily) {
  const widths = data.map((item) => measureTextWidth(item, fontSize, fontFamily));
  return Math.max(...widths);
}

/**
 * @param {PDFKit.PDFDocument} pdfDoc
 * @param {string} name Font name
 * @param {string} type Font file extension
 * @param {string} url URL of font
 * @returns {Promise<any>}
 */
const loadFont = (pdfDoc, name, type, url) =>
  new Promise((resolve, reject) => {
    if (type !== "ttf") {
      /**
       * @todo test with other font file extensions
       * @see https://github.com/foliojs/pdfkit/issues/623#issuecomment-284625259
       */
      reject(`Font with type "${type}" is not yet supported.`);
      return;
    }

    const request = new XMLHttpRequest();

    request.addEventListener("load", async () => {
      if (request.status === 200) {
        pdfDoc.registerFont(name, request.response);
        resolve();
      } else {
        reject();
      }
    });
    request.addEventListener("error", reject);

    request.open("GET", url, true);
    request.responseType = "arraybuffer";
    request.send(null);
  });

/**
 * @param {{
 *   elements: Array<{id, columnIndex, label, x, y, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 * }} data
 */
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

/**
 * @param {{
 *   elements: Array<{id, columnIndex, label, x, y, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 * }} data
 */
export async function downloadPDF(data, onProgress) {
  return constructPDF(data, onProgress);
}
