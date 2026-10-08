import type { Material, Texture } from "three";

export type SlotKey =
  | "map"
  | "normalMap"
  | "bumpMap"
  | "displacementMap"
  | "aoMap"
  | "roughnessMap"
  | "metalnessMap"
  | "specularMap"
  | "emissiveMap"
  | "alphaMap"
  | "lightMap";

export interface SlotInfo {
  key: SlotKey;
  /** Used in exported file names; the on-screen name comes from the `slot.<key>` text id. */
  fileTag: string;
  /** Tailwind-compatible color used for the slot badge. */
  color: string;
}

export const TEXTURE_SLOTS: SlotInfo[] = [
  { key: "map", fileTag: "Albedo", color: "#60a5fa" },
  { key: "normalMap", fileTag: "Normal", color: "#a78bfa" },
  { key: "displacementMap", fileTag: "Displacement", color: "#f472b6" },
  { key: "aoMap", fileTag: "AO", color: "#94a3b8" },
  { key: "roughnessMap", fileTag: "Roughness", color: "#34d399" },
  { key: "metalnessMap", fileTag: "Metalness", color: "#fbbf24" },
  { key: "specularMap", fileTag: "Specular", color: "#2dd4bf" },
  { key: "emissiveMap", fileTag: "Emissive", color: "#fb923c" },
  { key: "alphaMap", fileTag: "Alpha", color: "#e5e7eb" },
  { key: "bumpMap", fileTag: "Bump", color: "#c084fc" },
  { key: "lightMap", fileTag: "Lightmap", color: "#facc15" },
];

export const SLOT_BY_KEY = Object.fromEntries(TEXTURE_SLOTS.map((s) => [s.key, s])) as Record<SlotKey, SlotInfo>;

export interface TextureEntry {
  id: string;
  texture: Texture;
  slots: SlotKey[];
  materials: string[];
}

/**
 * Textures that a loader parsed but three.js materials have no slot for
 * (e.g. OBJ `map_Pr` on a Phong material) are stored in `material.userData.extraTextures`.
 */
export function texturesOf(material: Material): [SlotKey, Texture][] {
  const out: [SlotKey, Texture][] = [];
  const m = material as unknown as Record<string, unknown>;
  for (const { key } of TEXTURE_SLOTS) {
    const t = m[key] as Texture | null | undefined;
    if (t && (t as Texture).isTexture) out.push([key, t]);
  }
  const extra = material.userData?.extraTextures as Partial<Record<SlotKey, Texture>> | undefined;
  if (extra) {
    for (const [k, t] of Object.entries(extra)) {
      if (t?.isTexture && !out.some(([, existing]) => existing === t)) out.push([k as SlotKey, t]);
    }
  }
  return out;
}

/**
 * Collects unique textures across materials, remembering every slot and material using them.
 * `keyOf` decides what "the same texture" means — by default the texture object, but loaders
 * often create one Texture per material for the same file, so the session passes the file path.
 */
export function collectTextures(
  materials: Iterable<Material>,
  keyOf: (t: Texture) => string = (t) => t.uuid,
): TextureEntry[] {
  const byId = new Map<string, TextureEntry>();
  const seenMaterials = new Set<Material>();

  for (const material of materials) {
    if (seenMaterials.has(material)) continue;
    seenMaterials.add(material);
    for (const [slot, texture] of texturesOf(material)) {
      const key = keyOf(texture);
      let entry = byId.get(key);
      if (!entry) {
        entry = { id: key, texture, slots: [], materials: [] };
        byId.set(key, entry);
      }
      if (!entry.slots.includes(slot)) entry.slots.push(slot);
      const name = material.name || "(unnamed)";
      if (!entry.materials.includes(name)) entry.materials.push(name);
    }
  }

  const order = (e: TextureEntry) => Math.min(...e.slots.map((s) => TEXTURE_SLOTS.findIndex((x) => x.key === s)));
  return [...byId.values()].sort((a, b) => order(a) - order(b));
}

/** How many textures fill each slot type — used for the "which maps does this model have" chips. */
export function slotSummary(entries: TextureEntry[]): Record<SlotKey, number> {
  const summary = Object.fromEntries(TEXTURE_SLOTS.map((s) => [s.key, 0])) as Record<SlotKey, number>;
  for (const e of entries) for (const s of e.slots) summary[s]++;
  return summary;
}
