import { useSyncExternalStore } from "react";
import type { AnimationController, AnimationState } from "../core/AnimationController";
import type { SessionState, ViewerSession } from "../core/ViewerSession";
import { getSession, useApp } from "../store/appStore";

const noop = () => () => {};

export function useActiveSession(): ViewerSession | undefined {
  const activeId = useApp((s) => s.activeId);
  return getSession(activeId);
}

/** Subscribes a component to a session's state (status, display mode, textures...). */
export function useSessionState<T>(session: ViewerSession | undefined, select: (s: SessionState) => T): T | undefined {
  return useSyncExternalStore(session ? session.changed.subscribe : noop, () =>
    session ? select(session.state) : undefined,
  );
}

export function useAnimationState(ctrl: AnimationController | null | undefined): AnimationState | undefined {
  return useSyncExternalStore(ctrl ? ctrl.changed.subscribe : noop, () => ctrl?.state);
}

/** Playhead time; re-renders on every animation tick, so only use it in small components. */
export function useAnimationTime(ctrl: AnimationController | null | undefined): number {
  return useSyncExternalStore(ctrl ? ctrl.tick.subscribe : noop, () => ctrl?.time ?? 0);
}
