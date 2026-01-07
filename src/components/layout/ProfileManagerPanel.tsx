import { useState, useEffect } from "react";
import { GameProfile, listTemplateProfiles, saveProfile, deleteProfile, duplicateProfile } from "@/lib/api";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Trash2, Copy, Save, Edit2 } from "lucide-react";

interface ProfileManagerPanelProps {
    onSelectTemplate?: (profile: GameProfile) => void;
}

export function ProfileManagerPanel({ onSelectTemplate }: ProfileManagerPanelProps) {
    const [templates, setTemplates] = useState<GameProfile[]>([]);
    const [editingProfile, setEditingProfile] = useState<GameProfile | null>(null);
    const [newProfileName, setNewProfileName] = useState("");
    const [newProfileDesc, setNewProfileDesc] = useState("");
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            const list = await listTemplateProfiles();
            setTemplates(list);
        } catch (e) {
            console.error("Failed to load templates:", e);
        }
    };

    const handleCreateNew = async () => {
        if (!newProfileName.trim()) return;

        const newProfile: GameProfile = {
            name: newProfileName.trim(),
            description: newProfileDesc.trim() || null,
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
        };

        try {
            await saveProfile(newProfile);
            setNewProfileName("");
            setNewProfileDesc("");
            setIsCreating(false);
            await loadTemplates();
        } catch (e) {
            console.error("Failed to create template:", e);
        }
    };

    const handleDelete = async (name: string) => {
        try {
            await deleteProfile(name);
            await loadTemplates();
        } catch (e) {
            console.error("Failed to delete template:", e);
        }
    };

    const handleDuplicate = async (sourceName: string) => {
        const newName = `${sourceName} (Copy)`;
        try {
            await duplicateProfile(sourceName, newName);
            await loadTemplates();
        } catch (e) {
            console.error("Failed to duplicate template:", e);
        }
    };

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-semibold">Profile Templates</h1>
                    <p className="text-sm text-muted-foreground">
                        Create reusable profiles to apply to any game
                    </p>
                </div>
                <Button size="sm" onClick={() => setIsCreating(!isCreating)}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                </Button>
            </div>

            {/* Create New Template Form */}
            {isCreating && (
                <div className="p-4 border-b border-border bg-card">
                    <div className="space-y-3">
                        <div>
                            <label className="text-sm font-medium">Template Name</label>
                            <input
                                type="text"
                                value={newProfileName}
                                onChange={(e) => setNewProfileName(e.target.value)}
                                placeholder="e.g., DLSS 4.5 Ultra"
                                className="w-full mt-1 bg-background border border-input px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium">Description</label>
                            <input
                                type="text"
                                value={newProfileDesc}
                                onChange={(e) => setNewProfileDesc(e.target.value)}
                                placeholder="e.g., Best settings for RTX 4090"
                                className="w-full mt-1 bg-background border border-input px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleCreateNew}>
                                <Save className="w-4 h-4 mr-2" />
                                Create
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setIsCreating(false)}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template List */}
            <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                    {templates.length === 0 ? (
                        <div className="text-center text-muted-foreground py-8">
                            <p>No templates yet</p>
                            <p className="text-sm">Click "New Template" to create one</p>
                        </div>
                    ) : (
                        templates.map((template) => (
                            <div
                                key={template.name}
                                className="p-3 bg-card border border-border hover:border-nvidia/30 transition-colors cursor-pointer"
                                onClick={() => onSelectTemplate?.(template)}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{template.name}</div>
                                        {template.description && (
                                            <div className="text-sm text-muted-foreground">
                                                {template.description}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDuplicate(template.name);
                                            }}
                                        >
                                            <Copy className="w-4 h-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(template.name);
                                            }}
                                        >
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>

            {/* Usage Instructions */}
            <div className="p-4 border-t border-border bg-muted/30">
                <p className="text-xs text-muted-foreground">
                    💡 Use templates with: <code className="bg-muted px-1">unvcpfl --profile "Template Name" %command%</code>
                </p>
            </div>
        </div>
    );
}
