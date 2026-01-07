//! PCGamingWiki integration for game data paths
//! Fetches config and save locations from PCGamingWiki API

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

/// A resolved game path with existence status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GamePath {
    pub platform: String,
    pub raw_path: String,
    pub resolved_path: String,
    pub exists: bool,
}

/// Game data paths from PCGamingWiki
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameDataPaths {
    pub game_name: String,
    pub config_paths: Vec<GamePath>,
    pub save_paths: Vec<GamePath>,
    pub error: Option<String>,
}

/// Response from PCGamingWiki cargo query
#[derive(Debug, Deserialize)]
struct CargoQueryResponse {
    cargoquery: Vec<CargoQueryResult>,
}

#[derive(Debug, Deserialize)]
struct CargoQueryResult {
    title: CargoQueryTitle,
}

#[derive(Debug, Deserialize)]
struct CargoQueryTitle {
    #[serde(rename = "Page")]
    page: Option<String>,
}

/// Response from MediaWiki API
#[derive(Debug, Deserialize)]
struct WikiQueryResponse {
    query: WikiQuery,
}

#[derive(Debug, Deserialize)]
struct WikiQuery {
    pages: std::collections::HashMap<String, WikiPage>,
}

#[derive(Debug, Deserialize)]
struct WikiPage {
    revisions: Option<Vec<WikiRevision>>,
}

#[derive(Debug, Deserialize)]
struct WikiRevision {
    #[serde(rename = "*")]
    content: String,
}

/// Fetch game data paths from PCGamingWiki
pub async fn fetch_pcgamingwiki_paths(steam_appid: u32) -> GameDataPaths {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (X11; Linux x86_64) uNVCPfL/1.0")
        .build()
        .unwrap_or_default();

    // Step 1: Get page name from Steam AppID
    let page_name = match get_page_name(&client, steam_appid).await {
        Ok(name) => name,
        Err(e) => {
            return GameDataPaths {
                game_name: format!("AppID {}", steam_appid),
                config_paths: vec![],
                save_paths: vec![],
                error: Some(e),
            }
        }
    };

    // Step 2: Get wiki content
    let wikitext = match get_wikitext(&client, &page_name).await {
        Ok(text) => text,
        Err(e) => {
            return GameDataPaths {
                game_name: page_name,
                config_paths: vec![],
                save_paths: vec![],
                error: Some(e),
            }
        }
    };

    // Step 3: Parse paths from wikitext
    let config_paths = parse_game_data_paths(&wikitext, "config", steam_appid);
    let save_paths = parse_game_data_paths(&wikitext, "saves", steam_appid);

    GameDataPaths {
        game_name: page_name,
        config_paths,
        save_paths,
        error: None,
    }
}

/// Get page name from Steam AppID using cargo query
async fn get_page_name(client: &reqwest::Client, steam_appid: u32) -> Result<String, String> {
    let url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=cargoquery&tables=Infobox_game&fields=Infobox_game._pageName=Page&where=Infobox_game.Steam_AppID%20HOLDS%20%22{}%22&format=json",
        steam_appid
    );

    let response: CargoQueryResponse = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    response
        .cargoquery
        .first()
        .and_then(|r| r.title.page.clone())
        .ok_or_else(|| format!("Game not found on PCGamingWiki for AppID {}", steam_appid))
}

/// Get wikitext content for a page
async fn get_wikitext(client: &reqwest::Client, page_name: &str) -> Result<String, String> {
    let url = format!(
        "https://www.pcgamingwiki.com/w/api.php?action=query&titles={}&prop=revisions&rvprop=content&format=json",
        urlencoding::encode(page_name)
    );

    let response: WikiQueryResponse = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?
        .json()
        .await
        .map_err(|e| format!("JSON parse error: {}", e))?;

    response
        .query
        .pages
        .values()
        .next()
        .and_then(|p| p.revisions.as_ref())
        .and_then(|r| r.first())
        .map(|r| r.content.clone())
        .ok_or_else(|| "No content found".to_string())
}

