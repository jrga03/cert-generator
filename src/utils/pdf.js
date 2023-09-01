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
 * Construct PDF Document
 * @param {{
 *   names: string[],
 *   orgs: string[],
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 *   orgTextX: number,
 *   orgTextY: number,
 * }} data
 * @returns {Promise<Blob>}
 */
const constructPDF = ({ names, orgs, img, fontSize, textX, textY, orgTextX, orgTextY }) =>
  new Promise(async (resolve, reject) => {
    const pageWidth = pixelsToPoints(PAGE_WIDTH);
    const pageHeight = pixelsToPoints(PAGE_HEIGHT);

    const options = {
      layout: "landscape",
      size: [pageHeight, pageWidth],
      margin: 0,
      autoFirstPage: false,
      info: undefined, // document metadata. See https://pdfkit.org/docs/getting_started.html#setting_document_metadata
    };

    // create document
    const doc = new window.PDFDocument(options);

    await loadFont(doc, "Arial", "ttf", "/arial.ttf");

    // pipe the document to a blob
    const stream = doc.pipe(blobStream());

    const fontSizePt = pixelsToPoints(fontSize);
    const largestNameWidth = getLargestWidth(names, fontSize, "Arial");
    const largestOrgWidth = getLargestWidth(orgs, fontSize, "Arial");

    /**
     * Start of PDF content
     */
    for (const [index, name] of names.entries()) {
      // Add page to the document
      doc.addPage();

      // Add image to the page
      doc.image(img, 0, 0, {
        align: "center",
        valign: "center",
        width: pageWidth,
        height: pageHeight,
      });

      // Add text
      doc
        .font("Arial")
        .fontSize(fontSizePt)
        .strokeColor("#000")
        .fillColor("#000")
        .text(
          name,
          pixelsToPoints(textX - largestNameWidth / 2),
          pixelsToPoints(textY - fontSize),
          {
            align: "center",
            width: pixelsToPoints(largestNameWidth),
          }
        );

      const org = orgs[index];
      // Add org text
      doc
        .font("Arial")
        .fontSize(pixelsToPoints(fontSize))
        .strokeColor("#000")
        .fillColor("#000")
        .text(
          org,
          pixelsToPoints(orgTextX - largestOrgWidth / 2),
          pixelsToPoints(orgTextY - fontSize),
          {
            align: "center",
            width: pixelsToPoints(largestOrgWidth),
          }
        );
    }
    /**
     * End of PDF content
     */

    doc.end();
    stream.on("finish", function () {
      const blob = stream.toBlob("application/pdf");
      resolve(blob);
    });

    stream.on("error", reject);
  });

/**
 * @param {{
 *   names: string[],
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 * }[]} data
 */
export async function downloadPDF(data) {
  try {
    const blob = await constructPDF(data);
    return blob;
  } catch (error) {
    console.log(error);
  }
}
