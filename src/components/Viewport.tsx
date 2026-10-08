import * as ToggleGroup from "@radix-ui/react-toggle-group";
import { useEffect, useRef, useState } from "react";
import { Box, Focus, Grid3x3, Image as ImageIcon, LoaderCircle, RefreshCw, TriangleAlert, X } from "lucide-react";
import { getRenderManager } from "../core/RenderManager";
import type { DisplayMode, ViewerSession } from "../core/ViewerSession";
import { useActiveSession, useSessionState } from "../hooks/useSession";
import { t, useLanguage, type TextId } from "../i18n";
import { Trans } from "../i18n/Trans";
import { useApp } from "../store/appStore";
import { MouseLegend } from "./MouseLegend";
import { Button, IconButton, Tip } from "./ui";

export function Viewport() {
  useLanguage();
  const host = useRef<HTMLDivElement>(null);
  const session = useActiveSession();
  const status = useSessionState(session, (s) => s.status);

  useEffect(() => getRenderManager().mount(host.current!), []);

  return (
    <div className="viewport-bg relative min-h-0 min-w-0 flex-1 overflow-hidden">
      <div ref={host} className="absolute inset-0" />
      {session && status === "ready" && (
        <>
          <ViewToolbar session={session} />
          <MouseHint key={session.id} />
        </>
      )}
      {session && status === "loading" && <LoadingOverlay session={session} />}
      {session && status === "error" && <ErrorOverlay session={session} />}
    </div>
  );
}

function ViewToolbar({ session }: { session: ViewerSession }) {
  const mode = useSessionState(session, (s) => s.displayMode)!;
  const grid = useSessionState(session, (s) => s.grid)!;
  const wireframe = useSessionState(session, (s) => s.wireframe)!;

  return (
    <div className="animate-fade-in absolute left-3 top-3 flex items-center gap-1 rounded-xl border border-line bg-panel/90 p-1 shadow-float backdrop-blur">
      <ToggleGroup.Root
        type="single"
        value={mode}
        onValueChange={(v) => v && session.setDisplayMode(v as DisplayMode)}
        aria-label={t("viewport.displayMode")}
        className="flex rounded-lg bg-panel-2 p-0.5"
      >
        <ModeItem value="clay" label="viewport.clay" hint="viewport.clayHint" icon={<Box size={14} />} />
        <ModeItem value="textured" label="viewport.textured" hint="viewport.texturedHint" icon={<ImageIcon size={14} />} />
      </ToggleGroup.Root>
      <div className="mx-1 h-5 w-px bg-line" />
      <IconButton label={t("viewport.grid")} shortcut="G" active={grid} onClick={() => session.setGrid(!grid)}>
        <Grid3x3 size={16} />
      </IconButton>
      <IconButton label={t("viewport.wireframe")} shortcut="W" active={wireframe} onClick={() => session.setWireframe(!wireframe)}>
        <WireIcon />
      </IconButton>
      <IconButton label={t("viewport.frame")} shortcut="F" onClick={() => session.frame()}>
        <Focus size={16} />
      </IconButton>
    </div>
  );
}

function ModeItem({ value, label, hint, icon }: { value: DisplayMode; label: TextId; hint: TextId; icon: React.ReactNode }) {
  return (
    <Tip label={t(hint)} shortcut="C">
      <ToggleGroup.Item
        value={value}
        className="flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-muted transition-colors hover:text-fg aria-checked:bg-accent aria-checked:text-accent-fg aria-checked:shadow-sm"
      >
        {icon}
        {t(label)}
      </ToggleGroup.Item>
    </Tip>
  );
}

function WireIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M12 2.5 21 7.5v9L12 21.5 3 16.5v-9z" />
      <path d="M3 7.5l9 5 9-5M12 12.5v9M3 7.5l9 14M21 7.5l-9 14" opacity=".55" />
    </svg>
  );
}

function MouseHint() {
  const [expanded, setExpanded] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setExpanded(false), 6000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      className="absolute bottom-3 left-3 flex items-center rounded-lg border border-line bg-panel/85 px-2.5 py-1.5 text-[11.5px] text-muted shadow-float backdrop-blur transition-all"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <MouseLegend collapsed={!expanded} />
    </div>
  );
}

function LoadingOverlay({ session }: { session: ViewerSession }) {
  const progress = useSessionState(session, (s) => s.progress) ?? 0;
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-fade-in w-[320px] rounded-xl border border-line bg-panel/95 p-5 shadow-float">
        <div className="mb-3 flex items-center gap-2.5">
          <LoaderCircle size={18} className="animate-spin text-accent" />
          <div className="min-w-0">
            <div className="text-[13px] font-medium">{t("viewport.loading")}</div>
            <div className="truncate text-xs text-muted">{session.source.name}</div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <div className="mt-1.5 text-right text-[11px] tabular-nums text-muted">{Math.round(progress * 100)}%</div>
      </div>
    </div>
  );
}

function ErrorOverlay({ session }: { session: ViewerSession }) {
  const error = useSessionState(session, (s) => s.error);
  return (
    <div className="absolute inset-0 flex items-center justify-center p-6">
      <div className="animate-fade-in w-[400px] rounded-xl border border-line bg-panel p-5 shadow-float">
        <div className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
          <TriangleAlert size={18} className="text-danger" />
          {t("viewport.errorTitle")}
        </div>
        <p className="mb-1 text-[13px] text-muted">
          <Trans id="viewport.errorBody" values={{ name: <span className="text-fg">{session.source.name}</span> }} />
        </p>
        <p className="mb-4 break-words rounded-md bg-panel-2 px-2 py-1.5 font-mono text-[11px] text-muted">{error}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => useApp.getState().closeTab(session.id)}>
            <X size={14} /> {t("viewport.closeTab")}
          </Button>
          <Button variant="primary" onClick={() => void session.reload()}>
            <RefreshCw size={14} /> {t("viewport.retry")}
          </Button>
        </div>
      </div>
    </div>
  );
}
