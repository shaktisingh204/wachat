'use client';

/**
 * Slide-in panel showing a single message and its thread replies.
 * Mounted as a 20ui Sheet on the right edge of the chat surface.
 */
import * as React from 'react';
import { format } from 'date-fns';
import { MessagesSquare, Send } from 'lucide-react';

import {
    Button,
    Field,
    Input,
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    Spinner,
    useToast,
} from '@/components/sabcrm/20ui';

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
    const { toast } = useToast();
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
                tone: 'danger',
            });
        }
    };

    const open = !!rootMessageId;

    return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <SheetContent
                side="right"
                closeLabel="Close thread"
                className="flex w-[420px] flex-col p-0"
            >
                <SheetHeader className="flex flex-row items-center justify-between gap-2 border-b border-[var(--st-border)] px-4 py-3">
                    <SheetTitle className="text-[13px]">Thread</SheetTitle>
                </SheetHeader>

                <div className="flex-1 space-y-3 overflow-auto bg-[var(--st-bg-muted)]/40 px-4 py-3">
                    {loading || !thread ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-[var(--st-text-secondary)]">
                            <Spinner size="sm" />
                            <span>Loading thread.</span>
                        </div>
                    ) : (
                        <>
                            <ThreadMessage message={thread.root} root meId={meId} />
                            <div className="flex items-center gap-2 py-1 text-[10.5px] uppercase tracking-[0.06em] text-[var(--st-text-secondary)]">
                                <div className="h-px flex-1 bg-[var(--st-border)]" />
                                <span>
                                    {thread.replies.length} {thread.replies.length === 1 ? 'reply' : 'replies'}
                                </span>
                                <div className="h-px flex-1 bg-[var(--st-border)]" />
                            </div>
                            {thread.replies.map((r) => (
                                <ThreadMessage key={String(r._id)} message={r} meId={meId} />
                            ))}
                        </>
                    )}
                </div>

                <form onSubmit={onSend} className="border-t border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-3">
                    <div className="flex items-end gap-2">
                        <Field label="Reply" className="flex-1">
                            <Input
                                placeholder="Reply in thread."
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                disabled={sending}
                            />
                        </Field>
                        <Button
                            type="submit"
                            variant="primary"
                            iconLeft={Send}
                            loading={sending}
                            disabled={!body.trim()}
                            aria-label="Send reply"
                        >
                            Send
                        </Button>
                    </div>
                </form>
            </SheetContent>
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
                'rounded-[var(--st-radius)] border px-3 py-2 text-[13px] ' +
                (root
                    ? 'border-[var(--st-border)] bg-[var(--st-bg)]'
                    : mine
                      ? 'border-[var(--st-text)]/20 bg-[var(--st-bg-muted)]'
                      : 'border-[var(--st-border)] bg-[var(--st-bg)]')
            }
        >
            {message.content ? (
                <div className="whitespace-pre-wrap text-[var(--st-text)]">{message.content}</div>
            ) : null}
            <div className="mt-1 text-[10px] text-[var(--st-text-secondary)]">
                {format(new Date(message.createdAt as any), 'PPp')}
            </div>
        </div>
    );
}
