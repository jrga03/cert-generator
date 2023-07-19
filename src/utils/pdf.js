// import PDFDocument from "pdfkit";
import blobStream from "blob-stream";

function pixelsToPoints(pixel) {
  return (pixel * 72) / 300;
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
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 * }} data
 * @returns {Promise<Blob>}
 */
const constructPDF = ({ names, img, fontSize, textY }) =>
  new Promise(async (resolve, reject) => {
    const pageWidth = pixelsToPoints(3508);
    const pageHeight = pixelsToPoints(2480);

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

    /**
     * Start of PDF content
     */

    for (const name of names) {
      // Add page to the document
      doc.addPage();

      // Add image to the page
      doc.image(img, 0, 0, {
        align: "center",
        valign: "center",
        width: pageWidth,
        height: pageHeight,
      });

      doc
        .font("Arial")
        .fontSize(pixelsToPoints(fontSize))
        .strokeColor("#000")
        .fillColor("#000")
        .text(name, 0, pixelsToPoints(textY - fontSize), {
          align: "center",
        });
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
