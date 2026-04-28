import { migrateLoadedSettings } from "./persistence";

describe("migrateLoadedSettings", () => {
  it("returns null when input is null", () => {
    expect(migrateLoadedSettings(null)).toBeNull();
  });

  it("returns null when input is undefined", () => {
    expect(migrateLoadedSettings(undefined)).toBeNull();
  });

  it("passes through new shape", () => {
    const out = migrateLoadedSettings({
      globalFontSize: 80,
      outputType: "png",
      separate: true,
    });
    expect(out).toEqual({ globalFontSize: 80, outputType: "png", separate: true });
  });

  it("lifts numberInputs.fontSize → globalFontSize for old shape", () => {
    const out = migrateLoadedSettings({
      numberInputs: { fontSize: 90, textX: 1, textY: 2, orgTextX: 3, orgTextY: 4 },
      outputType: "pdf",
      separate: false,
    });
    expect(out.globalFontSize).toBe(90);
    expect(out.outputType).toBe("pdf");
    expect(out.separate).toBe(false);
    expect(out.numberInputs).toBeUndefined();
  });

  it("ignores old position fields entirely", () => {
    const out = migrateLoadedSettings({
      numberInputs: { textX: 1, textY: 2 },
    });
    expect(out.globalFontSize).toBeUndefined();
  });

  it("prefers new globalFontSize over old numberInputs.fontSize", () => {
    const out = migrateLoadedSettings({
      globalFontSize: 100,
      numberInputs: { fontSize: 50 },
    });
    expect(out.globalFontSize).toBe(100);
  });

  it("preserves boolean false for separate", () => {
    const out = migrateLoadedSettings({ separate: false });
    expect(out.separate).toBe(false);
  });
});