/// Parse Game data/config or Game data/saves templates from wikitext
/// Uses brace counting to handle nested {{...}} templates
fn parse_game_data_paths(wikitext: &str, path_type: &str, steam_appid: u32) -> Vec<GamePath> {
    let marker = format!("{{{{Game data/{}|", path_type);
    let mut paths = vec![];

    let mut search_start = 0;
    while let Some(start_idx) = wikitext[search_start..].find(&marker) {
        let abs_start = search_start + start_idx + marker.len();
        
        // Find closing }} by counting brace depth
        let mut depth = 1;
        let mut end_idx = abs_start;
        let chars: Vec<char> = wikitext[abs_start..].chars().collect();
        let mut i = 0;
        
        while i < chars.len() && depth > 0 {
            if i + 1 < chars.len() && chars[i] == '{' && chars[i + 1] == '{' {
                depth += 1;
                i += 2;
            } else if i + 1 < chars.len() && chars[i] == '}' && chars[i + 1] == '}' {
                depth -= 1;
                if depth == 0 {
                    end_idx = abs_start + i;
                    break;
                }
                i += 2;
            } else {
                i += 1;
            }
        }
        
        if depth == 0 {
            let content = &wikitext[abs_start..end_idx];
            // Split on first | to get platform and path
            if let Some(pipe_idx) = content.find('|') {
                let platform = &content[..pipe_idx];
                let raw_path = &content[pipe_idx + 1..];
                
                // Only process Windows paths (we'll translate to Wine prefix)
                if platform == "Windows" {
                    let resolved = resolve_wine_path(raw_path, steam_appid);
                    let exists = check_path_exists(&resolved);

                    paths.push(GamePath {
                        platform: platform.to_string(),
                        raw_path: raw_path.to_string(),
                        resolved_path: resolved,
                        exists,
                    });
                }
            }
        }
        
        search_start = abs_start;
    }

    paths
}

/// Resolve PCGamingWiki path variables to Wine/Proton prefix paths
pub fn resolve_wine_path(raw_path: &str, steam_appid: u32) -> String {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/home/user".to_string());

    // Find the prefix path
    let prefix = find_proton_prefix(steam_appid, &home);

    let mut path = raw_path.to_string();

    // Handle various PCGamingWiki path variables
    // {{p|userprofile\Documents}} or {{P|userprofile}}\Documents
    let patterns = [
        (r"\{\{[pP]\|userprofile\\Documents\}\}", format!("{}/drive_c/users/steamuser/Documents", prefix)),
        (r"\{\{[pP]\|userprofile\}\}\\Documents", format!("{}/drive_c/users/steamuser/Documents", prefix)),
        (r"\{\{[pP]\|userprofile\}\}", format!("{}/drive_c/users/steamuser", prefix)),
        (r"\{\{[pP]\|localappdata\}\}", format!("{}/drive_c/users/steamuser/AppData/Local", prefix)),
        (r"\{\{[pP]\|appdata\}\}", format!("{}/drive_c/users/steamuser/AppData/Roaming", prefix)),
        (r"\{\{[pP]\|programdata\}\}", format!("{}/drive_c/ProgramData", prefix)),
        (r"\{\{[pP]\|public\}\}", format!("{}/drive_c/users/Public", prefix)),
        (r"\{\{[pP]\|game\}\}", find_game_install_path(steam_appid, &home)),
    ];

    for (pattern, replacement) in patterns {
        let re = Regex::new(pattern).unwrap();
        path = re.replace_all(&path, replacement.as_str()).to_string();
    }

    // Convert Windows backslashes to Unix forward slashes
    path = path.replace('\\', "/");

    // Remove wildcards for directory checking (keep for display)
    if path.contains('*') {
        if let Some(parent) = Path::new(&path).parent() {
            return parent.to_string_lossy().to_string();
        }
    }

    path
}

