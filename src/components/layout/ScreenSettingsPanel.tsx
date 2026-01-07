import { useState, useEffect, useRef } from "react";
import { 
    listMonitors, 
    detectCompositor, 
    isScreenConfigSupported,
    Monitor 
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RefreshCw, Save, Monitor as MonitorIcon, AlertTriangle } from "lucide-react";

interface MonitorSettings {
    name: string;
    enabled: boolean;
    width: number;
    height: number;
    x: number;
    y: number;
    refresh_rate: number;
    actual_refresh_rate: number; // Original from monitor
    scale: number;
    vrr_mode: number; // 0=off, 1=always, 2=fullscreen only
}

const VRR_MODES = [
    { value: 0, label: "Off" },
    { value: 1, label: "Always On" },
    { value: 2, label: "Fullscreen Only" },
];

const COMMON_RESOLUTIONS = [
    { width: 3840, height: 2160, label: "4K (3840×2160)" },
    { width: 2560, height: 1440, label: "1440p (2560×1440)" },
    { width: 1920, height: 1080, label: "1080p (1920×1080)" },
    { width: 1680, height: 1050, label: "WSXGA+ (1680×1050)" },
    { width: 1280, height: 720, label: "720p (1280×720)" },
];

const COMMON_REFRESH_RATES = [240, 165, 144, 120, 75, 60, 50, 30];

// Helper to get unique refresh rates including actual
function getRefreshRateOptions(actualRate: number): number[] {
    const rates = new Set(COMMON_REFRESH_RATES);
    // Add actual rate rounded to nearest integer
    const roundedActual = Math.round(actualRate);
    rates.add(roundedActual);
    return Array.from(rates).sort((a, b) => b - a);
}

