import { invoke } from "@tauri-apps/api/core";

// Types matching Rust structs
export interface GpuInfo {
    name: string;
    temperature: number;
    power_draw: number;
    power_limit: number;
    utilization: number;
    memory_used: number;
    memory_total: number;
    clock_graphics: number;
    clock_memory: number;
    fan_speed: number | null;
}

export type GameSource = "Steam" | "Lutris" | "Heroic" | "Faugus";

export interface Game {
    id: string;
    name: string;
    executable: string | null;
    source: GameSource;
    install_path: string | null;
    icon_url: string | null;
}

export interface DlssSettings {
    upgrade: boolean;
    indicator: boolean;
    ngx_updater: boolean;
    sr_override: boolean;
    rr_override: boolean;
    fg_override: boolean;
    sr_preset: string | null;
    rr_preset: string | null;
    fg_multi_frame: string | null;
}

export interface DxvkSettings {
    hud: string | null;
    nvapi: boolean;
    async_compile: boolean;
}

export interface Vkd3dSettings {
    no_dxr: boolean;
    force_dxr: boolean;
    dxr12: boolean;
    force_static_cbv: boolean;
    single_queue: boolean;
    no_upload_hvv: boolean;
    frame_rate: number;
}

export interface NvidiaSettings {
    vsync: string | null;
    triple_buffer: boolean;
    prime: boolean;
    smooth_motion: boolean;
}

export interface ProtonSettings {
    verb: string | null;
    sync_mode: string | null;  // "default", "esync", "fsync", "ntsync"
    enable_wayland: boolean;
    enable_hdr: boolean;
    integer_scaling: boolean;
}

export interface FrameLimiterSettings {
    enabled: boolean;
    target_fps: number | null;
    swapchain_latency: number | null;
}

export interface GamescopeSettings {
    enabled: boolean;
    width: number | null;
    height: number | null;
    internal_width: number | null;
    internal_height: number | null;
    dsr_enabled: boolean;
    dsr_width: number | null;
    dsr_height: number | null;
    upscale_filter: string | null;
    fsr_sharpness: number | null;
    fullscreen: boolean;
    borderless: boolean;
    vrr: boolean;
    framelimit: number | null;
    mangoapp: boolean;
    hdr: boolean;
}

export interface MangoHudSettings {
    enabled: boolean;
    fps_limit_enabled: boolean;
    fps_limit: number | null;
    fps_limiter_mode: string | null;  // "early", "late"
}

export interface WrapperSettings {
    mangohud: MangoHudSettings;
    gamemode: boolean;
    game_performance: boolean;
    dlss_swapper: boolean;
    gamescope: GamescopeSettings;
    frame_limiter: FrameLimiterSettings;
    lact_profile: string | null;
    lact_restore_after_exit: boolean;
}

export interface ScreenSettings {
    target_monitor: string | null;
    fullscreen_on_target: boolean;
    disable_other_monitors: boolean;
    restore_monitors_after_exit: boolean;
}

export interface Monitor {
    id: number;
    name: string;
    description: string;
    width: number;
    height: number;
    refresh_rate: number;
    x: number;
    y: number;
    scale: number;
    active: boolean;
    focused: boolean;
}

export interface GameProfile {
    name: string;
    description: string | null;
    is_template: boolean;
    executable_match: string | null;
    steam_appid: number | null;
    dlss: DlssSettings;
    dxvk: DxvkSettings;
    vkd3d: Vkd3dSettings;
    nvidia: NvidiaSettings;
    proton: ProtonSettings;
    wrappers: WrapperSettings;
    screen: ScreenSettings;
    custom_env: Record<string, string>;
    custom_args: string | null;
}

// GPU Commands
export async function getGpuInfo(): Promise<GpuInfo | null> {
    return invoke<GpuInfo | null>("get_gpu_info");
}

export async function getGpuName(): Promise<string> {
    return invoke<string>("get_gpu_name");
}

// Game Detection Commands
export async function detectGames(): Promise<Game[]> {
    return invoke<Game[]>("detect_games");
}

export async function detectSteamGames(): Promise<Game[]> {
    return invoke<Game[]>("detect_steam_games");
}

