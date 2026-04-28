import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

const FALLBACK_NAME = "Juan dela Cruz";
const FALLBACK_ORG = "Organization";

export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY, nameText, orgText },
  successCb,
  boxesRef
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

    const scale = Math.min(canvasWidth / PAGE_WIDTH, canvasHeight / PAGE_HEIGHT);
    const scaledFontSize = fontSize * scale;
    const scaledTextX = textX * scale;
    const scaledTextY = textY * scale;
    const scaledOrgTextX = orgTextX * scale;
    const scaledOrgTextY = orgTextY * scale;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const image = new Image();
    image.src = bgPhoto;
    image.width = canvasWidth;
    image.height = canvasHeight;
    image.onload = () => {
      ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

      ctx.font = `${scaledFontSize}px Arial`;
      ctx.fillStyle = "#000";
      ctx.textAlign = "center";

      const drawnName = nameText || FALLBACK_NAME;
      const drawnOrg = orgText || FALLBACK_ORG;

      ctx.fillText(drawnName, scaledTextX, scaledTextY);
      ctx.fillText(drawnOrg, scaledOrgTextX, scaledOrgTextY);

      if (boxesRef) {
        const nameMetrics = ctx.measureText(drawnName);
        const orgMetrics = ctx.measureText(drawnOrg);

        const nameAscent = nameMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
        const nameDescent = nameMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
        const orgAscent = orgMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
        const orgDescent = orgMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

        boxesRef.current = {
          name: {
            x: scaledTextX - nameMetrics.width / 2,
            y: scaledTextY - nameAscent,
            width: nameMetrics.width,
            height: nameAscent + nameDescent,
          },
          org: {
            x: scaledOrgTextX - orgMetrics.width / 2,
            y: scaledOrgTextY - orgAscent,
            width: orgMetrics.width,
            height: orgAscent + orgDescent,
          },
          scale,
        };
      }
    };

    successCb?.(true);
    return;
  }
  successCb?.(false);
}

export function hitTest(boxes, canvasX, canvasY) {
  if (!boxes) return null;
  const inside = (b) =>
    canvasX >= b.x &&
    canvasX <= b.x + b.width &&
    canvasY >= b.y &&
    canvasY <= b.y + b.height;
  // org draws after name, so prefer org on overlap
  if (inside(boxes.org)) return "org";
  if (inside(boxes.name)) return "name";
  return null;
}
