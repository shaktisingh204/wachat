'use client';

/**
 * Bookmarks side-panel — list of "save for later" messages, scoped to
 * the calling user. Opens from the sidebar.
 */
import * as React from 'react';
import { Bookmark, X } from 'lucide-react';
import { format } from 'date-fns';

import {
    Button,
    Sheet,
    ZoruSheetContent,
    ZoruSheetHeader,
    ZoruSheetTitle,
    useZoruToast,
} from '@/components/sabcrm/20ui/compat';

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
    const { toast } = useZoruToast();
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
                variant: 'destructive',
            });
            return;
        }
        await reload();
    };

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <ZoruSheetContent side="left" className="flex w-[360px] flex-col p-0">
                <ZoruSheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-zoru-line px-4 py-3">
                    <ZoruSheetTitle className="flex items-center gap-2 text-[13px]">
                        <Bookmark className="h-3.5 w-3.5" /> Saved messages
                    </ZoruSheetTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-zoru-ink-muted hover:bg-zoru-surface-2"
                        aria-label="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </ZoruSheetHeader>

                <div className="flex-1 overflow-auto bg-zoru-surface-2/40 px-3 py-3">
                    {loading ? (
                        <div className="text-[12px] text-zoru-ink-muted">Loading…</div>
                    ) : items.length === 0 ? (
                        <div className="text-[12px] text-zoru-ink-muted">
                            No saved messages yet. Hover a message and click the bookmark icon to save it.
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {items.map((b) => {
                                const preview = b.message?.content
                                    ? b.message.content.slice(0, 140)
                                    : '(attachment)';
                                return (
                                    <li
                                        key={b._id}
                                        className="flex items-start gap-2 rounded-md border border-zoru-line bg-zoru-bg px-3 py-2"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => onJump(b.channelId, b.messageId)}
                                            className="flex-1 text-left"
                                        >
                                            <div className="text-[12.5px] text-zoru-ink">{preview}</div>
                                            <div className="mt-1 text-[10.5px] text-zoru-ink-muted">
                                                Saved {format(new Date(b.savedAt), 'PP')}
                                            </div>
                                        </button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            className="h-6 w-6"
                                            aria-label="Remove bookmark"
                                            onClick={() => onRemove(b.messageId)}
                                        >
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            </ZoruSheetContent>
        </Sheet>
    );
}
