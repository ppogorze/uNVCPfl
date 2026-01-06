# uNVCPfL

> **Unofficial NVIDIA Control Panel for Linux**

⚠️ **Work in Progress** - This project is under active development.

> **Note**: This codebase is primarily AI-generated as a proof of concept. The code structure and implementation were created with AI assistance and may require manual refinement for production use.

Idea from: [EmkMage](https://www.reddit.com/r/cachyos/comments/1pw9j1z/wip_my_arch_nvidia_control_panel/#lightbox)

![Screenshot](public/screenshot.png)

A modern, user-friendly application to configure per-game graphics settings for Linux gaming. Built with Tauri, React, and Rust.

## ✨ Features

- **🎮 Game Detection** - Auto-detects games from Steam, Lutris, Heroic, and Faugus Launcher
- **⚙️ Per-Game Profiles** - Configure DLSS, DXVK, Gamescope, VKD3D and more for each game
- **📊 GPU Monitoring** - Real-time NVIDIA GPU stats via NVML
- **🔌 LACT Integration** - Switch GPU power profiles per-game (if LACT is installed)
- **📋 Launch Commands** - Copy ready-to-use Steam launch options
- **🖥️ Desktop Entry** - Create desktop shortcuts with configured settings

### Supported Environment Variables

| Category | Variables |
|----------|-----------|
| **DLSS** | `PROTON_DLSS_UPGRADE`, `PROTON_DLSS_INDICATOR`, `PROTON_ENABLE_NGX_UPDATER` |
| **DXVK-NVAPI** | `DXVK_NVAPI_DRS_NGX_DLSS_*_OVERRIDE`, Render Presets, Multi-Frame Generation |
| **VKD3D** | `VKD3D_CONFIG` (nodxr, dxr12, force_static_cbv, no_upload_hvv), `VKD3D_FRAME_RATE` |
| **NVIDIA** | `NVPRESENT_ENABLE_SMOOTH_MOTION`, `__NV_PRIME_RENDER_OFFLOAD`, VSync |
| **Proton** | `PROTON_ENABLE_WAYLAND`, ESYNC/FSYNC/NTSYNC modes |
| **Wrappers** | MangoHud, Gamemode, game-performance, Gamescope, DLSS Swapper |

## 🚀 Quick Start

### Prerequisites

```bash
# Arch/CachyOS
sudo pacman -S webkit2gtk-4.1 base-devel curl wget openssl gtk3 libayatana-appindicator librsvg

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install --lts
```

### Build & Run

```bash
# Clone the repository
git clone https://github.com/yourusername/unvcpfl.git
cd unvcpfl

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

The built application will be in `src-tauri/target/release/`.

## 📖 Usage

### Using the GUI

1. **Launch uNVCPfL** - Games are automatically detected
2. **Select a game** from the sidebar
3. **Configure settings** - Toggle options, adjust values
4. **Save** - Click the Save button
5. **Copy launch option** - Use "Copy unvcpfl" or "Copy Full" button
6. **Create Desktop Entry** (optional) - Creates a .desktop file with your settings

### Using the Wrapper Script

Add to your Steam game's launch options:

```bash
# Simple method (uses saved profile)
unvcpfl --profile "Game Name" %command%

# Or copy the full command from the app
```

#### Installing the Wrapper

```bash
sudo cp scripts/unvcpfl /usr/local/bin/
sudo chmod +x /usr/local/bin/unvcpfl
```

## 🐧 CachyOS Support

This app is optimized for [CachyOS](https://cachyos.org/) with special support for:

- **game-performance** - CachyOS scheduler optimization wrapper
- **NTSYNC** - Native sync support (kernel 6.3+)
- **Optimized defaults** - Settings tuned for CachyOS gaming

Enable "Game Performance (CachyOS)" in the Wrappers section to use `game-performance`.

## 🔧 Configuration

Profiles are stored as TOML files in:

```
~/.config/unvcpfl/profiles/
├── cyberpunk_2077.toml
├── elden_ring.toml
└── global_settings.toml
```

## 🔗 LACT Integration

If [LACT](https://github.com/ilya-zlobintsev/LACT) is installed, you can switch GPU power profiles per-game:

```bash
# Verify LACT is working
lact cli profile list
```

The app will automatically detect LACT and show the profile dropdown.

## 🔧 Troubleshooting

### Poor Performance on Wayland

If you experience sluggish UI or poor scrolling performance on Wayland, try:

```bash
WEBKIT_DISABLE_COMPOSITING_MODE=1 npm run tauri dev
```

Or add to your environment permanently:

```bash
export WEBKIT_DISABLE_COMPOSITING_MODE=1
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.

**Important**: This project is currently a proof of concept with AI-generated code. I plan to manually refactor and improve the codebase to ensure code quality and remove any "AI slop". Contributions that improve code quality, fix bugs, or add well-designed features are especially appreciated.

## 📄 License

MIT License - See [LICENSE](LICENSE) for details.

---

Made with 💚 for the Linux gaming community
