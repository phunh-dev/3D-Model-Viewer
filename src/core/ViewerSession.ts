import {
  Bone,
  Box3,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Material,
  MathUtils,
  Mesh,
  MeshStandardMaterial,
  MOUSE,
  Object3D,
  PerspectiveCamera,
  Scene,
  SkinnedMesh,
  Sphere,
  Vector3,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { ModelSource } from "../lib/platform";
import { AnimationController } from "./AnimationController";
import { collectTextures, texturesOf, type TextureEntry } from "./collectTextures";
import { forEachMaterial, loadModel, type LoadedModel } from "./loadModel";
import type { RenderManager, Renderable } from "./RenderManager";
import { Signal } from "./signal";
import type { Lifecycle } from "./tabLifecycle";
import type { TextureCandidate } from "./textureResolver";

export type DisplayMode = "clay" | "textured";

export interface ModelStats {
  meshes: number;
  vertices: number;
  triangles: number;
  materials: number;
  bones: number;
  fileSize: number;
}

export interface SessionState {
  status: "loading" | "ready" | "error";
  progress: number;
  error?: string;
  displayMode: DisplayMode;
  wireframe: boolean;
  grid: boolean;
  lifecycle: Lifecycle;
  stats?: ModelStats;
  textures: TextureEntry[];
  missing: string[];
}

const CLAY_COLOR = new Color("#c2c2c2");
const DEFAULT_DIR = new Vector3(0.55, 0.35, 1).normalize();

/** One tab: its own scene, camera, controls and animation, rendered through the shared renderer. */
export class ViewerSession implements Renderable {
  readonly changed = new Signal();
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(45, 1, 0.01, 1000);
  readonly controls: OrbitControls;
  animation: AnimationController | null = null;
  lastActiveAt = Date.now();

  private model: LoadedModel | null = null;
  private root: Object3D | null = null;
  private grid: GridHelper | null = null;
  private keyLight = new DirectionalLight(0xffffff, 2.2);
  private originals = new Map<Mesh, Material | Material[]>();
  private clay = new MeshStandardMaterial({ color: CLAY_COLOR, roughness: 0.85, metalness: 0, name: "Clay" });
  private _state: SessionState;

  constructor(
    readonly id: string,
    readonly source: ModelSource,
    private rm: RenderManager,
    defaults: { displayMode: DisplayMode; grid: boolean },
  ) {
    this._state = {
      status: "loading",
      progress: 0,
      displayMode: defaults.displayMode,
      wireframe: false,
      grid: defaults.grid,
      lifecycle: "sleeping",
      textures: [],
      missing: [],
    };

    this.scene.environment = rm.environment;
    this.scene.environmentIntensity = 0.7;
    this.scene.add(new HemisphereLight(0xffffff, 0x3a3f4a, 1.1));
    this.scene.add(this.keyLight);
    this.camera.position.set(0, 1, 3);

    this.controls = new OrbitControls(this.camera, rm.canvas);
    // Left = pan, middle = zoom, right = orbit (wheel still zooms).
    this.controls.mouseButtons = { LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE };
    this.controls.screenSpacePanning = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.12;
    this.controls.zoomToCursor = true;
    this.controls.enabled = false;
    this.controls.addEventListener("change", rm.requestRender);
  }

  get state(): SessionState {
    return this._state;
  }

  get isReady(): boolean {
    return this._state.status === "ready";
  }

  // ------------------------------------------------------------ loading

  async load(): Promise<void> {
    this.set({ status: "loading", progress: 0, error: undefined });
    try {
      const model = await loadModel(this.source, (progress) => this.set({ progress }));
      this.model = model;
      this.root = model.root;
      this.scene.add(model.root);

      model.root.traverse((o) => {
        const mesh = o as Mesh;
        if (mesh.isMesh) this.originals.set(mesh, mesh.material);
      });
      if (model.clips.length) {
        this.animation = new AnimationController(model.root, model.clips);
      }

      const materials: Material[] = [];
      forEachMaterial(model.root, (m) => materials.push(m));

      this.set({
        status: "ready",
        progress: 1,
        stats: computeStats(model.root, materials.length, model.fileSize),
        textures: collectTextures(materials, (t) => model.sourceOf(t)?.path ?? t.uuid),
        missing: model.missing,
      });
      this.buildGrid();
      this.applyDisplayMode();
      this.frame();
    } catch (err) {
      console.error(err);
      this.set({ status: "error", error: err instanceof Error ? err.message : String(err) });
    }
  }

  async reload(): Promise<void> {
    this.unloadModel();
    await this.load();
  }

  textureSource(entry: TextureEntry): TextureCandidate | null {
    return this.model?.sourceOf(entry.texture) ?? null;
  }

  // ------------------------------------------------------------ view settings

  setDisplayMode(displayMode: DisplayMode): void {
    this.set({ displayMode });
    this.applyDisplayMode();
  }

  setWireframe(wireframe: boolean): void {
    this.set({ wireframe });
    for (const m of this.allMaterials()) if ("wireframe" in m) (m as MeshStandardMaterial).wireframe = wireframe;
    this.rm.requestRender();
  }

  setGrid(grid: boolean): void {
    this.set({ grid });
    if (this.grid) this.grid.visible = grid;
    this.rm.requestRender();
  }

  /** Points the camera at the whole model. */
  frame(): void {
    const sphere = this.boundingSphere();
    const r = Math.max(sphere.radius, 1e-3);
    const dist = (r / Math.sin(MathUtils.degToRad(this.camera.fov) / 2)) * 1.1;

    this.camera.near = dist / 200;
    this.camera.far = dist * 200;
    this.camera.position.copy(sphere.center).addScaledVector(DEFAULT_DIR, dist);
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(sphere.center);
    this.controls.minDistance = r * 0.01;
    this.controls.maxDistance = dist * 50;
    this.controls.update();

    this.keyLight.position.copy(sphere.center).add(new Vector3(r * 1.5, r * 3, r * 2));
    this.keyLight.target.position.copy(sphere.center);
    this.keyLight.target.updateMatrixWorld();
    this.rm.requestRender();
  }

  // ------------------------------------------------------------ Renderable

  setActive(active: boolean): void {
    this.controls.enabled = active;
    if (!active) this.lastActiveAt = Date.now();
  }

  setAspect(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  update(dt: number): boolean {
    const cameraMoving = this.controls.update(dt);
    const animating = this.animation?.update(dt) ?? false;
    return cameraMoving || animating;
  }

  // ------------------------------------------------------------ lifecycle

  setLifecycle(lifecycle: Lifecycle): void {
    if (lifecycle === this._state.lifecycle) return;
    if (lifecycle === "hibernated") this.releaseGpu();
    this.set({ lifecycle });
  }

  /**
   * Frees VRAM but keeps geometry/image data in memory. three.js re-uploads everything
   * automatically the next time this scene is rendered.
   */
  private releaseGpu() {
    this.scene.traverse((o) => {
      const g = (o as Mesh).geometry;
      if (g) g.dispose();
    });
    for (const m of this.allMaterials()) {
      for (const [, t] of texturesOf(m)) t.dispose();
      m.dispose();
    }
    (this.grid?.material as Material | undefined)?.dispose();
  }

  dispose(): void {
    this.controls.removeEventListener("change", this.rm.requestRender);
    this.controls.dispose();
    this.unloadModel();
    this.clay.dispose();
  }

  private unloadModel() {
    this.animation?.dispose();
    this.animation = null;
    if (this.root) {
      this.releaseGpu();
      this.scene.remove(this.root);
    }
    if (this.grid) {
      this.scene.remove(this.grid);
      this.grid.geometry.dispose();
      this.grid = null;
    }
    this.model?.release();
    this.model = null;
    this.root = null;
    this.originals.clear();
  }

  // ------------------------------------------------------------ helpers

  private applyDisplayMode() {
    const clay = this._state.displayMode === "clay";
    for (const [mesh, original] of this.originals) mesh.material = clay ? this.clay : original;
    this.rm.requestRender();
  }

  private allMaterials(): Material[] {
    const out = new Set<Material>([this.clay]);
    for (const m of this.originals.values()) for (const x of Array.isArray(m) ? m : [m]) out.add(x);
    return [...out];
  }

  /**
   * Bounds of the model in its current pose. Skinned meshes need fresh bone matrices first,
   * otherwise their cached box reflects the raw bind data (or nothing, before the first render).
   */
  private computeBounds(): Box3 {
    const box = new Box3();
    if (!this.root) return box;
    this.root.updateMatrixWorld(true);
    this.root.traverse((o) => {
      const skinned = o as SkinnedMesh;
      if (skinned.isSkinnedMesh) {
        skinned.skeleton.update();
        skinned.computeBoundingBox();
      }
    });
    return box.setFromObject(this.root);
  }

  private boundingSphere(): Sphere {
    const box = this.computeBounds();
    if (box.isEmpty()) return new Sphere(new Vector3(), 1);
    return box.getBoundingSphere(new Sphere());
  }

  private buildGrid() {
    const box = this.computeBounds();
    if (box.isEmpty()) return;
    const size = box.getSize(new Vector3());
    const extent = Math.max(size.x, size.z, size.y * 0.5);
    // Round the grid to a "nice" size: 1, 2 or 5 × 10^n.
    const raw = extent * 3;
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const nice = [1, 2, 5, 10].map((k) => k * pow).find((v) => v >= raw) ?? raw;

    const grid = new GridHelper(nice, 20, 0x8a93a6, 0x4a5262);
    const mat = grid.material as Material;
    mat.transparent = true;
    mat.opacity = 0.35;
    mat.depthWrite = false;
    grid.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
    grid.visible = this._state.grid;
    grid.renderOrder = -1;
    this.grid = grid;
    this.scene.add(grid);
  }

  private set(patch: Partial<SessionState>) {
    this._state = { ...this._state, ...patch };
    this.changed.emit();
  }
}

function computeStats(root: Object3D, materials: number, fileSize: number): ModelStats {
  let meshes = 0;
  let vertices = 0;
  let triangles = 0;
  const bones = new Set<Bone>();
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    meshes++;
    const g = mesh.geometry;
    const count = g.attributes.position?.count ?? 0;
    vertices += count;
    triangles += (g.index ? g.index.count : count) / 3;
    const skinned = o as SkinnedMesh;
    if (skinned.isSkinnedMesh) for (const b of skinned.skeleton.bones) bones.add(b);
  });
  return { meshes, vertices, triangles: Math.round(triangles), materials, bones: bones.size, fileSize };
}
