import { useEffect, useState, useMemo, useCallback } from "react";
import { Game, GameProfile, detectGames, listProfiles, listTemplateProfiles, saveProfile, deleteProfile } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GpuMonitor } from "./GpuMonitor";
import { Search, RefreshCw, Settings2, Monitor, Plus, MoreVertical, Pencil, Trash2, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
    selectedGame: Game | null;
    selectedProfile: GameProfile | null;
    onSelectGame: (game: Game | null) => void;
    onSelectProfile: (profile: GameProfile | null) => void;
    activePanel?: "game" | "global" | "screen" | "profile";
    onSelectScreen?: () => void;
    profilesVersion?: number;
}

// Games to filter out (Steamworks, redistributables, tools, etc.)
const IGNORED_PATTERNS = [
    /^steamworks common redistributables$/i,
    /^steam linux runtime/i,
    /^proton \d/i,
    /^proton experimental/i,
    /^proton hotfix/i,
    /^proton - experimental/i,
    /^steamworks shared/i,
    /directx/i,
    /vcredist/i,
    /^microsoft visual c\+\+/i,
    /dotnet/i,
    /\.net framework/i,
    /easyanticheat/i,
    /^battleye/i,
    /^sdk$/i,
    /redistributable/i,
];

function shouldFilterGame(name: string): boolean {
    return IGNORED_PATTERNS.some(pattern => pattern.test(name));
}

