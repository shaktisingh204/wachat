'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Pencil, Send, Trash2, X } from 'lucide-react';

import { Button, useZoruToast } from '@/components/zoruui';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
    deleteCrmTimesheet,
    setCrmTimesheetStatus,
    type CrmTimesheetStatus,
} from '@/app/actions/crm-timesheets.actions';

interface Props {
    id: string;
    status: CrmTimesheetStatus;
}

export function TimesheetDetailActions({ id, status }: Props): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [, startTransition] = React.useTransition();
    const [confirmDelete, setConfirmDelete] = React.useState(false);

    const move = React.useCallback(
        (next: CrmTimesheetStatus, label: string) => {
            startTransition(async () => {
                const r = await setCrmTimesheetStatus(id, next);
                if (r.success) {
                    toast({ title: label });
                    router.refresh();
                } else {
                    toast({
                        title: 'Action failed',
                        description: r.error,
                        variant: 'destructive',
                    });
                }
            });
        },
        [id, router, toast],
    );

    const onDelete = React.useCallback(async () => {
        const r = await deleteCrmTimesheet(id);
        if (r.success) {
            toast({ title: 'Timesheet deleted' });
            router.push('/dashboard/crm/hr/timesheets');
        } else {
            toast({
                title: 'Delete failed',
                description: r.error,
                variant: 'destructive',
            });
            throw new Error(r.error);
        }
    }, [id, router, toast]);

    return (
        <>
            {status === 'draft' ? (
                <Button
                    size="sm"
                    variant="outline"
                    onClick={() => move('submitted', 'Submitted for approval')}
                >
                    <Send className="h-4 w-4" />
                    Submit
                </Button>
            ) : null}
            {status === 'submitted' ? (
                <>
                    <Button
                        size="sm"
                        onClick={() => move('approved', 'Timesheet approved')}
                    >
                        <Check className="h-4 w-4" />
                        Approve
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => move('rejected', 'Timesheet rejected')}
                    >
                        <X className="h-4 w-4" />
                        Reject
                    </Button>
                </>
            ) : null}
            <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/crm/hr/timesheets/${id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Edit
                </Link>
            </Button>
            <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmDelete(true)}
            >
                <Trash2 className="h-4 w-4" />
                Delete
            </Button>

            <ConfirmDialog
                open={confirmDelete}
                onOpenChange={setConfirmDelete}
                title="Delete timesheet?"
                description="This action cannot be undone. The timesheet and its approval history will be permanently removed."
                confirmLabel="Delete"
                onConfirm={onDelete}
            />
        </>
    );
}
