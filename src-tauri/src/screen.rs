//! Screen configuration module for Hyprland and other compositors
//!
//! Provides monitor detection, per-game monitor rules, and monitor enable/disable.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Command;

/// Detected compositor type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Compositor {
    Hyprland,
    Sway,
    Gnome,
    Kde,
    X11,
    Unknown,
}

impl Default for Compositor {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Monitor information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Monitor {
    pub id: u32,
    pub name: String,           // e.g., "DP-1", "HDMI-A-1"
    pub description: String,    // e.g., "Samsung 27G5"
    pub width: u32,
    pub height: u32,
    pub refresh_rate: f32,
    pub x: i32,
    pub y: i32,
    pub scale: f32,
    pub active: bool,
    pub focused: bool,
}

/// Hyprland monitor JSON structure
#[derive(Debug, Deserialize)]
struct HyprlandMonitor {
    id: i32,
    name: String,
    description: String,
    width: u32,
    height: u32,
    #[serde(rename = "refreshRate")]
    refresh_rate: f32,
    x: i32,
    y: i32,
    scale: f32,
    disabled: bool,
    #[serde(default)]
    focused: bool,
}

/// Detect the current compositor/desktop environment
pub fn detect_compositor() -> Compositor {
    // Check Hyprland first (most specific)
    if std::env::var("HYPRLAND_INSTANCE_SIGNATURE").is_ok() {
        return Compositor::Hyprland;
    }

    // Check Sway
    if std::env::var("SWAYSOCK").is_ok() {
        return Compositor::Sway;
    }

    // Check GNOME
    if std::env::var("GNOME_DESKTOP_SESSION_ID").is_ok() {
        return Compositor::Gnome;
    }
    if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
        if desktop.to_lowercase().contains("gnome") {
            return Compositor::Gnome;
        }
        if desktop.to_lowercase().contains("kde") || desktop.to_lowercase().contains("plasma") {
            return Compositor::Kde;
        }
    }

    // Check KDE
    if std::env::var("KDE_SESSION_VERSION").is_ok() {
        return Compositor::Kde;
    }

    // Check X11 (fallback for Wayland check)
    if std::env::var("WAYLAND_DISPLAY").is_err() {
        if std::env::var("DISPLAY").is_ok() {
            return Compositor::X11;
        }
    }

    Compositor::Unknown
}

/// Get compositor name as string
pub fn compositor_name(compositor: Compositor) -> &'static str {
    match compositor {
        Compositor::Hyprland => "Hyprland",
        Compositor::Sway => "Sway",
        Compositor::Gnome => "GNOME",
        Compositor::Kde => "KDE Plasma",
        Compositor::X11 => "X11",
        Compositor::Unknown => "Unknown",
    }
}

/// List all monitors (currently Hyprland only)
pub fn list_monitors() -> Result<Vec<Monitor>, String> {
    let compositor = detect_compositor();

    match compositor {
        Compositor::Hyprland => list_monitors_hyprland(),
        Compositor::Sway => list_monitors_sway(),
        _ => Err(format!(
            "Monitor listing not supported for {}",
            compositor_name(compositor)
        )),
    }
}

/// List monitors using hyprctl
fn list_monitors_hyprland() -> Result<Vec<Monitor>, String> {
    let output = Command::new("hyprctl")
        .args(["monitors", "-j"])
        .output()
        .map_err(|e| format!("Failed to run hyprctl: {}", e))?;

    if !output.status.success() {
        return Err("hyprctl monitors failed".to_string());
    }

    let json_str =
        String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8: {}", e))?;

    let hypr_monitors: Vec<HyprlandMonitor> =
        serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(hypr_monitors
        .into_iter()
        .map(|m| Monitor {
            id: m.id as u32,
            name: m.name,
            description: m.description,
            width: m.width,
            height: m.height,
            refresh_rate: m.refresh_rate,
            x: m.x,
            y: m.y,
            scale: m.scale,
            active: !m.disabled,
            focused: m.focused,
        })
        .collect())
}

/// List monitors using swaymsg (Sway)
fn list_monitors_sway() -> Result<Vec<Monitor>, String> {
    let output = Command::new("swaymsg")
        .args(["-t", "get_outputs", "-r"])
        .output()
        .map_err(|e| format!("Failed to run swaymsg: {}", e))?;

    if !output.status.success() {
        return Err("swaymsg get_outputs failed".to_string());
    }

    // Sway JSON structure is different, simplified parsing
    let json_str =
        String::from_utf8(output.stdout).map_err(|e| format!("Invalid UTF-8: {}", e))?;

    let sway_outputs: Vec<serde_json::Value> =
        serde_json::from_str(&json_str).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    Ok(sway_outputs
        .into_iter()
        .enumerate()
        .map(|(i, o)| Monitor {
            id: i as u32,
            name: o["name"].as_str().unwrap_or("unknown").to_string(),
            description: o["make"].as_str().unwrap_or("").to_string()
                + " "
                + o["model"].as_str().unwrap_or(""),
            width: o["rect"]["width"].as_u64().unwrap_or(0) as u32,
            height: o["rect"]["height"].as_u64().unwrap_or(0) as u32,
            refresh_rate: o["refresh"].as_f64().unwrap_or(60.0) as f32 / 1000.0,
            x: o["rect"]["x"].as_i64().unwrap_or(0) as i32,
            y: o["rect"]["y"].as_i64().unwrap_or(0) as i32,
            scale: o["scale"].as_f64().unwrap_or(1.0) as f32,
            active: o["active"].as_bool().unwrap_or(true),
            focused: o["focused"].as_bool().unwrap_or(false),
        })
        .collect())
}

