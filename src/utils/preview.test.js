import { hitTest } from "./preview";

const boxes = (overrides = {}) => ({
  "el-0": { x: 0,   y: 0,   width: 100, height: 50 },
  "el-1": { x: 50,  y: 25,  width: 100, height: 50 }, // overlaps el-0
  "el-2": { x: 200, y: 200, width: 50,  height: 50 },
  scale: 1,
  ...overrides,
});

describe("hitTest", () => {
  it("returns null when boxes is null", () => {
    expect(hitTest(null, 10, 10, ["el-0"])).toBeNull();
  });

  it("returns the id of the only box hit", () => {
    expect(hitTest(boxes(), 210, 210, ["el-0", "el-1", "el-2"])).toBe("el-2");
  });

  it("returns null when point is outside all boxes", () => {
    expect(hitTest(boxes(), 500, 500, ["el-0", "el-1", "el-2"])).toBeNull();
  });

  it("prefers later id in elementIds order on overlap (later draws on top)", () => {
    // (60, 30) is inside both el-0 and el-1. el-1 drew last → wins.
    expect(hitTest(boxes(), 60, 30, ["el-0", "el-1"])).toBe("el-1");
  });

  it("respects elementIds order, not insertion order of boxes", () => {
    // Same boxes, reversed ids → el-0 wins.
    expect(hitTest(boxes(), 60, 30, ["el-1", "el-0"])).toBe("el-0");
  });

  it("ignores ids without a corresponding box", () => {
    expect(hitTest(boxes(), 10, 10, ["missing", "el-0"])).toBe("el-0");
  });
});
