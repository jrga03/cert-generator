import JSZip from "jszip";

import { downloadAsPhoto } from "./png";
import { downloadPDF } from "./pdf";

/**
 * @param {{
 *   type: "pdf" | "png",
 *   names: string[],
 *   orgs: string[],
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 *   orgTextX: number,
 *   orgTextY: number,
 *   separate: boolean,
 * }} data
 */
export async function download(data, onProgress) {
  const { type, names, orgs, separate } = data;

  switch (type) {
    case "pdf": {
      if (separate) {
        const zip = new JSZip();

        for (const [index, name] of names.entries()) {
          const pdf = await downloadPDF({
            ...data,
            names: [name],
            orgs: [orgs[index]],
          });

          const fileName = `${name}.pdf`;
          zip.file(fileName, pdf);
          onProgress?.(index + 1, names.length);
        }

        const blob = await zip.generateAsync({ type: "blob" });
        downloadFile(blob, "certificates", "zip");
      } else {
        const pdf = await downloadPDF(data, onProgress);
        downloadFile(pdf, "certificates", "pdf");
      }

      break;
    }

    case "png": {
      const zip = await downloadAsPhoto(data, onProgress);
      downloadFile(zip, "certificates", "zip");
      break;
    }
  }
}

function downloadFile(blob, fileName = "file", ext) {
  // IE11 support
  if (navigator?.msSaveBlob) {
    navigator.msSaveBlob(blob, `${fileName}.${ext}`);
  } else {
    // other browsers

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
