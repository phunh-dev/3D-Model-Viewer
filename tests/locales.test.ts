import { describe, expect, it } from "vitest";
import en from "../src/locales/en.json";
import vi from "../src/locales/vi.json";
import { parseTemplate, setLanguage, t, tn } from "../src/i18n";

const locales: Record<string, Record<string, string>> = { en, vi };
const placeholders = (s: string) =>
  parseTemplate(s)
    .flatMap((p) => (p.param ? [p.param] : []))
    .sort();

describe("locale files", () => {
  const enKeys = Object.keys(en).sort();

  for (const [lang, dict] of Object.entries(locales)) {
    it(`${lang}.json has exactly the same ids as en.json`, () => {
      const keys = Object.keys(dict).sort();
      expect(keys.filter((k) => !enKeys.includes(k)), "extra ids").toEqual([]);
      expect(enKeys.filter((k) => !keys.includes(k)), "missing ids").toEqual([]);
    });

    it(`${lang}.json has no empty texts`, () => {
      expect(Object.entries(dict).filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    });

    it(`${lang}.json keeps the same placeholders as en.json`, () => {
      const mismatched = enKeys.filter(
        (k) => dict[k] !== undefined && placeholders(dict[k]).join() !== placeholders((en as Record<string, string>)[k]).join(),
      );
      expect(mismatched).toEqual([]);
    });
  }

  it("every plural id has both .one and .other", () => {
    const bases = new Set(enKeys.filter((k) => /\.(one|other)$/.test(k)).map((k) => k.replace(/\.(one|other)$/, "")));
    for (const b of bases) {
      expect(enKeys).toContain(`${b}.one`);
      expect(enKeys).toContain(`${b}.other`);
    }
  });
});

describe("t / tn", () => {
  it("fills placeholders and switches language", () => {
    setLanguage("en");
    expect(t("tabbar.closeTab", { name: "a.fbx" })).toBe("Close a.fbx");
    expect(tn("drop.openCount", 1)).toBe("Drop to open 1 model");
    expect(tn("drop.openCount", 3)).toBe("Drop to open 3 models");
    setLanguage("vi");
    expect(t("tabbar.closeTab", { name: "a.fbx" })).toBe("Đóng a.fbx");
    setLanguage("en");
  });
});
