import { PAGE_HEIGHT, PAGE_WIDTH } from "./page-size";

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
  { bgPhoto, globalFontSize, elements, rowCells, selectedElementId },
  successCb,
  boxesRef
) {
  if (
    !canvas ||
    !bgPhoto ||
    typeof globalFontSize !== "number" ||
    !Array.isArray(elements)
  ) {
    successCb?.(false);
    return;
  }

  const computedStyles = getComputedStyle(canvas);
  const canvasWidth = parseInt(computedStyles.width, 10);
  const canvasHeight = parseInt(computedStyles.height, 10);

  const scale = Math.min(canvasWidth / PAGE_WIDTH, canvasHeight / PAGE_HEIGHT);
  const image = getCachedImage(bgPhoto);

  function draw() {
    if (canvas.width !== canvasWidth) canvas.width = canvasWidth;
    if (canvas.height !== canvasHeight) canvas.height = canvasHeight;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(image, 0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = "#000";
    ctx.textAlign = "center";

    const boxes = { scale };

    for (const el of elements) {
      const fontSize = (el.fontSize ?? globalFontSize) * scale;
      ctx.font = `${fontSize}px Arial`;

      const cell = rowCells?.[el.columnIndex];
      const text = (cell != null && cell !== "") ? cell : el.label;

      const x = el.x * scale;
      const y = el.y * scale;
      ctx.fillText(text, x, y);

      const m = ctx.measureText(text);
      const ascent = m.actualBoundingBoxAscent ?? fontSize * 0.8;
      const descent = m.actualBoundingBoxDescent ?? fontSize * 0.2;
      boxes[el.id] = {
        x: x - m.width / 2,
        y: y - ascent,
        width: m.width,
        height: ascent + descent,
      };
    }

    if (boxesRef) boxesRef.current = boxes;

    if (selectedElementId && boxes[selectedElementId]) {
      const b = boxes[selectedElementId];
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
