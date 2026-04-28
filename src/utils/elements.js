import { PAGE_WIDTH, PAGE_HEIGHT } from "./page-size";

const DEFAULT_FONT_SIZE = 75;

export function buildDefaultElements(headers) {
  return headers.map((label, i) => ({
    id: `el-${i}`,
    columnIndex: i,
    label,
    x: PAGE_WIDTH / 2,
    y: PAGE_HEIGHT / 2 + i * DEFAULT_FONT_SIZE,
    fontSize: null,
  }));
}

export function updateElement(elements, id, patch) {
  return elements.map(el => el.id === id ? { ...el, ...patch } : el);
}

export function parseCertCsv(parsedRows) {
  const [headerRow, ...dataRows] = parsedRows ?? [];
  if (!dataRows || dataRows.length === 0) {
    return { error: "CSV has no data rows." };
  }
  const headers = (headerRow ?? []).map((cell, i) =>
    (cell ?? "").toString().trim() || `Field ${i + 1}`
  );
  return {
    headers,
    rows: dataRows,
    elements: buildDefaultElements(headers),
  };
}
