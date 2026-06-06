'use client';

import { useState, useTransition } from 'react';

import { MessageSquare } from 'lucide-react';

import {
    Badge,
    Button,
    EmptyState,
    Field,
    Input,
    useToast,
} from '@/components/sabcrm/20ui';

import {
    createSabConnectComment,
    listSabConnectComments,
    listSabConnectReactions,
    toggleSabConnectReaction,
} from '@/app/actions/sabconnect.actions';
import type { SabConnectCommentDoc } from '@/lib/rust-client/sabconnect-comments';

const QUICK_EMOJIS = ['👍', '❤️', '🎉', '🙌', '👀'] as const;

interface Props {
    itemId: string;
}

export function SabConnectFeedItemActions({ itemId }: Props) {
    const [counts, setCounts] = useState<Record<string, number>>({});
    const [comments, setComments] = useState<SabConnectCommentDoc[] | null>(null);
    const [draft, setDraft] = useState('');
    const [pending, startTransition] = useTransition();
    const { toast } = useToast();

    const onReact = (emoji: string) => {
        startTransition(async () => {
            const res = await toggleSabConnectReaction(itemId, emoji);
            if ('error' in res) {
                toast.error('Could not update your reaction.');
                return;
            }
            setCounts((prev) => {
                const next = { ...prev };
                const cur = next[emoji] ?? 0;
                next[emoji] = res.added ? cur + 1 : Math.max(0, cur - 1);
                return next;
            });
        });
    };

    const onOpenComments = () => {
        if (comments !== null) {
            setComments(null);
            return;
        }
        startTransition(async () => {
            const [r, c] = await Promise.all([
                listSabConnectReactions(itemId),
                listSabConnectComments({ itemId, parentCommentId: 'root', limit: 50 }),
            ]);
            setCounts(r.countByEmoji);
            setComments(c.items);
        });
    };

    const onPostComment = () => {
        const body = draft.trim();
        if (!body) return;
        startTransition(async () => {
            const res = await createSabConnectComment({ itemId, body });
            if ('error' in res) {
                toast.error('Could not post your comment.');
                return;
            }
            setComments((prev) => (prev ? [...prev, res.entity] : [res.entity]));
            setDraft('');
        });
    };

    return (
        <div className="flex flex-col gap-2 border-t border-[var(--st-border)] pt-3">
            <div className="flex flex-wrap items-center gap-1">
                {QUICK_EMOJIS.map((e) => (
                    <Button
                        key={e}
                        variant="ghost"
                        size="sm"
                        onClick={() => onReact(e)}
                        disabled={pending}
                        aria-pressed={(counts[e] ?? 0) > 0}
                        aria-label={`React with ${e}`}
                    >
                        <span aria-hidden="true">{e}</span>
                        {counts[e] ? (
                            <Badge tone="neutral" className="ml-1">
                                {counts[e]}
                            </Badge>
                        ) : null}
                    </Button>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    iconLeft={MessageSquare}
                    onClick={onOpenComments}
                    aria-expanded={comments !== null}
                >
                    {comments === null ? 'Comments' : 'Hide comments'}
                </Button>
            </div>

            {comments !== null ? (
                <div className="flex flex-col gap-2 pt-2">
                    {comments.length === 0 ? (
                        <EmptyState
                            size="sm"
                            icon={MessageSquare}
                            title="No comments yet"
                            description="Be the first to reply to this update."
                        />
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {comments.map((c) => (
                                <li
                                    key={c._id}
                                    className="rounded-[var(--st-radius)] bg-[var(--st-hover)] px-3 py-2"
                                >
                                    <p className="text-xs font-semibold text-[var(--st-text)]">
                                        {c.authorName ?? 'Teammate'}
                                    </p>
                                    <p className="text-sm text-[var(--st-text)]">{c.body}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex items-end gap-2">
                        <Field label="Write a comment" className="flex-1">
                            <Input
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                placeholder="Write a comment."
                            />
                        </Field>
                        <Button
                            variant="primary"
                            onClick={onPostComment}
                            loading={pending}
                            disabled={pending || !draft.trim()}
                        >
                            Reply
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
