//! unvcpfl-cli - Command-line helper for profile parsing
//!
//! This binary provides reliable TOML profile parsing for the bash wrapper script.
//! Usage:
//!   unvcpfl-cli env <profile_file>        Outputs shell export commands
//!   unvcpfl-cli wrappers <profile_file>   Outputs wrapper command prefix
//!   unvcpfl-cli lact-profile <profile>    Outputs LACT profile name
//!   unvcpfl-cli lact-restore <profile>    Outputs "true" or "false"

use clap::{Parser, Subcommand};
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "unvcpfl-cli")]
#[command(about = "CLI helper for unvcpfl profile parsing")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Output shell export commands for environment variables
    Env { profile_file: PathBuf },
    /// Output wrapper command prefix
    Wrappers { profile_file: PathBuf },
    /// Output LACT profile name
    LactProfile { profile_file: PathBuf },
    /// Output whether to restore LACT profile ("true" or "false")
    LactRestore { profile_file: PathBuf },
}

// Minimal profile structs for CLI parsing (mirrors main profiles.rs)
#[derive(Debug, Deserialize, Default)]
struct DlssSettings {
    #[serde(default)]
    upgrade: bool,
    #[serde(default)]
    indicator: bool,
    #[serde(default)]
    ngx_updater: bool,
    #[serde(default)]
    sr_override: bool,
    #[serde(default)]
    rr_override: bool,
    #[serde(default)]
    fg_override: bool,
    sr_preset: Option<String>,
    rr_preset: Option<String>,
    fg_multi_frame: Option<u8>,
}

#[derive(Debug, Deserialize, Default)]
struct DxvkSettings {
    hud: Option<String>,
    #[serde(default)]
    nvapi: bool,
    #[serde(default)]
    async_compile: bool,
}

#[derive(Debug, Deserialize, Default)]
struct Vkd3dSettings {
    #[serde(default)]
    no_dxr: bool,
    #[serde(default)]
    force_dxr: bool,
    #[serde(default)]
    dxr12: bool,
    #[serde(default)]
    force_static_cbv: bool,
    #[serde(default)]
    single_queue: bool,
    #[serde(default)]
    no_upload_hvv: bool,
    #[serde(default)]
    frame_rate: u32,
}

#[derive(Debug, Deserialize, Default)]
struct NvidiaSettings {
    vsync: Option<String>,
    #[serde(default)]
    triple_buffer: bool,
    #[serde(default)]
    prime: bool,
    #[serde(default)]
    smooth_motion: bool,
}

#[derive(Debug, Deserialize, Default)]
struct ProtonSettings {
    verb: Option<String>,
    sync_mode: Option<String>,
    #[serde(default)]
    enable_wayland: bool,
    #[serde(default)]
    enable_hdr: bool,
    #[serde(default)]
    integer_scaling: bool,
}

