mod games;
mod game_settings;
mod nvidia;
mod profiles;
mod screen;

use games::{Game, GameDetector};
use nvidia::{create_gpu_state, GpuInfo, SharedGpuState};
use profiles::{GameProfile, ProfileManager};
use screen::{Compositor, Monitor};
use std::sync::Arc;
use tauri::State;

// GPU monitoring commands
#[tauri::command]
async fn get_gpu_info(state: State<'_, SharedGpuState>) -> Result<Option<GpuInfo>, String> {
    let state = state.read().await;
    if let Some(monitor) = &state.monitor {
        Ok(Some(monitor.get_info().map_err(|e| e.to_string())?))
    } else {
        Ok(None)
    }
}

#[tauri::command]
async fn get_gpu_name(state: State<'_, SharedGpuState>) -> Result<String, String> {
    let state = state.read().await;
    if let Some(monitor) = &state.monitor {
        Ok(monitor.get_gpu_name())
    } else {
        Ok("No NVIDIA GPU detected".to_string())
    }
}

// Game detection commands
#[tauri::command]
fn detect_games() -> Vec<Game> {
    GameDetector::detect_all_games()
}

#[tauri::command]
fn detect_steam_games() -> Vec<Game> {
    GameDetector::detect_steam_games()
}

#[tauri::command]
fn detect_lutris_games() -> Vec<Game> {
    GameDetector::detect_lutris_games()
}

#[tauri::command]
fn detect_heroic_games() -> Vec<Game> {
    GameDetector::detect_heroic_games()
}

// Profile management commands
#[tauri::command]
fn list_profiles(state: State<'_, Arc<ProfileManager>>) -> Vec<GameProfile> {
    state.list_profiles()
}

#[tauri::command]
fn get_profile(state: State<'_, Arc<ProfileManager>>, name: String) -> Option<GameProfile> {
    state.get_profile(&name)
}

#[tauri::command]
fn get_profile_by_executable(
    state: State<'_, Arc<ProfileManager>>,
    exe_name: String,
) -> Option<GameProfile> {
    state.get_profile_by_executable(&exe_name)
}

#[tauri::command]
fn save_profile(state: State<'_, Arc<ProfileManager>>, profile: GameProfile) -> Result<(), String> {
    state.save_profile(&profile)
}

#[tauri::command]
fn delete_profile(state: State<'_, Arc<ProfileManager>>, name: String) -> Result<(), String> {
    state.delete_profile(&name)
}

#[tauri::command]
fn duplicate_profile(
    state: State<'_, Arc<ProfileManager>>,
    source_name: String,
    new_name: String,
) -> Result<(), String> {
    state.duplicate_profile(&source_name, &new_name)
}

#[tauri::command]
fn list_template_profiles(state: State<'_, Arc<ProfileManager>>) -> Vec<GameProfile> {
    state.list_template_profiles()
}

#[tauri::command]
fn apply_template(
    state: State<'_, Arc<ProfileManager>>,
    template_name: String,
    game_name: String,
) -> Result<GameProfile, String> {
    state.apply_template(&template_name, &game_name)
}

#[tauri::command]
fn build_env_vars(
    state: State<'_, Arc<ProfileManager>>,
    profile: GameProfile,
) -> std::collections::HashMap<String, String> {
    state.build_env_vars(&profile)
}

#[tauri::command]
fn build_wrapper_cmd(state: State<'_, Arc<ProfileManager>>, profile: GameProfile) -> Vec<String> {
    state.build_wrapper_cmd(&profile)
}

#[tauri::command]
fn is_lact_available() -> bool {
    profiles::is_lact_available()
}

#[tauri::command]
fn get_lact_profiles() -> Vec<String> {
    profiles::get_lact_profiles()
}

// Screen configuration commands
#[tauri::command]
fn detect_compositor() -> Compositor {
    screen::detect_compositor()
}

#[tauri::command]
fn get_compositor_name() -> String {
    let compositor = screen::detect_compositor();
    screen::compositor_name(compositor).to_string()
}

#[tauri::command]
fn list_monitors() -> Result<Vec<Monitor>, String> {
    screen::list_monitors()
}

