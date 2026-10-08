import type { DisplayMode } from "../core/ViewerSession";
import { detectLanguage, type Language } from "../i18n";
import { isTauri } from "./platform";

export type Theme = "dark" | "light";

export interface Prefs {
  language: Language;
  theme: Theme;
  defaultMode: DisplayMode;
  grid: boolean;
  inspectorOpen: boolean;
  inspectorWidth: number;
  recent: string[];
}

export const DEFAULT_PREFS: Prefs = {
  language: detectLanguage(),
  theme: "dark",
  defaultMode: "textured",
  grid: true,
  inspectorOpen: true,
  inspectorWidth: 320,
  recent: [],
};

const KEY = "prefs";

/** Persists UI preferences: Tauri store on desktop, localStorage in a plain browser. */
export async function loadPrefs(): Promise<Prefs> {
  try {
    if (isTauri) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: 300, defaults: {} });
      return { ...DEFAULT_PREFS, ...((await store.get<Partial<Prefs>>(KEY)) ?? {}) };
    }
    const raw = localStorage.getItem(KEY);
    return { ...DEFAULT_PREFS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
  } catch (err) {
    console.warn("Could not load preferences", err);
    return DEFAULT_PREFS;
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  try {
    if (isTauri) {
      const { load } = await import("@tauri-apps/plugin-store");
      const store = await load("settings.json", { autoSave: 300, defaults: {} });
      await store.set(KEY, prefs);
      return;
    }
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch (err) {
    console.warn("Could not save preferences", err);
  }
}
