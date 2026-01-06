import { useEffect, useState } from "react";
import { Game, detectGames } from "@/lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GpuMonitor } from "./GpuMonitor";
import { Gamepad2, Search, Settings, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
    selectedGame: Game | null;
    onSelectGame: (game: Game | null) => void;
    onOpenSettings: () => void;
}

export function Sidebar({ selectedGame, onSelectGame, onOpenSettings }: SidebarProps) {
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    const loadGames = async () => {
        setLoading(true);
        try {
            const detected = await detectGames();
            setGames(detected);
        } catch (e) {
            console.error("Failed to detect games:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGames();
    }, []);

    const filteredGames = games.filter((game) =>
        game.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getSourceIcon = (source: string) => {
        switch (source) {
            case "Steam":
                return "🎮";
            case "Lutris":
                return "🍷";
            case "Heroic":
                return "⚔️";
            default:
                return "🎲";
        }
    };

    return (
        <div className="w-72 bg-card border-r border-border flex flex-col h-full">
            {/* GPU Monitor */}
            <GpuMonitor />

            {/* Navigation */}
            <div className="p-2 border-b border-border flex gap-1">
                <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 justify-start"
                    onClick={() => onSelectGame(null)}
                >
                    <Gamepad2 className="w-4 h-4 mr-2" />
                    All Settings
                </Button>
                <Button variant="ghost" size="icon" onClick={onOpenSettings}>
                    <Settings className="w-4 h-4" />
                </Button>
            </div>

            {/* Search */}
            <div className="p-2 border-b border-border">
                <div className="relative">
                    <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search games..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-background border border-input pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-nvidia"
                    />
                </div>
            </div>

            {/* Games List */}
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

            <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                    {loading ? (
                        <div className="text-sm text-muted-foreground p-3 text-center">
                            Scanning for games...
                        </div>
                    ) : filteredGames.length === 0 ? (
                        <div className="text-sm text-muted-foreground p-3 text-center">
                            No games found
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
                                {/* Game Icon */}
                                {game.icon_url ? (
                                    <img
                                        src={game.icon_url}
                                        alt={game.name}
                                        className="w-10 h-14 object-cover bg-secondary"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).style.display = "none";
                                        }}
                                    />
                                ) : (
                                    <div className="w-10 h-14 bg-secondary flex items-center justify-center text-lg">
                                        {getSourceIcon(game.source)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium truncate">{game.name}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <span>{getSourceIcon(game.source)}</span>
                                        <span>{game.source}</span>
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
