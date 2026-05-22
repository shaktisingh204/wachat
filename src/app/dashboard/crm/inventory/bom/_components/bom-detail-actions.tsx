'use client';

import { Button, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    Activity,
  Archive,
  Copy,
  Edit,
  Factory,
  Mail,
  Power,
  Printer,
  } from 'lucide-react';

/**
 * 8-action header for the BOM detail page (per §1D.2):
 *   Edit · Activate/Deactivate · Duplicate · Print · Create Production
 *   Order · Email · Archive · Activity
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { duplicateBom, setBomStatus } from '@/app/actions/crm-bom.actions';

export interface BomDetailActionsProps {
    bomId: string;
    bomNo: string;
    finishedGoodName: string;
    active: boolean;
}

export function BomDetailActions({
    bomId,
    bomNo,
    finishedGoodName,
    active,
}: BomDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [archiveOpen, setArchiveOpen] = React.useState(false);

    const onToggleActive = async () => {
        const res = await setBomStatus(bomId, active ? 'inactive' : 'active');
        if (res.success) {
            toast({ title: active ? 'BOM deactivated' : 'BOM activated' });
            router.refresh();
        } else {
            toast({
                title: 'Status update failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const onDuplicate = async () => {
        const res = await duplicateBom(bomId);
        if (res.success && res.id) {
            toast({ title: 'BOM duplicated' });
            router.push(`/dashboard/crm/inventory/bom/${res.id}/edit`);
        } else {
            toast({
                title: 'Duplicate failed',
                description: res.error,
                variant: 'destructive',
            });
        }
    };

    const onPrint = () => {
        if (typeof window !== 'undefined') window.print();
    };

    const onEmail = () => {
        if (typeof window === 'undefined') return;
        const subject = encodeURIComponent(`BOM ${bomNo} — ${finishedGoodName}`);
        const body = encodeURIComponent(
            `BOM ${bomNo} for ${finishedGoodName}.\n\nView: ${window.location.href}`,
        );
        window.location.href = `mailto:?subject=${subject}&body=${body}`;
    };

    const onConfirmArchive = async () => {
        const res = await setBomStatus(bomId, 'archived');
        if (res.success) {
            toast({ title: 'BOM archived' });
            router.refresh();
        } else {
            toast({
                title: 'Archive failed',
                description: res.error,
                variant: 'destructive',
            });
        }
        setArchiveOpen(false);
    };

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <Button size="sm" asChild>
                    <Link href={`/dashboard/crm/inventory/bom/${bomId}/edit`}>
                        <Edit className="h-3.5 w-3.5" /> Edit
                    </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={onToggleActive}>
                    <Power className="h-3.5 w-3.5" />
                    {active ? 'Deactivate' : 'Activate'}
                </Button>
                <Button size="sm" variant="outline" onClick={onDuplicate}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" onClick={onPrint}>
                    <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button size="sm" variant="outline" asChild>
                    <Link href={`/dashboard/crm/inventory/production-orders/new?bomId=${bomId}`}>
                        <Factory className="h-3.5 w-3.5" /> Create production order
                    </Link>
                </Button>
                <Button size="sm" variant="outline" onClick={onEmail}>
                    <Mail className="h-3.5 w-3.5" /> Email
                </Button>
                <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
                    <Archive className="h-3.5 w-3.5" /> Archive
                </Button>
                <Button size="sm" variant="ghost" asChild>
                    <Link href={`/dashboard/crm/inventory/bom/${bomId}/activity`}>
                        <Activity className="h-3.5 w-3.5" /> Activity
                    </Link>
                </Button>
            </div>

            <ConfirmDialog
                open={archiveOpen}
                onOpenChange={setArchiveOpen}
                title="Archive this BOM?"
                description={`"${bomNo}" will be hidden from default views. You can restore later.`}
                confirmLabel="Archive"
                confirmTone="primary"
                onConfirm={onConfirmArchive}
            />
        </>
    );
}

export default BomDetailActions;
