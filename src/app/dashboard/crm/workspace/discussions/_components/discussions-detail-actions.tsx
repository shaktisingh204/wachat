'use client';

import * as React from 'react';
import Link from 'next/link';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  Activity,
  Archive,
  Lock,
  Pencil,
  Pin,
  Reply,
  Trash2,
} from 'lucide-react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteDiscussion,
  toggleLockDiscussion,
  togglePinDiscussion,
  archiveDiscussion,
} from '@/app/actions/worksuite/knowledge.actions';

/**
 * Discussion detail actions — Edit · Lock · Pin · Reply · Archive ·
 * Activity · Delete.
 */

export interface DiscussionsDetailActionsProps {
    discussionId: string;
}

export function DiscussionsDetailActions({
    discussionId,
}: DiscussionsDetailActionsProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [busy, setBusy] = React.useState<string | null>(null);

    const handleDelete = React.useCallback(async () => {
        const r = await deleteDiscussion(discussionId);
        if (r.success) {
            toast({ title: 'Discussion deleted' });
            window.location.assign('/dashboard/crm/workspace/discussions');
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
    }, [discussionId, toast]);

    const handleLock = React.useCallback(async () => {
        setBusy('lock');
        const r = await toggleLockDiscussion(discussionId);
        setBusy(null);
        if (r.success) {
            toast({ title: r.locked ? 'Discussion locked' : 'Discussion unlocked' });
        } else {
            toast({ title: 'Lock failed', description: r.error, variant: 'destructive' });
        }
    }, [discussionId, toast]);

    const handlePin = React.useCallback(async () => {
        setBusy('pin');
        const r = await togglePinDiscussion(discussionId);
        setBusy(null);
        if (r.success) {
            toast({ title: r.pinned ? 'Discussion pinned' : 'Discussion unpinned' });
        } else {
            toast({ title: 'Pin failed', description: r.error, variant: 'destructive' });
        }
    }, [discussionId, toast]);

    const handleArchive = React.useCallback(async () => {
        setBusy('archive');
        const r = await archiveDiscussion(discussionId);
        setBusy(null);
        if (r.success) {
            toast({ title: 'Discussion archived' });
            window.location.assign('/dashboard/crm/workspace/discussions');
        } else {
            toast({ title: 'Archive failed', description: r.error, variant: 'destructive' });
        }
    }, [discussionId, toast]);

    return (
        <>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={busy === 'lock'}
                onClick={handleLock}
            >
                <Lock className="h-3.5 w-3.5" /> Lock
            </Button>
            <Button
                variant="outline"
                size="sm"
                disabled={busy === 'pin'}
                onClick={handlePin}
            >
                <Pin className="h-3.5 w-3.5" /> Pin
            </Button>
            <Button variant="outline" size="sm" asChild>
                <a href="#replies">
                    <Reply className="h-3.5 w-3.5" /> Reply
                </a>
            </Button>
            <Button
                variant="ghost"
                size="sm"
                disabled={busy === 'archive'}
                onClick={handleArchive}
            >
                <Archive className="h-3.5 w-3.5" /> Archive
            </Button>
            <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete this discussion?"
                description="All replies will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default DiscussionsDetailActions;
