'use client';

/**
 * Hover-revealed reaction toolbar + emoji picker for a single message.
 */
import * as React from 'react';
import { SmilePlus } from 'lucide-react';

import {
    Button,
    Popover,
    ZoruPopoverContent,
    ZoruPopoverTrigger,
} from '@/components/sabcrm/20ui/compat';

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
                    <button
                        key={r.emoji}
                        type="button"
                        onClick={() => onToggle(r.emoji)}
                        className={
                            'inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors ' +
                            (mine
                                ? 'border-zoru-ink/40 bg-zoru-surface-2 text-zoru-ink'
                                : 'border-zoru-line bg-zoru-bg text-zoru-ink-muted hover:border-zoru-ink/30')
                        }
                        aria-pressed={mine}
                    >
                        <span>{r.emoji}</span>
                        <span className="tabular-nums">{r.count}</span>
                    </button>
                );
            })}
            <Popover>
                <ZoruPopoverTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Add reaction"
                        className="h-6 w-6"
                    >
                        <SmilePlus className="h-3 w-3" />
                    </Button>
                </ZoruPopoverTrigger>
                <ZoruPopoverContent
                    align="start"
                    className="w-[224px] p-2"
                >
                    {!compact ? (
                        <div className="mb-2 flex flex-wrap gap-1">
                            {QUICK_EMOJIS.map((e) => (
                                <button
                                    key={e}
                                    type="button"
                                    onClick={() => onToggle(e)}
                                    className="h-7 w-7 rounded-md border border-zoru-line text-[14px] hover:bg-zoru-surface-2"
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    ) : null}
                    <div className="grid grid-cols-6 gap-1">
                        {PICKER_EMOJIS.map((e) => (
                            <button
                                key={e}
                                type="button"
                                onClick={() => onToggle(e)}
                                className="h-7 w-7 rounded-md text-[14px] hover:bg-zoru-surface-2"
                            >
                                {e}
                            </button>
                        ))}
                    </div>
                </ZoruPopoverContent>
            </Popover>
        </div>
    );
}
