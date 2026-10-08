import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Download, Film, Info, Layers, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import type { ViewerSession } from "../core/ViewerSession";
import { TEXTURE_SLOTS, slotSummary, type TextureEntry } from "../core/collectTextures";
import { exportAllTextures } from "../core/exportTexture";
import { useActiveSession, useAnimationState, useSessionState } from "../hooks/useSession";
import { formatBytes, formatCount, formatTime } from "../lib/format";
import { revealInFolder } from "../lib/platform";
import { useApp } from "../store/appStore";
import { TextureCard } from "./TextureCard";
import { TexturePreviewDialog } from "./TexturePreviewDialog";
import { Button, SlotBadge } from "./ui";
import { t, tn, useLanguage, type TextId } from "../i18n";

export function Inspector() {
  useLanguage();
  const width = useApp((s) => s.inspectorWidth);
  const session = useActiveSession();
  const status = useSessionState(session, (s) => s.status);

  return (
    <aside className="relative flex shrink-0 flex-col border-l border-line bg-panel" style={{ width }}>
      <ResizeHandle />
      {session && status === "ready" ? (
        <div className="scroll-thin flex-1 overflow-y-auto">
          <ModelSection session={session} />
          <AnimationSection session={session} />
          <TexturesSection session={session} />
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-[12.5px] text-subtle">
          {session ? t("inspector.emptyLoading") : t("inspector.emptyNoModel")}
        </div>
      )}
    </aside>
  );
}

function ResizeHandle() {
  const setWidth = useApp((s) => s.setInspectorWidth);
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize transition-colors hover:bg-accent/40"
      onPointerDown={(e) => {
        const startX = e.clientX;
        const startW = useApp.getState().inspectorWidth;
        const move = (ev: PointerEvent) => setWidth(startW + (startX - ev.clientX));
        const up = () => {
          window.removeEventListener("pointermove", move);
          window.removeEventListener("pointerup", up);
          document.body.style.cursor = "";
        };
        document.body.style.cursor = "col-resize";
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
      }}
    />
  );
}

function Section({ icon, title, extra, children }: { icon: ReactNode; title: TextId; extra?: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-b border-line">
      <div className="flex h-10 items-center gap-2 px-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-[11.5px] font-semibold uppercase tracking-wider text-muted hover:text-fg"
        >
          <ChevronDown size={14} className={clsx("transition-transform", !open && "-rotate-90")} />
          <span className="text-subtle">{icon}</span>
          {t(title)}
        </button>
        {extra}
      </div>
      {open && <div className="animate-fade-in px-3 pb-3">{children}</div>}
    </section>
  );
}

// ---------------------------------------------------------------- model info

