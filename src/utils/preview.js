import { readAsDataURL } from "./data-url";

const { attachImage } = require("./png");

export const generatePreviewImg = ({ bgPhoto, fontSize: _fontSize, textX, textY }) =>
  new Promise(async (resolve, reject) => {
    const pageWidth = 3508;
    const pageHeight = 2480;

    const canvas = document.createElement("canvas");
    canvas.width = pageWidth;
    canvas.height = pageHeight;
    const ctx = canvas.getContext("2d");

    // set background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add bg photo
    await attachImage(ctx, {
      src: await readAsDataURL(bgPhoto),
      width: pageWidth,
      height: pageHeight,
      left: 0,
      top: 0,
    });

    // Add text
    const fontSize = `${_fontSize}px`;
    const fontFamily = "Arial";
    ctx.font = [fontSize, fontFamily].join(" ");
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";
    ctx.fillText("Juan dela Cruz", textX, textY);

    // Create image from canvas
    const img = new Image();
    img.src = canvas.toDataURL("image/png", 1.0);
    img.width = canvas.width;
    img.height = canvas.height;

    img.addEventListener("load", function () {
      resolve(img.src);
    });

    img.addEventListener("error", reject);
  });