export function Sidebar({ selectedGame, selectedProfile, onSelectGame, onSelectProfile, activePanel = "global", onSelectScreen, profilesVersion }: SidebarProps) {
    const [games, setGames] = useState<Game[]>([]);
    const [gameProfiles, setGameProfiles] = useState<GameProfile[]>([]);
    const [customProfiles, setCustomProfiles] = useState<GameProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [showNewProfileDialog, setShowNewProfileDialog] = useState(false);
    const [newProfileName, setNewProfileName] = useState("");
    const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null);
    const [renameProfile, setRenameProfile] = useState<string | null>(null);
    const [renameValue, setRenameValue] = useState("");

    // Debounce search query (500ms delay, minimum 3 characters or empty)
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedQuery(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const loadGames = useCallback(async () => {
        setLoading(true);
        try {
            const [detected, savedProfiles, templates] = await Promise.all([
                detectGames(),
                listProfiles(),
                listTemplateProfiles(),
            ]);
            // Filter out ignored games
            const filtered = detected.filter(g => !shouldFilterGame(g.name));
            setGames(filtered);
            setGameProfiles(savedProfiles.filter(p => !p.is_template));
            setCustomProfiles(templates);
        } catch (e) {
            console.error("Failed to detect games:", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadGames();
    }, [loadGames, profilesVersion]);

    // Memoized filtered games - filter when query has 3+ chars
    const filteredGames = useMemo(() => {
        const query = debouncedQuery.trim().toLowerCase();
        if (query.length < 3) return games;
        return games.filter((game) =>
            game.name.toLowerCase().includes(query)
        );
    }, [games, debouncedQuery]);

    // Check if game has a custom profile
    const hasProfile = useCallback((game: Game): boolean => {
        return gameProfiles.some(p =>
            p.name.toLowerCase() === game.name.toLowerCase() ||
            p.steam_appid?.toString() === game.id
        );
    }, [gameProfiles]);

    // Handle Enter key for immediate search
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setDebouncedQuery(searchQuery);
        }
    };

    const handleCreateProfile = async () => {
        if (!newProfileName.trim()) return;
        
        const newProfile: GameProfile = {
            name: newProfileName.trim(),
            description: null,
            is_template: true,
            executable_match: null,
            steam_appid: null,
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
            custom_env: {},
            custom_args: null,
            screen: {
                target_monitor: null,
                fullscreen_on_target: false,
                disable_other_monitors: false,
                restore_monitors_after_exit: true,
            },
        };

        try {
            await saveProfile(newProfile);
            setNewProfileName("");
            setShowNewProfileDialog(false);
            await loadGames();
        } catch (e) {
            console.error("Failed to create profile:", e);
        }
    };

    const handleDeleteProfile = async (name: string) => {
        try {
            await deleteProfile(name);
            setMenuOpenFor(null);
            await loadGames();
        } catch (e) {
            console.error("Failed to delete profile:", e);
        }
    };

    const handleRename = async (oldName: string) => {
        if (!renameValue.trim() || renameValue === oldName) {
            setRenameProfile(null);
            return;
        }
        
        const profile = customProfiles.find(p => p.name === oldName);
        if (!profile) return;
        
        try {
            // Delete old and create new
            await deleteProfile(oldName);
            await saveProfile({ ...profile, name: renameValue.trim() });
            setRenameProfile(null);
            setRenameValue("");
            await loadGames();
        } catch (e) {
            console.error("Failed to rename profile:", e);
        }
    };

    return (
        <div className="w-80 bg-card border-r border-border flex flex-col h-full">
            {/* GPU Monitor */}
            <GpuMonitor />

            {/* Navigation */}
            <div className="p-2 border-b border-border space-y-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full justify-start ${
                        activePanel === "screen"
                            ? "bg-nvidia/20 border-l-2 border-nvidia"
                            : ""
                    }`}
                    onClick={() => onSelectScreen?.()}
                >
                    <Monitor className="w-4 h-4 mr-2" />
                    Screen Settings
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full justify-start ${
                        activePanel === "global"
                            ? "bg-nvidia/20 border-l-2 border-nvidia"
                            : ""
                    }`}
                    onClick={() => {
                        onSelectGame(null);
                        onSelectProfile(null);
                    }}
                >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Global Profile
                </Button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search (min 3 chars)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background border border-input pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nvidia"
                    />
                </div>
            </div>

            {/* Games & Profiles Header */}
            <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Games & Profiles ({filteredGames.length + customProfiles.length})
                </span>
                <div className="flex gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => setShowNewProfileDialog(true)}
                        title="Create new profile"
                    >
                        <Plus className="w-3 h-3" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={loadGames}
                        disabled={loading}
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
            </div>

            {/* New Profile Dialog */}
            {showNewProfileDialog && (
                <div className="p-2 border-b border-border bg-muted/30">
                    <input
                        type="text"
                        placeholder="Profile name..."
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleCreateProfile()}
                        autoFocus
                        className="w-full bg-background border border-input px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nvidia mb-2"
                    />
                    <div className="flex gap-2">
                        <Button size="sm" onClick={handleCreateProfile} disabled={!newProfileName.trim()}>
                            Create
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                            setShowNewProfileDialog(false);
                            setNewProfileName("");
                        }}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}

            {/* Games & Profiles List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {/* Custom Profiles first */}
                    {customProfiles.map((profile) => (
                        <div
                            key={`profile-${profile.name}`}
                            className={`w-full flex items-center gap-3 p-2 text-left transition-colors ${
                                selectedProfile?.name === profile.name && activePanel === "profile"
                                    ? "bg-nvidia/20 border-l-2 border-nvidia"
                                    : "hover:bg-secondary"
                            }`}
                        >
                            <button
                                className="flex-1 flex items-center gap-3 min-w-0"
                                onClick={() => onSelectProfile(profile)}
                            >
                                <div className="w-10 h-14 bg-gradient-to-br from-nvidia/30 to-nvidia/10 flex-shrink-0 flex items-center justify-center" style={{ borderRadius: '5px' }}>
                                    <Layers className="w-5 h-5 text-nvidia" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    {renameProfile === profile.name ? (
                                        <input
                                            type="text"
                                            value={renameValue}
                                            onChange={(e) => setRenameValue(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleRename(profile.name)}
                                            onBlur={() => handleRename(profile.name)}
                                            autoFocus
                                            className="w-full bg-background border border-input px-2 py-0.5 text-sm"
                                            onClick={(e) => e.stopPropagation()}
                                        />
                                    ) : (
                                        <>
                                            <span className="text-sm font-medium truncate block">{profile.name}</span>
                                            <span className="text-xs text-muted-foreground">Custom Profile</span>
                                        </>
                                    )}
                                </div>
                            </button>
                            
                            {/* 3-dot menu */}
                            <div className="relative">
                                <button
                                    className="p-1 hover:bg-muted rounded"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setMenuOpenFor(menuOpenFor === profile.name ? null : profile.name);
                                    }}
                                >
                                    <MoreVertical className="w-4 h-4 text-muted-foreground" />
                                </button>
                                
                                {menuOpenFor === profile.name && (
                                    <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded shadow-lg z-50 min-w-32">
                                        <button
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setRenameValue(profile.name);
                                                setRenameProfile(profile.name);
                                                setMenuOpenFor(null);
                                            }}
                                        >
                                            <Pencil className="w-3 h-3" />
                                            Rename
                                        </button>
                                        <button
                                            className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left text-destructive"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteProfile(profile.name);
                                            }}
                                        >
                                            <Trash2 className="w-3 h-3" />
                                            Remove
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {/* Separator if both profiles and games exist */}
                    {customProfiles.length > 0 && filteredGames.length > 0 && (
                        <div className="border-t border-border/50 my-2" />
                    )}

                    {/* Games */}
                    {loading ? (
                        <div className="text-sm text-muted-foreground p-3 text-center">
                            Scanning for games...
                        </div>
                    ) : filteredGames.length === 0 && customProfiles.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 text-center">
                            {searchQuery.length > 0 && searchQuery.length < 3
                                ? "Type at least 3 characters to search"
                                : debouncedQuery.length >= 3
                                    ? `No games matching "${debouncedQuery}"`
                                    : "No games found"}
                        </div>
                    ) : (
                        filteredGames.map((game) => (
                            <button
                                key={`${game.source}-${game.id}`}
                                onClick={() => onSelectGame(game)}
                                className={`w-full flex items-center gap-3 p-2 text-left transition-colors ${selectedGame?.id === game.id && selectedGame?.source === game.source
                                    ? "bg-nvidia/20 border-l-2 border-nvidia"
                                    : "hover:bg-secondary"
                                    }`}
                            >
                                {/* Game Poster */}
                                {game.icon_url ? (
                                    <img
                                        src={game.icon_url}
                                        alt={game.name}
                                        className="w-10 h-14 object-cover bg-secondary flex-shrink-0"
                                        style={{ borderRadius: '5px' }}
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                        }}
                                    />
                                ) : null}
                                <div
                                    className={`w-10 h-14 bg-secondary flex-shrink-0 ${game.icon_url ? "hidden" : ""}`}
                                    style={{ borderRadius: '5px' }}
                                />

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        {hasProfile(game) && (
                                            <span className="w-2 h-2 bg-nvidia flex-shrink-0" style={{ borderRadius: '50%' }} title="Has custom profile" />
                                        )}
                                        <span className="text-sm font-medium truncate block">{game.name}</span>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {game.source}
                                    </div>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </ScrollArea>
            
            {/* Click outside to close menu */}
            {menuOpenFor && (
                <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setMenuOpenFor(null)}
                />
            )}
        </div>
    );
}
