import JSZip from "jszip";

import { downloadAsPhoto } from "./png";
import { downloadPDF } from "./pdf";

/**
 * @param {{
 *   type: "pdf" | "png",
 *   elements: Array<{id: string, columnIndex: number, label: string, x: number, y: number, fontSize: number|null}>,
 *   globalFontSize: number,
 *   rows: string[][],
 *   img: string,
 *   separate: boolean,
 * }} data
 */
export async function download(data, onProgress) {
  const { type, separate, rows } = data;

  switch (type) {
    case "pdf": {
      if (separate) {
        const zip = new JSZip();

        for (const [index, row] of rows.entries()) {
          const pdf = await downloadPDF({ ...data, rows: [row] });
          const baseName = (row[0] && String(row[0]).trim()) || `cert-${index + 1}`;
          const fileName = `${baseName}.pdf`;
          zip.file(fileName, pdf);
          onProgress?.(index + 1, rows.length);
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