/// Disable a monitor (Hyprland only for now)
pub fn disable_monitor(name: &str) -> Result<(), String> {
    let compositor = detect_compositor();

    match compositor {
        Compositor::Hyprland => {
            let output = Command::new("hyprctl")
                .args(["keyword", "monitor", &format!("{},disable", name)])
                .output()
                .map_err(|e| format!("Failed to run hyprctl: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to disable monitor {}", name));
            }
            Ok(())
        }
        Compositor::Sway => {
            let output = Command::new("swaymsg")
                .args(["output", name, "disable"])
                .output()
                .map_err(|e| format!("Failed to run swaymsg: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to disable monitor {}", name));
            }
            Ok(())
        }
        _ => Err(format!(
            "Monitor disable not supported for {}",
            compositor_name(compositor)
        )),
    }
}

/// Enable/restore a monitor (requires stored config)
pub fn enable_monitor(name: &str, config: &str) -> Result<(), String> {
    let compositor = detect_compositor();

    match compositor {
        Compositor::Hyprland => {
            // config format: "1920x1080@144,0x0,1" (resolution@hz,position,scale)
            let output = Command::new("hyprctl")
                .args(["keyword", "monitor", &format!("{},{}", name, config)])
                .output()
                .map_err(|e| format!("Failed to run hyprctl: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to enable monitor {}", name));
            }
            Ok(())
        }
        Compositor::Sway => {
            let output = Command::new("swaymsg")
                .args(["output", name, "enable"])
                .output()
                .map_err(|e| format!("Failed to run swaymsg: {}", e))?;

            if !output.status.success() {
                return Err(format!("Failed to enable monitor {}", name));
            }
            Ok(())
        }
        _ => Err(format!(
            "Monitor enable not supported for {}",
            compositor_name(compositor)
        )),
    }
}

/// Set a window rule to put a game on a specific monitor
pub fn set_game_monitor_rule(window_class: &str, monitor_name: &str) -> Result<(), String> {
    let compositor = detect_compositor();

    match compositor {
        Compositor::Hyprland => {
            // Set window rule for the game class
            let rule = format!("monitor {},class:^({})$", monitor_name, window_class);
            let output = Command::new("hyprctl")
                .args(["keyword", "windowrulev2", &rule])
                .output()
                .map_err(|e| format!("Failed to run hyprctl: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Failed to set monitor rule for {}",
                    window_class
                ));
            }
            Ok(())
        }
        Compositor::Sway => {
            // Sway uses for_window rules
            let rule = format!(
                "for_window [class=\"{}\"] move container to output {}",
                window_class, monitor_name
            );
            let output = Command::new("swaymsg")
                .arg(&rule)
                .output()
                .map_err(|e| format!("Failed to run swaymsg: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Failed to set monitor rule for {}",
                    window_class
                ));
            }
            Ok(())
        }
        _ => Err(format!(
            "Window rules not supported for {}",
            compositor_name(compositor)
        )),
    }
}

/// Set fullscreen rule for a game
pub fn set_game_fullscreen_rule(window_class: &str) -> Result<(), String> {
    let compositor = detect_compositor();

    match compositor {
        Compositor::Hyprland => {
            let rule = format!("fullscreen,class:^({})$", window_class);
            let output = Command::new("hyprctl")
                .args(["keyword", "windowrulev2", &rule])
                .output()
                .map_err(|e| format!("Failed to run hyprctl: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Failed to set fullscreen rule for {}",
                    window_class
                ));
            }
            Ok(())
        }
        Compositor::Sway => {
            let rule = format!("for_window [class=\"{}\"] fullscreen enable", window_class);
            let output = Command::new("swaymsg")
                .arg(&rule)
                .output()
                .map_err(|e| format!("Failed to run swaymsg: {}", e))?;

            if !output.status.success() {
                return Err(format!(
                    "Failed to set fullscreen rule for {}",
                    window_class
                ));
            }
            Ok(())
        }
        _ => Err(format!(
            "Fullscreen rules not supported for {}",
            compositor_name(compositor)
        )),
    }
}

/// Get current monitor configurations for restoration
pub fn get_monitor_configs() -> Result<HashMap<String, String>, String> {
    let monitors = list_monitors()?;
    let mut configs = HashMap::new();

    for m in monitors {
        if m.active {
            // Format: resolution@hz,position,scale
            let config = format!(
                "{}x{}@{:.0},{}x{},{:.1}",
                m.width, m.height, m.refresh_rate, m.x, m.y, m.scale
            );
            configs.insert(m.name, config);
        }
    }

    Ok(configs)
}

/// Check if screen configuration is supported for current compositor
pub fn is_screen_config_supported() -> bool {
    matches!(detect_compositor(), Compositor::Hyprland | Compositor::Sway)
}
