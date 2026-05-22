'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  Activity,
  Archive,
  Copy,
  Mail,
  Pencil,
  Pin,
  Share2,
  Trash2,
  ThumbsDown,
  ThumbsUp,
  } from 'lucide-react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import * as React from 'react';
import Link from 'next/link';

import {
    deleteKnowledgeBase,
    togglePinKnowledgeBase,
} from '@/app/actions/worksuite/knowledge.actions';

export interface KbInternalDetailActionsProps {
    id: string;
    pinned: boolean;
}

export function KbInternalDetailActions({
    id,
    pinned,
}: KbInternalDetailActionsProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const handleTogglePin = React.useCallback(async () => {
        const r = await togglePinKnowledgeBase(id);
        if (r.success) {
            toast({ title: pinned ? 'Unpublished' : 'Published' });
        } else {
            toast({ title: 'Error', description: r.error, variant: 'destructive' });
        }
    }, [id, pinned, toast]);

    const handleShare = React.useCallback(async () => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        try {
            await navigator.clipboard.writeText(url);
            toast({ title: 'Link copied' });
        } catch {
            toast({ title: 'Could not copy', variant: 'destructive' });
        }
    }, [toast]);

    const handleEmail = React.useCallback(() => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        const subject = encodeURIComponent('Knowledge base article');
        const body = encodeURIComponent(`Take a look at this article:\n\n${url}`);
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    }, []);

    const handleDelete = React.useCallback(async () => {
        const r = await deleteKnowledgeBase(id);
        if (r.success) {
            toast({ title: 'Article deleted' });
            window.location.assign('/dashboard/crm/workspace/knowledge-base');
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
    }, [id, toast]);

    const handleHelpful = React.useCallback(
        (vote: 'yes' | 'no') => {
            // TODO 1D.2: server-side helpfulYes / helpfulNo counters once schema extends.
            toast({ title: vote === 'yes' ? 'Thanks!' : 'Thanks for the feedback' });
        },
        [toast],
    );

    return (
        <>
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/knowledge-base/${id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={handleTogglePin}>
                <Pin className="h-3.5 w-3.5" /> {pinned ? 'Unpublish' : 'Publish'}
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={handleShare}>
                <Share2 className="h-3.5 w-3.5" /> Share
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={handleShare}>
                <Copy className="h-3.5 w-3.5" /> Copy link
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" onClick={handleEmail}>
                <Mail className="h-3.5 w-3.5" /> Email
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={() => handleHelpful('yes')}>
                <ThumbsUp className="h-3.5 w-3.5" /> Helpful
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={() => handleHelpful('no')}>
                <ThumbsDown className="h-3.5 w-3.5" /> Not helpful
            </ZoruButton>
            <ZoruButton asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/knowledge-base/${id}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </ZoruButton>
            <ZoruButton asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/knowledge-base/${id}/edit`}>
                    <Archive className="h-3.5 w-3.5" /> Archive
                </Link>
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete this article?"
                description="The article will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default KbInternalDetailActions;
