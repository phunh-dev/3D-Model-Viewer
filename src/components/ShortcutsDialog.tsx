import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { t, useLanguage, type TextId } from "../i18n";
import { Kbd } from "./ui";

/** A key is either literal text ("Ctrl", "F") or a text id for names that need translating. */
type Key = string | { id: TextId };

const GROUPS: { title: TextId; items: [Key[], TextId][] }[] = [
  {
    title: "shortcuts.group.file",
    items: [
      [["Ctrl", "O"], "shortcuts.openFile"],
      [["Ctrl", "W"], "shortcuts.closeTab"],
      [["Ctrl", "Tab"], "shortcuts.nextTab"],
      [["Ctrl", "Shift", "Tab"], "shortcuts.prevTab"],
      [[{ id: "key.middleMouse" }], "shortcuts.closeTabMiddle"],
    ],
  },
  {
    title: "shortcuts.group.viewport",
    items: [
      [[{ id: "key.leftMouse" }], "shortcuts.pan"],
      [[{ id: "key.middleMouse" }], "shortcuts.dolly"],
      [[{ id: "key.wheel" }], "shortcuts.wheel"],
      [[{ id: "key.rightMouse" }], "shortcuts.orbit"],
      [["F"], "shortcuts.frame"],
      [["C"], "shortcuts.toggleMode"],
      [["G"], "shortcuts.grid"],
      [["W"], "shortcuts.wireframe"],
      [["I"], "shortcuts.inspector"],
    ],
  },
  {
    title: "shortcuts.group.animation",
    items: [
      [[{ id: "key.space" }], "shortcuts.playPause"],
      [["L"], "shortcuts.loop"],
      [["←", "→"], "shortcuts.step"],
      [["Shift", "← →"], "shortcuts.step10"],
      [["Home", "End"], "shortcuts.startEnd"],
      [["[", "]"], "shortcuts.prevNextClip"],
    ],
  },
];

export function ShortcutsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  useLanguage();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="animate-fade-in fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          aria-describedby={undefined}
          className="animate-fade-in fixed left-1/2 top-1/2 z-50 max-h-[86vh] w-[min(92vw,720px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-panel p-5 shadow-float"
        >
          <div className="mb-4 flex items-center justify-between">
            <Dialog.Title className="text-[15px] font-semibold">{t("shortcuts.title")}</Dialog.Title>
            <Dialog.Close className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-hover hover:text-fg" aria-label={t("common.close")}>
              <X size={16} />
            </Dialog.Close>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            {GROUPS.map((g) => (
              <div key={g.title} className={g.title === "shortcuts.group.viewport" ? "sm:row-span-2" : ""}>
                <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-wider text-subtle">{t(g.title)}</div>
                <ul className="space-y-1">
                  {g.items.map(([keys, desc]) => (
                    <li key={desc} className="flex items-center justify-between gap-3 rounded-md px-2 py-1 text-[12.5px] hover:bg-hover">
                      <span>{t(desc)}</span>
                      <span className="flex shrink-0 gap-1">
                        {keys.map((k, i) => (
                          <Kbd key={i}>{typeof k === "string" ? k : t(k.id)}</Kbd>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
