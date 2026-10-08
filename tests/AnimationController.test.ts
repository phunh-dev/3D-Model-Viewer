import { describe, expect, it } from "vitest";
import { AnimationClip, Object3D, VectorKeyframeTrack } from "three";
import { AnimationController, estimateFps } from "../src/core/AnimationController";

function makeClip(name: string, duration = 2, fps = 30) {
  const times: number[] = [];
  const values: number[] = [];
  for (let f = 0; f <= duration * fps; f++) {
    times.push(f / fps);
    values.push(f / fps, 0, 0); // x == time, easy to assert
  }
  return new AnimationClip(name, duration, [new VectorKeyframeTrack(".position", times, values)]);
}

function setup() {
  const root = new Object3D();
  const ctrl = new AnimationController(root, [makeClip("Walk"), makeClip("Run", 1, 24)]);
  return { root, ctrl };
}

describe("AnimationController", () => {
  it("auto-selects and plays the first clip", () => {
    const { ctrl } = setup();
    expect(ctrl.state.index).toBe(0);
    expect(ctrl.state.playing).toBe(true);
    expect(ctrl.state.clips.map((c) => c.name)).toEqual(["Walk", "Run"]);
  });

  it("estimates fps from keyframe spacing", () => {
    expect(estimateFps(makeClip("a", 1, 24))).toBe(24);
    expect(estimateFps(new AnimationClip("empty", 1, []))).toBe(30);
  });

  it("seeks while paused and applies the pose", () => {
    const { root, ctrl } = setup();
    ctrl.pause();
    ctrl.seek(1.5);
    expect(ctrl.time).toBeCloseTo(1.5);
    expect(root.position.x).toBeCloseTo(1.5);
    ctrl.update(0.5); // paused: no movement
    expect(ctrl.time).toBeCloseTo(1.5);
  });

  it("loops by default and wraps the playhead", () => {
    const { ctrl } = setup();
    ctrl.update(2.5);
    expect(ctrl.time).toBeCloseTo(0.5);
    expect(ctrl.state.playing).toBe(true);
  });

  it("stops at the end when loop is off, then restarts on play", () => {
    const { ctrl } = setup();
    ctrl.setLoop(false);
    ctrl.update(3);
    expect(ctrl.state.playing).toBe(false);
    expect(ctrl.time).toBeCloseTo(2);
    ctrl.play();
    expect(ctrl.time).toBeCloseTo(0);
    expect(ctrl.state.playing).toBe(true);
  });

  it("switches clips and keeps the paused state", () => {
    const { ctrl } = setup();
    ctrl.pause();
    ctrl.select(1);
    expect(ctrl.state.index).toBe(1);
    expect(ctrl.state.playing).toBe(false);
    expect(ctrl.state.fps).toBe(24);
    expect(ctrl.state.duration).toBe(1);
  });

  it("steps frame by frame", () => {
    const { ctrl } = setup();
    ctrl.select(1, false);
    ctrl.step(12);
    expect(ctrl.time).toBeCloseTo(0.5);
    ctrl.step(-100);
    expect(ctrl.time).toBe(0);
  });

  it("restores playback after scrubbing", () => {
    const { ctrl } = setup();
    ctrl.beginScrub();
    ctrl.seek(1);
    ctrl.update(0.5);
    expect(ctrl.time).toBeCloseTo(1);
    ctrl.endScrub();
    expect(ctrl.state.playing).toBe(true);
  });
});
