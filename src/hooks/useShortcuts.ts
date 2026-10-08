import { useEffect } from "react";
import { openFilesDialog } from "../lib/actions";
import { getSession, useApp } from "../store/appStore";

/** Global keyboard shortcuts (see ShortcutsDialog for the list). */
export function useShortcuts(onShowShortcuts: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable=true]")) return;
      if (document.querySelector("[role=dialog]")) return;

      const app = useApp.getState();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        const k = e.key.toLowerCase();
        if (k === "o") openFilesDialog();
        else if (k === "w") app.activeId && app.closeTab(app.activeId);
        else if (e.key === "Tab") app.cycleTab(e.shiftKey ? -1 : 1);
        else if (e.key === "PageDown") app.cycleTab(1);
        else if (e.key === "PageUp") app.cycleTab(-1);
        else return;
        e.preventDefault();
        return;
      }
      if (e.altKey) return;

      if (e.key === "?") {
        onShowShortcuts();
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "i") {
        app.toggleInspector();
        return;
      }

      const session = getSession(app.activeId);
      if (!session?.isReady) return;
      // Let focused sliders / menus handle their own arrow keys.
      const onWidget = !!target?.closest("[role=slider], [role=menu], [role=menuitem]");
      const anim = session.animation;
      const state = session.state;

      switch (e.key) {
        case " ":
          if (target?.closest("button")) target.blur();
          anim?.toggle();
          break;
        case "f":
        case "F":
          session.frame();
          break;
        case "c":
        case "C":
          session.setDisplayMode(state.displayMode === "clay" ? "textured" : "clay");
          break;
        case "g":
        case "G":
          session.setGrid(!state.grid);
          break;
        case "w":
        case "W":
          session.setWireframe(!state.wireframe);
          break;
        case "l":
        case "L":
          anim?.setLoop(!anim.state.loop);
          break;
        case "ArrowLeft":
        case "ArrowRight":
          if (onWidget) return;
          anim?.step((e.key === "ArrowLeft" ? -1 : 1) * (e.shiftKey ? 10 : 1));
          break;
        case "Home":
          anim?.seek(0);
          break;
        case "End":
          if (anim) anim.seek(anim.state.duration);
          break;
        case "[":
        case "]":
          if (anim && anim.state.clips.length > 1) {
            const n = anim.state.clips.length;
            anim.select((anim.state.index + (e.key === "]" ? 1 : -1) + n) % n);
          }
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onShowShortcuts]);
}
