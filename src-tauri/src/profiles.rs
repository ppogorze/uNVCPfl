use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DlssSettings {
    #[serde(default)]
    pub upgrade: bool, // PROTON_DLSS_UPGRADE=1
    #[serde(default)]
    pub indicator: bool, // PROTON_DLSS_INDICATOR=1
    #[serde(default)]
    pub ngx_updater: bool, // PROTON_ENABLE_NGX_UPDATER=1
    #[serde(default)]
    pub sr_override: bool, // DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE=on
    #[serde(default)]
    pub rr_override: bool, // DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE=on
    #[serde(default)]
    pub fg_override: bool, // DXVK_NVAPI_DRS_NGX_DLSS_FG_OVERRIDE=on
    pub sr_preset: Option<String>, // DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE_RENDER_PRESET_SELECTION
    pub rr_preset: Option<String>, // DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE_RENDER_PRESET_SELECTION
    pub fg_multi_frame: Option<String>, // DXVK_NVAPI_DRS_NGX_DLSSG_MULTI_FRAME_COUNT
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DxvkSettings {
    pub hud: Option<String>,
    #[serde(default)]
    pub nvapi: bool,
    #[serde(default)]
    pub async_compile: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Vkd3dSettings {
    #[serde(default)]
    pub no_dxr: bool, // nodxr - Disable DXR raytracing
    #[serde(default)]
    pub force_dxr: bool, // dxr - Force enable DXR even if unsafe
    #[serde(default)]
    pub dxr12: bool, // dxr12 - Experimental DXR 1.2 support
    #[serde(default)]
    pub force_static_cbv: bool, // force_static_cbv - NVIDIA speed hack (unsafe)
    #[serde(default)]
    pub single_queue: bool, // single_queue - No async compute/transfer
    #[serde(default)]
    pub no_upload_hvv: bool, // no_upload_hvv - Don't use resizable BAR for uploads
    #[serde(default)]
    pub frame_rate: u32, // VKD3D_FRAME_RATE
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NvidiaSettings {
    pub vsync: Option<String>,
    #[serde(default)]
    pub triple_buffer: bool,
    #[serde(default)]
    pub prime: bool,
    #[serde(default)]
    pub smooth_motion: bool, // RTX 40/50 only - NVPRESENT_ENABLE_SMOOTH_MOTION
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProtonSettings {
    pub verb: Option<String>,
    pub sync_mode: Option<String>, // "default", "esync", "fsync", "ntsync"
    #[serde(default)]
    pub enable_wayland: bool,
    #[serde(default)]
    pub enable_hdr: bool, // PROTON_ENABLE_HDR=1
    #[serde(default)]
    pub integer_scaling: bool, // WINE_FULLSCREEN_INTEGER_SCALING=1
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FrameLimiterSettings {
    #[serde(default)]
    pub enabled: bool,
    pub target_fps: Option<u32>,          // DXVK_FRAME_RATE / VKD3D_FRAME_RATE
    pub swapchain_latency: Option<u32>,   // VKD3D_SWAPCHAIN_LATENCY_FRAMES
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GamescopeSettings {
    #[serde(default)]
    pub enabled: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub internal_width: Option<u32>,
    pub internal_height: Option<u32>,
    #[serde(default)]
    pub dsr_enabled: bool, // Dynamic Super Resolution mode
    pub dsr_width: Option<u32>,
    pub dsr_height: Option<u32>,
    pub upscale_filter: Option<String>,
    pub fsr_sharpness: Option<u32>,
    #[serde(default)]
    pub fullscreen: bool,
    #[serde(default)]
    pub borderless: bool,
    #[serde(default)]
    pub vrr: bool,
    pub framelimit: Option<u32>,
    #[serde(default)]
    pub mangoapp: bool,
    #[serde(default)]
    pub hdr: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MangoHudSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub fps_limit_enabled: bool,
    pub fps_limit: Option<u32>,
    pub fps_limiter_mode: Option<String>, // "early", "late"
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct WrapperSettings {
    #[serde(default)]
    pub mangohud: MangoHudSettings,
    #[serde(default)]
    pub gamemode: bool,
    #[serde(default)]
    pub game_performance: bool, // CachyOS game-performance
    #[serde(default)]
    pub dlss_swapper: bool,
    #[serde(default)]
    pub gamescope: GamescopeSettings,
    #[serde(default)]
    pub frame_limiter: FrameLimiterSettings,
    pub lact_profile: Option<String>, // LACT GPU profile name
    #[serde(default = "default_true")]
    pub lact_restore_after_exit: bool, // Restore previous LACT profile after game exit
}

/// Settings for per-game screen/monitor configuration (Hyprland/Sway)
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ScreenSettings {
    pub target_monitor: Option<String>,      // Monitor name for game (e.g., "DP-1")
    #[serde(default)]
    pub fullscreen_on_target: bool,          // Force fullscreen on target monitor
    #[serde(default)]
    pub disable_other_monitors: bool,        // Turn off other monitors during gameplay
    #[serde(default = "default_true")]
    pub restore_monitors_after_exit: bool,   // Restore monitors after game exit
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameProfile {
    pub name: String,
    pub description: Option<String>,       // User-provided description
    #[serde(default)]
    pub is_template: bool,                  // True if this is a reusable template, not game-bound
    pub executable_match: Option<String>,
    pub steam_appid: Option<u32>,

    #[serde(default)]
    pub dlss: DlssSettings,
    #[serde(default)]
    pub dxvk: DxvkSettings,
    #[serde(default)]
    pub vkd3d: Vkd3dSettings,
    #[serde(default)]
    pub nvidia: NvidiaSettings,
    #[serde(default)]
    pub proton: ProtonSettings,
    #[serde(default)]
    pub wrappers: WrapperSettings,
    #[serde(default)]
    pub screen: ScreenSettings,

    #[serde(default)]
    pub custom_env: HashMap<String, String>,
    pub custom_args: Option<String>,
}

impl Default for GameProfile {
    fn default() -> Self {
        Self {
            name: String::new(),
            description: None,
            is_template: false,
            executable_match: None,
            steam_appid: None,
            dlss: DlssSettings::default(),
            dxvk: DxvkSettings::default(),
            vkd3d: Vkd3dSettings::default(),
            nvidia: NvidiaSettings::default(),
            proton: ProtonSettings::default(),
            wrappers: WrapperSettings::default(),
            screen: ScreenSettings::default(),
            custom_env: HashMap::new(),
            custom_args: None,
        }
    }
}

pub struct ProfileManager {
    profiles_dir: PathBuf,
}

impl ProfileManager {
    pub fn new() -> Self {
        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("~/.config"))
            .join("unvcpfl")
            .join("profiles");

        // Create profiles directory if it doesn't exist
        fs::create_dir_all(&config_dir).ok();

        Self {
            profiles_dir: config_dir,
        }
    }

    pub fn list_profiles(&self) -> Vec<GameProfile> {
        let mut profiles = Vec::new();

        if let Ok(entries) = fs::read_dir(&self.profiles_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "toml").unwrap_or(false) {
                    if let Ok(content) = fs::read_to_string(&path) {
                        if let Ok(profile) = toml::from_str::<GameProfile>(&content) {
                            profiles.push(profile);
                        }
                    }
                }
            }
        }

        profiles
    }

    pub fn get_profile(&self, name: &str) -> Option<GameProfile> {
        let filename = format!("{}.toml", name.to_lowercase().replace(' ', "_"));
        let path = self.profiles_dir.join(filename);

        fs::read_to_string(&path)
            .ok()
            .and_then(|content| toml::from_str(&content).ok())
    }

    pub fn get_profile_by_executable(&self, exe_name: &str) -> Option<GameProfile> {
        self.list_profiles().into_iter().find(|p| {
            p.executable_match
                .as_ref()
                .map(|e| e == exe_name)
                .unwrap_or(false)
        })
    }

    pub fn save_profile(&self, profile: &GameProfile) -> Result<(), String> {
        let filename = format!("{}.toml", profile.name.to_lowercase().replace(' ', "_"));
        let path = self.profiles_dir.join(filename);

        let content = toml::to_string_pretty(profile)
            .map_err(|e| format!("Failed to serialize profile: {}", e))?;

        fs::write(&path, content).map_err(|e| format!("Failed to write profile: {}", e))
    }

    pub fn delete_profile(&self, name: &str) -> Result<(), String> {
        let filename = format!("{}.toml", name.to_lowercase().replace(' ', "_"));
        let path = self.profiles_dir.join(filename);

        fs::remove_file(&path).map_err(|e| format!("Failed to delete profile: {}", e))
    }

    /// Duplicate an existing profile with a new name
    pub fn duplicate_profile(&self, source_name: &str, new_name: &str) -> Result<(), String> {
        let mut profile = self
            .get_profile(source_name)
            .ok_or_else(|| format!("Profile '{}' not found", source_name))?;

        profile.name = new_name.to_string();
        // Clear game-specific bindings when duplicating
        profile.executable_match = None;
        profile.steam_appid = None;
        profile.is_template = true;

        self.save_profile(&profile)
    }

    /// List only template profiles (is_template = true)
    pub fn list_template_profiles(&self) -> Vec<GameProfile> {
        self.list_profiles()
            .into_iter()
            .filter(|p| p.is_template)
            .collect()
    }

    /// Apply a template to a game profile
    pub fn apply_template(&self, template_name: &str, game_name: &str) -> Result<GameProfile, String> {
        let template = self
            .get_profile(template_name)
            .ok_or_else(|| format!("Template '{}' not found", template_name))?;

        let mut profile = template.clone();
        profile.name = game_name.to_string();
        profile.is_template = false;

        Ok(profile)
    }

    /// Generate environment variables from a profile
    pub fn build_env_vars(&self, profile: &GameProfile) -> HashMap<String, String> {
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
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE".to_string(),
                "on".to_string(),
            );
        }
        if profile.dlss.rr_override {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE".to_string(),
                "on".to_string(),
            );
        }
        if profile.dlss.fg_override {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_FG_OVERRIDE".to_string(),
                "on".to_string(),
            );
        }
        if let Some(preset) = &profile.dlss.sr_preset {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE_RENDER_PRESET_SELECTION".to_string(),
                preset.clone(),
            );
        }
        if let Some(preset) = &profile.dlss.rr_preset {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE_RENDER_PRESET_SELECTION".to_string(),
                preset.clone(),
            );
        }
        if let Some(count) = &profile.dlss.fg_multi_frame {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSSG_MULTI_FRAME_COUNT".to_string(),
                count.clone(),
            );
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
            env.insert(
                "VKD3D_FRAME_RATE".to_string(),
                profile.vkd3d.frame_rate.to_string(),
            );
        }

        // NVIDIA driver settings
        if let Some(vsync) = &profile.nvidia.vsync {
            let val = if vsync == "on" { "1" } else { "0" };
            env.insert("__GL_SYNC_TO_VBLANK".to_string(), val.to_string());
        }
        if profile.nvidia.prime {
            env.insert("__NV_PRIME_RENDER_OFFLOAD".to_string(), "1".to_string());
            env.insert(
                "__VK_LAYER_NV_optimus".to_string(),
                "NVIDIA_only".to_string(),
            );
            env.insert(
                "__GLX_VENDOR_LIBRARY_NAME".to_string(),
                "nvidia".to_string(),
            );
        }
        if profile.nvidia.smooth_motion {
            env.insert(
                "NVPRESENT_ENABLE_SMOOTH_MOTION".to_string(),
                "1".to_string(),
            );
        }

        // Proton settings
        if let Some(verb) = &profile.proton.verb {
            env.insert("PROTON_VERB".to_string(), verb.clone());
        }

        // Sync mode
        if let Some(sync_mode) = &profile.proton.sync_mode {
            match sync_mode.as_str() {
                "esync" => {
                    env.insert("PROTON_NO_FSYNC".to_string(), "1".to_string());
                }
                "fsync" => {
                    env.insert("PROTON_NO_ESYNC".to_string(), "1".to_string());
                }
                "ntsync" => {
                    // ntsync uses WINEFSYNC_FUTEX2 (kernel 6.3+)
                    env.insert("WINEFSYNC_FUTEX2".to_string(), "1".to_string());
                }
                _ => {} // "default" - let Proton decide
            }
        }

        if profile.proton.enable_wayland {
            env.insert("PROTON_ENABLE_WAYLAND".to_string(), "1".to_string());
        }

        // HDR and integer scaling
        if profile.proton.enable_hdr {
            env.insert("PROTON_ENABLE_HDR".to_string(), "1".to_string());
        }
        if profile.proton.integer_scaling {
            env.insert("WINE_FULLSCREEN_INTEGER_SCALING".to_string(), "1".to_string());
        }

        // Frame limiter (applies to both DXVK and VKD3D)
        if profile.wrappers.frame_limiter.enabled {
            if let Some(fps) = profile.wrappers.frame_limiter.target_fps {
                env.insert("DXVK_FRAME_RATE".to_string(), fps.to_string());
                env.insert("VKD3D_FRAME_RATE".to_string(), fps.to_string());
            }
            if let Some(latency) = profile.wrappers.frame_limiter.swapchain_latency {
                env.insert("VKD3D_SWAPCHAIN_LATENCY_FRAMES".to_string(), latency.to_string());
            }
        }

        // MangoHud fps limiter
        if profile.wrappers.mangohud.enabled && profile.wrappers.mangohud.fps_limit_enabled {
            if let Some(fps) = profile.wrappers.mangohud.fps_limit {
                env.insert("MANGOHUD_CONFIG".to_string(), format!("fps_limit={}", fps));
            }
        }

        // Custom environment variables
        for (key, value) in &profile.custom_env {
            env.insert(key.clone(), value.clone());
        }

        env
    }

    /// Build wrapper command prefix
    pub fn build_wrapper_cmd(&self, profile: &GameProfile) -> Vec<String> {
        let mut wrappers = Vec::new();

        // LACT profile switch (prepend as a command)
        if let Some(lact_profile) = &profile.wrappers.lact_profile {
            wrappers.push(format!("lact cli profile set \"{}\" &&", lact_profile));
        }

        if profile.wrappers.gamescope.enabled {
            let mut gs = vec!["gamescope".to_string()];

            // DSR mode - render at higher resolution than display
            if profile.wrappers.gamescope.dsr_enabled {
                if let Some(w) = profile.wrappers.gamescope.dsr_width {
                    gs.push("-w".to_string());
                    gs.push(w.to_string());
                }
                if let Some(h) = profile.wrappers.gamescope.dsr_height {
                    gs.push("-h".to_string());
                    gs.push(h.to_string());
                }
            }

            if let Some(w) = profile.wrappers.gamescope.width {
                gs.push("-W".to_string());
                gs.push(w.to_string());
            }
            if let Some(h) = profile.wrappers.gamescope.height {
                gs.push("-H".to_string());
                gs.push(h.to_string());
            }
            if let Some(w) = profile.wrappers.gamescope.internal_width {
                gs.push("-w".to_string());
                gs.push(w.to_string());
            }
            if let Some(h) = profile.wrappers.gamescope.internal_height {
                gs.push("-h".to_string());
                gs.push(h.to_string());
            }
            if let Some(filter) = &profile.wrappers.gamescope.upscale_filter {
                gs.push("-F".to_string());
                gs.push(filter.clone());
            }
            if let Some(sharp) = profile.wrappers.gamescope.fsr_sharpness {
                gs.push("--fsr-sharpness".to_string());
                gs.push(sharp.to_string());
            }
            if profile.wrappers.gamescope.fullscreen {
                gs.push("-f".to_string());
            }
            if profile.wrappers.gamescope.borderless {
                gs.push("-b".to_string());
            }
            if profile.wrappers.gamescope.vrr {
                gs.push("--adaptive-sync".to_string());
            }
            if let Some(limit) = profile.wrappers.gamescope.framelimit {
                if limit > 0 {
                    gs.push("-r".to_string());
                    gs.push(limit.to_string());
                }
            }
            if profile.wrappers.gamescope.mangoapp {
                gs.push("--mangoapp".to_string());
            }
            if profile.wrappers.gamescope.hdr {
                gs.push("--hdr-enabled".to_string());
            }
            gs.push("--".to_string());

            wrappers.extend(gs);
        }

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

        wrappers
    }
}

/// Check if LACT is installed
pub fn is_lact_available() -> bool {
    std::process::Command::new("which")
        .arg("lact")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
}

/// Get available LACT profiles
pub fn get_lact_profiles() -> Vec<String> {
    if !is_lact_available() {
        return Vec::new();
    }

    // LACT uses `lact cli profile list` command
    std::process::Command::new("lact")
        .args(["cli", "profile", "list"])
        .output()
        .ok()
        .and_then(|output| {
            if output.status.success() {
                String::from_utf8(output.stdout).ok()
            } else {
                None
            }
        })
        .map(|s| {
            s.lines()
                .map(|l| l.trim().to_string())
                .filter(|l| !l.is_empty())
                .collect()
        })
        .unwrap_or_default()
}
