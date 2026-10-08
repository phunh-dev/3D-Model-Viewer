/**
 * Everything that touches the OS goes through here. In the desktop app (Tauri) files are read
 * from disk by path; when the UI runs in a plain browser (`npm run dev` without Tauri) it falls
 * back to dropped/picked File objects so the viewer is still usable for quick UI work.
 */
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { basename, dirname, extname, joinPath } from "../core/paths";
import type { TextureCandidate } from "../core/textureResolver";
import { t } from "../i18n";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const MODEL_EXTENSIONS = ["fbx", "obj", "dae"] as const;
export type ModelFormat = (typeof MODEL_EXTENSIONS)[number];

export function isModelFile(name: string): boolean {
  return (MODEL_EXTENSIONS as readonly string[]).includes(extname(name));
}

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "tga", "dds", "bmp", "gif", "webp", "tif", "tiff"]);

export interface ModelSource {
  name: string;
  format: ModelFormat;
  /** Absolute path (desktop) — also used as the identity for recent files. */
  path?: string;
  /** Web mode only. */
  file?: File;
  /** Web mode only: the other files dropped together (textures, .mtl). */
  siblings?: File[];
}

export function sourceFromPath(path: string): ModelSource {
  return { name: basename(path), format: extname(path) as ModelFormat, path };
}

export function sourcesFromFiles(files: File[]): ModelSource[] {
  return files
    .filter((f) => isModelFile(f.name))
    .map((file) => ({ name: file.name, format: extname(file.name) as ModelFormat, file, siblings: files }));
}

// ---------------------------------------------------------------- reading

export async function readBinary(src: ModelSource, onProgress?: (p: number) => void): Promise<ArrayBuffer> {
  if (src.file) return src.file.arrayBuffer();
  const res = await fetch(convertFileSrc(src.path!));
  if (!res.ok) throw new Error(t("error.readFile", { status: res.status }));
  const total = Number(res.headers.get("content-length")) || 0;
  if (!res.body || !total || !onProgress) return res.arrayBuffer();

  const reader = res.body.getReader();
  const out = new Uint8Array(total);
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.set(value, received);
    received += value.length;
    onProgress(received / total);
  }
  return out.buffer;
}

/** Reads a file next to the model (used for `.mtl`). Returns null when it does not exist. */
export async function readSiblingText(src: ModelSource, relName: string): Promise<string | null> {
  if (src.siblings) {
    const wanted = basename(relName).toLowerCase();
    const f = src.siblings.find((s) => s.name.toLowerCase() === wanted);
    return f ? f.text() : null;
  }
  try {
    const res = await fetch(convertFileSrc(joinPath(dirname(src.path!), relName)));
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

export async function listTextureCandidates(src: ModelSource): Promise<TextureCandidate[]> {
  if (src.siblings) {
    return src.siblings
      .filter((f) => IMAGE_EXT.has(extname(f.name)))
      .map((file) => ({ path: file.name, url: URL.createObjectURL(file), file }));
  }
  const paths = await invoke<string[]>("scan_textures", { modelPath: src.path });
  return paths.map((p) => ({ path: p.replace(/\\/g, "/"), url: convertFileSrc(p) }));
}

export function modelDir(src: ModelSource): string {
  return src.path ? dirname(src.path) : "";
}

// ---------------------------------------------------------------- dialogs

export async function pickModelPaths(): Promise<string[]> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const picked = await open({
    multiple: true,
    title: t("dialog.openTitle"),
    filters: [{ name: t("dialog.filter3d"), extensions: [...MODEL_EXTENSIONS] }],
  });
  if (!picked) return [];
  return Array.isArray(picked) ? picked : [picked];
}

export async function pickSavePath(defaultName: string, ext: string): Promise<string | null> {
  if (!isTauri) return defaultName;
  const { save } = await import("@tauri-apps/plugin-dialog");
  return save({ defaultPath: defaultName, filters: [{ name: ext.toUpperCase(), extensions: [ext] }] });
}

export async function pickDirectory(): Promise<string | null> {
  if (!isTauri) return "";
  const { open } = await import("@tauri-apps/plugin-dialog");
  const dir = await open({ directory: true, title: t("dialog.exportFolder") });
  return typeof dir === "string" ? dir : null;
}

// ---------------------------------------------------------------- writing

/** Writes bytes to `path` (desktop) or downloads them as `path`'s file name (browser). */
export async function writeBytes(path: string, bytes: Uint8Array): Promise<void> {
  if (!isTauri) return download(new Blob([bytes as BlobPart]), basename(path));
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(path, bytes);
}

/** Copies an original texture file without re-encoding it. */
export async function copyOriginal(candidate: TextureCandidate, to: string): Promise<void> {
  if (candidate.file) return download(candidate.file, basename(to));
  await invoke("copy_file", { from: candidate.path, to });
}

export async function revealInFolder(path: string): Promise<void> {
  if (!isTauri) return;
  const { revealItemInDir } = await import("@tauri-apps/plugin-opener");
  await revealItemInDir(path);
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
