import { describe, expect, it } from "vitest";
import { planLifecycle, type LifecycleTab } from "../src/core/tabLifecycle";

const opts = { hibernateAfterMs: 1000, maxSleeping: 2 };

describe("planLifecycle", () => {
  it("activates the selected tab and puts the previous one to sleep", () => {
    const tabs: LifecycleTab[] = [
      { id: "a", lifecycle: "active", lastActiveAt: 0 },
      { id: "b", lifecycle: "sleeping", lastActiveAt: 0 },
    ];
    expect(planLifecycle(tabs, "b", 10, opts)).toEqual([
      { id: "a", to: "sleeping" },
      { id: "b", to: "active" },
    ]);
  });

  it("wakes a hibernated tab when it becomes active", () => {
    const tabs: LifecycleTab[] = [{ id: "a", lifecycle: "hibernated", lastActiveAt: 0 }];
    expect(planLifecycle(tabs, "a", 10, opts)).toEqual([{ id: "a", to: "active" }]);
  });

  it("hibernates tabs that slept longer than the timeout", () => {
    const tabs: LifecycleTab[] = [
      { id: "a", lifecycle: "active", lastActiveAt: 0 },
      { id: "b", lifecycle: "sleeping", lastActiveAt: 0 },
      { id: "c", lifecycle: "sleeping", lastActiveAt: 900 },
    ];
    expect(planLifecycle(tabs, "a", 1500, opts)).toEqual([{ id: "b", to: "hibernated" }]);
  });

  it("hibernates the least recently used tabs beyond maxSleeping", () => {
    const tabs: LifecycleTab[] = [
      { id: "a", lifecycle: "active", lastActiveAt: 0 },
      { id: "b", lifecycle: "sleeping", lastActiveAt: 100 },
      { id: "c", lifecycle: "sleeping", lastActiveAt: 300 },
      { id: "d", lifecycle: "sleeping", lastActiveAt: 200 },
    ];
    expect(planLifecycle(tabs, "a", 400, opts)).toEqual([{ id: "b", to: "hibernated" }]);
  });

  it("does nothing when everything is already in place", () => {
    const tabs: LifecycleTab[] = [
      { id: "a", lifecycle: "active", lastActiveAt: 0 },
      { id: "b", lifecycle: "hibernated", lastActiveAt: 0 },
    ];
    expect(planLifecycle(tabs, "a", 99999, opts)).toEqual([]);
  });
});
