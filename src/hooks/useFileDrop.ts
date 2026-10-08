import { useEffect, useState } from "react";
import { openFiles, openPaths } from "../lib/actions";
import { isModelFile, isTauri } from "../lib/platform";

export interface DragState {
  active: boolean;
  /** Number of supported models being dragged; null when the browser doesn't tell us yet. */
  models: number | null;
}

/** Window-wide drag & drop. Tauri gives real file paths; a browser gives File objects. */
export function useFileDrop(): DragState {
  const [state, setState] = useState<DragState>({ active: false, models: null });

  useEffect(() => {
    if (isTauri) {
      let unlisten: (() => void) | undefined;
      let disposed = false;
      void import("@tauri-apps/api/webview").then(({ getCurrentWebview }) =>
        getCurrentWebview()
          .onDragDropEvent((e) => {
            const p = e.payload;
            if (p.type === "enter") setState({ active: true, models: p.paths.filter(isModelFile).length });
            else if (p.type === "leave") setState({ active: false, models: null });
            else if (p.type === "drop") {
              setState({ active: false, models: null });
              openPaths(p.paths);
            }
          })
          .then((fn) => (disposed ? fn() : (unlisten = fn))),
      );
      return () => {
        disposed = true;
        unlisten?.();
      };
    }

    let depth = 0;
    const hasFiles = (e: DragEvent) => e.dataTransfer?.types.includes("Files");
    const enter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      if (depth++ === 0) setState({ active: true, models: null });
    };
    const over = (e: DragEvent) => hasFiles(e) && e.preventDefault();
    const leave = () => {
      if (--depth <= 0) {
        depth = 0;
        setState({ active: false, models: null });
      }
    };
    const drop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setState({ active: false, models: null });
      openFiles([...(e.dataTransfer?.files ?? [])]);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", over);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", over);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, []);

  return state;
}
