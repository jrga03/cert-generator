import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY },
  successCb
) {
  if (
    canvas &&
    bgPhoto &&
    typeof fontSize === "number" &&
    typeof textX === "number" &&
    typeof textY === "number"
  ) {
    const computedStyles = getComputedStyle(canvas);
    const canvasWidth = parseInt(computedStyles.width, 10);
    const canvasHeight = parseInt(computedStyles.height, 10);

    const scale = canvasWidth / PAGE_WIDTH;
    const scaledFontSize = fontSize * scale;
    const scaledTextX = textX * scale;
    const scaledTextY = textY * scale;
    const scaledOrgTextX = orgTextX * scale;
    const scaledOrgTextY = orgTextY * scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    // set background
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add image
    const image = new Image();
    image.src = bgPhoto;
    image.width = canvasWidth;
    image.height = canvasHeight;
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

      ctx.font = `${scaledFontSize}px Arial`;
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      // Add text
      ctx.fillText("Juan dela Cruz", scaledTextX, scaledTextY);

      // Add org text
      ctx.fillText("Organization", scaledOrgTextX, scaledOrgTextY);
    };

    successCb?.(true);
    return;
  }
  successCb?.(false);
}