function ModelSection({ session }: { session: ViewerSession }) {
  const stats = useSessionState(session, (s) => s.stats);
  if (!stats) return null;
  const rows: [TextId, string][] = [
    ["inspector.vertices", formatCount(stats.vertices)],
    ["inspector.triangles", formatCount(stats.triangles)],
    ["inspector.meshes", formatCount(stats.meshes)],
    ["inspector.materials", formatCount(stats.materials)],
    ["inspector.bones", formatCount(stats.bones)],
    ["inspector.fileSize", formatBytes(stats.fileSize)],
  ];
  return (
    <Section icon={<Info size={14} />} title="inspector.model">
      <div className="mb-2 truncate text-[13px] font-medium" title={session.source.path ?? session.source.name}>
        {session.source.name}
      </div>
      <dl className="grid grid-cols-3 gap-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="rounded-md bg-panel-2 px-2 py-1.5">
            <dt className="text-[10.5px] text-subtle">{t(k)}</dt>
            <dd className="text-[13px] font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

// ---------------------------------------------------------------- animation

function AnimationSection({ session }: { session: ViewerSession }) {
  const ctrl = session.animation;
  const state = useAnimationState(ctrl);

  return (
    <Section icon={<Film size={14} />} title="inspector.animation" extra={state && <span className="text-[11px] text-subtle">{state.clips.length}</span>}>
      {!ctrl || !state ? (
        <p className="rounded-md bg-panel-2 px-3 py-2.5 text-[12.5px] text-muted">{t("inspector.noAnimation")}</p>
      ) : (
        <>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="flex h-9 w-full items-center gap-2 rounded-md border border-line bg-panel-2 px-2.5 text-left text-[13px] hover:bg-hover data-[state=open]:border-accent">
              <span className="min-w-0 flex-1 truncate font-medium">{state.clips[state.index]?.name}</span>
              <span className="text-[11.5px] tabular-nums text-subtle">{formatTime(state.duration)}</span>
              <ChevronDown size={14} className="text-muted" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={4}
                className="animate-fade-in scroll-thin z-50 max-h-[360px] w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto rounded-lg border border-line bg-panel p-1 shadow-float"
              >
                {state.clips.map((clip, i) => (
                  <DropdownMenu.Item
                    key={i}
                    onSelect={() => ctrl.select(i)}
                    className="flex h-8 cursor-default items-center gap-2 rounded-md px-2 text-[12.5px] outline-none data-[highlighted]:bg-hover"
                  >
                    <span className="w-4 text-accent">{i === state.index && <Check size={13} />}</span>
                    <span className={clsx("min-w-0 flex-1 truncate", i === state.index && "font-medium text-accent")}>{clip.name}</span>
                    <span className="tabular-nums text-subtle">{formatTime(clip.duration)}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <div className="mt-2 flex gap-3 text-[11.5px] text-subtle">
            <span>{t("inspector.fps", { fps: state.fps })}</span>
            <span>{tn("inspector.frames", Math.round(state.duration * state.fps))}</span>
          </div>
        </>
      )}
    </Section>
  );
}

// ---------------------------------------------------------------- textures

function TexturesSection({ session }: { session: ViewerSession }) {
  const textures = useSessionState(session, (s) => s.textures) ?? [];
  const missing = useSessionState(session, (s) => s.missing) ?? [];
  const [preview, setPreview] = useState<TextureEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const summary = slotSummary(textures);

  const exportAll = async () => {
    setBusy(true);
    try {
      const res = await exportAllTextures(session);
      if (!res) return;
      if (res.failed.length)
        toast.warning(t("toast.exportedPartial", { count: res.count, failed: res.failed.length }), { description: res.failed.join(", ") });
      else
        toast.success(tn("toast.exportedAll", res.count), {
          description: res.dir || undefined,
          action: res.dir ? { label: t("common.openFolder"), onClick: () => void revealInFolder(res.dir) } : undefined,
        });
    } catch (err) {
      toast.error(t("toast.exportFailed"), { description: String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      icon={<Layers size={14} />}
      title="inspector.textures"
      extra={
        textures.length > 0 && (
          <Button variant="ghost" className="h-7 px-2 text-[12px]" disabled={busy} onClick={exportAll}>
            <Download size={13} /> {t("inspector.exportAll")}
          </Button>
        )
      }
    >
      <div className="mb-3 flex flex-wrap gap-1">
        {TEXTURE_SLOTS.map((s) => (
          <span key={s.key} title={summary[s.key] ? tn("inspector.slotCount", summary[s.key]) : t("inspector.slotMissing")}>
            <SlotBadge label={summary[s.key] ? t(`slot.${s.key}`) : `${t(`slot.${s.key}`)} —`} color={s.color} dim={!summary[s.key]} />
          </span>
        ))}
      </div>

      {missing.length > 0 && (
        <div className="mb-3 rounded-md border border-warn/30 bg-warn/10 px-2.5 py-2 text-[12px]">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-warn">
            <TriangleAlert size={13} /> {tn("inspector.missingTitle", missing.length)}
          </div>
          <ul className="scroll-thin max-h-24 overflow-y-auto font-mono text-[11px] text-muted">
            {missing.map((m) => (
              <li key={m} className="truncate">{m}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-subtle">{t("inspector.missingHint")}</p>
        </div>
      )}

      {textures.length === 0 ? (
        <p className="rounded-md bg-panel-2 px-3 py-2.5 text-[12.5px] text-muted">{t("inspector.noTextures")}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {textures.map((t) => (
            <TextureCard key={t.id} session={session} entry={t} onOpen={() => setPreview(t)} />
          ))}
        </div>
      )}

      <TexturePreviewDialog session={session} entry={preview} onClose={() => setPreview(null)} />
    </Section>
  );
}
