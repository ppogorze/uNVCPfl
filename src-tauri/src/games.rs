use regex::Regex;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum GameSource {
    Steam,
    Lutris,
    Heroic,
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

        games.extend(Self::detect_steam_games());
        games.extend(Self::detect_lutris_games());
        games.extend(Self::detect_heroic_games());

        games
    }

    pub fn detect_steam_games() -> Vec<Game> {
        let mut games = Vec::new();

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
                        games.push(game);
                    }
                }
            }
        }

        games
    }

    fn get_steam_library_paths() -> Vec<PathBuf> {
        let mut paths = Vec::new();

        // Default Steam paths
        if let Some(home) = dirs::home_dir() {
            let default_steam = home.join(".steam").join("steam");
            if default_steam.exists() {
                paths.push(default_steam.clone());
            }

            let alt_steam = home.join(".local").join("share").join("Steam");
            if alt_steam.exists() && !paths.contains(&alt_steam) {
                paths.push(alt_steam);
            }

            // Parse libraryfolders.vdf for additional libraries
            let libfolders = default_steam.join("steamapps").join("libraryfolders.vdf");
            if libfolders.exists() {
                if let Ok(content) = fs::read_to_string(&libfolders) {
                    let path_regex = Regex::new(r#""path"\s+"([^"]+)""#).unwrap();
                    for cap in path_regex.captures_iter(&content) {
                        let lib_path = PathBuf::from(&cap[1]);
                        if lib_path.exists() && !paths.contains(&lib_path) {
                            paths.push(lib_path);
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
            executable: None, // Would need to scan for .exe files
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
}
