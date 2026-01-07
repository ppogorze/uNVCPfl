import { useState, useEffect, useMemo } from "react";
import { Game, GameProfile, getProfile, saveProfile, buildEnvVars, buildWrapperCmd, isLactAvailable, getLactProfiles, createDesktopEntry } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RotateCcw, Layers, Sparkles, Monitor, Gamepad2, Copy, Check, Terminal, Zap, HelpCircle, FileDown } from "lucide-react";

// Tooltip component
function Tooltip({ children, text }: { children: React.ReactNode; text: string }) {
    return (
        <span className="relative group cursor-help">
            {children}
            <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-2 py-1 bg-popover border border-border text-xs text-popover-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                {text}
            </span>
        </span>
    );
}

// Default profile structure
const createDefaultProfile = (game: Game | null): GameProfile => ({
    name: game?.name || "Global Settings",
    description: null,
    is_template: false,
    executable_match: game?.executable || null,
    steam_appid: game?.source === "Steam" ? parseInt(game.id) : null,
    dlss: {
        upgrade: false,
        indicator: false,
        ngx_updater: false,
        sr_override: false,
        rr_override: false,
        fg_override: false,
        sr_preset: null,
        rr_preset: null,
        fg_multi_frame: null,
    },
    dxvk: {
        hud: null,
        nvapi: true,
        async_compile: true,
    },
    vkd3d: {
        no_dxr: false,
        force_dxr: false,
        dxr12: false,
        force_static_cbv: false,
        single_queue: false,
        no_upload_hvv: false,
        frame_rate: 0,
    },
    nvidia: {
        vsync: null,
        triple_buffer: false,
        prime: false,
        smooth_motion: false,
    },
    proton: {
        verb: "waitforexitandrun",
        sync_mode: null,
        enable_wayland: false,
        enable_hdr: false,
        integer_scaling: false,
    },
    wrappers: {
        mangohud: {
            enabled: false,
            fps_limit_enabled: false,
            fps_limit: null,
            fps_limiter_mode: null,
        },
        gamemode: false,
        game_performance: false,
        dlss_swapper: false,
        gamescope: {
            enabled: false,
            width: null,
            height: null,
            internal_width: null,
            internal_height: null,
            dsr_enabled: false,
            dsr_width: null,
            dsr_height: null,
            upscale_filter: null,
            fsr_sharpness: null,
            fullscreen: true,
            borderless: false,
            vrr: false,
            framelimit: null,
            mangoapp: false,
            hdr: false,
        },
        frame_limiter: {
            enabled: false,
            target_fps: null,
            swapchain_latency: null,
        },
        lact_profile: null,
        lact_restore_after_exit: true,
    },
    screen: {
        target_monitor: null,
        fullscreen_on_target: false,
        disable_other_monitors: false,
        restore_monitors_after_exit: true,
    },
    custom_env: {},
    custom_args: null,
});

