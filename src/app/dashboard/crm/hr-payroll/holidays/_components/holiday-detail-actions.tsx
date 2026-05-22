'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';

import { Button, useZoruToast } from '@/components/zoruui';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { deleteHolidayAction } from '@/app/actions/crm/holidays.actions';

interface Props {
    id: string;
    name: string;
}

export function HolidayDetailActions({ id, name }: Props): React.JSX.Element {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [confirmOpen, setConfirmOpen] = React.useState(false);

    const onDelete = React.useCallback(async () => {
        const r = await deleteHolidayAction(id);
        if (r.success) {
            toast({ title: 'Holiday deleted' });
            router.push('/dashboard/crm/hr-payroll/holidays');
        } else {
            toast({
                title: 'Delete failed',
                description: r.error,
                variant: 'destructive',
            });
            throw new Error(r.error ?? 'Delete failed');
        }
    }, [id, router, toast]);

    return (
        <>
            <ZoruButton asChild size="sm" variant="outline">
                <Link href={`/dashboard/crm/hr-payroll/holidays/${id}/edit`}>
                    <Pencil className="h-4 w-4" />
                    Edit
                </Link>
            </ZoruButton>
            <ZoruButton
                size="sm"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
            >
                <Trash2 className="h-4 w-4" />
                Delete
            </ZoruButton>

            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={setConfirmOpen}
                title={`Delete "${name}"?`}
                description="This holiday will be permanently removed from the calendar. This action cannot be undone."
                confirmLabel="Delete"
                onConfirm={onDelete}
            />
        </>
    );
}
