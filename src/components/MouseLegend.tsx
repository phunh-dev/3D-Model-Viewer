import clsx from "clsx";
import { Mouse } from "lucide-react";
import { t, useLanguage, type TextId } from "../i18n";

const ITEMS: [TextId, TextId][] = [
  ["mouse.left", "mouse.leftAction"],
  ["mouse.middle", "mouse.middleAction"],
  ["mouse.right", "mouse.rightAction"],
];

/** "Left pan · Middle/Wheel zoom · Right orbit" — shared by the viewport hint and the empty state. */
export function MouseLegend({ collapsed = false }: { collapsed?: boolean }) {
  useLanguage();
  return (
    <span className="flex items-center gap-2">
      <Mouse size={14} className="shrink-0" />
      <span
        className={clsx(
          "flex items-center gap-3 overflow-hidden whitespace-nowrap transition-all duration-300",
          collapsed ? "max-w-0 opacity-0" : "max-w-[460px] opacity-100",
        )}
      >
        {ITEMS.map(([button, action]) => (
          <span key={button}>
            <b className="font-semibold text-fg">{t(button)}</b> {t(action)}
          </span>
        ))}
      </span>
    </span>
  );
}
