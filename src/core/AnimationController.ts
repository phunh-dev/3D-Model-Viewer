import { AnimationAction, AnimationClip, AnimationMixer, LoopOnce, LoopRepeat, Object3D } from "three";
import { Signal } from "./signal";

export interface ClipInfo {
  name: string;
  duration: number;
}

export interface AnimationState {
  clips: ClipInfo[];
  index: number;
  playing: boolean;
  loop: boolean;
  speed: number;
  duration: number;
  fps: number;
}

export const SPEEDS = [0.25, 0.5, 1, 1.5, 2];

/** Guesses the frame rate a clip was baked at from its keyframe spacing (falls back to 30). */
export function estimateFps(clip: AnimationClip): number {
  let minDelta = Infinity;
  for (const track of clip.tracks) {
    const t = track.times;
    const n = Math.min(t.length, 300);
    for (let i = 1; i < n; i++) {
      const d = t[i] - t[i - 1];
      if (d > 1e-4 && d < minDelta) minDelta = d;
    }
  }
  if (!Number.isFinite(minDelta)) return 30;
  const fps = Math.round(1 / minDelta);
  return fps >= 1 && fps <= 240 ? fps : 30;
}

/**
 * Wraps AnimationMixer with the operations the timeline needs. Framework-free so it can be
 * unit-tested and driven by the render loop. `changed` fires on state changes (clip, play,
 * loop...), `tick` fires whenever the playhead moves.
 */
export class AnimationController {
  readonly changed = new Signal();
  readonly tick = new Signal();
  readonly mixer: AnimationMixer;

  private action: AnimationAction | null = null;
  private wasPlayingBeforeScrub = false;
  private _state: AnimationState;

  constructor(
    root: Object3D,
    private clips: AnimationClip[],
  ) {
    this.mixer = new AnimationMixer(root);
    this.mixer.addEventListener("finished", () => {
      this.set({ playing: false });
      this.tick.emit();
    });
    this._state = {
      clips: clips.map((c, i) => ({ name: c.name || `Animation ${i + 1}`, duration: c.duration })),
      index: -1,
      playing: false,
      loop: true,
      speed: 1,
      duration: 0,
      fps: 30,
    };
    if (clips.length > 0) this.select(0, true);
  }

  get state(): AnimationState {
    return this._state;
  }

  get time(): number {
    return this.action?.time ?? 0;
  }

  get hasClips(): boolean {
    return this.clips.length > 0;
  }

  select(index: number, autoplay = this._state.playing): void {
    const clip = this.clips[index];
    if (!clip) return;
    this.mixer.stopAllAction();
    const action = this.mixer.clipAction(clip);
    action.reset();
    this.applyLoop(action, this._state.loop);
    action.paused = !autoplay;
    action.play();
    this.action = action;
    this.mixer.update(0);
    this.set({ index, playing: autoplay, duration: clip.duration, fps: estimateFps(clip) });
    this.tick.emit();
  }

  play(): void {
    const a = this.action;
    if (!a) return;
    // A non-looping clip that reached its end restarts from the beginning.
    if (!this._state.loop && a.time >= a.getClip().duration - 1e-4) {
      a.reset();
      this.applyLoop(a, false);
    }
    a.enabled = true;
    a.paused = false;
    if (!a.isScheduled()) a.play();
    this.set({ playing: true });
  }

  pause(): void {
    if (!this.action) return;
    this.action.paused = true;
    this.set({ playing: false });
  }

  toggle(): void {
    if (this._state.playing) this.pause();
    else this.play();
  }

  setLoop(loop: boolean): void {
    if (this.action) {
      const time = this.action.time;
      this.applyLoop(this.action, loop);
      this.action.time = time;
    }
    this.set({ loop });
  }

  setSpeed(speed: number): void {
    this.mixer.timeScale = speed;
    this.set({ speed });
  }

  seek(time: number): void {
    const a = this.action;
    if (!a) return;
    const duration = a.getClip().duration;
    a.enabled = true;
    if (!a.isScheduled()) a.play();
    a.time = Math.min(Math.max(time, 0), duration);
    this.mixer.update(0);
    this.tick.emit();
  }

  step(frames: number): void {
    if (!this.action) return;
    this.pause();
    this.seek(this.time + frames / this._state.fps);
  }

  /** While the user drags the slider the clip is paused; releasing restores the previous state. */
  beginScrub(): void {
    this.wasPlayingBeforeScrub = this._state.playing;
    if (this.action) this.action.paused = true;
  }

  endScrub(): void {
    if (this.wasPlayingBeforeScrub) this.play();
    else this.set({ playing: false });
  }

  /** Advances the mixer; returns true while the pose keeps changing (so the frame must be redrawn). */
  update(dt: number): boolean {
    if (!this.action || !this._state.playing) return false;
    this.mixer.update(dt);
    this.tick.emit();
    // Even if the clip just finished, this frame's pose still has to be drawn.
    return true;
  }

  dispose(): void {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.mixer.getRoot());
  }

  private applyLoop(action: AnimationAction, loop: boolean) {
    action.setLoop(loop ? LoopRepeat : LoopOnce, Infinity);
    action.clampWhenFinished = true;
  }

  private set(patch: Partial<AnimationState>) {
    this._state = { ...this._state, ...patch };
    this.changed.emit();
  }
}
