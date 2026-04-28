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