// LACT Profile Section Component
function LactProfileSection({
    profile,
    setProfile,
    setHasChanges
}: {
    profile: GameProfile;
    setProfile: React.Dispatch<React.SetStateAction<GameProfile>>;
    setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const [lactAvailable, setLactAvailable] = useState(false);
    const [lactProfiles, setLactProfiles] = useState<string[]>([]);

    useEffect(() => {
        isLactAvailable().then(setLactAvailable).catch(() => setLactAvailable(false));
        getLactProfiles().then(setLactProfiles).catch(() => setLactProfiles([]));
    }, []);

    if (!lactAvailable) {
        return null;
    }

    return (
        <div className="bg-card border border-nvidia/30 p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-nvidia" />
                <span className="text-sm font-medium">LACT GPU Profile</span>
                <Tooltip text="Switch GPU power profile when launching this game">
                    <HelpCircle className="w-3 h-3 text-muted-foreground" />
                </Tooltip>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-medium">Apply LACT Profile</div>
                    <div className="text-xs text-muted-foreground">Runs: lact cli profile set "name"</div>
                </div>
                <Select
                    value={profile.wrappers.lact_profile || "none"}
                    onValueChange={(v) => {
                        setProfile((prev) => ({
                            ...prev,
                            wrappers: { ...prev.wrappers, lact_profile: v === "none" ? null : v },
                        }));
                        setHasChanges(true);
                    }}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {lactProfiles.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {profile.wrappers.lact_profile && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                    <div>
                        <div className="text-sm font-medium">Restore Previous Profile</div>
                        <div className="text-xs text-muted-foreground">Switch back to previous LACT profile after game exits</div>
                    </div>
                    <Switch
                        checked={profile.wrappers.lact_restore_after_exit}
                        onCheckedChange={(v) => {
                            setProfile((prev) => ({
                                ...prev,
                                wrappers: { ...prev.wrappers, lact_restore_after_exit: v },
                            }));
                            setHasChanges(true);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

// Screen Configuration Section Component
function ScreenConfigSection({
    profile,
    setProfile,
    setHasChanges
}: {
    profile: GameProfile;
    setProfile: React.Dispatch<React.SetStateAction<GameProfile>>;
    setHasChanges: React.Dispatch<React.SetStateAction<boolean>>;
}) {
    const [monitors, setMonitors] = useState<{ id: number; name: string; description: string; width: number; height: number; refresh_rate: number }[]>([]);
    const [isSupported, setIsSupported] = useState(false);
    const [compositorName, setCompositorName] = useState("");

    useEffect(() => {
        import("@/lib/api").then(api => {
            api.isScreenConfigSupported().then(setIsSupported);
            api.getCompositorName().then(setCompositorName);
            api.listMonitors().then(setMonitors).catch(() => setMonitors([]));
        });
    }, []);

    if (!isSupported) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-muted-foreground text-sm">
                <Monitor className="w-4 h-4" />
                <span>Screen configuration requires Hyprland or Sway</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Monitor className="w-4 h-4" />
                <span>Compositor: {compositorName}</span>
            </div>

            {/* Target Monitor Selection */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm">Target Monitor</span>
                    <Tooltip text="Launch game on this monitor">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Tooltip>
                </div>
                <Select
                    value={profile.screen.target_monitor || "auto"}
                    onValueChange={(v) => {
                        setProfile(prev => ({
                            ...prev,
                            screen: { ...prev.screen, target_monitor: v === "auto" ? null : v }
                        }));
                        setHasChanges(true);
                    }}
                >
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="Auto" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="auto">Auto (Primary)</SelectItem>
                        {monitors.map(m => (
                            <SelectItem key={m.name} value={m.name}>
                                {m.name} ({m.width}x{m.height}@{Math.round(m.refresh_rate)}Hz)
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Fullscreen on Target */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm">Fullscreen on Target</span>
                    <Tooltip text="Force fullscreen mode on target monitor">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Tooltip>
                </div>
                <Switch
                    checked={profile.screen.fullscreen_on_target}
                    onCheckedChange={(v) => {
                        setProfile(prev => ({
                            ...prev,
                            screen: { ...prev.screen, fullscreen_on_target: v }
                        }));
                        setHasChanges(true);
                    }}
                />
            </div>

            {/* Disable Other Monitors */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm">Disable Other Monitors</span>
                    <Tooltip text="Turn off other monitors during gameplay">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                    </Tooltip>
                </div>
                <Switch
                    checked={profile.screen.disable_other_monitors}
                    onCheckedChange={(v) => {
                        setProfile(prev => ({
                            ...prev,
                            screen: { ...prev.screen, disable_other_monitors: v }
                        }));
                        setHasChanges(true);
                    }}
                />
            </div>

            {/* Restore After Exit */}
            {profile.screen.disable_other_monitors && (
                <div className="flex items-center justify-between ml-4 pt-2 border-t border-border/30">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Restore monitors after exit</span>
                    </div>
                    <Switch
                        checked={profile.screen.restore_monitors_after_exit}
                        onCheckedChange={(v) => {
                            setProfile(prev => ({
                                ...prev,
                                screen: { ...prev.screen, restore_monitors_after_exit: v }
                            }));
                            setHasChanges(true);
                        }}
                    />
                </div>
            )}
        </div>
    );
}

// Game Data Paths Section Component (PCGamingWiki)
function GameDataSection({
    steamAppid
}: {
    steamAppid: number | null;
}) {
    const [data, setData] = useState<{
        game_name: string;
        config_paths: { platform: string; raw_path: string; resolved_path: string; exists: boolean }[];
        save_paths: { platform: string; raw_path: string; resolved_path: string; exists: boolean }[];
        error: string | null;
    } | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (steamAppid) {
            setLoading(true);
            import("@/lib/api").then(api => {
                api.getGameDataPaths(steamAppid).then(paths => {
                    setData(paths);
                    setLoading(false);
                }).catch(() => {
                    setLoading(false);
                });
            });
        } else {
            setData(null);
        }
    }, [steamAppid]);

    const handleOpen = async (path: string, inEditor: boolean) => {
        const api = await import("@/lib/api");
        try {
            await api.openGamePath(path, inEditor);
        } catch (e) {
            console.error("Failed to open path:", e);
        }
    };

    if (!steamAppid) {
        return (
            <div className="text-sm text-muted-foreground">
                Select a Steam game to view data locations.
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span>Loading from PCGamingWiki...</span>
            </div>
        );
    }

    if (data?.error) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-200 text-sm">
                <span className="text-lg">❌</span>
                <div>
                    <span className="font-medium">Error</span>
                    <p className="text-xs text-red-200/70 mt-0.5">{data.error}</p>
                </div>
            </div>
        );
    }

    if (!data || (data.config_paths.length === 0 && data.save_paths.length === 0)) {
        return (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
                <span className="text-lg">⚠️</span>
                <div>
                    <span className="font-medium">No data found</span>
                    <p className="text-xs text-amber-200/70 mt-0.5">
                        PCGamingWiki doesn't have path information for this game.
                    </p>
                </div>
            </div>
        );
    }

    const PathItem = ({ path, type }: { path: typeof data.config_paths[0]; type: "config" | "save" }) => (
        <div className="bg-muted/30 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
                <code className="text-xs font-mono text-muted-foreground break-all flex-1">
                    {path.resolved_path}
                </code>
                <div className="flex items-center gap-1 shrink-0">
                    {path.exists ? (
                        <span className="text-green-400 text-sm">✅</span>
                    ) : (
                        <span className="text-red-400 text-sm">❌</span>
                    )}
                </div>
            </div>
            <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                    {path.exists ? "Found" : "Not found"}
                </span>
                {path.exists && (
                    <div className="flex gap-1">
                        {type === "config" && (
                            <button
                                onClick={() => handleOpen(path.resolved_path, true)}
                                className="px-2 py-1 text-xs bg-primary/20 hover:bg-primary/30 text-primary rounded transition-colors"
                            >
                                Open in Editor
                            </button>
                        )}
                        <button
                            onClick={() => handleOpen(path.resolved_path, false)}
                            className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded transition-colors"
                        >
                            Open Folder
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* PCGamingWiki Attribution */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>📚</span>
                <span>Data from <a href={`https://www.pcgamingwiki.com/wiki/${encodeURIComponent(data.game_name)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">PCGamingWiki</a></span>
            </div>

            {/* Configuration Paths */}
            {data.config_paths.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span>⚙️</span>
                        <span className="text-sm font-medium">Configuration</span>
                    </div>
                    {data.config_paths.map((path, i) => (
                        <PathItem key={i} path={path} type="config" />
                    ))}
                </div>
            )}

            {/* Save Paths */}
            {data.save_paths.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <span>💾</span>
                        <span className="text-sm font-medium">Save Games</span>
                    </div>
                    {data.save_paths.map((path, i) => (
                        <PathItem key={i} path={path} type="save" />
                    ))}
                </div>
            )}

            {/* Help text */}
            {(data.config_paths.some(p => !p.exists) || data.save_paths.some(p => !p.exists)) && (
                <div className="text-xs text-muted-foreground p-2 bg-muted/20 rounded">
                    💡 Paths marked "Not found" may appear after running the game at least once.
                </div>
            )}
        </div>
    );
}

// Launch Preview Component
function LaunchPreview({ profile, isSteamGame }: { profile: GameProfile; isSteamGame: boolean }) {
    const [envVars, setEnvVars] = useState<Record<string, string>>({});
    const [wrappers, setWrappers] = useState<string[]>([]);
    const [copiedFull, setCopiedFull] = useState(false);
    const [copiedSimple, setCopiedSimple] = useState(false);

    useEffect(() => {
        buildEnvVars(profile).then(setEnvVars).catch(() => setEnvVars({}));
        buildWrapperCmd(profile).then(setWrappers).catch(() => setWrappers([]));
    }, [profile]);

    const steamLaunchCommand = useMemo(() => {
        const envString = Object.entries(envVars)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ");
        const wrapperString = wrappers.join(" ");

        let cmd = "";
        if (envString) cmd += envString + " ";
        if (wrapperString) cmd += wrapperString + " ";
        cmd += "%command%";

        return cmd;
    }, [envVars, wrappers]);

    const simpleCommand = `unvcpfl --profile "${profile.name}" %command%`;

    const handleCopyFull = async () => {
        try {
            await navigator.clipboard.writeText(steamLaunchCommand);
            setCopiedFull(true);
            setTimeout(() => setCopiedFull(false), 2000);
        } catch (e) {
            console.error("Failed to copy:", e);
        }
    };

    const handleCopySimple = async () => {
        try {
            await navigator.clipboard.writeText(simpleCommand);
            setCopiedSimple(true);
            setTimeout(() => setCopiedSimple(false), 2000);
        } catch (e) {
            console.error("Failed to copy:", e);
        }
    };

    const hasEnvVars = Object.keys(envVars).length > 0;
    const hasWrappers = wrappers.length > 0;

    if (!hasEnvVars && !hasWrappers) {
        return (
            <div className="bg-card border border-border p-4 mb-6">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Terminal className="w-4 h-4" />
                    <span className="text-sm">No custom launch options configured</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-nvidia" />
                    <span className="text-sm font-medium">Launch Configuration</span>
                </div>
                {isSteamGame && (
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleCopySimple} className="h-7 text-xs">
                            {copiedSimple ? <Check className="w-3 h-3 mr-1 text-nvidia" /> : <Copy className="w-3 h-3 mr-1" />}
                            Copy unvcpfl
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopyFull} className="h-7 text-xs">
                            {copiedFull ? <Check className="w-3 h-3 mr-1 text-nvidia" /> : <Copy className="w-3 h-3 mr-1" />}
                            Copy Full
                        </Button>
                    </div>
                )}
            </div>

            {hasEnvVars && (
                <div className="mb-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Environment Variables</div>
                    <div className="bg-background p-2 font-mono text-xs space-y-0.5 max-h-24 overflow-y-auto">
                        {Object.entries(envVars).map(([key, value]) => (
                            <div key={key}>
                                <span className="text-nvidia">{key}</span>
                                <span className="text-muted-foreground">=</span>
                                <span className="text-foreground">{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {hasWrappers && (
                <div className="mb-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wrappers</div>
                    <div className="bg-background p-2 font-mono text-xs">
                        <span className="text-nvidia">{wrappers.join(" ")}</span>
                    </div>
                </div>
            )}

            {isSteamGame && (
                <>
                    <div className="mb-3">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Simple (uses wrapper script)</div>
                        <div className="bg-background p-2 font-mono text-xs break-all select-all">
                            {simpleCommand}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Full Command (standalone)</div>
                        <div className="bg-background p-2 font-mono text-xs break-all select-all">
                            {steamLaunchCommand}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

interface MainPanelProps {
    selectedGame: Game | null;
    selectedProfile?: GameProfile | null;
    onProfileSaved?: () => void;
}

export function MainPanel({ selectedGame, selectedProfile, onProfileSaved }: MainPanelProps) {
    const [profile, setProfile] = useState<GameProfile>(createDefaultProfile(selectedGame));
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        // If a custom profile is selected, use it directly
        if (selectedProfile) {
            setProfile(selectedProfile);
            setHasChanges(false);
            return;
        }
        
        if (selectedGame) {
            getProfile(selectedGame.name).then((existing) => {
                if (existing) {
                    setProfile(existing);
                } else {
                    setProfile(createDefaultProfile(selectedGame));
                }
                setHasChanges(false);
            });
        } else {
            setProfile(createDefaultProfile(null));
            setHasChanges(false);
        }
    }, [selectedGame, selectedProfile]);

    const updateNested = <P extends keyof GameProfile, K extends keyof GameProfile[P]>(
        parent: P,
        key: K,
        value: GameProfile[P][K]
    ) => {
        setProfile((prev) => ({
            ...prev,
            [parent]: { ...(prev[parent] as object), [key]: value },
        }));
        setHasChanges(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveProfile(profile);
            setHasChanges(false);
            onProfileSaved?.();
        } catch (e) {
            console.error("Failed to save profile:", e);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setProfile(createDefaultProfile(selectedGame));
        setHasChanges(true);
    };

    const handleCreateDesktopEntry = async () => {
        if (!selectedGame) return;
        try {
            const path = await createDesktopEntry(selectedGame, profile);
            console.log("Desktop entry created:", path);
            // Could show a toast notification here
        } catch (e) {
            console.error("Failed to create desktop entry:", e);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold">
                        {selectedGame?.name || "Global Settings"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {selectedGame
                            ? `Configure settings for ${selectedGame.source} game`
                            : "Default settings applied to all games without custom profiles"}
                    </p>
                </div>
                <div className="flex gap-2">
                    {selectedGame && (
                        <Button variant="outline" size="sm" onClick={handleCreateDesktopEntry}>
                            <FileDown className="w-4 h-4 mr-2" />
                            Desktop Entry
                        </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={handleReset}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Reset
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={!hasChanges || saving}>
                        <Save className="w-4 h-4 mr-2" />
                        {saving ? "Saving..." : "Save"}
                    </Button>
                </div>
            </div>

            {/* Settings */}
            <ScrollArea className="flex-1">
                <div className="p-6 space-y-8">
                    {/* Launch Preview */}
                    <LaunchPreview profile={profile} isSteamGame={selectedGame?.source === "Steam"} />

                    {/* LACT GPU Profile */}
                    <LactProfileSection profile={profile} setProfile={setProfile} setHasChanges={setHasChanges} />

                    {/* Screen Configuration */}
                    <SettingsSection title="Screen Configuration" icon={<Monitor className="w-4 h-4" />}>
                        <ScreenConfigSection profile={profile} setProfile={setProfile} setHasChanges={setHasChanges} />
                    </SettingsSection>

                    {/* Game Data Paths (PCGamingWiki) - Only for Steam games */}
                    {selectedGame?.source === "Steam" && selectedGame.id && (
                        <SettingsSection title="Game Data" icon={<span className="text-sm">📁</span>}>
                            <GameDataSection steamAppid={parseInt(selectedGame.id)} />
                        </SettingsSection>
                    )}

                    {/* NVIDIA GPU Settings */}
                    <SettingsSection title="NVIDIA GPU" icon={<Zap className="w-4 h-4" />}>
                        <SettingRow label="NVIDIA Prime" description="Force discrete GPU on hybrid systems">
                            <Switch
                                checked={profile.nvidia.prime}
                                onCheckedChange={(v) => updateNested("nvidia", "prime", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Smooth Motion"
                            description="Frame generation (RTX 40/50 series only)"
                            tooltip="NVPRESENT_ENABLE_SMOOTH_MOTION=1"
                        >
                            <Switch
                                checked={profile.nvidia.smooth_motion}
                                onCheckedChange={(v) => updateNested("nvidia", "smooth_motion", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Frame Synchronization */}
                    <SettingsSection title="Frame Synchronization" icon={<Monitor className="w-4 h-4" />}>
                        <SettingRow label="Vertical Sync" description="Synchronize frame rate with display refresh">
                            <Select
                                value={profile.nvidia.vsync || "app"}
                                onValueChange={(v) => updateNested("nvidia", "vsync", v === "app" ? null : v)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Application Controlled" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="app">Application Controlled</SelectItem>
                                    <SelectItem value="off">Off</SelectItem>
                                    <SelectItem value="on">On</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>

                        <SettingRow label="Triple Buffering" description="Use triple buffering for smoother frame pacing">
                            <Switch
                                checked={profile.nvidia.triple_buffer}
                                onCheckedChange={(v) => updateNested("nvidia", "triple_buffer", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Proton / Wine */}
                    <SettingsSection title="Proton / Wine" icon={<Layers className="w-4 h-4" />}>
                        <SettingRow
                            label="Sync Mode"
                            description="Synchronization primitive mode"
                            tooltip="Controls ESYNC/FSYNC/NTSYNC. 'Prefix Default' lets Proton decide."
                        >
                            <Select
                                value={profile.proton.sync_mode || "default"}
                                onValueChange={(v) => updateNested("proton", "sync_mode", v === "default" ? null : v)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Prefix Default</SelectItem>
                                    <SelectItem value="esync">ESYNC</SelectItem>
                                    <SelectItem value="fsync">FSYNC</SelectItem>
                                    <SelectItem value="ntsync">NTSYNC (Kernel 6.3+)</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>

                        <SettingRow
                            label="Proton Wayland"
                            description="Enable native Wayland mode in Proton"
                            tooltip="PROTON_ENABLE_WAYLAND=1"
                        >
                            <Switch
                                checked={profile.proton.enable_wayland}
                                onCheckedChange={(v) => updateNested("proton", "enable_wayland", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="HDR Support"
                            description="Enable High Dynamic Range output"
                            tooltip="PROTON_ENABLE_HDR=1"
                        >
                            <Switch
                                checked={profile.proton.enable_hdr}
                                onCheckedChange={(v) => updateNested("proton", "enable_hdr", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Integer Scaling"
                            description="Pixel-perfect scaling for retro games"
                            tooltip="WINE_FULLSCREEN_INTEGER_SCALING=1"
                        >
                            <Switch
                                checked={profile.proton.integer_scaling}
                                onCheckedChange={(v) => updateNested("proton", "integer_scaling", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Frame Limiter */}
                    <SettingsSection title="Frame Limiter" icon={<Monitor className="w-4 h-4" />}>
                        <SettingRow
                            label="Enable Frame Limiter"
                            description="Limit FPS at driver level (DXVK/VKD3D)"
                            tooltip="Uses DXVK_FRAME_RATE and VKD3D_FRAME_RATE"
                        >
                            <Switch
                                checked={profile.wrappers.frame_limiter.enabled}
                                onCheckedChange={(v) => {
                                    setProfile((prev) => ({
                                        ...prev,
                                        wrappers: {
                                            ...prev.wrappers,
                                            frame_limiter: { ...prev.wrappers.frame_limiter, enabled: v },
                                        },
                                    }));
                                    setHasChanges(true);
                                }}
                            />
                        </SettingRow>

                        {profile.wrappers.frame_limiter.enabled && (
                            <>
                                <SettingRow label="Target FPS" description="Maximum frames per second">
                                    <input
                                        type="number"
                                        value={profile.wrappers.frame_limiter.target_fps || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    frame_limiter: { ...prev.wrappers.frame_limiter, target_fps: val },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                        className="w-24 bg-background border border-input px-3 py-1.5 text-sm"
                                        placeholder="60"
                                    />
                                </SettingRow>

                                <SettingRow
                                    label="Swapchain Latency"
                                    description="VKD3D swapchain latency frames (DX12 only)"
                                    tooltip="VKD3D_SWAPCHAIN_LATENCY_FRAMES - Lower = less input lag"
                                >
                                    <input
                                        type="number"
                                        value={profile.wrappers.frame_limiter.swapchain_latency || ""}
                                        onChange={(e) => {
                                            const val = e.target.value ? parseInt(e.target.value) : null;
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    frame_limiter: { ...prev.wrappers.frame_limiter, swapchain_latency: val },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                        className="w-24 bg-background border border-input px-3 py-1.5 text-sm"
                                        placeholder="1"
                                    />
                                </SettingRow>
                            </>
                        )}
                    </SettingsSection>

                    <Separator />

                    {/* Wrappers */}
                    <SettingsSection title="Wrappers" icon={<Layers className="w-4 h-4" />}>
                        <SettingRow label="MangoHud" description="Display performance overlay">
                            <Switch
                                checked={profile.wrappers.mangohud.enabled}
                                onCheckedChange={(v) => {
                                    setProfile((prev) => ({
                                        ...prev,
                                        wrappers: {
                                            ...prev.wrappers,
                                            mangohud: { ...prev.wrappers.mangohud, enabled: v },
                                        },
                                    }));
                                    setHasChanges(true);
                                }}
                            />
                        </SettingRow>

                        {profile.wrappers.mangohud.enabled && (
                            <>
                                <SettingRow label="FPS Limiter" description="Enable MangoHud FPS limiting">
                                    <Switch
                                        checked={profile.wrappers.mangohud.fps_limit_enabled}
                                        onCheckedChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    mangohud: { ...prev.wrappers.mangohud, fps_limit_enabled: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                </SettingRow>

                                {profile.wrappers.mangohud.fps_limit_enabled && (
                                    <>
                                        <SettingRow label="FPS Limit" description="Maximum frames per second">
                                            <input
                                                type="number"
                                                value={profile.wrappers.mangohud.fps_limit || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                    setProfile((prev) => ({
                                                        ...prev,
                                                        wrappers: {
                                                            ...prev.wrappers,
                                                            mangohud: { ...prev.wrappers.mangohud, fps_limit: val },
                                                        },
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                                className="w-24 bg-background border border-input px-3 py-1.5 text-sm"
                                                placeholder="60"
                                            />
                                        </SettingRow>

                                        <SettingRow
                                            label="Limiter Mode"
                                            description="When to apply the frame limit"
                                            tooltip="Early: before game logic. Late: after rendering."
                                        >
                                            <Select
                                                value={profile.wrappers.mangohud.fps_limiter_mode || "late"}
                                                onValueChange={(v) => {
                                                    setProfile((prev) => ({
                                                        ...prev,
                                                        wrappers: {
                                                            ...prev.wrappers,
                                                            mangohud: { ...prev.wrappers.mangohud, fps_limiter_mode: v },
                                                        },
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                            >
                                                <SelectTrigger className="w-32">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="early">Early</SelectItem>
                                                    <SelectItem value="late">Late</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </SettingRow>
                                    </>
                                )}
                            </>
                        )}

                        <SettingRow label="Gamemode" description="Feral Gamemode optimizations">
                            <Switch
                                checked={profile.wrappers.gamemode}
                                onCheckedChange={(v) => updateNested("wrappers", "gamemode", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Game Performance"
                            description="CachyOS game-performance scheduler"
                            tooltip="Requires game-performance package from CachyOS"
                        >
                            <Switch
                                checked={profile.wrappers.game_performance}
                                onCheckedChange={(v) => updateNested("wrappers", "game_performance", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="DLSS Swapper"
                            description="Swap DLSS DLLs with latest version"
                            tooltip="Replaces embedded DLSS with latest from dlss-swapper"
                        >
                            <Switch
                                checked={profile.wrappers.dlss_swapper}
                                onCheckedChange={(v) => updateNested("wrappers", "dlss_swapper", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* DLSS / DXVK-NVAPI */}
                    <SettingsSection title="DLSS / DXVK-NVAPI" icon={<Sparkles className="w-4 h-4" />}>
                        <SettingRow
                            label="DLSS Upgrade"
                            description="Use latest DLSS version in Proton"
                            tooltip="PROTON_DLSS_UPGRADE=1 - Enables Frame Generation, Super Resolution, Ray Reconstruction"
                        >
                            <Switch
                                checked={profile.dlss.upgrade}
                                onCheckedChange={(v) => updateNested("dlss", "upgrade", v)}
                            />
                        </SettingRow>

                        <SettingRow label="DLSS Indicator" description="Show DLSS status overlay in-game">
                            <Switch
                                checked={profile.dlss.indicator}
                                onCheckedChange={(v) => updateNested("dlss", "indicator", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="NGX Updater"
                            description="Auto-update DLSS models"
                            tooltip="PROTON_ENABLE_NGX_UPDATER=1"
                        >
                            <Switch
                                checked={profile.dlss.ngx_updater}
                                onCheckedChange={(v) => updateNested("dlss", "ngx_updater", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Super Resolution Override"
                            description="Force enable DLSS Super Resolution"
                            tooltip="DXVK_NVAPI_DRS_NGX_DLSS_SR_OVERRIDE=on"
                        >
                            <Switch
                                checked={profile.dlss.sr_override}
                                onCheckedChange={(v) => updateNested("dlss", "sr_override", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Ray Reconstruction Override"
                            description="Force enable DLSS Ray Reconstruction"
                            tooltip="DXVK_NVAPI_DRS_NGX_DLSS_RR_OVERRIDE=on"
                        >
                            <Switch
                                checked={profile.dlss.rr_override}
                                onCheckedChange={(v) => updateNested("dlss", "rr_override", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Frame Generation Override"
                            description="Force enable DLSS Frame Generation"
                            tooltip="DXVK_NVAPI_DRS_NGX_DLSS_FG_OVERRIDE=on"
                        >
                            <Switch
                                checked={profile.dlss.fg_override}
                                onCheckedChange={(v) => updateNested("dlss", "fg_override", v)}
                            />
                        </SettingRow>

                        <SettingRow label="SR Preset" description="Super Resolution render preset">
                            <Select
                                value={profile.dlss.sr_preset || "default"}
                                onValueChange={(v) => updateNested("dlss", "sr_preset", v === "default" ? null : v)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    <SelectItem value="render_preset_latest">Latest</SelectItem>
                                    <SelectItem value="render_preset_a">Preset A</SelectItem>
                                    <SelectItem value="render_preset_b">Preset B</SelectItem>
                                    <SelectItem value="render_preset_c">Preset C</SelectItem>
                                    <SelectItem value="render_preset_d">Preset D</SelectItem>
                                    <SelectItem value="render_preset_e">Preset E</SelectItem>
                                    <SelectItem value="render_preset_f">Preset F</SelectItem>
                                    <SelectItem value="render_preset_g">Preset G</SelectItem>
                                    <SelectItem value="render_preset_h">Preset H</SelectItem>
                                    <SelectItem value="render_preset_i">Preset I</SelectItem>
                                    <SelectItem value="render_preset_j">Preset J</SelectItem>
                                    <SelectItem value="render_preset_k">Preset K (Best)</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>

                        <SettingRow label="Multi-Frame Generation" description="Number of generated frames">
                            <Select
                                value={profile.dlss.fg_multi_frame || "default"}
                                onValueChange={(v) => updateNested("dlss", "fg_multi_frame", v === "default" ? null : v)}
                            >
                                <SelectTrigger className="w-32">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    <SelectItem value="MAX">Max</SelectItem>
                                    <SelectItem value="1">1</SelectItem>
                                    <SelectItem value="2">2</SelectItem>
                                    <SelectItem value="3">3</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Gamescope */}
                    <SettingsSection title="Gamescope" icon={<Gamepad2 className="w-4 h-4" />}>
                        <SettingRow label="Enable Gamescope" description="Use Gamescope compositor">
                            <Switch
                                checked={profile.wrappers.gamescope.enabled}
                                onCheckedChange={(v) => {
                                    setProfile((prev) => ({
                                        ...prev,
                                        wrappers: {
                                            ...prev.wrappers,
                                            gamescope: { ...prev.wrappers.gamescope, enabled: v },
                                        },
                                    }));
                                    setHasChanges(true);
                                }}
                            />
                        </SettingRow>

                        {profile.wrappers.gamescope.enabled && (
                            <>
                                <SettingRow
                                    label="DSR Mode"
                                    description="Dynamic Super Resolution (render at higher res)"
                                    tooltip="Renders game at higher resolution then downscales for better quality"
                                >
                                    <Switch
                                        checked={profile.wrappers.gamescope.dsr_enabled}
                                        onCheckedChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    gamescope: { ...prev.wrappers.gamescope, dsr_enabled: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                </SettingRow>

                                {profile.wrappers.gamescope.dsr_enabled && (
                                    <SettingRow label="DSR Resolution" description="Internal render resolution (width × height)">
                                        <div className="flex gap-2 items-center">
                                            <input
                                                type="number"
                                                value={profile.wrappers.gamescope.dsr_width || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                    setProfile((prev) => ({
                                                        ...prev,
                                                        wrappers: {
                                                            ...prev.wrappers,
                                                            gamescope: { ...prev.wrappers.gamescope, dsr_width: val },
                                                        },
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                                className="w-20 bg-background border border-input px-2 py-1.5 text-sm"
                                                placeholder="2560"
                                            />
                                            <span className="text-muted-foreground">×</span>
                                            <input
                                                type="number"
                                                value={profile.wrappers.gamescope.dsr_height || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value ? parseInt(e.target.value) : null;
                                                    setProfile((prev) => ({
                                                        ...prev,
                                                        wrappers: {
                                                            ...prev.wrappers,
                                                            gamescope: { ...prev.wrappers.gamescope, dsr_height: val },
                                                        },
                                                    }));
                                                    setHasChanges(true);
                                                }}
                                                className="w-20 bg-background border border-input px-2 py-1.5 text-sm"
                                                placeholder="1440"
                                            />
                                        </div>
                                    </SettingRow>
                                )}

                                <SettingRow label="Output Resolution" description="Display output resolution (width × height)">
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="number"
                                            value={profile.wrappers.gamescope.width || ""}
                                            onChange={(e) => {
                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                setProfile((prev) => ({
                                                    ...prev,
                                                    wrappers: {
                                                        ...prev.wrappers,
                                                        gamescope: { ...prev.wrappers.gamescope, width: val },
                                                    },
                                                }));
                                                setHasChanges(true);
                                            }}
                                            className="w-20 bg-background border border-input px-2 py-1.5 text-sm"
                                            placeholder="1920"
                                        />
                                        <span className="text-muted-foreground">×</span>
                                        <input
                                            type="number"
                                            value={profile.wrappers.gamescope.height || ""}
                                            onChange={(e) => {
                                                const val = e.target.value ? parseInt(e.target.value) : null;
                                                setProfile((prev) => ({
                                                    ...prev,
                                                    wrappers: {
                                                        ...prev.wrappers,
                                                        gamescope: { ...prev.wrappers.gamescope, height: val },
                                                    },
                                                }));
                                                setHasChanges(true);
                                            }}
                                            className="w-20 bg-background border border-input px-2 py-1.5 text-sm"
                                            placeholder="1080"
                                        />
                                    </div>
                                </SettingRow>

                                <SettingRow label="Upscale Filter" description="Scaling algorithm">
                                    <Select
                                        value={profile.wrappers.gamescope.upscale_filter || "fsr"}
                                        onValueChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    gamescope: { ...prev.wrappers.gamescope, upscale_filter: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    >
                                        <SelectTrigger className="w-48">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fsr">AMD FSR</SelectItem>
                                            <SelectItem value="nis">NVIDIA NIS</SelectItem>
                                            <SelectItem value="linear">Linear</SelectItem>
                                            <SelectItem value="nearest">Nearest</SelectItem>
                                            <SelectItem value="pixel">Pixel</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </SettingRow>

                                <SettingRow label="Fullscreen" description="Run in fullscreen mode">
                                    <Switch
                                        checked={profile.wrappers.gamescope.fullscreen}
                                        onCheckedChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    gamescope: { ...prev.wrappers.gamescope, fullscreen: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                </SettingRow>

                                <SettingRow label="VRR / Adaptive Sync" description="Variable refresh rate">
                                    <Switch
                                        checked={profile.wrappers.gamescope.vrr}
                                        onCheckedChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    gamescope: { ...prev.wrappers.gamescope, vrr: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                </SettingRow>

                                <SettingRow label="HDR" description="Enable HDR output">
                                    <Switch
                                        checked={profile.wrappers.gamescope.hdr}
                                        onCheckedChange={(v) => {
                                            setProfile((prev) => ({
                                                ...prev,
                                                wrappers: {
                                                    ...prev.wrappers,
                                                    gamescope: { ...prev.wrappers.gamescope, hdr: v },
                                                },
                                            }));
                                            setHasChanges(true);
                                        }}
                                    />
                                </SettingRow>
                            </>
                        )}
                    </SettingsSection>

                    <Separator />

                    {/* DXVK */}
                    <SettingsSection title="DXVK" icon={<Layers className="w-4 h-4" />}>
                        <SettingRow label="NVAPI" description="Enable NVIDIA API support for DXVK">
                            <Switch
                                checked={profile.dxvk.nvapi}
                                onCheckedChange={(v) => updateNested("dxvk", "nvapi", v)}
                            />
                        </SettingRow>

                        <SettingRow label="Async Compile" description="Compile shaders asynchronously">
                            <Switch
                                checked={profile.dxvk.async_compile}
                                onCheckedChange={(v) => updateNested("dxvk", "async_compile", v)}
                            />
                        </SettingRow>

                        <SettingRow label="HUD" description="DXVK performance overlay">
                            <Select
                                value={profile.dxvk.hud || "off"}
                                onValueChange={(v) => updateNested("dxvk", "hud", v === "off" ? null : v)}
                            >
                                <SelectTrigger className="w-40">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="off">Off</SelectItem>
                                    <SelectItem value="fps">FPS Only</SelectItem>
                                    <SelectItem value="fps,memory">FPS + Memory</SelectItem>
                                    <SelectItem value="full">Full</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* VKD3D-Proton */}
                    <SettingsSection title="VKD3D-Proton (DX12)" icon={<Layers className="w-4 h-4" />}>
                        <SettingRow
                            label="Disable DXR"
                            description="Disable DirectX Raytracing"
                            tooltip="VKD3D_CONFIG=nodxr - Useful for games with buggy RT"
                        >
                            <Switch
                                checked={profile.vkd3d.no_dxr}
                                onCheckedChange={(v) => updateNested("vkd3d", "no_dxr", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Force DXR"
                            description="Enable DXR even if unsafe"
                            tooltip="VKD3D_CONFIG=dxr - Forces raytracing even when not recommended"
                        >
                            <Switch
                                checked={profile.vkd3d.force_dxr}
                                onCheckedChange={(v) => updateNested("vkd3d", "force_dxr", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="DXR 1.2 (Experimental)"
                            description="Enable experimental DXR 1.2 with opacity micromap"
                            tooltip="VKD3D_CONFIG=dxr12 - Requires VK_EXT_opacity_micromap"
                        >
                            <Switch
                                checked={profile.vkd3d.dxr12}
                                onCheckedChange={(v) => updateNested("vkd3d", "dxr12", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Force Static CBV (NVIDIA)"
                            description="Unsafe speed hack for NVIDIA GPUs"
                            tooltip="VKD3D_CONFIG=force_static_cbv - May improve performance, may cause issues"
                        >
                            <Switch
                                checked={profile.vkd3d.force_static_cbv}
                                onCheckedChange={(v) => updateNested("vkd3d", "force_static_cbv", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Single Queue"
                            description="Disable async compute/transfer queues"
                            tooltip="VKD3D_CONFIG=single_queue - May fix stability issues"
                        >
                            <Switch
                                checked={profile.vkd3d.single_queue}
                                onCheckedChange={(v) => updateNested("vkd3d", "single_queue", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="No Upload HVV"
                            description="Don't use resizable BAR for uploads"
                            tooltip="VKD3D_CONFIG=no_upload_hvv - Free up VRAM at cost of GPU performance"
                        >
                            <Switch
                                checked={profile.vkd3d.no_upload_hvv}
                                onCheckedChange={(v) => updateNested("vkd3d", "no_upload_hvv", v)}
                            />
                        </SettingRow>

                        <SettingRow label="Frame Rate Limit" description="VKD3D frame rate limiter">
                            <input
                                type="number"
                                value={profile.vkd3d.frame_rate || ""}
                                onChange={(e) => {
                                    const val = e.target.value ? parseInt(e.target.value) : 0;
                                    updateNested("vkd3d", "frame_rate", val);
                                }}
                                className="w-20 bg-background border border-input px-2 py-1.5 text-sm"
                                placeholder="0"
                            />
                        </SettingRow>
                    </SettingsSection>
                </div>
            </ScrollArea>
        </div>
    );
}

// Helper components
function SettingsSection({
    title,
    icon,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <span className="text-nvidia">{icon}</span>
                <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
            </div>
            <div className="space-y-4">{children}</div>
        </div>
    );
}

function SettingRow({
    label,
    description,
    tooltip,
    children,
}: {
    label: string;
    description: string;
    tooltip?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <div className="flex items-center gap-1">
                    <span className="text-sm font-medium">{label}</span>
                    {tooltip && (
                        <Tooltip text={tooltip}>
                            <HelpCircle className="w-3 h-3 text-muted-foreground" />
                        </Tooltip>
                    )}
                </div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            {children}
        </div>
    );
}
