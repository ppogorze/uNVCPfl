use regex::Regex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GameSource {
    Steam,
    Lutris,
    Heroic,
    Faugus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Game {
    pub id: String,
    pub name: String,
    pub executable: Option<PathBuf>,
    pub source: GameSource,
    pub install_path: Option<PathBuf>,
    pub icon_url: Option<String>,
}

pub struct GameDetector;

impl GameDetector {
    pub fn detect_all_games() -> Vec<Game> {
        let mut games = Vec::new();
        let mut seen_steam_ids: HashSet<String> = HashSet::new();

        // Steam games - deduplicate by appid
        for game in Self::detect_steam_games() {
            if !seen_steam_ids.contains(&game.id) {
                seen_steam_ids.insert(game.id.clone());
                games.push(game);
            }
        }

        // Other sources - deduplicate by name
        let mut seen_names: HashSet<String> = HashSet::new();
        for game in &games {
            seen_names.insert(game.name.to_lowercase());
        }

        for game in Self::detect_lutris_games() {
            let lower = game.name.to_lowercase();
            if !seen_names.contains(&lower) {
                seen_names.insert(lower);
                games.push(game);
            }
        }

        for game in Self::detect_heroic_games() {
            let lower = game.name.to_lowercase();
            if !seen_names.contains(&lower) {
                seen_names.insert(lower);
                games.push(game);
            }
        }

        for game in Self::detect_faugus_games() {
            let lower = game.name.to_lowercase();
            if !seen_names.contains(&lower) {
                seen_names.insert(lower);
                games.push(game);
            }
        }

        // Sort alphabetically
        games.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

        games
    }

    pub fn detect_steam_games() -> Vec<Game> {
        let mut games = Vec::new();
        let mut seen_appids: HashSet<String> = HashSet::new();

        // Find Steam library folders
        let steam_paths = Self::get_steam_library_paths();

        for library_path in steam_paths {
            let steamapps = library_path.join("steamapps");
            if !steamapps.exists() {
                continue;
            }

            // Find all .acf files
            for entry in fs::read_dir(&steamapps).into_iter().flatten().flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "acf").unwrap_or(false) {
                    if let Some(game) = Self::parse_acf_file(&path, &steamapps) {
                        // Deduplicate by appid
                        if !seen_appids.contains(&game.id) {
                            seen_appids.insert(game.id.clone());
                            games.push(game);
                        }
                    }
                }
            }
        }

        games
    }

    fn get_steam_library_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();
        let mut seen_canonicalized: HashSet<PathBuf> = HashSet::new();

        // Default Steam paths
        if let Some(home) = dirs::home_dir() {
            let default_steam = home.join(".steam").join("steam");
            if default_steam.exists() {
                // Canonicalize to resolve symlinks
                if let Ok(canonical) = fs::canonicalize(&default_steam) {
                    if !seen_canonicalized.contains(&canonical) {
                        seen_canonicalized.insert(canonical.clone());
                        paths.push(canonical);
                    }
                }
            }

            let alt_steam = home.join(".local").join("share").join("Steam");
            if alt_steam.exists() {
                if let Ok(canonical) = fs::canonicalize(&alt_steam) {
                    if !seen_canonicalized.contains(&canonical) {
                        seen_canonicalized.insert(canonical.clone());
                        paths.push(canonical);
                    }
                }
            }

            // Parse libraryfolders.vdf for additional libraries
            let libfolders_path = if let Some(first) = paths.first() {
                first.join("steamapps").join("libraryfolders.vdf")
            } else {
                default_steam.join("steamapps").join("libraryfolders.vdf")
            };

            if libfolders_path.exists() {
                if let Ok(content) = fs::read_to_string(&libfolders_path) {
                    let path_regex = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
                    for cap in path_regex.captures_iter(&content) {
                        let lib_path = PathBuf::from(&cap[1]);
                        if lib_path.exists() {
                            if let Ok(canonical) = fs::canonicalize(&lib_path) {
                                if !seen_canonicalized.contains(&canonical) {
                                    seen_canonicalized.insert(canonical.clone());
                                    paths.push(canonical);
                                }
                            }
                        }
                    }
                }
            }
        }

        paths
    }

    fn parse_acf_file(path: &PathBuf, steamapps: &PathBuf) -> Option<Game> {
        let content = fs::read_to_string(path).ok()?;

        let appid_regex = Regex::new(r#""appid"\s+"(\d+)""#).ok()?;
        let name_regex = Regex::new(r#""name"\s+"([^"]+)""#).ok()?;
        let installdir_regex = Regex::new(r#""installdir"\s+"([^"]+)""#).ok()?;

        let appid = appid_regex.captures(&content)?.get(1)?.as_str().to_string();
        let name = name_regex.captures(&content)?.get(1)?.as_str().to_string();
        let installdir = installdir_regex.captures(&content)?.get(1)?.as_str();

        let install_path = steamapps.join("common").join(installdir);

        Some(Game {
            id: appid.clone(),
            name,
            executable: None,
            source: GameSource::Steam,
            install_path: Some(install_path),
            icon_url: Some(format!(
                "https://steamcdn-a.akamaihd.net/steam/apps/{}/library_600x900.jpg",
                appid
            )),
        })
    }

    pub fn detect_lutris_games() -> Vec<Game> {
        let mut games = Vec::new();

        if let Some(data_dir) = dirs::data_dir() {
            let db_path = data_dir.join("lutris").join("pga.db");

            if db_path.exists() {
                if let Ok(conn) = Connection::open(&db_path) {
                    let mut stmt = conn
                        .prepare("SELECT slug, name, directory, runner FROM games")
                        .ok();

                    if let Some(ref mut stmt) = stmt {
                        let game_iter = stmt.query_map([], |row| {
                            Ok(Game {
                                id: row.get::<_, String>(0)?,
                                name: row.get::<_, String>(1)?,
                                executable: None,
                                source: GameSource::Lutris,
                                install_path: row.get::<_, Option<String>>(2)?.map(PathBuf::from),
                                icon_url: None,
                            })
                        });

                        if let Ok(iter) = game_iter {
                            for game in iter.flatten() {
                                games.push(game);
                            }
                        }
                    }
                }
            }
        }

        games
    }

    pub fn detect_heroic_games() -> Vec<Game> {
        let mut games = Vec::new();

        if let Some(config_dir) = dirs::config_dir() {
            // Heroic installed games config
            let heroic_config = config_dir.join("heroic").join("GamesConfig");

            if heroic_config.exists() {
                for entry in WalkDir::new(&heroic_config)
                    .max_depth(1)
                    .into_iter()
                    .flatten()
                {
                    let path = entry.path();
                    if path.extension().map(|e| e == "json").unwrap_or(false) {
                        if let Ok(content) = fs::read_to_string(path) {
                            if let Ok(config) = serde_json::from_str::<serde_json::Value>(&content)
                            {
                                if let Some(title) = config.get("title").and_then(|v| v.as_str()) {
                                    let id = path
                                        .file_stem()
                                        .and_then(|s| s.to_str())
                                        .unwrap_or("unknown")
                                        .to_string();

                                    let install_path = config
                                        .get("winePrefix")
                                        .and_then(|v| v.as_str())
                                        .map(PathBuf::from);

                                    games.push(Game {
                                        id,
                                        name: title.to_string(),
                                        executable: None,
                                        source: GameSource::Heroic,
                                        install_path,
                                        icon_url: None,
                                    });
                                }
                            }
                        }
                    }
                }
            }

            // Legendary games (Epic via Heroic)
            let legendary_installed = config_dir
                .join("heroic")
                .join("legendaryConfig")
                .join("legendary")
                .join("installed.json");

            if legendary_installed.exists() {
                if let Ok(content) = fs::read_to_string(&legendary_installed) {
                    if let Ok(installed) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(obj) = installed.as_object() {
                            for (id, info) in obj {
                                if let Some(title) = info.get("title").and_then(|v| v.as_str()) {
                                    let install_path = info
                                        .get("install_path")
                                        .and_then(|v| v.as_str())
                                        .map(PathBuf::from);

                                    games.push(Game {
                                        id: id.clone(),
                                        name: title.to_string(),
                                        executable: None,
                                        source: GameSource::Heroic,
                                        install_path,
                                        icon_url: None,
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        games
    }

    pub fn detect_faugus_games() -> Vec<Game> {
        let mut games = Vec::new();

        if let Some(data_dir) = dirs::data_dir() {
            let applications_dir = data_dir.join("applications");

            if applications_dir.exists() {
                // Look for Faugus launcher .desktop files
                for entry in fs::read_dir(&applications_dir)
                    .into_iter()
                    .flatten()
                    .flatten()
                {
                    let path = entry.path();
                    if path.extension().map(|e| e == "desktop").unwrap_or(false) {
                        if let Ok(content) = fs::read_to_string(&path) {
                            // Check if it's a Faugus launcher shortcut
                            if content.contains("faugus-launcher") || content.contains("umu-run") {
                                if let Some(game) = Self::parse_desktop_file(&content, &path) {
                                    games.push(game);
                                }
                            }
                        }
                    }
                }
            }
        }

        // Also check ~/Faugus/ directory for prefixes
        if let Some(home) = dirs::home_dir() {
            let faugus_dir = home.join("Faugus");
            if faugus_dir.exists() {
                for entry in fs::read_dir(&faugus_dir).into_iter().flatten().flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        let name = path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("Unknown")
                            .to_string();

                        // Skip if it looks like a system folder
                        if name.starts_with('.') {
                            continue;
                        }

                        games.push(Game {
                            id: format!("faugus-{}", name.to_lowercase().replace(' ', "-")),
                            name,
                            executable: None,
                            source: GameSource::Faugus,
                            install_path: Some(path),
                            icon_url: None,
                        });
                    }
                }
            }
        }

        games
    }

    fn parse_desktop_file(content: &str, path: &PathBuf) -> Option<Game> {
        let name_regex = Regex::new(r"(?m)^Name=(.+)$").ok()?;
        let name = name_regex
            .captures(content)?
            .get(1)?
            .as_str()
            .trim()
            .to_string();

        // Skip if name is empty or looks like a system app
        if name.is_empty() || name.starts_with("faugus") {
            return None;
        }

        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("unknown")
            .to_string();

        Some(Game {
            id,
            name,
            executable: None,
            source: GameSource::Faugus,
            install_path: None,
            icon_url: None,
        })
    }
}
