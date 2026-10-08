import type { Texture } from "three";
import { t as tr } from "../i18n";

export type Channel = "rgba" | "rgb" | "r" | "g" | "b" | "a";

/** Reads the pixels of textures that have no drawable image (e.g. compressed DDS) through the GPU. */
export type GpuReader = (texture: Texture, width: number, height: number) => ImageData | null;

type Drawable = HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas;
interface DataImage {
  data?: ArrayLike<number>;
  width?: number;
  height?: number;
}

export function textureSize(t: Texture): { width: number; height: number } {
  const img = t.image as DataImage & { naturalWidth?: number; naturalHeight?: number };
  return {
    width: img?.naturalWidth || img?.width || 0,
    height: img?.naturalHeight || img?.height || 0,
  };
}

function isDrawable(img: unknown): img is Drawable {
  return (
    (typeof HTMLImageElement !== "undefined" && img instanceof HTMLImageElement) ||
    (typeof HTMLCanvasElement !== "undefined" && img instanceof HTMLCanvasElement) ||
    (typeof ImageBitmap !== "undefined" && img instanceof ImageBitmap) ||
    (typeof OffscreenCanvas !== "undefined" && img instanceof OffscreenCanvas)
  );
}

/** Draws a texture into a canvas, downscaled so the longest side is at most `maxSize`. */
export function textureToCanvas(t: Texture, maxSize = Infinity, gpu?: GpuReader): HTMLCanvasElement | null {
  const { width, height } = textureSize(t);
  if (!width || !height) return null;
  const scale = Math.min(1, maxSize / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  // Full-size canvases get read back for channel isolation / PNG export.
  const ctx = canvas.getContext("2d", { willReadFrequently: scale === 1 })!;
  const img = t.image as unknown;

  if (isDrawable(img)) {
    ctx.drawImage(img, 0, 0, w, h);
    return canvas;
  }

  let pixels: ImageData | null = null;
  const data = (img as DataImage).data;
  if (data && (data instanceof Uint8Array || data instanceof Uint8ClampedArray) && data.length === width * height * 4) {
    pixels = new ImageData(new Uint8ClampedArray(data), width, height);
  } else if (gpu) {
    pixels = gpu(t, width, height);
  }
  if (!pixels) return null;

  if (scale === 1) {
    ctx.putImageData(pixels, 0, 0);
  } else {
    const full = document.createElement("canvas");
    full.width = width;
    full.height = height;
    full.getContext("2d")!.putImageData(pixels, 0, 0);
    ctx.drawImage(full, 0, 0, w, h);
  }
  return canvas;
}

/** Returns a copy of `src` showing a single channel as grayscale (or RGB without alpha). */
export function isolateChannel(src: HTMLCanvasElement, channel: Channel): HTMLCanvasElement {
  if (channel === "rgba") return src;
  const out = document.createElement("canvas");
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext("2d")!;
  const img = src.getContext("2d")!.getImageData(0, 0, src.width, src.height);
  const d = img.data;
  const idx = { r: 0, g: 1, b: 2, a: 3 } as const;
  for (let i = 0; i < d.length; i += 4) {
    if (channel === "rgb") {
      d[i + 3] = 255;
    } else {
      const v = d[i + idx[channel]];
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

export function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error(tr("error.pngEncode")));
      blob.arrayBuffer().then((b) => resolve(new Uint8Array(b)), reject);
    }, "image/png"),
  );
}

const thumbCache = new WeakMap<Texture, string>();

/** Small cached data-URL preview for the texture grid. */
export function thumbnailUrl(t: Texture, gpu?: GpuReader): string | null {
  const cached = thumbCache.get(t);
  if (cached) return cached;
  const canvas = textureToCanvas(t, 192, gpu);
  if (!canvas) return null;
  const url = canvas.toDataURL("image/png");
  thumbCache.set(t, url);
  return url;
}
