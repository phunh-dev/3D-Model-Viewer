import { useEffect, useState } from "react";
import { Download, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { SLOT_BY_KEY, type TextureEntry } from "../core/collectTextures";
import { exportName, exportTexture } from "../core/exportTexture";
import { getRenderManager } from "../core/RenderManager";
import { textureSize, thumbnailUrl } from "../core/textureImage";
import type { ViewerSession } from "../core/ViewerSession";
import { revealInFolder } from "../lib/platform";
import { SlotBadge } from "./ui";
import { t, useLanguage } from "../i18n";

export async function exportWithToast(session: ViewerSession, entry: TextureEntry) {
  try {
    const path = await exportTexture(session, entry);
    if (path) {
      toast.success(t("toast.exported"), {
        description: path,
        action: { label: t("common.openFolder"), onClick: () => void revealInFolder(path) },
      });
    }
  } catch (err) {
    toast.error(t("toast.exportFailed"), { description: String(err) });
  }
}

export function TextureCard({ session, entry, onOpen }: { session: ViewerSession; entry: TextureEntry; onOpen: () => void }) {
  useLanguage();
  const [thumb, setThumb] = useState<string | null | undefined>(undefined);
  const { width, height } = textureSize(entry.texture);
  const { base, ext } = exportName(session, entry);
  const source = session.textureSource(entry);
  const name = source ? source.path.split("/").pop()! : entry.texture.name || t("common.embeddedTexture");

  // Thumbnails are generated after paint so a model with many textures doesn't block the UI.
  useEffect(() => {
    const timer = setTimeout(() => setThumb(thumbnailUrl(entry.texture, getRenderManager().readTexturePixels)), 0);
    return () => clearTimeout(timer);
  }, [entry]);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-line bg-panel-2 transition-colors hover:border-accent/60">
      <button type="button" onClick={onOpen} className="block w-full text-left" title={t("texture.openLarge", { name })}>
        <div className="checker relative flex aspect-square items-center justify-center overflow-hidden">
          {thumb ? (
            <img src={thumb} alt={name} className="h-full w-full object-contain" draggable={false} />
          ) : thumb === null ? (
            <ImageOff size={22} className="text-subtle" />
          ) : (
            <div className="h-full w-full animate-pulse bg-hover" />
          )}
          <div className="absolute left-1.5 top-1.5 flex flex-wrap gap-1">
            {entry.slots.map((s) => (
              <span key={s} className="rounded bg-black/55 backdrop-blur-sm">
                <SlotBadge label={t(`slot.${s}`)} color={SLOT_BY_KEY[s].color} />
              </span>
            ))}
          </div>
        </div>
        <div className="px-2 py-1.5">
          <div className="truncate text-[12px] font-medium">{name}</div>
          <div className="text-[10.5px] tabular-nums text-subtle">
            {width && height ? `${width}×${height}` : "—"} · {source ? ext.toUpperCase() : t("common.embedded")}
          </div>
        </div>
      </button>
      <button
        type="button"
        aria-label={t("texture.exportNamed", { name: `${base}.${ext}` })}
        title={t("texture.export")}
        onClick={() => void exportWithToast(session, entry)}
        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition hover:bg-accent group-hover:opacity-100 focus-visible:opacity-100"
      >
        <Download size={14} />
      </button>
    </div>
  );
}
