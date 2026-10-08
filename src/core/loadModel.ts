import {
  AnimationClip,
  LoadingManager,
  Material,
  Mesh,
  Object3D,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { TGALoader } from "three/addons/loaders/TGALoader.js";
import { DDSLoader } from "three/addons/loaders/DDSLoader.js";
import {
  listTextureCandidates,
  modelDir,
  readBinary,
  readSiblingText,
  type ModelSource,
} from "../lib/platform";
import { basename, stem } from "./paths";
import { TextureResolver, normalizeRef, type TextureCandidate } from "./textureResolver";
import { TEXTURE_SLOTS, texturesOf, type SlotKey } from "./collectTextures";
import { t } from "../i18n";

export interface LoadedModel {
  root: Object3D;
  clips: AnimationClip[];
  fileSize: number;
  /** Texture references that could not be found on disk. */
  missing: string[];
  /** Where a texture came from: a file we can copy, or embedded data (export as PNG). */
  sourceOf(texture: Texture): TextureCandidate | null;
  /** Releases blob URLs created for this model (web mode). */
  release(): void;
}

const PASSTHROUGH = /^(blob:|data:|https?:\/\/asset\.localhost\/|asset:)/i;

/** TGA/DDS come back as DataTexture without an `<img>`; remember which reference produced them. */
class TrackedTGALoader extends TGALoader {
  override load(...args: Parameters<TGALoader["load"]>) {
    const t = super.load(...args);
    t.userData.sourceRef = args[0];
    return t;
  }
}
class TrackedDDSLoader extends DDSLoader {
  override load(...args: Parameters<DDSLoader["load"]>) {
    const t = super.load(...args);
    t.userData.sourceRef = args[0];
    return t;
  }
}

const TEXTURE_TIMEOUT_MS = 60_000;

export async function loadModel(src: ModelSource, onProgress: (p: number) => void): Promise<LoadedModel> {
  const candidates = await listTextureCandidates(src);
  const resolver = new TextureResolver(modelDir(src), candidates);

  const byRef = new Map<string, TextureCandidate>();
  const byUrl = new Map<string, TextureCandidate>();
  const missing = new Set<string>();

  const manager = new LoadingManager();
  manager.setURLModifier((url) => {
    if (PASSTHROUGH.test(url)) return url;
    const hit = resolver.resolve(url);
    if (hit) {
      byRef.set(url, hit);
      byUrl.set(hit.url, hit);
      return hit.url;
    }
    missing.add(basename(normalizeRef(url)));
    return url;
  });
  manager.addHandler(/\.tga$/i, new TrackedTGALoader(manager));
  manager.addHandler(/\.dds$/i, new TrackedDDSLoader(manager));

  // Texture loads start while parsing; collect a promise that settles once they all finish.
  let started = false;
  const texturesDone = new Promise<void>((resolve) => {
    manager.onStart = () => (started = true);
    manager.onLoad = () => resolve();
    manager.onProgress = (_url, loaded, total) => onProgress(0.6 + 0.4 * (loaded / total));
    manager.onError = (url) => console.warn("Texture failed to load:", url);
  });

  onProgress(0.02);
  const buffer = await readBinary(src, (p) => onProgress(0.02 + p * 0.4));
  onProgress(0.45);
  // Let the progress bar paint before the (synchronous) parse blocks the thread.
  await new Promise((r) => setTimeout(r, 16));
  const { root, clips } = await parse(src, buffer, manager);
  onProgress(0.6);
  // A stuck texture request must not keep the tab loading forever.
  if (started) await Promise.race([texturesDone, new Promise((r) => setTimeout(r, TEXTURE_TIMEOUT_MS))]);

  stripBrokenTextures(root);
  onProgress(1);

  return {
    root,
    clips,
    fileSize: buffer.byteLength,
    missing: [...missing].sort(),
    sourceOf(texture) {
      const ref = texture.userData.sourceRef as string | undefined;
      if (ref && byRef.has(ref)) return byRef.get(ref)!;
      const src = (texture.image as { src?: string } | undefined)?.src;
      return src ? (byUrl.get(src) ?? null) : null;
    },
    release() {
      for (const c of candidates) if (c.url.startsWith("blob:")) URL.revokeObjectURL(c.url);
    },
  };
}

async function parse(
  src: ModelSource,
  buffer: ArrayBuffer,
  manager: LoadingManager,
): Promise<{ root: Object3D; clips: AnimationClip[] }> {
  switch (src.format) {
    case "fbx": {
      const root = new FBXLoader(manager).parse(buffer, "");
      return { root, clips: root.animations };
    }
    case "dae": {
      const text = new TextDecoder().decode(buffer);
      const collada = new ColladaLoader(manager).parse(text, "");
      if (!collada) throw new Error(t("error.invalidCollada"));
      const root = collada.scene as Object3D;
      return { root, clips: root.animations ?? [] };
    }
    case "obj": {
      const text = new TextDecoder().decode(buffer);
      const loader = new OBJLoader(manager);
      const mtlText = await findMtl(src, text);
      if (mtlText) {
        const materials = new MTLLoader(manager).parse(mtlText, "");
        materials.preload();
        loader.setMaterials(materials);
        const root = loader.parse(text);
        applyExtraMtlMaps(root, mtlText, manager);
        return { root, clips: [] };
      }
      return { root: loader.parse(text), clips: [] };
    }
  }
}

async function findMtl(src: ModelSource, objText: string): Promise<string | null> {
  const names = [...objText.matchAll(/^\s*mtllib\s+(.+?)\s*$/gm)].map((m) => m[1]);
  names.push(`${stem(src.name)}.mtl`);
  for (const name of names) {
    const text = await readSiblingText(src, name);
    if (text) return text;
  }
  return null;
}

/** MTLLoader ignores PBR/AO maps; pick them up so they show in the texture panel (and AO renders). */
function applyExtraMtlMaps(root: Object3D, mtlText: string, manager: LoadingManager) {
  const extra = new Map<string, Partial<Record<SlotKey, string>>>();
  let current = "";
  for (const raw of mtlText.split(/\r?\n/)) {
    const line = raw.trim();
    const [kw] = line.split(/\s+/, 1);
    const lower = kw?.toLowerCase();
    if (lower === "newmtl") current = line.slice(kw.length).trim();
    const slot: SlotKey | undefined =
      lower === "map_ao" ? "aoMap" : lower === "map_pr" ? "roughnessMap" : lower === "map_pm" ? "metalnessMap" : undefined;
    if (!slot || !current) continue;
    // Drop texture options such as `-bm 1.0` and keep the file name.
    const file = line.slice(kw.length).trim().replace(/^(-\w+(\s+-?[\d.]+)*\s+)*/, "");
    if (file) extra.set(current, { ...extra.get(current), [slot]: file });
  }
  if (extra.size === 0) return;

  const loader = new TextureLoader(manager);
  const cache = new Map<string, Texture>();
  const load = (file: string) => {
    let t = cache.get(file);
    if (!t) {
      const handler = manager.getHandler(file) as TextureLoader | null;
      t = (handler ?? loader).load(file);
      cache.set(file, t);
    }
    return t;
  };

  forEachMaterial(root, (m) => {
    const maps = extra.get(m.name);
    if (!maps) return;
    for (const [slot, file] of Object.entries(maps) as [SlotKey, string][]) {
      const tex = load(file);
      if (slot === "aoMap" && "aoMap" in m) {
        (m as Material & { aoMap: Texture | null }).aoMap = tex;
        m.needsUpdate = true;
      } else {
        m.userData.extraTextures = { ...m.userData.extraTextures, [slot]: tex };
      }
    }
  });
}

/** A texture whose file was missing or failed to decode would render black — remove it from the material. */
function stripBrokenTextures(root: Object3D) {
  forEachMaterial(root, (m) => {
    const slots = m as unknown as Record<string, unknown>;
    for (const [slot, tex] of texturesOf(m)) {
      if (isUsable(tex)) {
        if (slot === "map" || slot === "emissiveMap") tex.colorSpace = SRGBColorSpace;
        continue;
      }
      if (TEXTURE_SLOTS.some((s) => s.key === slot) && slots[slot] === tex) slots[slot] = null;
      if (m.userData.extraTextures?.[slot] === tex) delete m.userData.extraTextures[slot];
      m.needsUpdate = true;
    }
  });
}

function isUsable(t: Texture): boolean {
  const img = t.image as { width?: number; height?: number; data?: unknown } | undefined;
  if (!img) return (t as Texture & { mipmaps?: unknown[] }).mipmaps?.length ? true : false;
  return (img.width ?? 0) > 0 && (img.height ?? 0) > 0;
}

export function forEachMaterial(root: Object3D, fn: (m: Material, mesh: Mesh) => void) {
  const seen = new Set<Material>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const m of list) {
      if (m && !seen.has(m)) {
        seen.add(m);
        fn(m, mesh);
      }
    }
  });
}
