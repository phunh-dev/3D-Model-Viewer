/**
 * Tab power states:
 * - active:     the visible tab; renders on demand and plays animation
 * - sleeping:   hidden; no rendering, no animation updates, GPU data kept for instant switching
 * - hibernated: hidden for a while (or too many sleeping tabs); GPU buffers/textures released,
 *               CPU data kept so three.js re-uploads transparently when the tab becomes active
 */
export type Lifecycle = "active" | "sleeping" | "hibernated";

export interface LifecycleTab {
  id: string;
  lifecycle: Lifecycle;
  /** Timestamp (ms) when the tab stopped being active. */
  lastActiveAt: number;
}

export interface LifecycleOptions {
  hibernateAfterMs: number;
  /** Max number of hidden tabs allowed to keep their GPU resources. */
  maxSleeping: number;
}

export const DEFAULT_LIFECYCLE: LifecycleOptions = {
  hibernateAfterMs: 5 * 60_000,
  maxSleeping: 3,
};

export interface Transition {
  id: string;
  to: Lifecycle;
}

export function planLifecycle(
  tabs: LifecycleTab[],
  activeId: string | null,
  now: number,
  opts: LifecycleOptions = DEFAULT_LIFECYCLE,
): Transition[] {
  const out: Transition[] = [];
  const sleeping: LifecycleTab[] = [];

  for (const tab of tabs) {
    if (tab.id === activeId) {
      if (tab.lifecycle !== "active") out.push({ id: tab.id, to: "active" });
      continue;
    }
    if (tab.lifecycle === "hibernated") continue;

    if (tab.lifecycle === "active" || now - tab.lastActiveAt < opts.hibernateAfterMs) {
      if (tab.lifecycle === "active") out.push({ id: tab.id, to: "sleeping" });
      sleeping.push(tab);
    } else {
      out.push({ id: tab.id, to: "hibernated" });
    }
  }

  // Keep only the most recently used tabs warm.
  const overflow = sleeping.length - opts.maxSleeping;
  if (overflow > 0) {
    const oldest = [...sleeping].sort((a, b) => a.lastActiveAt - b.lastActiveAt).slice(0, overflow);
    for (const tab of oldest) {
      const existing = out.find((t) => t.id === tab.id);
      if (existing) existing.to = "hibernated";
      else out.push({ id: tab.id, to: "hibernated" });
    }
  }
  return out;
}