#[tauri::command]
fn is_screen_config_supported() -> bool {
    screen::is_screen_config_supported()
}

#[tauri::command]
fn disable_monitor(name: String) -> Result<(), String> {
    screen::disable_monitor(&name)
}

#[tauri::command]
fn enable_monitor(name: String, config: String) -> Result<(), String> {
    screen::enable_monitor(&name, &config)
}

#[tauri::command]
fn set_game_monitor_rule(window_class: String, monitor_name: String) -> Result<(), String> {
    screen::set_game_monitor_rule(&window_class, &monitor_name)
}

#[tauri::command]
fn get_monitor_configs() -> Result<std::collections::HashMap<String, String>, String> {
    screen::get_monitor_configs()
}

#[tauri::command]
fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
}

#[tauri::command]
async fn get_game_data_paths(steam_appid: u32) -> game_settings::GameDataPaths {
    game_settings::fetch_pcgamingwiki_paths(steam_appid).await
}

#[tauri::command]
fn open_game_path(path: String, in_editor: bool) -> Result<(), String> {
    if in_editor {
        game_settings::open_in_editor(&path)
    } else {
        game_settings::open_in_file_manager(&path)
    }
}

#[tauri::command]
fn create_desktop_entry(game: Game, profile: GameProfile, state: State<'_, Arc<ProfileManager>>) -> Result<String, String> {
    let env_vars = state.build_env_vars(&profile);
    let wrappers = state.build_wrapper_cmd(&profile);
    
    let env_string = env_vars.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join(" ");
    
    let wrapper_string = wrappers.join(" ");
    
    // Build launch command based on game source
    let exec = match game.source {
        games::GameSource::Steam => format!("env {} {} steam steam://rungameid/{}", env_string, wrapper_string, game.id),
        games::GameSource::Lutris => format!("env {} {} lutris lutris:rungameid/{}", env_string, wrapper_string, game.id),
        games::GameSource::Heroic => format!("env {} {} heroic heroic://launch/{}", env_string, wrapper_string, game.id),
        games::GameSource::Faugus => format!("env {} {} xdg-open faugus://{}", env_string, wrapper_string, game.id),
    };
    
    let desktop_entry = format!(
r#"[Desktop Entry]
Name={}
Comment=Launched via uNVCPfL
Exec={}
Type=Application
Categories=Game;
"#,
        game.name,
        exec.trim()
    );
    
    // Write to ~/.local/share/applications/
    let apps_dir = dirs::data_local_dir()
        .unwrap_or_else(|| std::path::PathBuf::from("~/.local/share"))
        .join("applications");
    
    std::fs::create_dir_all(&apps_dir).ok();
    
    let filename = format!("unvcpfl-{}.desktop", game.name.to_lowercase().replace(' ', "-"));
    let path = apps_dir.join(&filename);
    
    std::fs::write(&path, desktop_entry)
        .map_err(|e| format!("Failed to write desktop entry: {}", e))?;
    
    Ok(path.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let gpu_state = create_gpu_state();
    let profile_manager = Arc::new(ProfileManager::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(gpu_state)
        .manage(profile_manager)
        .invoke_handler(tauri::generate_handler![
            // GPU commands
            get_gpu_info,
            get_gpu_name,
            // Game detection
            detect_games,
            detect_steam_games,
            detect_lutris_games,
            detect_heroic_games,
            // Profile management
            list_profiles,
            get_profile,
            get_profile_by_executable,
            save_profile,
            delete_profile,
            duplicate_profile,
            list_template_profiles,
            apply_template,
            build_env_vars,
            build_wrapper_cmd,
            // LACT integration
            is_lact_available,
            get_lact_profiles,
            // Screen configuration
            detect_compositor,
            get_compositor_name,
            list_monitors,
            is_screen_config_supported,
            disable_monitor,
            enable_monitor,
            set_game_monitor_rule,
            get_monitor_configs,
            // Game data paths (PCGamingWiki)
            get_game_data_paths,
            open_game_path,
            // System info
            get_hostname,
            create_desktop_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

