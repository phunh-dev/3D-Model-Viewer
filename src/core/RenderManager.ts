import {
  Mesh,
  NeutralToneMapping,
  NoToneMapping,
  OrthographicCamera,
  PlaneGeometry,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Texture,
  WebGLRenderTarget,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** What the render loop needs from a tab. Implemented by ViewerSession. */
export interface Renderable {
  readonly scene: Scene;
  readonly camera: import("three").PerspectiveCamera;
  readonly isReady: boolean;
  setActive(active: boolean): void;
  setAspect(aspect: number): void;
  /** Advances controls/animation. Returns true while something keeps moving. */
  update(dt: number): boolean;
}

/**
 * One WebGL context for the whole app. Only the active tab is rendered, and only when needed:
 * while animation plays, while the camera moves (incl. damping), or after `requestRender()`.
 * When nothing changes, no frames are drawn at all.
 */
export class RenderManager {
  readonly renderer: WebGLRenderer;
  readonly environment: Texture;
  private active: Renderable | null = null;
  private raf = 0;
  private last = 0;
  private dirty = false;
  private resizeObserver: ResizeObserver | null = null;

  constructor() {
    this.renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.toneMapping = NeutralToneMapping;
    this.renderer.setClearColor(0x000000, 0);

    const pmrem = new PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const canvas = this.renderer.domElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.display = "block";
    canvas.style.outline = "none";
    canvas.tabIndex = 0;
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) this.requestRender();
    });
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  mount(container: HTMLElement): () => void {
    container.appendChild(this.canvas);
    this.resizeObserver = new ResizeObserver(() => this.resize(container.clientWidth, container.clientHeight));
    this.resizeObserver.observe(container);
    this.resize(container.clientWidth, container.clientHeight);
    return () => {
      this.resizeObserver?.disconnect();
      this.canvas.remove();
    };
  }

  setActive(next: Renderable | null): void {
    if (this.active === next) return;
    this.active?.setActive(false);
    this.active = next;
    if (next) {
      next.setActive(true);
      next.setAspect(this.aspect());
    }
    // Don't leave the previous tab's last frame on screen while the new one is loading.
    if (!next?.isReady) this.renderer.clear();
    this.requestRender();
  }

  isActive(r: Renderable): boolean {
    return this.active === r;
  }

  requestRender = (): void => {
    this.dirty = true;
    this.schedule();
  };

  private schedule() {
    if (!this.raf && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const s = this.active;
    if (!s || !s.isReady || document.hidden) {
      this.last = 0;
      return;
    }
    const dt = this.last ? Math.min((now - this.last) / 1000, 0.1) : 1 / 60;
    const moving = s.update(dt);
    if (moving || this.dirty) {
      this.dirty = false;
      this.renderer.render(s.scene, s.camera);
    }
    if (moving) {
      this.last = now;
      this.schedule();
    } else {
      this.last = 0;
    }
  };

  private aspect() {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    return w > 0 && h > 0 ? w / h : 1;
  }

  private resize(w: number, h: number) {
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.active?.setAspect(w / h);
    this.requestRender();
  }

  // ------------------------------------------------------------ texture readback

  private blit: { scene: Scene; camera: OrthographicCamera; material: ShaderMaterial } | null = null;

  /** Renders any texture (incl. compressed) into an RGBA8 buffer, top row first. */
  readTexturePixels = (texture: Texture, width: number, height: number): ImageData | null => {
    try {
      if (!this.blit) {
        const material = new ShaderMaterial({
          uniforms: { map: { value: null }, srgb: { value: false } },
          vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
          fragmentShader: `
            uniform sampler2D map; uniform bool srgb; varying vec2 vUv;
            vec3 toSrgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
            void main(){ vec4 c = texture2D(map, vUv); if (srgb) c.rgb = toSrgb(c.rgb); gl_FragColor = c; }`,
          depthTest: false,
          depthWrite: false,
        });
        const scene = new Scene();
        scene.add(new Mesh(new PlaneGeometry(2, 2), material));
        this.blit = { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
      }
      const target = new WebGLRenderTarget(width, height);
      this.blit.material.uniforms.map.value = texture;
      this.blit.material.uniforms.srgb.value = texture.colorSpace === SRGBColorSpace;

      const prevTarget = this.renderer.getRenderTarget();
      const prevTone = this.renderer.toneMapping;
      this.renderer.toneMapping = NoToneMapping;
      this.renderer.setRenderTarget(target);
      this.renderer.render(this.blit.scene, this.blit.camera);
      const buf = new Uint8Array(width * height * 4);
      this.renderer.readRenderTargetPixels(target, 0, 0, width, height, buf);
      this.renderer.setRenderTarget(prevTarget);
      this.renderer.toneMapping = prevTone;
      target.dispose();
      this.blit.material.uniforms.map.value = null;

      // GL rows go bottom-up; images uploaded with flipY end up upside down otherwise.
      const out = new Uint8ClampedArray(buf.length);
      const row = width * 4;
      for (let y = 0; y < height; y++) {
        const srcRow = texture.flipY ? height - 1 - y : y;
        out.set(buf.subarray(srcRow * row, srcRow * row + row), y * row);
      }
      this.requestRender();
      return new ImageData(out, width, height);
    } catch (err) {
      console.warn("GPU texture readback failed", err);
      return null;
    }
  };
}

let instance: RenderManager | null = null;

export function getRenderManager(): RenderManager {
  if (!instance) {
    instance = new RenderManager();
    // Handy for inspecting `renderer.info` from devtools.
    if (import.meta.env.DEV) (window as unknown as { __renderManager: RenderManager }).__renderManager = instance;
  }
  return instance;
}
