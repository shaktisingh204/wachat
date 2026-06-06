'use client';

import { Button, useZoruToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import { Archive,
  BadgeCheck,
  RotateCcw } from 'lucide-react';

/**
 * Client-side action buttons rendered alongside the Edit/Activity
 * links in the warehouse detail header. Owns the Set-default and
 * Archive/Restore confirmation flows.
 */

import * as React from 'react';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    archiveCrmWarehouse,
    setDefaultCrmWarehouse,
    unarchiveCrmWarehouse,
} from '@/app/actions/crm-warehouses.actions';

export interface WarehouseDetailActionsProps {
    id: string;
    isDefault: boolean;
    archived: boolean;
}

export function WarehouseDetailActions({
    id,
    isDefault,
    archived,
}: WarehouseDetailActionsProps) {
    const router = useRouter();
    const { toast } = useZoruToast();
    const [confirmArchive, setConfirmArchive] = React.useState(false);
    const [pending, startTransition] = React.useTransition();

    function handleSetDefault() {
        startTransition(async () => {
            const res = await setDefaultCrmWarehouse(id);
            if (res.success) {
                toast({ title: 'Default warehouse updated' });
                router.refresh();
            } else {
                toast({
                    title: 'Update failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
        });
    }

    function handleConfirmArchive() {
        startTransition(async () => {
            const res = archived
                ? await unarchiveCrmWarehouse(id)
                : await archiveCrmWarehouse(id);
            if (res.success) {
                toast({
                    title: archived ? 'Warehouse restored' : 'Warehouse archived',
                });
                router.refresh();
            } else {
                toast({
                    title: archived ? 'Restore failed' : 'Archive failed',
                    description: res.error,
                    variant: 'destructive',
                });
            }
            setConfirmArchive(false);
        });
    }

    return (
        <>
            {!isDefault && !archived ? (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSetDefault}
                    disabled={pending}
                >
                    <BadgeCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Set default
                </Button>
            ) : null}
            <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmArchive(true)}
                disabled={pending}
            >
                {archived ? (
                    <>
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Restore
                    </>
                ) : (
                    <>
                        <Archive className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Archive
                    </>
                )}
            </Button>

            <ConfirmDialog
                open={confirmArchive}
                onOpenChange={setConfirmArchive}
                title={
                    archived
                        ? 'Restore this warehouse?'
                        : 'Archive this warehouse?'
                }
                description={
                    archived
                        ? 'This warehouse will be visible in your active list again.'
                        : 'This warehouse will be hidden from default views. You can restore it later.'
                }
                confirmLabel={archived ? 'Restore' : 'Archive'}
                confirmTone="primary"
                onConfirm={handleConfirmArchive}
            />
        </>
    );
}
