import * as Dialog from "@radix-ui/react-dialog";
import * as ToggleGroup from "@radix-ui/react-toggle-group";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { Download, ImageOff, X } from "lucide-react";
import { SLOT_BY_KEY, type TextureEntry } from "../core/collectTextures";
import { getRenderManager } from "../core/RenderManager";
import { isolateChannel, textureSize, textureToCanvas, type Channel } from "../core/textureImage";
import type { ViewerSession } from "../core/ViewerSession";
import { exportWithToast } from "./TextureCard";
import { Button, SlotBadge } from "./ui";
import { t, useLanguage, type TextId } from "../i18n";

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "rgba", label: "RGBA" },
  { value: "rgb", label: "RGB" },
  { value: "r", label: "R" },
  { value: "g", label: "G" },
  { value: "b", label: "B" },
  { value: "a", label: "A" },
];

export function TexturePreviewDialog({
  session,
  entry,
  onClose,
}: {
  session: ViewerSession;
  entry: TextureEntry | null;
  onClose: () => void;
}) {
  return (
    <Dialog.Root open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="animate-fade-in fixed left-1/2 top-1/2 z-50 flex h-[min(86vh,900px)] w-[min(92vw,1280px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-line bg-panel shadow-float"
        >
          {entry && <PreviewBody session={session} entry={entry} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PreviewBody({ session, entry }: { session: ViewerSession; entry: TextureEntry }) {
  useLanguage();
  const [channel, setChannel] = useState<Channel>("rgba");
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const stage = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const { width, height } = textureSize(entry.texture);
  const source = session.textureSource(entry);
  const name = source ? source.path.split("/").pop()! : entry.texture.name || t("common.embeddedTexture");

  const full = useMemo(() => textureToCanvas(entry.texture, Infinity, getRenderManager().readTexturePixels), [entry]);
  const shown = useMemo(() => (full ? isolateChannel(full, channel) : null), [full, channel]);

  useEffect(() => {
    const el = holder.current;
    if (!el || !shown) return;
    el.replaceChildren(shown);
  }, [shown]);

  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = stage.current!;
    const ro = new ResizeObserver(() => setStageSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = width && height && stageSize.w ? Math.min((stageSize.w - 48) / width, (stageSize.h - 48) / height, 1) : 1;
  const scale = zoom === "fit" ? fit : zoom;

  return (
    <>
      <div
        ref={stage}
        className="checker relative min-w-0 flex-1 overflow-auto"
        onWheel={(e) => {
          const next = Math.min(Math.max(scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15), 0.05), 16);
          setZoom(next);
        }}
      >
        {shown ? (
          <div className="flex min-h-full min-w-full items-center justify-center p-6">
            <div
              ref={holder}
              className={clsx("shrink-0 shadow-2xl [&>canvas]:h-full [&>canvas]:w-full", scale >= 2 && "[&>canvas]:[image-rendering:pixelated]")}
              style={{ width: width * scale, height: height * scale }}
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <ImageOff size={28} />
            {t("texture.unreadable")}
          </div>
        )}
        <div className="pointer-events-none sticky bottom-3 left-3 ml-3 inline-flex">
          <span className="pointer-events-auto flex items-center gap-1 rounded-lg border border-line bg-panel/90 p-1 text-[12px] shadow-float backdrop-blur">
            <ZoomButton active={zoom === "fit"} onClick={() => setZoom("fit")}>{t("texture.fit")}</ZoomButton>
            <ZoomButton active={zoom === 1} onClick={() => setZoom(1)}>{t("texture.actualSize")}</ZoomButton>
            <span className="px-1.5 tabular-nums text-muted">{Math.round(scale * 100)}%</span>
          </span>
        </div>
      </div>

      <aside className="flex w-[280px] shrink-0 flex-col border-l border-line">
        <div className="flex items-start gap-2 border-b border-line p-4">
          <Dialog.Title className="min-w-0 flex-1 break-words text-[14px] font-semibold">{name}</Dialog.Title>
          <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg" aria-label={t("common.close")}>
            <X size={16} />
          </Dialog.Close>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4 text-[12.5px]">
          <Field label="texture.channels">
            <ToggleGroup.Root
              type="single"
              value={channel}
              onValueChange={(v) => v && setChannel(v as Channel)}
              className="grid grid-cols-6 gap-0.5 rounded-lg bg-panel-2 p-0.5"
            >
              {CHANNELS.map((c) => (
                <ToggleGroup.Item
                  key={c.value}
                  value={c.value}
                  className="h-7 rounded-md text-[11px] font-semibold text-muted hover:text-fg data-[state=on]:bg-accent data-[state=on]:text-accent-fg"
                >
                  {c.label}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup.Root>
          </Field>
          <Field label="texture.usedAs">
            <div className="flex flex-wrap gap-1">
              {entry.slots.map((s) => (
                <SlotBadge key={s} label={t(`slot.${s}`)} color={SLOT_BY_KEY[s].color} />
              ))}
            </div>
          </Field>
          <Field label="texture.size">
            <span className="tabular-nums">{width && height ? t("texture.sizeValue", { width, height }) : "—"}</span>
          </Field>
          <Field label="texture.materials">
            <ul className="space-y-0.5">
              {entry.materials.map((m) => (
                <li key={m} className="truncate">{m}</li>
              ))}
            </ul>
          </Field>
          <Field label="texture.source">
            <span className="break-all font-mono text-[11px] text-muted">{source ? source.path : t("texture.embeddedSource")}</span>
          </Field>
        </div>

        <div className="border-t border-line p-4">
          <Button variant="primary" className="w-full" onClick={() => void exportWithToast(session, entry)}>
            <Download size={14} /> {t("texture.export")}
          </Button>
        </div>
      </aside>
    </>
  );
}

function Field({ label, children }: { label: TextId; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10.5px] font-semibold uppercase tracking-wider text-subtle">{t(label)}</div>
      {children}
    </div>
  );
}

function ZoomButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx("h-6 rounded-md px-2 font-medium", active ? "bg-accent text-accent-fg" : "text-muted hover:bg-hover hover:text-fg")}
    >
      {children}
    </button>
  );
}