export function ScreenSettingsPanel() {
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [monitorSettings, setMonitorSettings] = useState<MonitorSettings[]>([]);
    const [compositor, setCompositor] = useState<string>("Unknown");
    const [supported, setSupported] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedMonitor, setSelectedMonitor] = useState<string | null>(null);
    const [hasChanges, setHasChanges] = useState(false);
    const canvasRef = useRef<HTMLDivElement>(null);
    const [dragging, setDragging] = useState<string | null>(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const loadMonitors = async () => {
        setLoading(true);
        try {
            const [comp, supp, mons] = await Promise.all([
                detectCompositor(),
                isScreenConfigSupported(),
                listMonitors(),
            ]);
            setCompositor(comp);
            setSupported(supp);
            setMonitors(mons);
            setMonitorSettings(mons.map(m => ({
                name: m.name,
                enabled: m.active,
                width: m.width,
                height: m.height,
                x: m.x,
                y: m.y,
                refresh_rate: Math.round(m.refresh_rate),
                actual_refresh_rate: m.refresh_rate,
                scale: m.scale,
                vrr_mode: 0, // Default off, would need to read from config
            })));
            if (mons.length > 0 && !selectedMonitor) {
                setSelectedMonitor(mons[0].name);
            }
        } catch (e) {
            console.error("Failed to load monitors:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadMonitors();
    }, []);

    const updateSetting = (name: string, field: keyof MonitorSettings, value: unknown) => {
        setMonitorSettings(prev => prev.map(m => 
            m.name === name ? { ...m, [field]: value } : m
        ));
        setHasChanges(true);
    };

    const handleApply = async () => {
        // TODO: Apply settings via hyprctl/swaymsg
        console.log("Applying settings:", monitorSettings);
        setHasChanges(false);
    };

    const handleSaveConfig = () => {
        // TODO: Save to ~/.config/hypr/monitors.conf or ~/.config/sway/outputs
        console.log("Saving config for", compositor);
    };

    // Calculate scale for visual representation
    const getVisualScale = () => {
        if (!canvasRef.current || monitors.length === 0) return 0.1;
        const containerWidth = canvasRef.current.clientWidth - 40;
        const containerHeight = 300;
        const maxX = Math.max(...monitorSettings.map(m => m.x + m.width));
        const maxY = Math.max(...monitorSettings.map(m => m.y + m.height));
        return Math.min(containerWidth / maxX, containerHeight / maxY, 0.2);
    };

    const visualScale = getVisualScale();

    const handleMouseDown = (e: React.MouseEvent, name: string) => {
        const monitor = monitorSettings.find(m => m.name === name);
        if (!monitor) return;
        
        const rect = (e.target as HTMLElement).getBoundingClientRect();
        setDragging(name);
        setDragOffset({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        });
        setSelectedMonitor(name);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragging || !canvasRef.current) return;
        
        const rect = canvasRef.current.getBoundingClientRect();
        const newX = Math.max(0, Math.round((e.clientX - rect.left - dragOffset.x) / visualScale));
        const newY = Math.max(0, Math.round((e.clientY - rect.top - dragOffset.y) / visualScale));
        
        // Snap to grid (100px)
        const snappedX = Math.round(newX / 100) * 100;
        const snappedY = Math.round(newY / 100) * 100;
        
        updateSetting(dragging, 'x', snappedX);
        updateSetting(dragging, 'y', snappedY);
    };

    const handleMouseUp = () => {
        setDragging(null);
    };

    const selectedSettings = monitorSettings.find(m => m.name === selectedMonitor);

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center text-muted-foreground">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                    <p>Detecting monitors...</p>
                </div>
            </div>
        );
    }

    if (!supported) {
        return (
            <div className="flex-1 flex items-center justify-center bg-background">
                <div className="text-center text-muted-foreground max-w-md p-6">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
                    <h2 className="text-xl font-semibold mb-2">Unsupported Compositor</h2>
                    <p className="text-sm mb-4">
                        Screen configuration is only supported on Hyprland and Sway.
                        Detected compositor: <strong>{compositor}</strong>
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Use your desktop environment's display settings instead.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold flex items-center gap-2">
                        <MonitorIcon className="w-5 h-5" />
                        Screen Settings
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {compositor} • {monitors.length} monitor{monitors.length !== 1 ? 's' : ''} detected
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={loadMonitors}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Refresh
                    </Button>
                    <Button size="sm" onClick={handleApply} disabled={!hasChanges}>
                        <Save className="w-4 h-4 mr-2" />
                        Apply
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-4 space-y-6">
                    {/* Visual Monitor Layout */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium mb-3">Monitor Arrangement</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Drag monitors to arrange their positions. Click to select.
                        </p>
                        <div
                            ref={canvasRef}
                            className="relative bg-muted/30 rounded-lg border border-dashed border-border/50 overflow-hidden"
                            style={{ height: 320 }}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            {monitorSettings.map((monitor) => (
                                <div
                                    key={monitor.name}
                                    className={`absolute cursor-move transition-shadow ${
                                        selectedMonitor === monitor.name
                                            ? "ring-2 ring-nvidia shadow-lg z-10"
                                            : "hover:ring-1 hover:ring-border"
                                    } ${!monitor.enabled ? "opacity-50" : ""}`}
                                    style={{
                                        left: monitor.x * visualScale + 20,
                                        top: monitor.y * visualScale + 20,
                                        width: monitor.width * visualScale,
                                        height: monitor.height * visualScale,
                                        minWidth: 80,
                                        minHeight: 50,
                                    }}
                                    onMouseDown={(e) => handleMouseDown(e, monitor.name)}
                                    onClick={() => setSelectedMonitor(monitor.name)}
                                >
                                    <div className="w-full h-full bg-card border border-border rounded flex flex-col items-center justify-center p-2">
                                        <span className="text-xs font-medium truncate max-w-full">
                                            {monitor.name}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {monitor.width}×{monitor.height}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {monitor.refresh_rate}Hz
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Selected Monitor Settings */}
                    {selectedSettings && (
                        <div className="bg-card border border-border rounded-lg p-4">
                            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                                <MonitorIcon className="w-4 h-4" />
                                {selectedMonitor}
                            </h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                {/* Enable/Disable */}
                                <div className="col-span-2 flex items-center justify-between p-3 bg-muted/30 rounded">
                                    <span className="text-sm">Enable Monitor</span>
                                    <Switch
                                        checked={selectedSettings.enabled}
                                        onCheckedChange={(v) => updateSetting(selectedMonitor!, 'enabled', v)}
                                    />
                                </div>

                                {/* Resolution */}
                                <div>
                                    <label className="text-xs text-muted-foreground">Resolution</label>
                                    <Select
                                        value={`${selectedSettings.width}x${selectedSettings.height}`}
                                        onValueChange={(v) => {
                                            const [w, h] = v.split('x').map(Number);
                                            updateSetting(selectedMonitor!, 'width', w);
                                            updateSetting(selectedMonitor!, 'height', h);
                                        }}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {COMMON_RESOLUTIONS.map(r => (
                                                <SelectItem key={r.label} value={`${r.width}x${r.height}`}>
                                                    {r.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Refresh Rate */}
                                <div>
                                    <label className="text-xs text-muted-foreground">
                                        Refresh Rate
                                        <span className="ml-1 text-[10px] text-muted-foreground/70">
                                            (actual: {selectedSettings.actual_refresh_rate.toFixed(2)}Hz)
                                        </span>
                                    </label>
                                    <Select
                                        value={selectedSettings.refresh_rate.toString()}
                                        onValueChange={(v) => updateSetting(selectedMonitor!, 'refresh_rate', parseInt(v))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {getRefreshRateOptions(selectedSettings.actual_refresh_rate).map(r => (
                                                <SelectItem key={r} value={r.toString()}>
                                                    {r} Hz
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Scale */}
                                <div>
                                    <label className="text-xs text-muted-foreground">Scale</label>
                                    <Select
                                        value={selectedSettings.scale.toString()}
                                        onValueChange={(v) => updateSetting(selectedMonitor!, 'scale', parseFloat(v))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1">100%</SelectItem>
                                            <SelectItem value="1.25">125%</SelectItem>
                                            <SelectItem value="1.5">150%</SelectItem>
                                            <SelectItem value="1.75">175%</SelectItem>
                                            <SelectItem value="2">200%</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* VRR */}
                                <div>
                                    <label className="text-xs text-muted-foreground">Variable Refresh Rate</label>
                                    <Select
                                        value={selectedSettings.vrr_mode.toString()}
                                        onValueChange={(v) => updateSetting(selectedMonitor!, 'vrr_mode', parseInt(v))}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {VRR_MODES.map(mode => (
                                                <SelectItem key={mode.value} value={mode.value.toString()}>
                                                    {mode.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Position */}
                                <div className="col-span-2 grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-xs text-muted-foreground">Position X</label>
                                        <input
                                            type="number"
                                            value={selectedSettings.x}
                                            onChange={(e) => updateSetting(selectedMonitor!, 'x', parseInt(e.target.value) || 0)}
                                            className="w-full mt-1 bg-background border border-input px-3 py-2 text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground">Position Y</label>
                                        <input
                                            type="number"
                                            value={selectedSettings.y}
                                            onChange={(e) => updateSetting(selectedMonitor!, 'y', parseInt(e.target.value) || 0)}
                                            className="w-full mt-1 bg-background border border-input px-3 py-2 text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Save Config */}
                    <div className="bg-card border border-border rounded-lg p-4">
                        <h3 className="text-sm font-medium mb-2">Save Configuration</h3>
                        <p className="text-xs text-muted-foreground mb-4">
                            Export settings to {compositor === "Hyprland" 
                                ? "~/.config/hypr/monitors.conf" 
                                : "~/.config/sway/outputs"}
                        </p>
                        <Button variant="outline" size="sm" onClick={handleSaveConfig}>
                            <Save className="w-4 h-4 mr-2" />
                            Save to Config File
                        </Button>
                    </div>
                </div>
            </ScrollArea>
        </div>
    );
}
