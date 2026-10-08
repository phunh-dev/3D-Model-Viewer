/**
 * All user-facing text lives in `src/locales/<language>.json` and is looked up by id.
 * Placeholders use `{name}`; plural forms are separate ids ending in `.one` / `.other`.
 */
import { useSyncExternalStore } from "react";
import en from "../locales/en.json";
import vi from "../locales/vi.json";
import { Signal } from "../core/signal";

export const LANGUAGES = ["en", "vi"] as const;
export type Language = (typeof LANGUAGES)[number];

/** Every valid text id, checked at compile time against en.json. */
export type TextId = keyof typeof en;
/** Ids that have `.one` / `.other` variants, used with `tn()`. */
export type PluralId = TextId extends infer K ? (K extends `${infer Base}.one` ? Base : never) : never;
export type Params = Record<string, string | number>;

const dictionaries: Record<Language, Record<string, string>> = { en, vi };
const changed = new Signal();
let current: Language = "en";

export function detectLanguage(): Language {
  const lang = typeof navigator !== "undefined" ? navigator.language.toLowerCase() : "";
  return lang.startsWith("vi") ? "vi" : "en";
}

export function setLanguage(lang: Language): void {
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  if (lang === current) return;
  current = lang;
  changed.emit();
}

export function getLanguage(): Language {
  return current;
}

/** Splits a template into literal text and `{placeholder}` names. */
export function parseTemplate(text: string): { text?: string; param?: string }[] {
  return text.split(/(\{\w+\})/).filter(Boolean).map((part) => {
    const m = /^\{(\w+)\}$/.exec(part);
    return m ? { param: m[1] } : { text: part };
  });
}

/** Text for `id` in the current language (falls back to English, then to the id itself). */
export function t(id: TextId, params?: Params): string {
  const text = dictionaries[current][id] ?? en[id] ?? id;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole));
}

/** Plural-aware lookup: picks `<id>.one` for 1 and `<id>.other` otherwise; `{count}` is filled in. */
export function tn(id: PluralId, count: number, params?: Params): string {
  return t(`${id}.${count === 1 ? "one" : "other"}` as TextId, { count, ...params });
}

/** Re-renders the calling component when the language changes. */
export function useLanguage(): Language {
  return useSyncExternalStore(changed.subscribe, getLanguage);
}
