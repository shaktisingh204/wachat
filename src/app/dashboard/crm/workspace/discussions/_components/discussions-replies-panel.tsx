'use client';

import { Button, Card, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
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
    const { toast } = useToast();
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
        <Card>
            <h3 className="mb-3 text-[14px] font-semibold text-[var(--st-text)]">
                Replies ({replies.length})
            </h3>
            <div className="flex flex-col gap-3">
                {replies.length === 0 ? (
                    <p className="text-[13px] text-[var(--st-text-secondary)]">
                        No replies yet — be the first.
                    </p>
                ) : (
                    replies.map((r) => (
                        <div
                            key={r._id}
                            className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[var(--st-text)]">
                                        {r.user_name || r.user_id}
                                    </p>
                                    <p className="text-[11px] text-[var(--st-text-secondary)]">
                                        {fmtDateTime(r.createdAt)}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-[13.5px] text-[var(--st-text)]">
                                        {r.body}
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(r._id)}
                                >
                                    Delete
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2">
                <Textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a reply…"
                    rows={3}
                />
                <div className="flex justify-end">
                    <Button type="submit" disabled={submitting || !body.trim()}>
                        Post reply
                    </Button>
                </div>
            </form>
        </Card>
    );
}

export default DiscussionsRepliesPanel;
