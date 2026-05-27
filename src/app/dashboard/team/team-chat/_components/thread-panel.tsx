'use client';

/**
 * Slide-in panel showing a single message + its thread replies.
 * Mounted as a ZoruUI Sheet on the right edge of the chat surface.
 */
import * as React from 'react';
import { format } from 'date-fns';
import { Loader, Send, X } from 'lucide-react';

import {
    Button,
    Input,
    Sheet,
    ZoruSheetContent,
    ZoruSheetHeader,
    ZoruSheetTitle,
    useZoruToast,
} from '@/components/zoruui';

import {
    getMessageThread,
    sendThreadReply,
} from '@/app/actions/team-chat.actions';
import type { TeamThreadView } from '@/app/actions/team-chat.actions.types';

export interface ThreadPanelProps {
    rootMessageId: string | null;
    channelId: string | null;
    meId?: string;
    onClose: () => void;
}

export function ThreadPanel({
    rootMessageId,
    channelId,
    meId,
    onClose,
}: ThreadPanelProps) {
    const { toast } = useZoruToast();
    const [thread, setThread] = React.useState<TeamThreadView | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [body, setBody] = React.useState('');
    const [sending, setSending] = React.useState(false);

    const load = React.useCallback(async () => {
        if (!rootMessageId) {
            setThread(null);
            return;
        }
        setLoading(true);
        try {
            const t = await getMessageThread(rootMessageId);
            setThread(t);
        } finally {
            setLoading(false);
        }
    }, [rootMessageId]);

    React.useEffect(() => {
        void load();
    }, [load]);

    const onSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!rootMessageId || !channelId) return;
        const trimmed = body.trim();
        if (!trimmed) return;
        setSending(true);
        const res = await sendThreadReply({
            rootMessageId,
            channelId,
            body: trimmed,
        });
        setSending(false);
        if (res.success) {
            setBody('');
            await load();
        } else {
            toast({
                title: 'Reply failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const open = !!rootMessageId;

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <ZoruSheetContent side="right" className="flex w-[420px] flex-col p-0">
                <ZoruSheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-zoru-line px-4 py-3">
                    <ZoruSheetTitle className="text-[13px]">Thread</ZoruSheetTitle>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-md p-1 text-zoru-ink-muted hover:bg-zoru-surface-2"
                        aria-label="Close thread"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </ZoruSheetHeader>

                <div className="flex-1 space-y-3 overflow-auto bg-zoru-surface-2/40 px-4 py-3">
                    {loading || !thread ? (
                        <div className="text-[12.5px] text-zoru-ink-muted">Loading…</div>
                    ) : (
                        <>
                            <ThreadMessage message={thread.root} root meId={meId} />
                            <div className="flex items-center gap-2 py-1 text-[10.5px] uppercase tracking-[0.06em] text-zoru-ink-muted">
                                <div className="h-px flex-1 bg-zoru-line" />
                                <span>
                                    {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                                </span>
                                <div className="h-px flex-1 bg-zoru-line" />
                            </div>
                            {thread.replies.map((r) => (
                                <ThreadMessage key={String(r._id)} message={r} meId={meId} />
                            ))}
                        </>
                    )}
                </div>

                <form onSubmit={onSend} className="border-t border-zoru-line bg-zoru-bg px-3 py-3">
                    <div className="flex items-center gap-2">
                        <Input
                            placeholder="Reply in thread…"
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            disabled={sending}
                            className="flex-1"
                        />
                        <Button
                            type="submit"
                            size="icon"
                            disabled={sending || !body.trim()}
                            aria-label="Send reply"
                        >
                            {sending ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </form>
            </ZoruSheetContent>
        </Sheet>
    );
}

function ThreadMessage({
    message,
    meId,
    root,
}: {
    message: TeamThreadView['root'];
    meId?: string;
    root?: boolean;
}) {
    const mine = !!meId && String((message as any).senderId) === meId;
    return (
        <div
            className={
                'rounded-md border px-3 py-2 text-[13px] ' +
                (root
                    ? 'border-zoru-line bg-zoru-bg'
                    : mine
                      ? 'border-zoru-ink/20 bg-zoru-surface-2'
                      : 'border-zoru-line bg-zoru-bg')
            }
        >
            {message.content ? (
                <div className="whitespace-pre-wrap text-zoru-ink">{message.content}</div>
            ) : null}
            <div className="mt-1 text-[10px] text-zoru-ink-muted">
                {format(new Date(message.createdAt as any), 'PPp')}
            </div>
        </div>
    );
}
