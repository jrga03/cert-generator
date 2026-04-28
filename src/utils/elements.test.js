import { buildDefaultElements, updateElement } from "./elements";
import { PAGE_WIDTH, PAGE_HEIGHT } from "./page-size";

const DEFAULT_FONT_SIZE = 75;

describe("buildDefaultElements", () => {
  it("returns empty array for empty headers", () => {
    expect(buildDefaultElements([])).toEqual([]);
  });

  it("creates one element per header in order", () => {
    const els = buildDefaultElements(["Name", "Org", "Date"]);
    expect(els).toHaveLength(3);
    expect(els.map(e => e.label)).toEqual(["Name", "Org", "Date"]);
    expect(els.map(e => e.columnIndex)).toEqual([0, 1, 2]);
    expect(els.map(e => e.id)).toEqual(["el-0", "el-1", "el-2"]);
  });

  it("stacks elements vertically: first at center, each next + line height", () => {
    const els = buildDefaultElements(["A", "B", "C"]);
    expect(els[0].x).toBe(PAGE_WIDTH / 2);
    expect(els[0].y).toBe(PAGE_HEIGHT / 2);
    expect(els[1].y).toBe(PAGE_HEIGHT / 2 + DEFAULT_FONT_SIZE);
    expect(els[2].y).toBe(PAGE_HEIGHT / 2 + 2 * DEFAULT_FONT_SIZE);
    expect(els.every(e => e.x === PAGE_WIDTH / 2)).toBe(true);
  });

  it("initializes fontSize to null (inherit global)", () => {
    const [el] = buildDefaultElements(["Name"]);
    expect(el.fontSize).toBeNull();
  });
});

describe("updateElement", () => {
  const elements = [
    { id: "el-0", columnIndex: 0, label: "Name", x: 10, y: 20, fontSize: null },
    { id: "el-1", columnIndex: 1, label: "Org",  x: 30, y: 40, fontSize: 60   },
  ];

  it("patches matching element only", () => {
    const next = updateElement(elements, "el-0", { x: 100, y: 200 });
    expect(next[0]).toEqual({ ...elements[0], x: 100, y: 200 });
    expect(next[1]).toBe(elements[1]); // referential equality on untouched
  });

  it("returns a new array", () => {
    const next = updateElement(elements, "el-0", { x: 100 });
    expect(next).not.toBe(elements);
  });

  it("is a no-op when id is missing", () => {
    const next = updateElement(elements, "el-99", { x: 100 });
    expect(next).toEqual(elements);
  });

  it("can clear fontSize back to null", () => {
    const next = updateElement(elements, "el-1", { fontSize: null });
    expect(next[1].fontSize).toBeNull();
  });
});
