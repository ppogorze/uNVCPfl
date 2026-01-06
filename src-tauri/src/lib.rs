mod games;
mod nvidia;
mod profiles;

use games::{Game, GameDetector};
use nvidia::{create_gpu_state, GpuInfo, SharedGpuState};
use profiles::{GameProfile, ProfileManager};
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

#[tauri::command]
fn get_hostname() -> String {
    hostname::get()
        .map(|h| h.to_string_lossy().to_string())
        .unwrap_or_else(|_| "Unknown".to_string())
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
            build_env_vars,
            build_wrapper_cmd,
            // LACT integration
            is_lact_available,
            get_lact_profiles,
            // System info
            get_hostname,
            create_desktop_entry,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

