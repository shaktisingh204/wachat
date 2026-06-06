'use client';

/**
 * Bookmarks side-panel. List of "save for later" messages, scoped to
 * the calling user. Opens from the sidebar.
 */
import * as React from 'react';
import { Bookmark, X } from 'lucide-react';
import { format } from 'date-fns';

import {
    Button,
    EmptyState,
    IconButton,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    listMyBookmarks,
    unbookmarkTeamMessage,
} from '@/app/actions/team-chat.actions';
import type { BookmarkView } from '@/app/actions/team-chat.actions.types';

export interface BookmarksViewProps {
    open: boolean;
    onClose: () => void;
    onJump: (channelId: string, messageId: string) => void;
}

export function BookmarksView({ open, onClose, onJump }: BookmarksViewProps) {
    const { toast } = useToast();
    const [items, setItems] = React.useState<BookmarkView[]>([]);
    const [loading, setLoading] = React.useState(false);

    const reload = React.useCallback(async () => {
        setLoading(true);
        try {
            const list = await listMyBookmarks();
            setItems(list);
        } finally {
            setLoading(false);
        }
    }, []);

    React.useEffect(() => {
        if (open) void reload();
    }, [open, reload]);

    const onRemove = async (messageId: string) => {
        const res = await unbookmarkTeamMessage(messageId);
        if (!res.success) {
            toast({
                title: 'Could not remove bookmark',
                description: res.error,
                tone: 'danger',
            });
            return;
        }
        await reload();
    };

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <SheetContent
                side="left"
                closeLabel="Close saved messages"
                className="flex w-[360px] flex-col p-0"
            >
                <SheetHeader className="border-b border-[var(--st-border)] px-4 py-3">
                    <SheetTitle className="flex items-center gap-2 text-[13px]">
                        <Bookmark className="h-3.5 w-3.5" aria-hidden="true" /> Saved messages
                    </SheetTitle>
                </SheetHeader>

                <div className="flex-1 overflow-auto bg-[var(--st-bg-muted)]/40 px-3 py-3">
                    {loading ? (
                        <div className="text-[12px] text-[var(--st-text-secondary)]">
                            Loading saved messages...
                        </div>
                    ) : items.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={Bookmark}
                            title="No saved messages yet"
                            description="Hover a message and click the bookmark icon to save it."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {items.map((b) => {
                                const preview = b.message?.content
                                    ? b.message.content.slice(0, 140)
                                    : '(attachment)';
                                return (
                                    <li
                                        key={b._id}
                                        className="flex items-start gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2"
                                    >
                                        <Button
                                            variant="ghost"
                                            onClick={() => onJump(b.channelId, b.messageId)}
                                            className="flex h-auto flex-1 flex-col items-start justify-start gap-1 px-0 py-0 text-left"
                                        >
                                            <span className="text-[12.5px] text-[var(--st-text)]">{preview}</span>
                                            <span className="text-[10.5px] text-[var(--st-text-secondary)]">
                                                Saved {format(new Date(b.savedAt), 'PP')}
                                            </span>
                                        </Button>
                                        <IconButton
                                            label="Remove bookmark"
                                            icon={X}
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onRemove(b.messageId)}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </SheetContent>
        </Sheet>
    );
}
