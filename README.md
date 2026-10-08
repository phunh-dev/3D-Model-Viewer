# 3D Model Viewer

A local, offline desktop app for Windows, macOS and Linux for inspecting `.fbx`, `.obj` and `.dae` models, their animations and textures.

## Features

- **Open files** by drag & drop or with the file dialog (`Ctrl+O`). Each model opens in its own tab, and several files can be dropped at once.
- **Clay / Textured** display modes, plus wireframe and a ground grid.
- **Camera:** left mouse pans, middle mouse (or wheel) zooms, right mouse orbits, `F` frames the model.
- **Animations:** pick a clip from the dropdown. The timeline supports scrubbing, play/pause, loop/once, speed (0.25x–2x) and frame stepping.
- **Textures:** shows which maps the model uses (Albedo, Normal, Displacement, AO, Roughness, Metalness, Specular, Emissive, Alpha, Bump, Lightmap), with a large preview and per-channel R/G/B/A view.
  - Export copies the original file. Textures embedded in the model are exported as PNG.
- **Texture lookup:** finds textures even when the model stores absolute paths from another machine. It searches next to the model, `textures/` sub-folders and the parent folder, ignores case, and falls back to the same file name with another extension.
- **Tab performance:** one shared WebGL renderer for the whole app.
  - Only the visible tab renders, and only while something changes (animation playing or camera moving).
  - Hidden tabs sleep. After 5 minutes, or when more than 3 tabs are sleeping, a tab hibernates and releases its VRAM.
- **UI:** dark and light themes, tooltips with shortcuts. Press `?` for the full shortcut list.

## Tech stack

| Layer | Choice |
|---|---|
| Desktop shell | Tauri 2 (Rust) |
| UI | React 19 + TypeScript, Vite, Tailwind CSS 4, Radix UI, Zustand, lucide-react, sonner |
| 3D | three.js (FBXLoader, OBJLoader + MTLLoader, ColladaLoader, TGALoader, DDSLoader, OrbitControls) |
| Tests | Vitest |

## Development

Prerequisites:
- Node.js LTS.
- Rust via [rustup](https://rustup.rs).
- The platform dependencies listed in the [Tauri prerequisites](https://tauri.app/start/prerequisites/):
  - Windows: *Microsoft C++ Build Tools* ("Desktop development with C++") and WebView2. WebView2 is preinstalled on Windows 11.
  - macOS: Xcode Command Line Tools.
  - Linux: `libwebkit2gtk-4.1-dev`, `libappindicator3-dev`, `librsvg2-dev`, `patchelf`.

```bash
npm install
npm run tauri dev      # run the desktop app with hot reload
npm test               # unit tests
npm run typecheck
npm run tauri build    # build an installer for the current OS
```

`npm run dev` also runs the UI in a normal browser without Rust. This is handy for UI work. Pick or drop the model **together with** its textures and `.mtl`, because a browser cannot read neighbouring files by itself.

Installers for all three platforms are built by GitHub Actions (`.github/workflows/release.yml`). Push a `v*` tag to get a draft release.

## Localization

All UI text lives in [`src/locales/en.json`](src/locales/en.json) and [`src/locales/vi.json`](src/locales/vi.json). The code only refers to text by id:
- `t("viewport.loading")` returns plain text.
- `tn("inspector.frames", n)` handles plurals: it picks `<id>.one` or `<id>.other`.
- `<Trans id="…" values={{ name: <b/> }} />` is for text with styled parts.

To edit a translation, change only the value on the right. Keep the ids and the `{placeholders}` as they are. `npm test` fails if the two files end up with different ids or placeholders. Text ids are type-checked, so a typo in code fails the build.

To add a language:
1. Copy `en.json` to `<code>.json`.
2. Register it in `src/i18n/index.ts`.
3. Add a `language.<code>` entry to every locale file.

## Project layout

```
src/
  core/         three.js logic, framework-free
    RenderManager.ts         shared renderer + on-demand render loop
    ViewerSession.ts         one tab: scene, camera, controls, display modes, hibernation
    loadModel.ts             FBX/OBJ/DAE loading + texture resolution
    textureResolver.ts       finds texture files for a model
    AnimationController.ts   clip selection, timeline, loop, speed
    collectTextures.ts       texture slots per material
    tabLifecycle.ts          active / sleeping / hibernated rules
    textureImage.ts, exportTexture.ts
  components/   React UI (TabBar, Viewport, Inspector, Timeline, dialogs)
  store/        Zustand store (tabs, preferences)
  lib/          platform layer (Tauri vs browser), prefs, formatting
src-tauri/      Rust side: plugins + scan_textures / copy_file commands
tests/          Vitest unit tests
```
