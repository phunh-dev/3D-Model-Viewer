import { canvasToPng, textureToCanvas } from "./textureImage";
import { SLOT_BY_KEY, type TextureEntry } from "./collectTextures";
import { extname, joinPath, safeFileName, stem } from "./paths";
import { getRenderManager } from "./RenderManager";
import type { ViewerSession } from "./ViewerSession";
import { copyOriginal, pickDirectory, pickSavePath, writeBytes } from "../lib/platform";
import { t } from "../i18n";

/** `hero_Albedo_hero_diffuse.png` — model, slot and the texture's own name. */
export function exportName(session: ViewerSession, entry: TextureEntry): { base: string; ext: string } {
  const source = session.textureSource(entry);
  const texName = source ? stem(source.path) : entry.texture.name || "embedded";
  // File names stay in English regardless of the UI language.
  const slot = SLOT_BY_KEY[entry.slots[0]]?.fileTag ?? "Texture";
  return {
    base: safeFileName(`${stem(session.source.name)}_${slot}_${texName}`),
    ext: source ? extname(source.path) || "png" : "png",
  };
}

async function writeEntry(session: ViewerSession, entry: TextureEntry, path: string) {
  const source = session.textureSource(entry);
  if (source) return copyOriginal(source, path);
  const canvas = textureToCanvas(entry.texture, Infinity, getRenderManager().readTexturePixels);
  if (!canvas) throw new Error(t("error.noImageData"));
  await writeBytes(path, await canvasToPng(canvas));
}

/** Asks where to save and exports one texture. Returns the saved path, or null if cancelled. */
export async function exportTexture(session: ViewerSession, entry: TextureEntry): Promise<string | null> {
  const { base, ext } = exportName(session, entry);
  const path = await pickSavePath(`${base}.${ext}`, ext);
  if (!path) return null;
  await writeEntry(session, entry, path);
  return path;
}

/** Exports every texture of the model into a chosen folder. */
export async function exportAllTextures(
  session: ViewerSession,
): Promise<{ dir: string; count: number; failed: string[] } | null> {
  const dir = await pickDirectory();
  if (dir === null) return null;
  const used = new Set<string>();
  const failed: string[] = [];
  let count = 0;
  for (const entry of session.state.textures) {
    const { base, ext } = exportName(session, entry);
    let name = `${base}.${ext}`;
    for (let i = 2; used.has(name.toLowerCase()); i++) name = `${base}_${i}.${ext}`;
    used.add(name.toLowerCase());
    try {
      await writeEntry(session, entry, dir ? joinPath(dir, name) : name);
      count++;
    } catch (err) {
      console.warn(err);
      failed.push(name);
    }
  }
  return { dir, count, failed };
}
