import { toast } from "sonner";
import { create } from "zustand";
import { getRenderManager } from "../core/RenderManager";
import { ViewerSession, type DisplayMode } from "../core/ViewerSession";
import { planLifecycle } from "../core/tabLifecycle";
import { DEFAULT_PREFS, savePrefs, type Prefs, type Theme } from "../lib/prefs";
import type { ModelSource } from "../lib/platform";
import { tn, t, type Language } from "../i18n";

export interface TabInfo {
  id: string;
  name: string;
  format: ModelSource["format"];
  path?: string;
}

interface AppState extends Prefs {
  tabs: TabInfo[];
  activeId: string | null;
  prefsLoaded: boolean;

  applyPrefs(p: Prefs): void;
  openSources(sources: ModelSource[]): void;
  activate(id: string): void;
  closeTab(id: string): void;
  cycleTab(dir: 1 | -1): void;
  setLanguage(language: Language): void;
  setTheme(theme: Theme): void;
  toggleInspector(): void;
  setInspectorWidth(w: number): void;
  setDefaultMode(mode: DisplayMode): void;
  setDefaultGrid(grid: boolean): void;
  clearRecent(): void;
}

/** Live three.js objects stay outside React state; the store only keeps serialisable tab info. */
const sessions = new Map<string, ViewerSession>();
export const getSession = (id: string | null | undefined) => (id ? sessions.get(id) : undefined);

let nextId = 1;
const MAX_RECENT = 8;

export const useApp = create<AppState>((set, get) => ({
  ...DEFAULT_PREFS,
  tabs: [],
  activeId: null,
  prefsLoaded: false,

  applyPrefs: (p) => set({ ...p, prefsLoaded: true }),

  openSources(sources) {
    if (!sources.length) return;
    const rm = getRenderManager();
    const { tabs, defaultMode, grid, recent } = get();
    const added: TabInfo[] = [];
    let focus: string | null = null;

    for (const source of sources) {
      const existing = source.path && tabs.find((t) => t.path === source.path);
      if (existing) {
        focus = existing.id;
        continue;
      }
      const id = `tab-${nextId++}`;
      const session = new ViewerSession(id, source, rm, { displayMode: defaultMode, grid });
      sessions.set(id, session);
      added.push({ id, name: source.name, format: source.format, path: source.path });
      focus = id;
      void session.load().then(() => {
        const { missing } = session.state;
        if (missing.length) {
          toast.warning(tn("toast.missingTextures", missing.length, { name: source.name }), {
            description: t("toast.missingTexturesBody"),
          });
        }
      });
    }

    const paths = sources.map((s) => s.path).filter((p): p is string => !!p);
    set({
      tabs: [...tabs, ...added],
      recent: [...paths.reverse(), ...recent.filter((r) => !paths.includes(r))].slice(0, MAX_RECENT),
    });
    if (focus) get().activate(focus);
  },

  activate(id) {
    const session = sessions.get(id);
    if (!session) return;
    set({ activeId: id });
    getRenderManager().setActive(session);
    enforceLifecycle();
  },

  closeTab(id) {
    const { tabs, activeId } = get();
    const index = tabs.findIndex((t) => t.id === id);
    if (index < 0) return;
    const remaining = tabs.filter((t) => t.id !== id);
    const session = sessions.get(id);

    if (activeId === id) {
      const next = remaining[Math.min(index, remaining.length - 1)];
      set({ tabs: remaining, activeId: null });
      if (next) get().activate(next.id);
      else getRenderManager().setActive(null);
    } else {
      set({ tabs: remaining });
    }
    session?.dispose();
    sessions.delete(id);
  },

  cycleTab(dir) {
    const { tabs, activeId } = get();
    if (tabs.length < 2) return;
    const i = tabs.findIndex((t) => t.id === activeId);
    get().activate(tabs[(i + dir + tabs.length) % tabs.length].id);
  },

  setLanguage: (language) => set({ language }),
  setTheme: (theme) => set({ theme }),
  toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
  setInspectorWidth: (inspectorWidth) => set({ inspectorWidth: Math.round(Math.min(Math.max(inspectorWidth, 260), 560)) }),
  setDefaultMode: (defaultMode) => set({ defaultMode }),
  setDefaultGrid: (grid) => set({ grid }),
  clearRecent: () => set({ recent: [] }),
}));

/** Moves tabs between active / sleeping / hibernated (see tabLifecycle.ts). */
export function enforceLifecycle(now = Date.now()) {
  const { activeId } = useApp.getState();
  const list = [...sessions.values()].map((s) => ({ id: s.id, lifecycle: s.state.lifecycle, lastActiveAt: s.lastActiveAt }));
  for (const t of planLifecycle(list, activeId, now)) sessions.get(t.id)?.setLifecycle(t.to);
}

if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__app = { useApp, sessions, enforceLifecycle };
}

// Persist preferences whenever they change (after the initial load).
let saveTimer: ReturnType<typeof setTimeout> | undefined;
useApp.subscribe((s, prev) => {
  if (!s.prefsLoaded) return;
  const changed =
    s.language !== prev.language ||
    s.theme !== prev.theme ||
    s.defaultMode !== prev.defaultMode ||
    s.grid !== prev.grid ||
    s.inspectorOpen !== prev.inspectorOpen ||
    s.inspectorWidth !== prev.inspectorWidth ||
    s.recent !== prev.recent;
  if (!changed) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { language, theme, defaultMode, grid, inspectorOpen, inspectorWidth, recent } = useApp.getState();
    void savePrefs({ language, theme, defaultMode, grid, inspectorOpen, inspectorWidth, recent });
  }, 400);
});
