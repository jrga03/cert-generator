const KEY = "cert-generator:settings";
const VERSION = 1;

export function loadSettings() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== VERSION) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function saveSettings(data) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ version: VERSION, data })
    );
  } catch {
    // quota errors etc — ignore
  }
}

export function migrateLoadedSettings(saved) {
  if (saved == null) return null;
  const out = {};
  if (typeof saved.globalFontSize === "number") {
    out.globalFontSize = saved.globalFontSize;
  } else if (typeof saved.numberInputs?.fontSize === "number") {
    out.globalFontSize = saved.numberInputs.fontSize;
  }
  if (saved.outputType) out.outputType = saved.outputType;
  if (typeof saved.separate === "boolean") out.separate = saved.separate;
  return out;
}
