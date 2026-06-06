'use client';

import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, useToast } from '@/components/sabcrm/20ui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowRight,
  Award,
  ListChecks,
  Pencil,
  Printer,
  Send,
  ThumbsDown,
  } from 'lucide-react';

/**
 * <VendorBidDetailActions> — top-right action group for the vendor-bid
 * detail page. Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D, ships 7
 * actions:
 *
 *   1. Edit — handled here
 *   2. Submit — handled here (status → submitted)
 *   3. Shortlist — handled here (status → shortlisted)
 *   4. Award — handled here (status → awarded)
 *   5. Reject — handled here (status → rejected)
 *   6. Convert to PO — handled here (only after the bid is awarded)
 *   7. Print + Archive + Activity — handled here
 *
 * Status pill click opens a dropdown to flip status.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  archiveVendorBidAction,
  updateVendorBidStatus,
} from '@/app/actions/crm/vendor-bids.actions';
import type { CrmVendorBidStatus } from '@/lib/rust-client/crm-vendor-bids';

const STATUS_OPTIONS: CrmVendorBidStatus[] = [
  'submitted',
  'shortlisted',
  'awarded',
  'rejected',
  'withdrawn',
];

interface VendorBidDetailActionsProps {
  bidId: string;
  status: string;
  bidLabel: string;
}

export function VendorBidDetailActions({
  bidId,
  status,
  bidLabel,
}: VendorBidDetailActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [currentStatus, setCurrentStatus] = React.useState(status);
  const [, startTransition] = React.useTransition();
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  React.useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const moveTo = (next: CrmVendorBidStatus) => {
    if (next === currentStatus) return;
    const previous = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateVendorBidStatus(bidId, next);
      if (!res.success) {
        setCurrentStatus(previous);
        toast({
          title: 'Status change failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: 'Status updated', description: `Now: “${next}”.` });
      router.refresh();
    });
  };

  const isAwarded = currentStatus === 'awarded';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill → status-change dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus || 'submitted'}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <DropdownMenuItem key={s} onSelect={() => moveTo(s)}>
              {s}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/purchases/vendor-bids/${bidId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => moveTo('submitted')}>
        <Send className="h-3.5 w-3.5" /> Submit
      </Button>

      <Button size="sm" variant="outline" onClick={() => moveTo('shortlisted')}>
        <ListChecks className="h-3.5 w-3.5" /> Shortlist
      </Button>

      <Button size="sm" variant="outline" onClick={() => moveTo('awarded')}>
        <Award className="h-3.5 w-3.5" /> Award
      </Button>

      <Button size="sm" variant="outline" onClick={() => moveTo('rejected')}>
        <ThumbsDown className="h-3.5 w-3.5" /> Reject
      </Button>

      {isAwarded ? (
        <Button size="sm" variant="default" asChild>
          <Link
            href={`/dashboard/crm/purchases/orders/new?fromKind=vendorBid&fromId=${bidId}`}
          >
            <ArrowRight className="h-3.5 w-3.5" /> Convert to PO
          </Link>
        </Button>
      ) : null}

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/purchases/vendor-bids/${bidId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/purchases/vendor-bids/${bidId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${bidLabel || 'this vendor bid'}?`}
        description="Archived bids are flipped to `withdrawn` but remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await archiveVendorBidAction(bidId);
          if (res.success) {
            toast({ title: 'Archived' });
            router.refresh();
          } else {
            toast({
              title: 'Archive failed',
              description: res.error,
              variant: 'destructive',
            });
          }
        }}
      />
    </div>
  );
}
