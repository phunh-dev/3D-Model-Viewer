import * as Tooltip from "@radix-ui/react-tooltip";
import { useCallback, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { DropOverlay } from "./components/DropOverlay";
import { EmptyState } from "./components/EmptyState";
import { Inspector } from "./components/Inspector";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { TabBar } from "./components/TabBar";
import { Timeline } from "./components/Timeline";
import { Viewport } from "./components/Viewport";
import { useFileDrop } from "./hooks/useFileDrop";
import { useShortcuts } from "./hooks/useShortcuts";
import { enforceLifecycle, useApp } from "./store/appStore";
import { setLanguage } from "./i18n";

const LIFECYCLE_CHECK_MS = 30_000;

export default function App() {
  const theme = useApp((s) => s.theme);
  const hasTabs = useApp((s) => s.tabs.length > 0);
  const inspectorOpen = useApp((s) => s.inspectorOpen);
  const drag = useFileDrop();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const showShortcuts = useCallback(() => setShortcutsOpen(true), []);
  useShortcuts(showShortcuts);

  const language = useApp((s) => s.language);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => setLanguage(language), [language]);

  // Hidden tabs are hibernated after a while (see tabLifecycle.ts).
  useEffect(() => {
    const timer = setInterval(() => enforceLifecycle(), LIFECYCLE_CHECK_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <Tooltip.Provider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-full flex-col">
        <TabBar onShowShortcuts={showShortcuts} />
        <div className="flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1">
            <Viewport />
            {!hasTabs && <EmptyState />}
          </div>
          {inspectorOpen && <Inspector />}
        </div>
        <Timeline />
      </div>
      <DropOverlay drag={drag} />
      <ShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster theme={theme} position="bottom-right" offset={72} richColors closeButton />
    </Tooltip.Provider>
  );
}
