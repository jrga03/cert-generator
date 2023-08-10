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
  {
    name,
    org,
    pageWidth,
    pageHeight,
    img: src,
    fontSize: _fontSize,
    textX,
    textY,
    orgTextX,
    orgTextY,
  },
  mime
) =>
  new Promise(async (resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");

    // set background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add bg photo
    await attachImage(ctx, {
      src,
      width: pageWidth,
      height: pageHeight,
      left: 0,
      top: 0,
    });

    const fontSize = `${_fontSize}px`;
    const fontFamily = "Arial";
    ctx.font = [fontSize, fontFamily].join(" ");
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    // Add text
    ctx.fillText(name, textX, textY);
    // Add org text
    ctx.fillText(org, orgTextX, orgTextY);

    // Create image from canvas
    const img = new Image();
    img.src = canvas.toDataURL(mime, 1.0);
    img.width = canvas.width;
    img.height = canvas.height;

    img.addEventListener("load", function () {
      const fileName = `${name}.png`;
      const base64 = img.src.split(",")[1];
      // Add image to zip
      zip.file(fileName, base64, { base64: true });
      resolve();
    });

    img.addEventListener("error", reject);
  });

/**
 *
 * @param {"image/png"|"image/jpeg"} mime
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
 * @returns {Blob}
 */
const constructZip = async (
  mime,
  { names, orgs, img, fontSize, textX, textY, orgTextX, orgTextY }
) => {
  const pageWidth = PAGE_WIDTH;
  const pageHeight = PAGE_HEIGHT;

  // create zip
  const zip = new JSZip();

  /**
   * Start of zip content
   */
  for (const [index, name] of names.entries()) {
    const pageData = {
      name,
      org: orgs[index],
      pageWidth,
      pageHeight,
      img,
      fontSize,
      textX,
      textY,
      orgTextX,
      orgTextY,
    };

    await addPageToZip(zip, pageData, mime);
  }
  /**
   * End of zip content
   */

  const blob = await zip.generateAsync({ type: "blob" });
  return blob;
};

/**
 * @param {{
 *   names: string[],
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 * }} data
 */
export async function downloadAsPhoto(data) {
  try {
    const mime = "image/png";
    const zipBlob = await constructZip(mime, data);

    return zipBlob;
  } catch (error) {
    console.log(error);
  }
}
