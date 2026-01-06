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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
