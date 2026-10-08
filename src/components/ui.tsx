import * as Tooltip from "@radix-ui/react-tooltip";
import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Keyboard shortcut chip, e.g. <Kbd>Ctrl</Kbd>. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-[18px] items-center justify-center rounded border border-line bg-panel-2 px-1 font-sans text-[10px] font-medium leading-[16px] text-muted">
      {children}
    </kbd>
  );
}

export function Tip({
  label,
  shortcut,
  side = "bottom",
  children,
}: {
  label: ReactNode;
  shortcut?: string;
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side={side}
          sideOffset={6}
          className="animate-fade-in z-50 flex items-center gap-2 rounded-md border border-line bg-panel px-2 py-1 text-xs text-fg shadow-float"
        >
          {label}
          {shortcut && <Kbd>{shortcut}</Kbd>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  active?: boolean;
  tipSide?: "top" | "bottom" | "left" | "right";
  size?: "sm" | "md";
};

export function IconButton({ label, shortcut, active, tipSide, size = "md", className, children, ...rest }: IconButtonProps) {
  return (
    <Tip label={label} shortcut={shortcut} side={tipSide}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        className={clsx(
          "inline-flex shrink-0 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-40",
          size === "md" ? "h-8 w-8" : "h-7 w-7",
          active ? "bg-accent-soft text-accent" : "text-muted hover:bg-hover hover:text-fg",
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    </Tip>
  );
}

export function Button({
  variant = "secondary",
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" && "bg-accent text-accent-fg hover:brightness-110",
        variant === "secondary" && "border border-line bg-panel-2 text-fg hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-fg",
        className,
      )}
      {...rest}
    />
  );
}

export function SlotBadge({ label, color, dim }: { label: string; color: string; dim?: boolean }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide",
        dim && "border border-dashed border-line text-subtle",
      )}
      style={dim ? undefined : { color, backgroundColor: `${color}22` }}
    >
      {label}
    </span>
  );
}
