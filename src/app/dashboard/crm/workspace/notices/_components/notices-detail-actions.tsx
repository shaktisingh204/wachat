'use client';

import { Button, useToast } from '@/components/sabcrm/20ui';
import {
  Activity,
  Copy,
  Link2,
  Pencil,
  Pin,
  Trash2,
  Eye } from 'lucide-react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Notice detail actions — Edit · Pin · Mark read · Copy link · Delete ·
 * Activity. The pin/mark-read actions are intentionally optimistic UI
 * placeholders that call the existing single-row server actions where
 * available; missing server actions land as TODO 1D.2 comments.
 */

import * as React from 'react';
import Link from 'next/link';

import { deleteNotice, markNoticeViewed } from '@/app/actions/worksuite/knowledge.actions';

export interface NoticesDetailActionsProps {
    noticeId: string;
}

export function NoticesDetailActions({
    noticeId,
}: NoticesDetailActionsProps): React.JSX.Element {
    const { toast } = useToast();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const handleCopy = React.useCallback(async () => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        try {
            await navigator.clipboard.writeText(url);
            toast({ title: 'Link copied' });
        } catch {
            toast({ title: 'Could not copy', variant: 'destructive' });
        }
    }, [toast]);

    const handleMarkRead = React.useCallback(async () => {
        const r = await markNoticeViewed(noticeId);
        if (r.success) toast({ title: 'Marked as read' });
        else toast({ title: 'Error', description: r.error, variant: 'destructive' });
    }, [noticeId, toast]);

    const handleDelete = React.useCallback(async () => {
        const r = await deleteNotice(noticeId);
        if (r.success) {
            toast({ title: 'Notice deleted' });
            window.location.assign('/dashboard/crm/workspace/notices');
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
    }, [noticeId, toast]);

    return (
        <>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/notices/${noticeId}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>
            {/* TODO 1D.2: dedicated togglePinNotice server action.
                Use the edit form for now. */}
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/notices/${noticeId}/edit`}>
                    <Pin className="h-3.5 w-3.5" /> Pin
                </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={handleMarkRead}>
                <Eye className="h-3.5 w-3.5" /> Mark read
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Link2 className="h-3.5 w-3.5" /> Copy link
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopy}>
                <Copy className="h-3.5 w-3.5" /> Share
            </Button>
            <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/notices/${noticeId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete this notice?"
                description="The notice will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default NoticesDetailActions;