/// Find Proton prefix for a Steam AppID
fn find_proton_prefix(steam_appid: u32, home: &str) -> String {
    let possible_paths = [
        format!("{}/.steam/steam/steamapps/compatdata/{}/pfx", home, steam_appid),
        format!("{}/.local/share/Steam/steamapps/compatdata/{}/pfx", home, steam_appid),
        format!("{}/.var/app/com.valvesoftware.Steam/.steam/steam/steamapps/compatdata/{}/pfx", home, steam_appid),
    ];

    for path in &possible_paths {
        if Path::new(path).exists() {
            return path.clone();
        }
    }

    // Return default path even if doesn't exist
    possible_paths[0].clone()
}

/// Find game installation path
fn find_game_install_path(steam_appid: u32, home: &str) -> String {
    let library_paths = [
        format!("{}/.steam/steam/steamapps", home),
        format!("{}/.local/share/Steam/steamapps", home),
        format!("{}/.var/app/com.valvesoftware.Steam/.steam/steam/steamapps", home),
    ];

    for lib_path in &library_paths {
        let manifest = format!("{}/appmanifest_{}.acf", lib_path, steam_appid);
        if Path::new(&manifest).exists() {
            // Parse manifest to get installdir
            if let Ok(content) = std::fs::read_to_string(&manifest) {
                if let Some(install_dir) = parse_installdir(&content) {
                    let game_path = format!("{}/common/{}", lib_path, install_dir);
                    if Path::new(&game_path).exists() {
                        return game_path;
                    }
                }
            }
        }
    }

    format!("{}/.steam/steam/steamapps/common/GAME", home)
}

/// Parse installdir from Steam manifest
fn parse_installdir(content: &str) -> Option<String> {
    let re = Regex::new(r#""installdir"\s+"([^"]+)""#).ok()?;
    re.captures(content)
        .and_then(|c| c.get(1))
        .map(|m| m.as_str().to_string())
}

/// Check if a path exists
pub fn check_path_exists(path: &str) -> bool {
    Path::new(path).exists()
}

/// Open path in file manager (Dolphin, Nautilus, etc.)
pub fn open_in_file_manager(path: &str) -> Result<(), String> {
    let path_to_open = if Path::new(path).is_file() {
        Path::new(path)
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string())
    } else {
        path.to_string()
    };

    // Try various file managers
    let managers = ["xdg-open", "dolphin", "nautilus", "thunar", "pcmanfm"];

    for manager in managers {
        if Command::new("which")
            .arg(manager)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Command::new(manager)
                .arg(&path_to_open)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open file manager: {}", e));
        }
    }

    Err("No file manager found".to_string())
}

/// Open path in text editor (Kate, nano in terminal, etc.)
pub fn open_in_editor(path: &str) -> Result<(), String> {
    // Try GUI editors first
    let gui_editors = ["kate", "gedit", "code", "xed", "pluma"];

    for editor in gui_editors {
        if Command::new("which")
            .arg(editor)
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
        {
            return Command::new(editor)
                .arg(path)
                .spawn()
                .map(|_| ())
                .map_err(|e| format!("Failed to open editor: {}", e));
        }
    }

    // Fallback to terminal editor
    let terminal_cmd = if Command::new("which")
        .arg("konsole")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        ("konsole", vec!["-e", "nano", path])
    } else if Command::new("which")
        .arg("gnome-terminal")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false)
    {
        ("gnome-terminal", vec!["--", "nano", path])
    } else {
        return Err("No editor found".to_string());
    };

    Command::new(terminal_cmd.0)
        .args(&terminal_cmd.1)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open editor: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_path() {
        let raw = r"{{p|userprofile\Documents}}\The Witcher 3\*.settings";
        let resolved = resolve_wine_path(raw, 292030);
        assert!(resolved.contains("Documents/The Witcher 3"));
    }
}
