import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

const FALLBACK_NAME = "Juan dela Cruz";
const FALLBACK_ORG = "Organization";

const imageCache = new Map();

function getCachedImage(src) {
  let image = imageCache.get(src);
  if (!image) {
    image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return image;
}

export function generatePreview(
  canvas,
  { bgPhoto, fontSize, textX, textY, orgTextX, orgTextY, nameText, orgText, selectedElement },
  successCb,
  boxesRef
) {
  if (
    !canvas ||
    !bgPhoto ||
    typeof fontSize !== "number" ||
    typeof textX !== "number" ||
    typeof textY !== "number"
  ) {
    successCb?.(false);
    return;
  }

  const computedStyles = getComputedStyle(canvas);
  const canvasWidth = parseInt(computedStyles.width, 10);
  const canvasHeight = parseInt(computedStyles.height, 10);

  const scale = Math.min(canvasWidth / PAGE_WIDTH, canvasHeight / PAGE_HEIGHT);
  const scaledFontSize = fontSize * scale;
  const scaledTextX = textX * scale;
  const scaledTextY = textY * scale;
  const scaledOrgTextX = orgTextX * scale;
  const scaledOrgTextY = orgTextY * scale;

  const image = getCachedImage(bgPhoto);

  function draw() {
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    ctx.font = `${scaledFontSize}px Arial`;
    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    const drawnName = nameText || FALLBACK_NAME;
    const drawnOrg = orgText || FALLBACK_ORG;

    ctx.fillText(drawnName, scaledTextX, scaledTextY);
    ctx.fillText(drawnOrg, scaledOrgTextX, scaledOrgTextY);

    const nameMetrics = ctx.measureText(drawnName);
    const orgMetrics = ctx.measureText(drawnOrg);
    const nameAscent = nameMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
    const nameDescent = nameMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;
    const orgAscent = orgMetrics.actualBoundingBoxAscent ?? scaledFontSize * 0.8;
    const orgDescent = orgMetrics.actualBoundingBoxDescent ?? scaledFontSize * 0.2;

    const boxes = {
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

    if (boxesRef) {
      boxesRef.current = boxes;
    }

    if (selectedElement && boxes[selectedElement]) {
      const b = boxes[selectedElement];
      ctx.save();
      ctx.strokeStyle = "#4f46e5";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
      ctx.restore();
    }
  }

  if (image.complete && image.naturalWidth > 0) {
    draw();
  } else {
    image.addEventListener("load", draw, { once: true });
  }

  successCb?.(true);
}

export function hitTest(boxes, canvasX, canvasY, elementIds) {
  if (!boxes || !elementIds) return null;
  for (let i = elementIds.length - 1; i >= 0; i--) {
    const b = boxes[elementIds[i]];
    if (!b) continue;
    if (
      canvasX >= b.x &&
      canvasX <= b.x + b.width &&
      canvasY >= b.y &&
      canvasY <= b.y + b.height
    ) {
      return elementIds[i];
    }
  }
  return null;
}
