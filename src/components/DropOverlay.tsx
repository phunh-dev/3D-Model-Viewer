import clsx from "clsx";
import { Upload } from "lucide-react";
import type { DragState } from "../hooks/useFileDrop";
import { t, tn, useLanguage } from "../i18n";

export function DropOverlay({ drag }: { drag: DragState }) {
  useLanguage();
  if (!drag.active) return null;
  const none = drag.models === 0;
  return (
    <div className="animate-fade-in pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-bg/70 p-6 backdrop-blur-sm">
      <div
        className={clsx(
          "flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed",
          none ? "border-danger/70" : "border-accent bg-accent-soft",
        )}
      >
        <Upload size={40} className={none ? "text-danger" : "text-accent"} />
        <div className="mt-4 text-[20px] font-semibold">
          {none ? t("drop.none") : drag.models ? tn("drop.openCount", drag.models) : t("drop.open")}
        </div>
        <div className="mt-1 text-[13px] text-muted">{none ? t("drop.unsupported") : t("drop.eachTab")}</div>
      </div>
    </div>
  );
}
