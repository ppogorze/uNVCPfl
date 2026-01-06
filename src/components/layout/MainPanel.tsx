import { useState, useEffect } from "react";
import { Game, GameProfile, getProfile, saveProfile, listProfiles } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, RotateCcw, Cpu, Layers, Sparkles, Monitor, Gamepad2 } from "lucide-react";

interface MainPanelProps {
    selectedGame: Game | null;
}

// Default profile structure
const createDefaultProfile = (game: Game | null): GameProfile => ({
    name: game?.name || "Global Profile",
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
    },
    proton: {
        verb: "waitforexitandrun",
        esync: true,
        fsync: true,
    },
    wrappers: {
        mangohud: false,
        gamemode: false,
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
    },
    custom_env: {},
    custom_args: null,
});

export function MainPanel({ selectedGame }: MainPanelProps) {
    const [profile, setProfile] = useState<GameProfile>(createDefaultProfile(selectedGame));
    const [hasChanges, setHasChanges] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (selectedGame) {
            // Try to load existing profile
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

    const updateProfile = <K extends keyof GameProfile>(key: K, value: GameProfile[K]) => {
        setProfile((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
    };

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
                        {selectedGame?.name || "Global Profile"}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {selectedGame
                            ? `Configure settings for ${selectedGame.source} game`
                            : "Default settings for all games"}
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
