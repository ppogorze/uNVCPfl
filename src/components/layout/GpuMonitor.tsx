import { useEffect, useState } from "react";
import { GpuInfo, getGpuInfo, getHostname, formatBytes, formatPower, formatTemperature, formatClock } from "@/lib/api";
import { Cpu, Thermometer, Zap, HardDrive } from "lucide-react";

export function GpuMonitor() {
    const [gpuInfo, setGpuInfo] = useState<GpuInfo | null>(null);
    const [hostname, setHostname] = useState<string>("");

    useEffect(() => {
        // Initial fetch
        getGpuInfo().then(setGpuInfo);
        getHostname().then(setHostname);

        // Poll every 10 seconds
        const interval = setInterval(() => {
            getGpuInfo().then(setGpuInfo);
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    if (!gpuInfo) {
        return (
            <div className="p-4 bg-card border-b border-border">
                <div className="text-muted-foreground text-sm">Loading GPU info...</div>
            </div>
        );
    }

    const memoryPercent = (gpuInfo.memory_used / gpuInfo.memory_total) * 100;

    return (
        <div className="p-4 bg-card border-b border-border">
            {/* GPU Name */}
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-nvidia flex items-center justify-center">
                    <Cpu className="w-5 h-5 text-black" />
                </div>
                <div>
                    <div className="text-sm font-medium text-foreground">{gpuInfo.name}</div>
                    <div className="text-xs text-muted-foreground">@{hostname || "localhost"}</div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 text-xs">
                {/* Temperature */}
                <div className="flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-nvidia" />
                    <span className="text-foreground">{formatTemperature(gpuInfo.temperature)}</span>
                </div>

                {/* Power */}
                <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-nvidia" />
                    <span className="text-foreground">{formatPower(gpuInfo.power_draw)}</span>
                </div>

                {/* Utilization */}
                <div className="flex items-center gap-1.5">
                    <span className="text-nvidia font-medium">{gpuInfo.utilization}%</span>
                    <span className="text-muted-foreground">GPU</span>
                </div>
            </div>

            {/* Memory Bar */}
            <div className="mt-3">
                <div className="flex items-center justify-between text-xs mb-1">
                    <div className="flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">VRAM</span>
                    </div>
                    <span className="text-foreground">
                        {formatBytes(gpuInfo.memory_used)} / {formatBytes(gpuInfo.memory_total)}
                    </span>
                </div>
                <div className="h-1.5 bg-secondary">
                    <div
                        className="h-full gpu-stat-bar transition-all duration-500"
                        style={{ width: `${memoryPercent}%` }}
                    />
                </div>
            </div>

            {/* Clocks */}
            <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>Core: {formatClock(gpuInfo.clock_graphics)}</span>
                <span>Mem: {formatClock(gpuInfo.clock_memory)}</span>
            </div>
        </div>
    );
}