#[derive(Debug, Deserialize, Default)]
struct MangoHudSettings {
    #[serde(default)]
    enabled: bool,
    #[serde(default)]
    fps_limit_enabled: bool,
    fps_limit: Option<u32>,
    fps_limiter_mode: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
struct GamescopeSettings {
    #[serde(default)]
    enabled: bool,
    width: Option<u32>,
    height: Option<u32>,
    internal_width: Option<u32>,
    internal_height: Option<u32>,
    #[serde(default)]
    dsr_enabled: bool,
    dsr_width: Option<u32>,
    dsr_height: Option<u32>,
    upscale_filter: Option<String>,
    fsr_sharpness: Option<u8>,
    #[serde(default = "default_true")]
    fullscreen: bool,
    #[serde(default)]
    borderless: bool,
    #[serde(default)]
    vrr: bool,
    framelimit: Option<u32>,
    #[serde(default)]
    mangoapp: bool,
    #[serde(default)]
    hdr: bool,
}

#[derive(Debug, Deserialize, Default)]
struct FrameLimiterSettings {
    #[serde(default)]
    enabled: bool,
    target_fps: Option<u32>,
    swapchain_latency: Option<u32>,
}

#[derive(Debug, Deserialize, Default)]
struct WrapperSettings {
    #[serde(default)]
    mangohud: MangoHudSettings,
    #[serde(default)]
    gamemode: bool,
    #[serde(default)]
    game_performance: bool,
    #[serde(default)]
    dlss_swapper: bool,
    #[serde(default)]
    gamescope: GamescopeSettings,
    #[serde(default)]
    frame_limiter: FrameLimiterSettings,
    lact_profile: Option<String>,
    #[serde(default = "default_true")]
    lact_restore_after_exit: bool,
}

#[derive(Debug, Deserialize)]
struct GameProfile {
    name: String,
    #[serde(default)]
    dlss: DlssSettings,
    #[serde(default)]
    dxvk: DxvkSettings,
    #[serde(default)]
    vkd3d: Vkd3dSettings,
    #[serde(default)]
    nvidia: NvidiaSettings,
    #[serde(default)]
    proton: ProtonSettings,
    #[serde(default)]
    wrappers: WrapperSettings,
    #[serde(default)]
    custom_env: HashMap<String, String>,
}

fn default_true() -> bool {
    true
}

fn build_env_vars(profile: &GameProfile) -> HashMap<String, String> {
    let mut env = HashMap::new();

    // DLSS settings
    if profile.dlss.upgrade {
        env.insert("PROTON_DLSS_UPGRADE".to_string(), "1".to_string());
    }
    if profile.dlss.indicator {
        env.insert("PROTON_DLSS_INDICATOR".to_string(), "1".to_string());
    }
    if profile.dlss.ngx_updater {
        env.insert("PROTON_ENABLE_NGX_UPDATER".to_string(), "1".to_string());
    }
    if profile.dlss.sr_override {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE".to_string(), "1".to_string());
    }
    if profile.dlss.rr_override {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE".to_string(), "1".to_string());
    }
    if profile.dlss.fg_override {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSS_FG_OVERRIDE".to_string(), "1".to_string());
    }
    if let Some(preset) = &profile.dlss.sr_preset {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSS_SR_PRESET".to_string(), preset.clone());
    }
    if let Some(preset) = &profile.dlss.rr_preset {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSS_RR_PRESET".to_string(), preset.clone());
    }
    if let Some(count) = profile.dlss.fg_multi_frame {
        env.insert("DXVK_NVAPI_DRS_NGX_DLSSG_MULTI_FRAME_COUNT".to_string(), count.to_string());
    }

    // DXVK settings
    if let Some(hud) = &profile.dxvk.hud {
        env.insert("DXVK_HUD".to_string(), hud.clone());
    }
    if profile.dxvk.nvapi {
        env.insert("DXVK_ENABLE_NVAPI".to_string(), "1".to_string());
    }
    if profile.dxvk.async_compile {
        env.insert("DXVK_ASYNC".to_string(), "1".to_string());
    }

    // VKD3D settings
    let mut vkd3d_config = Vec::new();
    if profile.vkd3d.no_dxr {
        vkd3d_config.push("nodxr");
    }
    if profile.vkd3d.force_dxr {
        vkd3d_config.push("dxr");
    }
    if profile.vkd3d.dxr12 {
        vkd3d_config.push("dxr12");
    }
    if profile.vkd3d.force_static_cbv {
        vkd3d_config.push("force_static_cbv");
    }
    if profile.vkd3d.single_queue {
        vkd3d_config.push("single_queue");
    }
    if profile.vkd3d.no_upload_hvv {
        vkd3d_config.push("no_upload_hvv");
    }
    if !vkd3d_config.is_empty() {
        env.insert("VKD3D_CONFIG".to_string(), vkd3d_config.join(","));
    }
    if profile.vkd3d.frame_rate > 0 {
        env.insert("VKD3D_FRAME_RATE".to_string(), profile.vkd3d.frame_rate.to_string());
    }

    // NVIDIA settings
    if let Some(vsync) = &profile.nvidia.vsync {
        let val = if vsync == "on" { "1" } else { "0" };
        env.insert("__GL_SYNC_TO_VBLANK".to_string(), val.to_string());
    }
    if profile.nvidia.prime {
        env.insert("__NV_PRIME_RENDER_OFFLOAD".to_string(), "1".to_string());
        env.insert("__VK_LAYER_NV_optimus".to_string(), "NVIDIA_only".to_string());
        env.insert("__GLX_VENDOR_LIBRARY_NAME".to_string(), "nvidia".to_string());
    }
    if profile.nvidia.smooth_motion {
        env.insert("NVPRESENT_ENABLE_SMOOTH_MOTION".to_string(), "1".to_string());
    }

    // Proton settings
    if let Some(verb) = &profile.proton.verb {
        env.insert("PROTON_VERB".to_string(), verb.clone());
    }
    if let Some(sync_mode) = &profile.proton.sync_mode {
        match sync_mode.as_str() {
            "esync" => { env.insert("PROTON_NO_FSYNC".to_string(), "1".to_string()); }
            "fsync" => { env.insert("PROTON_NO_ESYNC".to_string(), "1".to_string()); }
            "ntsync" => { env.insert("WINEFSYNC_FUTEX2".to_string(), "1".to_string()); }
            _ => {}
        }
    }
    if profile.proton.enable_wayland {
        env.insert("PROTON_ENABLE_WAYLAND".to_string(), "1".to_string());
    }
    if profile.proton.enable_hdr {
        env.insert("PROTON_ENABLE_HDR".to_string(), "1".to_string());
    }
    if profile.proton.integer_scaling {
        env.insert("WINE_FULLSCREEN_INTEGER_SCALING".to_string(), "1".to_string());
    }

    // Frame limiter
    if profile.wrappers.frame_limiter.enabled {
        if let Some(fps) = profile.wrappers.frame_limiter.target_fps {
            env.insert("DXVK_FRAME_RATE".to_string(), fps.to_string());
            env.insert("VKD3D_FRAME_RATE".to_string(), fps.to_string());
        }
        if let Some(latency) = profile.wrappers.frame_limiter.swapchain_latency {
            env.insert("VKD3D_SWAPCHAIN_LATENCY_FRAMES".to_string(), latency.to_string());
        }
    }

    // MangoHud
    if profile.wrappers.mangohud.enabled && profile.wrappers.mangohud.fps_limit_enabled {
        if let Some(fps) = profile.wrappers.mangohud.fps_limit {
            env.insert("MANGOHUD_CONFIG".to_string(), format!("fps_limit={}", fps));
        }
    }

    // Custom env
    for (key, value) in &profile.custom_env {
        env.insert(key.clone(), value.clone());
    }

    env
}

fn build_wrappers(profile: &GameProfile) -> Vec<String> {
    let mut wrappers = Vec::new();

    if profile.wrappers.mangohud.enabled {
        wrappers.push("mangohud".to_string());
    }
    if profile.wrappers.gamemode {
        wrappers.push("gamemoderun".to_string());
    }
    if profile.wrappers.game_performance {
        wrappers.push("game-performance".to_string());
    }
    if profile.wrappers.dlss_swapper {
        wrappers.push("dlss-swapper".to_string());
    }

    // Gamescope
    if profile.wrappers.gamescope.enabled {
        let mut gs_args = vec!["gamescope".to_string()];
        let gs = &profile.wrappers.gamescope;

        if let Some(w) = gs.width {
            gs_args.push(format!("-W {}", w));
        }
        if let Some(h) = gs.height {
            gs_args.push(format!("-H {}", h));
        }
        if let Some(w) = gs.internal_width {
            gs_args.push(format!("-w {}", w));
        }
        if let Some(h) = gs.internal_height {
            gs_args.push(format!("-h {}", h));
        }
        if gs.fullscreen {
            gs_args.push("-f".to_string());
        }
        if gs.borderless {
            gs_args.push("-b".to_string());
        }
        if gs.vrr {
            gs_args.push("--adaptive-sync".to_string());
        }
        if let Some(fps) = gs.framelimit {
            gs_args.push(format!("-r {}", fps));
        }
        if gs.mangoapp {
            gs_args.push("--mangoapp".to_string());
        }
        if gs.hdr {
            gs_args.push("--hdr-enabled".to_string());
        }
        if let Some(filter) = &gs.upscale_filter {
            gs_args.push(format!("-U {}", filter));
        }
        if let Some(sharpness) = gs.fsr_sharpness {
            gs_args.push(format!("--fsr-sharpness {}", sharpness));
        }
        gs_args.push("--".to_string());

        wrappers.push(gs_args.join(" "));
    }

    wrappers
}

fn main() {
    let cli = Cli::parse();

    match cli.command {
        Commands::Env { profile_file } => {
            let content = match fs::read_to_string(&profile_file) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Error reading profile: {}", e);
                    std::process::exit(1);
                }
            };
            let profile: GameProfile = match toml::from_str(&content) {
                Ok(p) => p,
                Err(e) => {
                    eprintln!("Error parsing profile: {}", e);
                    std::process::exit(1);
                }
            };

            let env_vars = build_env_vars(&profile);
            for (key, value) in env_vars {
                println!("export {}=\"{}\"", key, value.replace('"', "\\\""));
            }
        }
        Commands::Wrappers { profile_file } => {
            let content = match fs::read_to_string(&profile_file) {
                Ok(c) => c,
                Err(_) => return,
            };
            let profile: GameProfile = match toml::from_str(&content) {
                Ok(p) => p,
                Err(_) => return,
            };

            let wrappers = build_wrappers(&profile);
            println!("{}", wrappers.join(" "));
        }
        Commands::LactProfile { profile_file } => {
            let content = match fs::read_to_string(&profile_file) {
                Ok(c) => c,
                Err(_) => return,
            };
            let profile: GameProfile = match toml::from_str(&content) {
                Ok(p) => p,
                Err(_) => return,
            };

            if let Some(lact_profile) = profile.wrappers.lact_profile {
                println!("{}", lact_profile);
            }
        }
        Commands::LactRestore { profile_file } => {
            let content = match fs::read_to_string(&profile_file) {
                Ok(c) => c,
                Err(_) => {
                    println!("true");
                    return;
                }
            };
            let profile: GameProfile = match toml::from_str(&content) {
                Ok(p) => p,
                Err(_) => {
                    println!("true");
                    return;
                }
            };

            println!("{}", profile.wrappers.lact_restore_after_exit);
        }
    }
}
