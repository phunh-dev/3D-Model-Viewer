import { describe, expect, it } from "vitest";
import { TextureResolver, normalizeRef, type TextureCandidate } from "../src/core/textureResolver";
import { joinPath } from "../src/core/paths";

const c = (path: string): TextureCandidate => ({ path, url: `asset://${path}` });

describe("normalizeRef", () => {
  it("strips file:// and decodes", () => {
    expect(normalizeRef("file:///C:/My%20Tex/a.png")).toBe("C:/My Tex/a.png");
  });
  it("converts backslashes and drops ./", () => {
    expect(normalizeRef(".\\textures\\a.tga")).toBe("textures/a.tga");
  });
  it("keeps malformed URI encodings", () => {
    expect(normalizeRef("100%.png")).toBe("100%.png");
  });
});

describe("joinPath", () => {
  it("resolves ..", () => {
    expect(joinPath("C:/proj/models", "../tex/a.png")).toBe("C:/proj/tex/a.png");
    expect(joinPath("/home/u/models", "./a.png")).toBe("/home/u/models/a.png");
  });
});

describe("TextureResolver", () => {
  const candidates = [
    c("C:/proj/models/hero_albedo.png"),
    c("C:/proj/models/Textures/hero_Normal.TGA"),
    c("C:/proj/tex/shared.png"),
    c("C:/proj/models/old/shared.png"),
    c("C:/proj/models/skin.png"),
  ];
  const r = new TextureResolver("C:/proj/models", candidates);

  it("finds a file next to the model", () => {
    expect(r.resolve("hero_albedo.png")?.path).toBe("C:/proj/models/hero_albedo.png");
  });

  it("resolves relative paths with ..", () => {
    expect(r.resolve("..\\tex\\shared.png")?.path).toBe("C:/proj/tex/shared.png");
  });

  it("ignores case and finds files in a textures sub-folder", () => {
    expect(r.resolve("hero_normal.tga")?.path).toBe("C:/proj/models/Textures/hero_Normal.TGA");
  });

  it("falls back to the file name when the model stores another machine's absolute path", () => {
    expect(r.resolve("D:\\Artist\\Work\\Textures\\hero_normal.tga")?.path).toBe(
      "C:/proj/models/Textures/hero_Normal.TGA",
    );
  });

  it("prefers the candidate sharing more trailing folders", () => {
    expect(r.resolve("Z:/x/old/shared.png")?.path).toBe("C:/proj/models/old/shared.png");
  });

  it("substitutes a loadable extension when the referenced format is missing", () => {
    expect(r.resolve("skin.psd")?.path).toBe("C:/proj/models/skin.png");
  });

  it("returns null when nothing matches", () => {
    expect(r.resolve("nope.png")).toBeNull();
    expect(r.resolve("")).toBeNull();
  });

  it("works with bare file names (web mode)", () => {
    const web = new TextureResolver("", [c("Body_D.png")]);
    expect(web.resolve("C:\\Users\\a\\Body_D.png")?.path).toBe("Body_D.png");
  });
});
