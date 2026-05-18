'use client';

import { ZoruButton, useZoruToast } from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  Banknote,
  Pencil,
  Printer,
  TrendingDown,
  UserMinus,
  UserPlus,
  Wrench,
  } from 'lucide-react';

/**
 * <FixedAssetDetailActions> — 9 actions per §1D.2: Edit · Assign ·
 * Unassign · Depreciate now · Retire · Print label · Maintenance log ·
 * Archive · Activity.
 */

import * as React from 'react';
import Link from 'next/link';

import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteFixedAssetAction,
  runDepreciation,
  unassignFixedAsset,
} from '@/app/actions/crm/fixed-assets.actions';

import {
  FixedAssetAssignDialog,
  FixedAssetRetireDialog,
} from './fixed-asset-detail-dialogs';

interface FixedAssetDetailActionsProps {
  assetId: string;
  custodianEmployeeId?: string | null;
}

export function FixedAssetDetailActions({
  assetId,
  custodianEmployeeId,
}: FixedAssetDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [, startTransition] = React.useTransition();

  const [assignOpen, setAssignOpen] = React.useState(false);
  const [retireOpen, setRetireOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const runUnassign = () => {
    startTransition(async () => {
      const res = await unassignFixedAsset(assetId);
      if (res.success) {
        toast({ title: 'Unassigned' });
        router.refresh();
      } else {
        toast({
          title: 'Unassign failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const runDepreciate = () => {
    startTransition(async () => {
      const res = await runDepreciation(assetId);
      if (res.success) {
        toast({
          title: 'Queued',
          description: 'Depreciation event logged. Numeric run executes on the next schedule.',
        });
        router.refresh();
      } else {
        toast({
          title: 'Depreciation failed',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/fixed-assets/${assetId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setAssignOpen(true)}
      >
        <UserPlus className="h-3.5 w-3.5" /> Assign
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={runUnassign}
        disabled={!custodianEmployeeId}
      >
        <UserMinus className="h-3.5 w-3.5" /> Unassign
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={runDepreciate}>
        <TrendingDown className="h-3.5 w-3.5" /> Depreciate now
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setRetireOpen(true)}
      >
        <Banknote className="h-3.5 w-3.5" /> Retire / Dispose
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print label
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" asChild>
        {/* TODO 1D.2: Maintenance log needs server-side endpoint and child table */}
        <Link href={`/dashboard/crm/fixed-assets/${assetId}/maintenance`}>
          <Wrench className="h-3.5 w-3.5" /> Maintenance log
        </Link>
      </ZoruButton>

      <ZoruButton
        size="sm"
        variant="outline"
        onClick={() => setArchiveOpen(true)}
      >
        <Archive className="h-3.5 w-3.5" /> Archive
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/fixed-assets/${assetId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </ZoruButton>

      <FixedAssetAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        assetId={assetId}
      />
      <FixedAssetRetireDialog
        open={retireOpen}
        onOpenChange={setRetireOpen}
        assetId={assetId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this asset?"
        description="The asset is removed from active views. There is no soft-delete flag — this performs a hard delete."
        requireTyped="ARCHIVE"
        confirmLabel="Archive"
        onConfirm={async () => {
          const res = await deleteFixedAssetAction(assetId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.push('/dashboard/crm/fixed-assets');
          } else {
            toast({
              title: 'Archive failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />
    </div>
  );
}
