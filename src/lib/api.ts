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

export type GameSource = "Steam" | "Lutris" | "Heroic";

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
    preset: string | null;
}

export interface DxvkSettings {
    hud: string | null;
    nvapi: boolean;
    async_compile: boolean;
    shader_cache: boolean;
}

export interface Vkd3dSettings {
    config: string[];
    frame_rate: number;
}

export interface NvidiaSettings {
    threaded_optimization: string | null;
    shader_cache_size: number | null;
    skip_cleanup: boolean;
    vsync: string | null;
    triple_buffer: boolean;
}

export interface ProtonSettings {
    verb: string | null;
    esync: boolean;
    fsync: boolean;
}

export interface GamescopeSettings {
    enabled: boolean;
    width: number | null;
    height: number | null;
    internal_width: number | null;
    internal_height: number | null;
    upscale_filter: string | null;
    fsr_sharpness: number | null;
    fullscreen: boolean;
    borderless: boolean;
    vrr: boolean;
    framelimit: number | null;
    mangoapp: boolean;
    hdr: boolean;
}

export interface WrapperSettings {
    mangohud: boolean;
    gamemode: boolean;
    dlss_swapper: boolean;
    gamescope: GamescopeSettings;
}

export interface GameProfile {
    name: string;
    executable_match: string | null;
    steam_appid: number | null;
    dlss: DlssSettings;
    dxvk: DxvkSettings;
    vkd3d: Vkd3dSettings;
    nvidia: NvidiaSettings;
    proton: ProtonSettings;
    wrappers: WrapperSettings;
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

export async function buildEnvVars(profile: GameProfile): Promise<Record<string, string>> {
    return invoke<Record<string, string>>("build_env_vars", { profile });
}

export async function buildWrapperCmd(profile: GameProfile): Promise<string[]> {
    return invoke<string[]>("build_wrapper_cmd", { profile });
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
