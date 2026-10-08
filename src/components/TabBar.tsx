import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import clsx from "clsx";
import { useEffect, useRef } from "react";
import { Check, FolderOpen, Keyboard, Languages, LoaderCircle, Moon, PanelRight, Sun, TriangleAlert, X } from "lucide-react";
import { getSession, useApp, type TabInfo } from "../store/appStore";
import { useSessionState } from "../hooks/useSession";
import { openFilesDialog } from "../lib/actions";
import { FORMAT_COLORS } from "../lib/format";
import { LANGUAGES, t, useLanguage } from "../i18n";
import { IconButton, Tip } from "./ui";

export function TabBar({ onShowShortcuts }: { onShowShortcuts: () => void }) {
  useLanguage();
  const tabs = useApp((s) => s.tabs);
  const activeId = useApp((s) => s.activeId);
  const theme = useApp((s) => s.theme);
  const inspectorOpen = useApp((s) => s.inspectorOpen);
  const { setTheme, toggleInspector } = useApp.getState();

  return (
    <header className="flex h-11 shrink-0 items-stretch gap-2 border-b border-line bg-panel pl-2 pr-1.5">
      <div className="flex items-center">
        <Tip label={t("tabbar.openTooltip")} shortcut="Ctrl+O">
          <button
            type="button"
            onClick={openFilesDialog}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-accent px-3 text-[13px] font-medium text-accent-fg transition hover:brightness-110"
          >
            <FolderOpen size={15} strokeWidth={2.2} />
            {t("tabbar.open")}
          </button>
        </Tip>
      </div>

      <div role="tablist" aria-label={t("tabbar.tablistLabel")} className="no-scrollbar flex min-w-0 flex-1 items-end gap-0.5 overflow-x-auto pt-1.5">
        {tabs.map((tab) => (
          <TabItem key={tab.id} tab={tab} active={tab.id === activeId} />
        ))}
      </div>

      <div className="flex items-center gap-0.5">
        <LanguageMenu />
        <IconButton label={t("tabbar.shortcuts")} shortcut="?" onClick={onShowShortcuts}>
          <Keyboard size={17} />
        </IconButton>
        <IconButton
          label={theme === "dark" ? t("tabbar.lightTheme") : t("tabbar.darkTheme")}
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
        </IconButton>
        <IconButton label={t("tabbar.toggleInspector")} shortcut="I" active={inspectorOpen} onClick={toggleInspector}>
          <PanelRight size={17} />
        </IconButton>
      </div>
    </header>
  );
}

function LanguageMenu() {
  const language = useApp((s) => s.language);
  const setLanguage = useApp((s) => s.setLanguage);
  return (
    <DropdownMenu.Root>
      <Tip label={t("tabbar.language")}>
        <DropdownMenu.Trigger
          aria-label={t("tabbar.language")}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-[11.5px] font-semibold uppercase text-muted hover:bg-hover hover:text-fg"
        >
          <Languages size={16} />
          {language}
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={6} className="animate-fade-in z-50 min-w-[150px] rounded-lg border border-line bg-panel p-1 shadow-float">
          {LANGUAGES.map((lang) => (
            <DropdownMenu.Item
              key={lang}
              onSelect={() => setLanguage(lang)}
              className={clsx(
                "flex h-8 cursor-default items-center justify-between gap-3 rounded-md px-2 text-[12.5px] outline-none data-[highlighted]:bg-hover",
                lang === language ? "text-accent" : "text-fg",
              )}
            >
              {t(`language.${lang}`)}
              {lang === language && <Check size={13} />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function TabItem({ tab, active }: { tab: TabInfo; active: boolean }) {
  const session = getSession(tab.id);
  const status = useSessionState(session, (s) => s.status);
  const ref = useRef<HTMLDivElement>(null);
  const { activate, closeTab } = useApp.getState();

  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <Tip label={tab.path ?? tab.name}>
      <div
        ref={ref}
        role="tab"
        aria-selected={active}
        tabIndex={0}
        onMouseDown={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            closeTab(tab.id);
          } else if (e.button === 0) activate(tab.id);
        }}
        onKeyDown={(e) => e.key === "Enter" && activate(tab.id)}
        className={clsx(
          "group relative flex h-[34px] min-w-[120px] max-w-[220px] shrink-0 items-center gap-2 rounded-t-lg border border-b-0 pl-2.5 pr-1 transition-colors",
          active ? "border-line bg-bg text-fg" : "border-transparent text-muted hover:bg-hover hover:text-fg",
        )}
      >
        {active && <span className="absolute inset-x-2 top-0 h-0.5 rounded-full bg-accent" />}
        {status === "loading" ? (
          <LoaderCircle size={13} className="shrink-0 animate-spin text-accent" />
        ) : status === "error" ? (
          <TriangleAlert size={13} className="shrink-0 text-danger" />
        ) : (
          <span
            className="shrink-0 rounded px-1 text-[9px] font-bold leading-[14px]"
            style={{ color: FORMAT_COLORS[tab.format], backgroundColor: `${FORMAT_COLORS[tab.format]}22` }}
          >
            {tab.format.toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-[12.5px]">{tab.name}</span>
        <button
          type="button"
          aria-label={t("tabbar.closeTab", { name: tab.name })}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => closeTab(tab.id)}
          className={clsx(
            "flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted hover:bg-hover hover:text-fg",
            active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <X size={13} />
        </button>
      </div>
    </Tip>
  );
}
