import React from 'react';
import { Button, Input, Select, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '@/components/zoruui';
import { Trash2 } from 'lucide-react';
import { TelegramProjectGate } from './telegram-project-gate';
import type { StoryArea } from '@/lib/rust-client/telegram-stories';

export interface AreaDraft extends StoryArea {
    /** Local-only id so React can key the list. */
    _key: string;
}

function NumField({
    label,
    value,
    onChange,
}: {
    label: string;
    value?: number;
    onChange: (v: number) => void;
}) {
    return (
        <label className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-[0.1em] text-zoru-ink-muted">
                {label}
            </span>
            <Input
                type="number"
                value={value ?? 0}
                onChange={(e) => onChange(Number(e.target.value))}
            />
        </label>
    );
}

export function AreaEditor({
    area,
    onChange,
    onRemove,
}: {
    area: AreaDraft;
    onChange: (next: AreaDraft) => void;
    onRemove: () => void;
}) {
    const pos = (area.position ?? {}) as Record<string, number>;
    function patchPos(patch: Partial<Record<string, number>>) {
        onChange({
            ...area,
            position: { ...pos, ...patch },
        });
    }
    return (
        <div className="rounded-md border border-zoru-line p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
                <Select
                    value={area.type || 'suggested_reaction'}
                    onValueChange={(v) => onChange({ ...area, type: v })}
                >
                    <ZoruSelectTrigger className="w-[200px]">
                        <ZoruSelectValue />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        <ZoruSelectItem value="suggested_reaction">
                            Reaction
                        </ZoruSelectItem>
                        <ZoruSelectItem value="location">Location</ZoruSelectItem>
                        <ZoruSelectItem value="link">Link</ZoruSelectItem>
                        <ZoruSelectItem value="weather">Weather</ZoruSelectItem>
                        <ZoruSelectItem value="unique_gift">
                            Unique gift
                        </ZoruSelectItem>
                    </ZoruSelectContent>
                </Select>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={onRemove}
                    aria-label="Remove area"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                <NumField
                    label="x%"
                    value={pos.x_percentage}
                    onChange={(v) => patchPos({ x_percentage: v })}
                />
                <NumField
                    label="y%"
                    value={pos.y_percentage}
                    onChange={(v) => patchPos({ y_percentage: v })}
                />
                <NumField
                    label="w%"
                    value={pos.width_percentage}
                    onChange={(v) => patchPos({ width_percentage: v })}
                />
                <NumField
                    label="h%"
                    value={pos.height_percentage}
                    onChange={(v) => patchPos({ height_percentage: v })}
                />
                <NumField
                    label="rot°"
                    value={pos.rotation_angle}
                    onChange={(v) => patchPos({ rotation_angle: v })}
                />
            </div>
        </div>
    );
}
