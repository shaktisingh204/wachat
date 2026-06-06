'use client';

/**
 * Strip of pinned messages anchored at the top of the channel pane.
 */
import * as React from 'react';
import { Pin, X } from 'lucide-react';

import { Button } from '@/components/sabcrm/20ui';

import type { PinnedMessageView } from '@/app/actions/team-chat.actions.types';

export interface PinnedStripProps {
    pins: PinnedMessageView[];
    onJump: (messageId: string) => void;
    onUnpin?: (messageId: string) => void;
    canEdit?: boolean;
}

export function PinnedStrip({
    pins,
    onJump,
    onUnpin,
    canEdit,
}: PinnedStripProps) {
    if (!pins.length) return null;
    return (
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-muted)]/60 px-3 py-2">
            <Pin className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" />
            <div className="flex flex-1 gap-2 overflow-x-auto">
                {pins.map((pin) => {
                    const id = String((pin as any)._id);
                    const preview =
                        (pin.content || '').slice(0, 60) ||
                        (pin.attachments?.[0]?.name ?? 'Attachment');
                    return (
                        <div
                            key={id}
                            className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-1 text-[11.5px] text-[var(--st-text)]"
                        >
                            <button
                                type="button"
                                onClick={() => onJump(id)}
                                className="max-w-[200px] truncate text-left hover:underline"
                            >
                                {preview}
                            </button>
                            {canEdit && onUnpin ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="h-5 w-5"
                                    aria-label="Unpin"
                                    onClick={() => onUnpin(id)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
