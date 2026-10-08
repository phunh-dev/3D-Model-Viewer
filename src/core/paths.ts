/** Path helpers that work on both Windows (`C:\a\b`) and POSIX (`/a/b`) paths. */

export function toSlashes(p: string): string {
  return p.replace(/\\/g, "/");
}

export function basename(p: string): string {
  const s = toSlashes(p).replace(/\/+$/, "");
  return s.slice(s.lastIndexOf("/") + 1);
}

export function dirname(p: string): string {
  const s = toSlashes(p);
  const i = s.lastIndexOf("/");
  return i < 0 ? "" : s.slice(0, i);
}

export function extname(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? "" : b.slice(i + 1).toLowerCase();
}

export function stem(p: string): string {
  const b = basename(p);
  const i = b.lastIndexOf(".");
  return i <= 0 ? b : b.slice(0, i);
}

export function isAbsolute(p: string): boolean {
  return /^[a-zA-Z]:\//.test(toSlashes(p)) || p.startsWith("/") || p.startsWith("\\\\");
}

/** Joins `rel` onto `dir`, resolving `.` and `..` segments. */
export function joinPath(dir: string, rel: string): string {
  if (isAbsolute(rel) || !dir) return normalizeSegments(toSlashes(rel));
  return normalizeSegments(`${toSlashes(dir).replace(/\/+$/, "")}/${toSlashes(rel)}`);
}

function normalizeSegments(p: string): string {
  const leadingSlash = p.startsWith("/");
  const out: string[] = [];
  for (const seg of p.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === ".." && out.length > 0 && out[out.length - 1] !== "..") out.pop();
    else out.push(seg);
  }
  return (leadingSlash ? "/" : "") + out.join("/");
}

/** Builds an export file name that is safe on every OS. */
export function safeFileName(name: string): string {
  return name.replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "_").replace(/\s+/g, "_").slice(0, 120) || "texture";
}
