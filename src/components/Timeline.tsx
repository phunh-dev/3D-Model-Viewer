import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Slider from "@radix-ui/react-slider";
import clsx from "clsx";
import { useRef } from "react";
import { Check, ChevronDown, Pause, Play, Repeat, Repeat1, StepBack, StepForward } from "lucide-react";
import { SPEEDS, type AnimationController } from "../core/AnimationController";
import { useActiveSession, useAnimationState, useAnimationTime, useSessionState } from "../hooks/useSession";
import { t, useLanguage } from "../i18n";
import { formatTime } from "../lib/format";
import { IconButton, Tip } from "./ui";

export function Timeline() {
  useLanguage();
  const session = useActiveSession();
  const status = useSessionState(session, (s) => s.status);
  const ctrl = status === "ready" ? session?.animation : null;
  const state = useAnimationState(ctrl);
  const disabled = !ctrl || !state;
  const playLabel = state?.playing ? t("timeline.pause") : t("timeline.play");

  return (
    <footer className="flex h-14 shrink-0 items-center gap-3 border-t border-line bg-panel px-3">
      <div className="flex items-center gap-0.5">
        <IconButton label={t("timeline.stepBack")} shortcut="←" tipSide="top" disabled={disabled} onClick={() => ctrl?.step(-1)}>
          <StepBack size={16} />
        </IconButton>
        <Tip label={playLabel} shortcut="Space" side="top">
          <button
            type="button"
            aria-label={playLabel}
            disabled={disabled}
            onClick={() => ctrl?.toggle()}
            className="mx-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm transition hover:brightness-110 disabled:bg-panel-2 disabled:text-subtle"
          >
            {state?.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="translate-x-px" />}
          </button>
        </Tip>
        <IconButton label={t("timeline.stepForward")} shortcut="→" tipSide="top" disabled={disabled} onClick={() => ctrl?.step(1)}>
          <StepForward size={16} />
        </IconButton>
      </div>

      <IconButton
        label={state?.loop ? t("timeline.loopOn") : t("timeline.loopOff")}
        shortcut="L"
        tipSide="top"
        active={!!state?.loop && !disabled}
        disabled={disabled}
        onClick={() => ctrl?.setLoop(!state?.loop)}
      >
        {state?.loop ? <Repeat size={16} /> : <Repeat1 size={16} />}
      </IconButton>

      <SpeedMenu ctrl={ctrl} speed={state?.speed ?? 1} disabled={disabled} />

      {disabled ? (
        <div className="flex flex-1 items-center gap-3 text-[12.5px] text-subtle">
          <div className="h-1 flex-1 rounded-full bg-panel-2" />
          <span>{session && status === "ready" ? t("timeline.noAnimationInModel") : t("timeline.noAnimation")}</span>
        </div>
      ) : (
        <Scrubber ctrl={ctrl!} duration={state!.duration} fps={state!.fps} />
      )}
    </footer>
  );
}

function Scrubber({ ctrl, duration, fps }: { ctrl: AnimationController; duration: number; fps: number }) {
  const time = useAnimationTime(ctrl);
  const scrubbing = useRef(false);
  const frame = Math.round(time * fps);
  const totalFrames = Math.round(duration * fps);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <Slider.Root
        className="relative flex h-6 flex-1 touch-none items-center"
        min={0}
        max={Math.max(duration, 1e-3)}
        step={1 / fps}
        value={[time]}
        aria-label={t("timeline.label")}
        onPointerDown={() => {
          scrubbing.current = true;
          ctrl.beginScrub();
        }}
        onValueChange={([v]) => ctrl.seek(v)}
        onValueCommit={() => {
          if (scrubbing.current) ctrl.endScrub();
          scrubbing.current = false;
        }}
      >
        <Slider.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-panel-2">
          <Slider.Range className="absolute h-full bg-accent" />
        </Slider.Track>
        <Slider.Thumb className="block h-4 w-4 rounded-full border-2 border-accent bg-white shadow transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-soft" />
      </Slider.Root>
      <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
        <span className="text-[13px] font-medium text-fg">{formatTime(time)}</span>
        <span className="text-[12px] text-subtle">/ {formatTime(duration)}</span>
        <span className="ml-1 rounded bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted">
          f {frame} / {totalFrames}
        </span>
      </div>
    </div>
  );
}

function SpeedMenu({ ctrl, speed, disabled }: { ctrl: AnimationController | null | undefined; speed: number; disabled: boolean }) {
  return (
    <DropdownMenu.Root>
      <Tip label={t("timeline.speed")} side="top">
        <DropdownMenu.Trigger
          disabled={disabled}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-[12.5px] font-medium tabular-nums text-muted hover:bg-hover hover:text-fg disabled:opacity-40"
        >
          {speed}x <ChevronDown size={13} />
        </DropdownMenu.Trigger>
      </Tip>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" sideOffset={6} className="animate-fade-in z-50 min-w-[96px] rounded-lg border border-line bg-panel p-1 shadow-float">
          {SPEEDS.map((s) => (
            <DropdownMenu.Item
              key={s}
              onSelect={() => ctrl?.setSpeed(s)}
              className={clsx(
                "flex h-7 cursor-default items-center justify-between gap-3 rounded-md px-2 text-[12.5px] tabular-nums outline-none data-[highlighted]:bg-hover",
                s === speed ? "text-accent" : "text-fg",
              )}
            >
              {s}x {s === speed && <Check size={13} />}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
