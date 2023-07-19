import JSZip from "jszip";

import { downloadAsPhoto } from "./png";
import { downloadPDF } from "./pdf";

/**
 * @param {{
 *   type: "pdf" | "png",
 *   names: string[],
 *   img: string,
 *   fontSize: number,
 *   textX: number,
 *   textY: number,
 *   separate: boolean,
 * }} data
 */
export async function download(data) {
  const { type, names, separate } = data;

  switch (type) {
    case "pdf": {
      if (separate) {
        // create zip
        const zip = new JSZip();

        for (const name of names) {
          const pdf = await downloadPDF({ ...data, names: [name] });

          const fileName = `${name}.pdf`;
          // Add image to zip
          zip.file(fileName, pdf);
        }

        const blob = await zip.generateAsync({ type: "blob" });

        if (blob) {
          downloadFile(blob, "certificates", "zip");
        }
      } else {
        const pdf = await downloadPDF(data);

        if (pdf) {
          downloadFile(pdf, "certificates", "pdf");
        }
      }

      break;
    }

    case "png": {
      const zip = await downloadAsPhoto(data);

      if (zip) {
        downloadFile(zip, "certificates", "zip");
      }

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
