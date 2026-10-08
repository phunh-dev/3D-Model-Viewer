import { Clock, FileBox, FolderOpen, Upload } from "lucide-react";
import { basename, dirname, extname } from "../core/paths";
import { t, useLanguage } from "../i18n";
import { Trans } from "../i18n/Trans";
import { openFilesDialog, openPaths } from "../lib/actions";
import { FORMAT_COLORS } from "../lib/format";
import { isTauri } from "../lib/platform";
import { useApp } from "../store/appStore";
import { MouseLegend } from "./MouseLegend";
import { Button, Kbd } from "./ui";

export function EmptyState() {
  useLanguage();
  const recent = useApp((s) => s.recent);
  const clearRecent = useApp((s) => s.clearRecent);

  return (
    <div className="viewport-bg absolute inset-0 flex items-center justify-center overflow-auto p-8">
      <div className="animate-fade-in flex w-full max-w-[560px] flex-col items-center">
        <button
          type="button"
          onClick={openFilesDialog}
          className="group flex w-full flex-col items-center rounded-2xl border-2 border-dashed border-line bg-panel/60 px-8 py-12 text-center backdrop-blur transition-colors hover:border-accent hover:bg-accent-soft"
        >
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent transition-transform group-hover:-translate-y-1">
            <Upload size={30} strokeWidth={1.8} />
          </div>
          <div className="mb-1.5 text-[18px] font-semibold">{t("empty.title")}</div>
          <div className="mb-5 text-[13px] text-muted">
            <Trans
              id="empty.supported"
              values={{
                formats: (
                  <>
                    <Fmt ext="fbx" /> <Fmt ext="obj" /> <Fmt ext="dae" />
                  </>
                ),
              }}
            />
          </div>
          <span className="inline-flex h-9 items-center gap-2 rounded-lg bg-accent px-4 text-[13px] font-medium text-accent-fg">
            <FolderOpen size={16} /> {t("empty.pickFiles")}
            <span className="ml-1 opacity-70">Ctrl+O</span>
          </span>
        </button>

        {isTauri && recent.length > 0 && (
          <div className="mt-6 w-full">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wider text-subtle">
                <Clock size={13} /> {t("empty.recent")}
              </span>
              <Button variant="ghost" className="h-6 px-2 text-[11.5px]" onClick={clearRecent}>
                {t("empty.clearRecent")}
              </Button>
            </div>
            <ul className="overflow-hidden rounded-xl border border-line bg-panel">
              {recent.map((path) => (
                <li key={path} className="border-b border-line last:border-0">
                  <button
                    type="button"
                    onClick={() => openPaths([path])}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-hover"
                  >
                    <FileBox size={16} style={{ color: FORMAT_COLORS[extname(path)] }} className="shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px]">{basename(path)}</span>
                      <span className="block truncate text-[11px] text-subtle">{dirname(path)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-muted">
          <MouseLegend />
          <span className="flex items-center gap-1">
            <Kbd>?</Kbd> {t("empty.showShortcuts")}
          </span>
        </div>
      </div>
    </div>
  );
}

function Fmt({ ext }: { ext: string }) {
  return (
    <span className="rounded px-1 py-px text-[11px] font-bold" style={{ color: FORMAT_COLORS[ext], backgroundColor: `${FORMAT_COLORS[ext]}22` }}>
      .{ext}
    </span>
  );
}
