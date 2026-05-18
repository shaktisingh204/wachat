'use client';

import { ZoruButton, ZoruCard, ZoruTextarea, useZoruToast } from '@/components/zoruui';
/**
 * <DiscussionsRepliesPanel> — client island rendered inside the detail
 * page. Loads replies on mount, owns the composer + per-row delete.
 */

import * as React from 'react';

import {
    addDiscussionReply,
    deleteDiscussionReply,
    getDiscussionReplies,
} from '@/app/actions/worksuite/knowledge.actions';
import type { WsDiscussionReply } from '@/lib/worksuite/knowledge-types';

import { fmtDateTime } from './discussions-shared';

export interface DiscussionsRepliesPanelProps {
    discussionId: string;
}

export function DiscussionsRepliesPanel({
    discussionId,
}: DiscussionsRepliesPanelProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [replies, setReplies] = React.useState<(WsDiscussionReply & { _id: string })[]>([]);
    const [body, setBody] = React.useState('');
    const [submitting, setSubmitting] = React.useState(false);

    const refresh = React.useCallback(async () => {
        const r = await getDiscussionReplies(discussionId);
        setReplies(r as (WsDiscussionReply & { _id: string })[]);
    }, [discussionId]);

    React.useEffect(() => {
        void refresh();
    }, [refresh]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!body.trim()) return;
        setSubmitting(true);
        const res = await addDiscussionReply(discussionId, body);
        setSubmitting(false);
        if (res.success) {
            setBody('');
            void refresh();
        } else {
            toast({ title: 'Error', description: res.error, variant: 'destructive' });
        }
    };

    const handleDelete = async (rid: string) => {
        const r = await deleteDiscussionReply(rid);
        if (r.success) void refresh();
        else toast({ title: 'Error', description: r.error, variant: 'destructive' });
    };

    return (
        <ZoruCard>
            <h3 className="mb-3 text-[14px] font-semibold text-zoru-ink">
                Replies ({replies.length})
            </h3>
            <div className="flex flex-col gap-3">
                {replies.length === 0 ? (
                    <p className="text-[13px] text-zoru-ink-muted">
                        No replies yet — be the first.
                    </p>
                ) : (
                    replies.map((r) => (
                        <div
                            key={r._id}
                            className="rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-zoru-ink">
                                        {r.user_name || r.user_id}
                                    </p>
                                    <p className="text-[11px] text-zoru-ink-muted">
                                        {fmtDateTime(r.createdAt)}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-zoru-ink">
                                        {r.body}
                                    </p>
                                </div>
                                <ZoruButton
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(r._id)}
                                >
                                    Delete
                                </ZoruButton>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
                <ZoruTextarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                />
                <div className="flex justify-end">
                    <ZoruButton type="submit" disabled={submitting || !body.trim()}>
                        Post reply
                    </ZoruButton>
                </div>
            </form>
        </ZoruCard>
    );
}

export default DiscussionsRepliesPanel;