export async function detectLutrisGames(): Promise<Game[]> {
    return invoke<Game[]>("detect_lutris_games");
}

export async function detectHeroicGames(): Promise<Game[]> {
    return invoke<Game[]>("detect_heroic_games");
}

// Profile Management Commands
export async function listProfiles(): Promise<GameProfile[]> {
    return invoke<GameProfile[]>("list_profiles");
}

export async function getProfile(name: string): Promise<GameProfile | null> {
    return invoke<GameProfile | null>("get_profile", { name });
}

export async function getProfileByExecutable(exeName: string): Promise<GameProfile | null> {
    return invoke<GameProfile | null>("get_profile_by_executable", { exeName });
}

export async function saveProfile(profile: GameProfile): Promise<void> {
    return invoke<void>("save_profile", { profile });
}

export async function deleteProfile(name: string): Promise<void> {
    return invoke<void>("delete_profile", { name });
}

export async function duplicateProfile(sourceName: string, newName: string): Promise<void> {
    return invoke<void>("duplicate_profile", { sourceName, newName });
}

export async function listTemplateProfiles(): Promise<GameProfile[]> {
    return invoke<GameProfile[]>("list_template_profiles");
}

export async function applyTemplate(templateName: string, gameName: string): Promise<GameProfile> {
    return invoke<GameProfile>("apply_template", { templateName, gameName });
}

export async function buildEnvVars(profile: GameProfile): Promise<Record<string, string>> {
    return invoke<Record<string, string>>("build_env_vars", { profile });
}

export async function buildWrapperCmd(profile: GameProfile): Promise<string[]> {
    return invoke<string[]>("build_wrapper_cmd", { profile });
}

// LACT Integration
export async function isLactAvailable(): Promise<boolean> {
    return invoke<boolean>("is_lact_available");
}

export async function getLactProfiles(): Promise<string[]> {
    return invoke<string[]>("get_lact_profiles");
}

// Screen Configuration Commands
export async function detectCompositor(): Promise<string> {
    return invoke<string>("detect_compositor");
}

export async function getCompositorName(): Promise<string> {
    return invoke<string>("get_compositor_name");
}

export async function listMonitors(): Promise<Monitor[]> {
    return invoke<Monitor[]>("list_monitors");
}

export async function isScreenConfigSupported(): Promise<boolean> {
    return invoke<boolean>("is_screen_config_supported");
}

export async function disableMonitor(name: string): Promise<void> {
    return invoke<void>("disable_monitor", { name });
}

export async function enableMonitor(name: string, config: string): Promise<void> {
    return invoke<void>("enable_monitor", { name, config });
}

export async function setGameMonitorRule(windowClass: string, monitorName: string): Promise<void> {
    return invoke<void>("set_game_monitor_rule", { windowClass, monitorName });
}

export async function getMonitorConfigs(): Promise<Record<string, string>> {
    return invoke<Record<string, string>>("get_monitor_configs");
}

// PCGamingWiki Game Data Paths Types
export interface GamePath {
    platform: string;
    raw_path: string;
    resolved_path: string;
    exists: boolean;
}

export interface GameDataPaths {
    game_name: string;
    config_paths: GamePath[];
    save_paths: GamePath[];
    error: string | null;
}

// Game Data Paths Commands (PCGamingWiki)
export async function getGameDataPaths(steamAppid: number): Promise<GameDataPaths> {
    return invoke<GameDataPaths>("get_game_data_paths", { steamAppid });
}

export async function openGamePath(path: string, inEditor: boolean): Promise<void> {
    return invoke<void>("open_game_path", { path, inEditor });
}

// System Info
export async function getHostname(): Promise<string> {
    return invoke<string>("get_hostname");
}

export async function createDesktopEntry(game: Game, profile: GameProfile): Promise<string> {
    return invoke<string>("create_desktop_entry", { game, profile });
}

// Utility functions
export function formatBytes(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function formatPower(watts: number): string {
    return `${watts.toFixed(0)}W`;
}

export function formatTemperature(celsius: number): string {
    return `${celsius}°C`;
}

export function formatClock(mhz: number): string {
    return `${mhz} MHz`;
}
