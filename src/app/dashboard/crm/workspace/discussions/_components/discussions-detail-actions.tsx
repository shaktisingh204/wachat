'use client';

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

/**
 * Discussion detail actions — Edit · Lock · Pin · Reply · Archive ·
 * Activity · Delete. Lock/Pin/Archive currently route to /edit since
 * no dedicated server actions exist yet (TODO 1D.2).
 */

import * as React from 'react';
import Link from 'next/link';

import { deleteDiscussion } from '@/app/actions/worksuite/knowledge.actions';

export interface DiscussionsDetailActionsProps {
    discussionId: string;
}

export function DiscussionsDetailActions({
    discussionId,
}: DiscussionsDetailActionsProps): React.JSX.Element {
    const { toast } = useZoruToast();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const handleDelete = React.useCallback(async () => {
        const r = await deleteDiscussion(discussionId);
        if (r.success) {
            toast({ title: 'Discussion deleted' });
            window.location.assign('/dashboard/crm/workspace/discussions');
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
    }, [discussionId, toast]);

    return (
        <>
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
            </ZoruButton>
            {/* TODO 1D.2: lock/pin/archive server actions */}
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/edit`}>
                    <Lock className="h-3.5 w-3.5" /> Lock
                </Link>
            </ZoruButton>
            <ZoruButton asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/edit`}>
                    <Pin className="h-3.5 w-3.5" /> Pin
                </Link>
            </ZoruButton>
            <ZoruButton variant="outline" size="sm" asChild>
                <a href="#replies">
                    <Reply className="h-3.5 w-3.5" /> Reply
                </a>
            </ZoruButton>
            <ZoruButton asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/edit`}>
                    <Archive className="h-3.5 w-3.5" /> Archive
                </Link>
            </ZoruButton>
            <ZoruButton asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/discussions/${discussionId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </ZoruButton>
            <ZoruButton variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </ZoruButton>

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
