use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DlssSettings {
    #[serde(default)]
    pub upgrade: bool,
    #[serde(default)]
    pub indicator: bool,
    pub preset: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DxvkSettings {
    pub hud: Option<String>,
    #[serde(default)]
    pub nvapi: bool,
    #[serde(default)]
    pub async_compile: bool,
    #[serde(default = "default_true")]
    pub shader_cache: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Vkd3dSettings {
    #[serde(default)]
    pub config: Vec<String>,
    #[serde(default)]
    pub frame_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NvidiaSettings {
    pub threaded_optimization: Option<String>,
    pub shader_cache_size: Option<u64>,
    #[serde(default)]
    pub skip_cleanup: bool,
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
    #[serde(default = "default_true")]
    pub esync: bool,
    #[serde(default = "default_true")]
    pub fsync: bool,
    #[serde(default)]
    pub enable_wayland: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct GamescopeSettings {
    #[serde(default)]
    pub enabled: bool,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub internal_width: Option<u32>,
    pub internal_height: Option<u32>,
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
pub struct WrapperSettings {
    #[serde(default)]
    pub mangohud: bool,
    #[serde(default)]
    pub gamemode: bool,
    #[serde(default)]
    pub game_performance: bool, // CachyOS game-performance
    #[serde(default)]
    pub dlss_swapper: bool,
    #[serde(default)]
    pub gamescope: GamescopeSettings,
    pub lact_profile: Option<String>, // LACT GPU profile name
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameProfile {
    pub name: String,
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
    pub custom_env: HashMap<String, String>,
    pub custom_args: Option<String>,
}

fn default_true() -> bool {
    true
}

impl Default for GameProfile {
    fn default() -> Self {
        Self {
            name: String::new(),
            executable_match: None,
            steam_appid: None,
            dlss: DlssSettings::default(),
            dxvk: DxvkSettings::default(),
            vkd3d: Vkd3dSettings::default(),
            nvidia: NvidiaSettings::default(),
            proton: ProtonSettings::default(),
            wrappers: WrapperSettings::default(),
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
        if let Some(preset) = &profile.dlss.preset {
            env.insert(
                "DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE_RENDER_PRESET_SELECTION".to_string(),
                preset.clone(),
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
        if !profile.dxvk.shader_cache {
            env.insert("DXVK_SHADER_CACHE".to_string(), "0".to_string());
        }

        // VKD3D settings
        if !profile.vkd3d.config.is_empty() {
            env.insert("VKD3D_CONFIG".to_string(), profile.vkd3d.config.join(","));
        }
        if profile.vkd3d.frame_rate > 0 {
            env.insert(
                "VKD3D_FRAME_RATE".to_string(),
                profile.vkd3d.frame_rate.to_string(),
            );
        }

        // NVIDIA driver settings
        if let Some(threaded) = &profile.nvidia.threaded_optimization {
            let val = match threaded.as_str() {
                "on" => "1",
                "off" => "0",
                _ => "1", // auto defaults to on
            };
            env.insert("__GL_THREADED_OPTIMIZATIONS".to_string(), val.to_string());
        }
        if let Some(size) = profile.nvidia.shader_cache_size {
            env.insert("__GL_SHADER_DISK_CACHE_SIZE".to_string(), size.to_string());
        }
        if profile.nvidia.skip_cleanup {
            env.insert(
                "__GL_SHADER_DISK_CACHE_SKIP_CLEANUP".to_string(),
                "1".to_string(),
            );
        }
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
        if !profile.proton.esync {
            env.insert("PROTON_NO_ESYNC".to_string(), "1".to_string());
        }
        if !profile.proton.fsync {
            env.insert("PROTON_NO_FSYNC".to_string(), "1".to_string());
        }
        if profile.proton.enable_wayland {
            env.insert("PROTON_ENABLE_WAYLAND".to_string(), "1".to_string());
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

        if profile.wrappers.gamescope.enabled {
            let mut gs = vec!["gamescope".to_string()];

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

        if profile.wrappers.mangohud {
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

        // LACT profile switch (prepend as a command)
        if let Some(lact_profile) = &profile.wrappers.lact_profile {
            // Insert at beginning: lact profile switch "name" &&
            wrappers.insert(0, format!("lact profile switch \"{}\" &&", lact_profile));
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
