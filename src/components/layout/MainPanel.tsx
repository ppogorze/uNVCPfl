import { useState, useEffect, useMemo } from "react";
import { Game, GameProfile, getProfile, saveProfile, buildEnvVars, buildWrapperCmd, isLactAvailable, getLactProfiles } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RotateCcw, Cpu, Layers, Sparkles, Monitor, Gamepad2, Copy, Check, Terminal, Gpu, Zap } from "lucide-react";

// Default profile structure
const createDefaultProfile = (game: Game | null): GameProfile => ({
    name: game?.name || "Global Settings",
    executable_match: game?.executable || null,
    steam_appid: game?.source === "Steam" ? parseInt(game.id) : null,
    dlss: {
        upgrade: false,
        indicator: false,
        preset: null,
    },
    dxvk: {
        hud: null,
        nvapi: true,
        async_compile: true,
        shader_cache: true,
    },
    vkd3d: {
        config: [],
        frame_rate: 0,
    },
    nvidia: {
        threaded_optimization: "auto",
        shader_cache_size: 12000000000,
        skip_cleanup: true,
        vsync: null,
        triple_buffer: false,
        prime: false,
        smooth_motion: false,
    },
    proton: {
        verb: "waitforexitandrun",
        esync: true,
        fsync: true,
        enable_wayland: false,
    },
    wrappers: {
        mangohud: false,
        gamemode: false,
        game_performance: false,
        dlss_swapper: false,
        gamescope: {
            enabled: false,
            width: null,
            height: null,
            internal_width: null,
            internal_height: null,
            upscale_filter: null,
            fsr_sharpness: null,
            fullscreen: true,
            borderless: false,
            vrr: false,
            framelimit: null,
            mangoapp: false,
            hdr: false,
        },
        lact_profile: null,
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
                <Gpu className="w-4 h-4 text-nvidia" />
                <span className="text-sm font-medium">LACT GPU Profile</span>
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-sm font-medium">Apply LACT Profile</div>
                    <div className="text-xs text-muted-foreground">Switch to a specific LACT GPU profile when launching</div>
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
        // Build env vars and wrappers from profile
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
                            {copiedSimple ? (
                                <>
                                    <Check className="w-3 h-3 mr-1 text-nvidia" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy unvcpfl
                                </>
                            )}
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleCopyFull} className="h-7 text-xs">
                            {copiedFull ? (
                                <>
                                    <Check className="w-3 h-3 mr-1 text-nvidia" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy Full Command
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>

            {/* Environment Variables */}
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

            {/* Wrappers */}
            {hasWrappers && (
                <div className="mb-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wrappers</div>
                    <div className="bg-background p-2 font-mono text-xs">
                        <span className="text-nvidia">{wrappers.join(" ")}</span>
                    </div>
                </div>
            )}

            {/* Steam Launch Commands */}
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
    onProfileSaved?: () => void;
}

export function MainPanel({ selectedGame, onProfileSaved }: MainPanelProps) {
    const [profile, setProfile] = useState<GameProfile>(createDefaultProfile(selectedGame));
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
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
    }, [selectedGame]);

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
            onProfileSaved?.();  // Notify parent to refresh sidebar
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

                    {/* LACT GPU Profile (if available) */}
                    <LactProfileSection profile={profile} setProfile={setProfile} setHasChanges={setHasChanges} />

                    {/* NVIDIA GPU Settings */}
                    <SettingsSection title="NVIDIA GPU" icon={<Zap className="w-4 h-4" />}>
                        <SettingRow
                            label="NVIDIA Prime"
                            description="Force discrete GPU on hybrid systems (laptop)"
                        >
                            <Switch
                                checked={profile.nvidia.prime}
                                onCheckedChange={(v) => updateNested("nvidia", "prime", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Smooth Motion (RTX 40/50)"
                            description="Frame generation on supported RTX cards"
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
                        <SettingRow
                            label="Vertical Sync"
                            description="Synchronize frame rate with display refresh"
                        >
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

                        <SettingRow
                            label="Triple Buffering"
                            description="Use triple buffering for smoother frame pacing"
                        >
                            <Switch
                                checked={profile.nvidia.triple_buffer}
                                onCheckedChange={(v) => updateNested("nvidia", "triple_buffer", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Performance */}
                    <SettingsSection title="Performance" icon={<Cpu className="w-4 h-4" />}>
                        <SettingRow
                            label="Threaded Optimization"
                            description="Enable multi-threaded OpenGL optimizations"
                        >
                            <Select
                                value={profile.nvidia.threaded_optimization || "auto"}
                                onValueChange={(v) => updateNested("nvidia", "threaded_optimization", v)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="auto">Auto</SelectItem>
                                    <SelectItem value="on">On</SelectItem>
                                    <SelectItem value="off">Off</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>

                        <SettingRow
                            label="Shader Cache"
                            description="Cache compiled shaders to reduce stuttering"
                        >
                            <Switch
                                checked={profile.dxvk.shader_cache}
                                onCheckedChange={(v) => updateNested("dxvk", "shader_cache", v)}
                            />
                        </SettingRow>

                        <SettingRow
                            label="Skip Shader Cache Cleanup"
                            description="Don't delete old shader cache entries"
                        >
                            <Switch
                                checked={profile.nvidia.skip_cleanup}
                                onCheckedChange={(v) => updateNested("nvidia", "skip_cleanup", v)}
                            />
                        </SettingRow>

                        <SettingRow label="ESYNC" description="Enhanced synchronization primitives">
                            <Switch
                                checked={profile.proton.esync}
                                onCheckedChange={(v) => updateNested("proton", "esync", v)}
                            />
                        </SettingRow>

                        <SettingRow label="FSYNC" description="Fast synchronization (requires kernel support)">
                            <Switch
                                checked={profile.proton.fsync}
                                onCheckedChange={(v) => updateNested("proton", "fsync", v)}
                            />
                        </SettingRow>

                        <SettingRow label="Proton Wayland" description="Enable Wayland support in Proton">
                            <Switch
                                checked={profile.proton.enable_wayland}
                                onCheckedChange={(v) => updateNested("proton", "enable_wayland", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* DLSS */}
                    <SettingsSection title="DLSS" icon={<Sparkles className="w-4 h-4" />}>
                        <SettingRow label="DLSS Upgrade" description="Automatically upgrade DLSS to latest version">
                            <Switch
                                checked={profile.dlss.upgrade}
                                onCheckedChange={(v) => updateNested("dlss", "upgrade", v)}
                            />
                        </SettingRow>

                        <SettingRow label="DLSS Indicator" description="Show DLSS status indicator in-game">
                            <Switch
                                checked={profile.dlss.indicator}
                                onCheckedChange={(v) => updateNested("dlss", "indicator", v)}
                            />
                        </SettingRow>

                        <SettingRow label="DLSS Preset" description="Force specific DLSS rendering preset">
                            <Select
                                value={profile.dlss.preset || "default"}
                                onValueChange={(v) => updateNested("dlss", "preset", v === "default" ? null : v)}
                            >
                                <SelectTrigger className="w-48">
                                    <SelectValue placeholder="Default" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    <SelectItem value="RENDER_PRESET_A">Preset A</SelectItem>
                                    <SelectItem value="RENDER_PRESET_B">Preset B</SelectItem>
                                    <SelectItem value="RENDER_PRESET_C">Preset C</SelectItem>
                                    <SelectItem value="RENDER_PRESET_D">Preset D</SelectItem>
                                    <SelectItem value="RENDER_PRESET_E">Preset E</SelectItem>
                                    <SelectItem value="RENDER_PRESET_F">Preset F</SelectItem>
                                    <SelectItem value="RENDER_PRESET_G">Preset G</SelectItem>
                                    <SelectItem value="RENDER_PRESET_H">Preset H</SelectItem>
                                    <SelectItem value="RENDER_PRESET_I">Preset I</SelectItem>
                                    <SelectItem value="RENDER_PRESET_J">Preset J</SelectItem>
                                    <SelectItem value="RENDER_PRESET_K">Preset K (Best)</SelectItem>
                                </SelectContent>
                            </Select>
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Wrappers */}
                    <SettingsSection title="Wrappers" icon={<Layers className="w-4 h-4" />}>
                        <SettingRow label="MangoHud" description="Display performance overlay">
                            <Switch
                                checked={profile.wrappers.mangohud}
                                onCheckedChange={(v) => updateNested("wrappers", "mangohud", v)}
                            />
                        </SettingRow>

                        <SettingRow label="Gamemode" description="Apply performance optimizations while gaming">
                            <Switch
                                checked={profile.wrappers.gamemode}
                                onCheckedChange={(v) => updateNested("wrappers", "gamemode", v)}
                            />
                        </SettingRow>

                        <SettingRow label="Game Performance (CachyOS)" description="CachyOS game-performance scheduler">
                            <Switch
                                checked={profile.wrappers.game_performance}
                                onCheckedChange={(v) => updateNested("wrappers", "game_performance", v)}
                            />
                        </SettingRow>

                        <SettingRow label="DLSS Swapper" description="Swap DLSS DLLs with latest version">
                            <Switch
                                checked={profile.wrappers.dlss_swapper}
                                onCheckedChange={(v) => updateNested("wrappers", "dlss_swapper", v)}
                            />
                        </SettingRow>
                    </SettingsSection>

                    <Separator />

                    {/* Gamescope */}
                    <SettingsSection title="Gamescope" icon={<Gamepad2 className="w-4 h-4" />}>
                        <SettingRow label="Enable Gamescope" description="Use Gamescope compositor for scaling/HDR">
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
                                <SettingRow label="Upscale Filter" description="Scaling algorithm (FSR, NIS, etc)">
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

                                <SettingRow label="VRR/Adaptive Sync" description="Enable variable refresh rate">
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

                        <SettingRow label="HUD" description="DXVK performance overlay options">
                            <Select
                                value={profile.dxvk.hud || "off"}
                                onValueChange={(v) => updateNested("dxvk", "hud", v === "off" ? null : v)}
                            >
                                <SelectTrigger className="w-48">
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
    children,
}: {
    label: string;
    description: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center justify-between py-2">
            <div>
                <div className="text-sm font-medium">{label}</div>
                <div className="text-xs text-muted-foreground">{description}</div>
            </div>
            {children}
        </div>
    );
}
