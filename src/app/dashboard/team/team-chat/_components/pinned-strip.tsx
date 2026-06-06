'use client';

/**
 * Strip of pinned messages anchored at the top of the channel pane.
 */
import * as React from 'react';
import { Pin, X } from 'lucide-react';

import { Button, IconButton } from '@/components/sabcrm/20ui';

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
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)]/60 px-3 py-2">
            <Pin className="h-3.5 w-3.5 text-[var(--st-text-secondary)]" aria-hidden="true" />
            <div className="flex flex-1 gap-2 overflow-x-auto">
                {pins.map((pin) => {
                    const id = String((pin as any)._id);
                    const preview =
                        (pin.content || '').slice(0, 60) ||
                        (pin.attachments?.[0]?.name ?? 'Attachment');
                    return (
                        <div
                            key={id}
                            className="flex shrink-0 items-center gap-1 rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] pl-3 pr-1 py-0.5 text-[11.5px] text-[var(--st-text)]"
                        >
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => onJump(id)}
                                aria-label={`Jump to pinned message: ${preview}`}
                                className="max-w-[200px] truncate"
                            >
                                {preview}
                            </Button>
                            {canEdit && onUnpin ? (
                                <IconButton
                                    label="Unpin message"
                                    icon={X}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => onUnpin(id)}
                                />
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
