'use client';

import { useState, useTransition } from 'react';

import { Button, Input } from '@/components/zoruui';

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

    const onReact = (emoji: string) => {
        startTransition(async () => {
            const res = await toggleSabConnectReaction(itemId, emoji);
            if ('error' in res) return;
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
            if ('error' in res) return;
            setComments((prev) => (prev ? [...prev, res.entity] : [res.entity]));
            setDraft('');
        });
    };

    return (
        <div className="flex flex-col gap-2 border-t border-zoru-line pt-3">
            <div className="flex flex-wrap items-center gap-1">
                {QUICK_EMOJIS.map((e) => (
                    <button
                        key={e}
                        type="button"
                        onClick={() => onReact(e)}
                        disabled={pending}
                        className="rounded-full border border-zoru-line bg-transparent px-2.5 py-1 text-sm transition-colors hover:bg-zoru-surface-hover"
                        aria-label={`React with ${e}`}
                    >
                        <span>{e}</span>
                        {counts[e] ? (
                            <span className="ml-1 text-xs text-zoru-muted">{counts[e]}</span>
                        ) : null}
                    </button>
                ))}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onOpenComments}
                    aria-expanded={comments !== null}
                >
                    {comments === null ? 'Comments' : 'Hide comments'}
                </Button>
            </div>

            {comments !== null ? (
                <div className="flex flex-col gap-2 pt-2">
                    {comments.length === 0 ? (
                        <p className="text-xs text-zoru-muted">No comments yet.</p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {comments.map((c) => (
                                <li
                                    key={c._id}
                                    className="rounded-lg bg-zoru-surface-hover px-3 py-2"
                                >
                                    <p className="text-xs font-semibold text-zoru-text">
                                        {c.authorName ?? 'Teammate'}
                                    </p>
                                    <p className="text-sm text-zoru-text">{c.body}</p>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="flex gap-2">
                        <Input
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            placeholder="Write a comment…"
                            aria-label="Write a comment"
                        />
                        <Button onClick={onPostComment} disabled={pending || !draft.trim()}>
                            Reply
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
