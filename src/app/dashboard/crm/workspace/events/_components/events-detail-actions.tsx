'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui';
import {
  Activity,
  CalendarX,
  Check,
  ChevronDown,
  Copy,
  Pencil,
  Send,
  Trash2,
  X as XIcon,
  } from 'lucide-react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

/**
 * Event detail action group (§1D.2) — Edit · RSVP · Send invite · Cancel ·
 * Reschedule · Delete · Activity. Renders inline in the page header.
 *
 * Most actions are client-side (RSVP, copy invite link). Edit / Activity
 * are <Link>s. Delete uses <ConfirmDialog>.
 */

import * as React from 'react';
import Link from 'next/link';

import { deleteEvent, rsvpEvent } from '@/app/actions/worksuite/knowledge.actions';
import type { WsEventAttendeeStatus } from '@/lib/worksuite/knowledge-types';

export interface EventsDetailActionsProps {
    eventId: string;
    onlineLink?: string;
}

export function EventsDetailActions({
    eventId,
    onlineLink,
}: EventsDetailActionsProps): React.JSX.Element {
    const { toast } = useToast();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const handleRsvp = React.useCallback(
        async (status: WsEventAttendeeStatus) => {
            const r = await rsvpEvent(eventId, status);
            if (r.success) {
                toast({ title: 'RSVP', description: `Marked as ${status}.` });
            } else {
                toast({ title: 'Error', description: r.error, variant: 'destructive' });
            }
        },
        [eventId, toast],
    );

    const handleCopyInvite = React.useCallback(async () => {
        const url = typeof window !== 'undefined' ? window.location.href : '';
        try {
            await navigator.clipboard.writeText(url);
            toast({ title: 'Invite link copied' });
        } catch {
            toast({ title: 'Could not copy', variant: 'destructive' });
        }
    }, [toast]);

    const handleCopyMeetLink = React.useCallback(async () => {
        if (!onlineLink) return;
        try {
            await navigator.clipboard.writeText(onlineLink);
            toast({ title: 'Meeting link copied' });
        } catch {
            toast({ title: 'Could not copy', variant: 'destructive' });
        }
    }, [onlineLink, toast]);

    const handleDelete = React.useCallback(async () => {
        const r = await deleteEvent(eventId);
        if (r.success) {
            toast({ title: 'Event deleted' });
            window.location.assign('/dashboard/crm/workspace/events');
        } else {
            toast({ title: 'Delete failed', description: r.error, variant: 'destructive' });
        }
    }, [eventId, toast]);

    return (
        <>
            <Button asChild variant="outline" size="sm">
                <Link href={`/dashboard/crm/workspace/events/${eventId}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                </Link>
            </Button>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        RSVP <ChevronDown className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Mark me as…</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleRsvp('yes')}>
                        <Check className="h-3.5 w-3.5" /> Going
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRsvp('maybe')}>
                        Maybe
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRsvp('no')}>
                        <XIcon className="h-3.5 w-3.5" /> Decline
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" onClick={handleCopyInvite}>
                <Send className="h-3.5 w-3.5" /> Invite
            </Button>

            <Button variant="outline" size="sm" asChild>
                <Link href={`/dashboard/crm/workspace/events/${eventId}/edit`}>
                    <CalendarX className="h-3.5 w-3.5" /> Reschedule
                </Link>
            </Button>

            {onlineLink ? (
                <Button variant="ghost" size="sm" onClick={handleCopyMeetLink}>
                    <Copy className="h-3.5 w-3.5" /> Copy meet link
                </Button>
            ) : null}

            <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/crm/workspace/events/${eventId}/activity`}>
                    <Activity className="h-3.5 w-3.5" /> Activity
                </Link>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete this event?"
                description="The event and its attendees will be permanently removed."
                requireTyped="DELETE"
                confirmLabel="Delete"
                onConfirm={handleDelete}
            />
        </>
    );
}

export default EventsDetailActions;
