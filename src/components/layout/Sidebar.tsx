import { useEffect, useState, useMemo, useCallback } from "react";
import { Game, GameProfile, detectGames, listProfiles } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GpuMonitor } from "./GpuMonitor";
import { Search, RefreshCw, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
    selectedGame: Game | null;
    onSelectGame: (game: Game | null) => void;
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

export function Sidebar({ selectedGame, onSelectGame, profilesVersion }: SidebarProps) {
    const [games, setGames] = useState<Game[]>([]);
    const [profiles, setProfiles] = useState<GameProfile[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");

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
            const [detected, savedProfiles] = await Promise.all([
                detectGames(),
                listProfiles(),
            ]);
            // Filter out ignored games
            const filtered = detected.filter(g => !shouldFilterGame(g.name));
            setGames(filtered);
            setProfiles(savedProfiles);
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
        return profiles.some(p =>
            p.name.toLowerCase() === game.name.toLowerCase() ||
            p.steam_appid?.toString() === game.id
        );
    }, [profiles]);

    // Handle Enter key for immediate search
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            setDebouncedQuery(searchQuery);
        }
    };

    return (
        <div className="w-80 bg-card border-r border-border flex flex-col h-full">
            {/* GPU Monitor */}
            <GpuMonitor />

            {/* Navigation */}
            <div className="p-2 border-b border-border">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => onSelectGame(null)}
                >
                    <Settings2 className="w-4 h-4 mr-2" />
                    Global Settings
                </Button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search games (min 3 chars)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full bg-background border border-input pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nvidia"
                    />
                </div>
            </div>

            {/* Games List Header */}
            <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                    Games ({filteredGames.length})
                </span>
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

            {/* Games List */}
            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {loading ? (
                        <div className="text-sm text-muted-foreground p-3 text-center">
                            Scanning for games...
                        </div>
                    ) : filteredGames.length === 0 ? (
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
        </div>
    );
}
