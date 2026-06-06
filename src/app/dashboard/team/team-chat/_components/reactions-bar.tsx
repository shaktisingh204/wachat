'use client';

/**
 * Hover-revealed reaction toolbar + emoji picker for a single message.
 */
import * as React from 'react';
import { SmilePlus } from 'lucide-react';

import { Button, IconButton, Popover, PopoverContent, PopoverTrigger } from '@/components/sabcrm/20ui';

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '🙏', '😂', '🔥'];
const PICKER_EMOJIS = [
    '👍', '👎', '❤️', '🔥', '🎉', '🙏', '😂', '😅', '😢', '😡',
    '👀', '✅', '❌', '💡', '🚀', '⭐', '🤝', '🤔', '👏', '💯',
    '☕', '🍕', '🎯', '📌', '🐛', '🛠️', '📈', '📉', '🧠', '⚡',
];

export interface ReactionsBarProps {
    /** Existing reaction summary for this message (counts + which user). */
    reactions?: { emoji: string; count: number; userIds: string[] }[];
    meId?: string;
    onToggle: (emoji: string) => void;
    /** Inline-render the picker open trigger only. */
    compact?: boolean;
}

export function ReactionsBar({
    reactions,
    meId,
    onToggle,
    compact,
}: ReactionsBarProps) {
    return (
        <div className="flex flex-wrap items-center gap-1">
            {(reactions ?? []).map((r) => {
                const mine = !!meId && r.userIds.includes(meId);
                return (
                    <Button
                        key={r.emoji}
                        variant={mine ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => onToggle(r.emoji)}
                        aria-pressed={mine}
                        aria-label={`React with ${r.emoji}, ${r.count} so far`}
                        className="h-6 gap-1 rounded-[var(--st-radius-full)] px-2 text-[11px]"
                    >
                        <span aria-hidden="true">{r.emoji}</span>
                        <span className="tabular-nums">{r.count}</span>
                    </Button>
                );
            })}
            <Popover>
                <PopoverTrigger asChild>
                    <IconButton
                        label="Add reaction"
                        icon={SmilePlus}
                        variant="outline"
                        size="sm"
                        className="h-6 w-6"
                    />
                </PopoverTrigger>
                <PopoverContent align="start" className="w-[224px] p-2">
                    {!compact ? (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {QUICK_EMOJIS.map((e) => (
                                <Button
                                    key={e}
                                    variant="ghost"
                                    onClick={() => onToggle(e)}
                                    aria-label={`React with ${e}`}
                                    className="h-7 w-7 rounded-[var(--st-radius)] border border-[var(--st-border)] p-0 text-[14px]"
                                >
                                    <span aria-hidden="true">{e}</span>
                                </Button>
                            ))}
                        </div>
                    ) : null}
                    <div className="grid grid-cols-6 gap-1">
                        {PICKER_EMOJIS.map((e) => (
                            <Button
                                key={e}
                                variant="ghost"
                                onClick={() => onToggle(e)}
                                aria-label={`React with ${e}`}
                                className="h-7 w-7 rounded-[var(--st-radius)] p-0 text-[14px]"
                            >
                                <span aria-hidden="true">{e}</span>
                            </Button>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
