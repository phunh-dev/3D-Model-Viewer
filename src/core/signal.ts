/** Minimal pub/sub used to bridge imperative three.js objects to React (`useSyncExternalStore`). */
export class Signal {
  private listeners = new Set<() => void>();

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  emit(): void {
    for (const fn of this.listeners) fn();
  }
}
