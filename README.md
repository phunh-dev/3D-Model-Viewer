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

## Setting up a new machine

Follow these steps in order to clone the repo and run the app on a fresh Windows, macOS or Linux machine.

You need four things:

| Tool | Why | Version |
|---|---|---|
| Git | Clone the repo | any recent |
| Node.js + npm | Frontend build, Vite, tests | LTS (22 or newer) |
| Rust | Compiles the Tauri desktop shell | stable, installed with rustup |
| OS build tools | C/C++ compiler and the system WebView that Tauri uses | see the step for your OS |

### 1. Install the OS build tools

#### Windows 10 / 11

1. **Microsoft C++ Build Tools**
   1. Download *Build Tools for Visual Studio* from https://visualstudio.microsoft.com/visual-cpp-build-tools/.
   2. In the installer, tick the **"Desktop development with C++"** workload. Keep the default components, which include MSVC and a Windows SDK.
   3. Click Install (about 6–8 GB) and restart Windows if asked.
2. **WebView2**
   - Windows 11: already installed.
   - Windows 10: install the *Evergreen Bootstrapper* from https://developer.microsoft.com/microsoft-edge/webview2/.

With `winget`, both can be installed from a terminal instead:

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools --override "--wait --passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
winget install Microsoft.EdgeWebView2Runtime
```

> Install the Build Tools **before** Rust. On Windows, the default Rust toolchain uses the MSVC linker.

#### macOS

```bash
xcode-select --install
```

#### Linux

Debian / Ubuntu:

```bash
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev \
  libssl-dev libayatana-appindicator3-dev librsvg2-dev
```

Fedora:

```bash
sudo dnf check-update
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel \
  librsvg2-devel libxdo-devel
sudo dnf group install "c-development"
```

Arch:

```bash
sudo pacman -Syu
sudo pacman -S --needed webkit2gtk-4.1 base-devel curl wget file openssl appmenu-gtk-module \
  libappindicator-gtk3 librsvg xdotool
```

For other distributions, see the [Tauri prerequisites](https://tauri.app/start/prerequisites/).

### 2. Install Rust

- **Windows**
  1. Download and run `rustup-init.exe` from https://rustup.rs.
  2. When it asks, type `1` and press Enter for the default installation. The default toolchain is `stable-x86_64-pc-windows-msvc`.
  - Or, with winget: `winget install Rustlang.Rustup`.
- **macOS / Linux**

  ```bash
  curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
  ```

  Choose the default installation, then run `source "$HOME/.cargo/env"`, or open a new terminal.

### 3. Install Node.js

Install the **LTS** version:
- **Windows / macOS:** use the installer from https://nodejs.org. With winget on Windows: `winget install OpenJS.NodeJS.LTS`.
- **Linux:** use [nvm](https://github.com/nvm-sh/nvm) or your package manager. Avoid very old distro packages.

### 4. Check the toolchain

**Close and reopen your terminal first**, and VS Code too if you use its terminal. Otherwise the new `PATH` entries are not picked up. Then run:

```bash
git --version
node -v        # v22.x or newer
npm -v
rustc --version
cargo --version
```

If every command prints a version, the machine is ready.

### 5. Clone and install dependencies

```bash
git clone https://github.com/phunh-dev/3D-Model-Viewer.git
cd 3D-Model-Viewer
npm ci
```

- `npm ci` installs the exact versions from `package-lock.json`.
- Rust crates are downloaded automatically on the first build, pinned by `src-tauri/Cargo.lock`.
- Until the work is merged into `main`, switch to the feature branch after cloning: `git switch feat/model-viewer`.

### 6. Run the app

```bash
npm run tauri dev
```

- The **first run takes a few minutes** (roughly 2–10) because Cargo compiles all the Rust dependencies. Later runs start in seconds.
- The app window opens by itself.
- Changes to files under `src/` reload instantly. Changes under `src-tauri/` rebuild the Rust part and restart the window.

To test quickly, use the sample models from the three.js repo, for example `examples/models/fbx/Samba Dancing.fbx` or `examples/models/collada/stormtrooper/`. Drag them onto the window.

### 7. Run checks

```bash
npm test             # unit tests (Vitest)
npm run typecheck    # TypeScript
```

### 8. Build an installer

```bash
npm run tauri build
```

Tauri can only build installers for the OS it runs on. Output goes to `src-tauri/target/release/bundle/`:

| OS | Files |
|---|---|
| Windows | `msi/*.msi`, `nsis/*-setup.exe` |
| macOS | `macos/*.app`, `dmg/*.dmg` |
| Linux | `deb/*.deb`, `rpm/*.rpm`, `appimage/*.AppImage` |

The Windows bundler downloads WiX and NSIS automatically the first time.

To get installers for all three platforms without owning each OS, use GitHub Actions (`.github/workflows/release.yml`):
- Push a tag such as `git tag v0.1.0 && git push origin v0.1.0` to create a draft GitHub release with every installer attached.
- Or run the workflow manually from the *Actions* tab.

### Troubleshooting

| Symptom | Fix |
|---|---|
| `cargo` / `rustc` not found | Reopen the terminal (and VS Code) after installing Rust. On Windows, check that `%USERPROFILE%\.cargo\bin` is in `PATH`. |
| `link.exe not found` or MSVC errors (Windows) | The "Desktop development with C++" workload is missing. Open *Visual Studio Installer* → *Modify* → tick it. |
| `Port 1420 is already in use` | Another dev server is still running. Close it, or find and stop it: Windows `netstat -ano \| findstr :1420` then `taskkill /PID <pid> /F`; macOS/Linux `lsof -i :1420` then `kill <pid>`. |
| `webkit2gtk-4.1` / `javascriptcoregtk` not found (Linux) | Install the Linux packages from step 1. |
| Black viewport or no 3D on Linux / in a VM | WebGL needs working GPU drivers. Update the drivers, or enable 3D acceleration in the VM. |
| `warning X4122 ... double precision` in the console (Windows) | Harmless shader-compiler warning from the WebView. You can ignore it. |
| Textures missing after opening a model | Keep the image files next to the model or in a `textures/` folder near it. The Inspector lists the textures it could not find. |

### Browser-only UI mode

`npm run dev` runs the UI in a normal browser at http://localhost:1420 without Rust. This is handy for UI work.

A browser cannot read neighbouring files on its own, so pick or drop the model **together with** its textures and `.mtl`.

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
