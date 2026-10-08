import { basename, extname, isAbsolute, joinPath, stem, toSlashes } from "./paths";

/** An image file the model may reference. `path` is absolute (desktop) or a file name (web). */
export interface TextureCandidate {
  path: string;
  url: string;
  /** Only in web mode: the dropped file itself, used for "export original". */
  file?: File;
}

const LOADABLE = new Set(["png", "jpg", "jpeg", "tga", "dds", "bmp", "gif", "webp"]);

/** Turns whatever a model file stores (`file:///C:/x%20y.png`, `..\tex\a.tga`) into a clean path. */
export function normalizeRef(ref: string): string {
  let s = ref.trim().replace(/^file:\/\/\/?/i, "");
  try {
    s = decodeURIComponent(s);
  } catch {
    // not URI-encoded, keep as is
  }
  s = toSlashes(s);
  // `file:///C:/...` leaves `C:/...`; `file:///home/...` leaves `home/...` which we can't tell apart
  // from a relative path, but basename matching below still finds it.
  return s.replace(/^\.\//, "");
}

const key = (p: string) => toSlashes(p).toLowerCase();

/**
 * Finds the actual file for a texture reference. Order:
 * 1. exact absolute path  2. path relative to the model  3. same file name anywhere in the
 * scanned folders (closest match wins)  4. same name with another, loadable extension
 * (e.g. the model references `.psd` but a `.png` sits next to it).
 */
export class TextureResolver {
  private byPath = new Map<string, TextureCandidate>();
  private byName = new Map<string, TextureCandidate[]>();
  private byStem = new Map<string, TextureCandidate[]>();

  constructor(
    private modelDir: string,
    candidates: TextureCandidate[],
  ) {
    for (const c of candidates) {
      this.byPath.set(key(c.path), c);
      push(this.byName, basename(c.path).toLowerCase(), c);
      push(this.byStem, stem(c.path).toLowerCase(), c);
    }
  }

  resolve(ref: string): TextureCandidate | null {
    const clean = normalizeRef(ref);
    if (!clean) return null;

    if (isAbsolute(clean)) {
      const hit = this.byPath.get(key(clean));
      if (hit) return hit;
    }
    const relative = this.byPath.get(key(joinPath(this.modelDir, clean)));
    if (relative) return relative;

    const sameName = this.byName.get(basename(clean).toLowerCase());
    if (sameName?.length) return this.closest(clean, sameName);

    const sameStem = this.byStem.get(stem(clean).toLowerCase())?.filter((c) => LOADABLE.has(extname(c.path)));
    if (sameStem?.length) return this.closest(clean, sameStem);

    return null;
  }

  /** Prefer the candidate sharing the most trailing folders with the reference, then the shortest path. */
  private closest(ref: string, list: TextureCandidate[]): TextureCandidate {
    const refSegs = key(ref).split("/").reverse();
    let best = list[0];
    let bestScore = -1;
    for (const c of list) {
      const segs = key(c.path).split("/").reverse();
      let shared = 0;
      while (shared < refSegs.length && shared < segs.length && refSegs[shared] === segs[shared]) shared++;
      const score = shared * 1000 - c.path.length;
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best;
  }
}

function push<K, V>(map: Map<K, V[]>, k: K, v: V) {
  const list = map.get(k);
  if (list) list.push(v);
  else map.set(k, [v]);
}
