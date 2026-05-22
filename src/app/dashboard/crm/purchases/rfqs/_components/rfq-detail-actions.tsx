'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowRight,
  Award,
  Lock,
  Pencil,
  Printer,
  Send,
  } from 'lucide-react';

/**
 * <RfqDetailActions> — top-right action group for the RFQ detail page.
 * Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D the surface ships 8
 * actions:
 *
 *   1. Edit — handled here
 *   2. Send to vendors — handled here (status → open)
 *   3. Close — handled here (status → closed)
 *   4. Award — opens the vendor-bid selector (the bids tab below)
 *   5. Convert to PO — handled here (only after the RFQ is awarded)
 *   6. Print — handled here (opens `?print=1` in a new tab)
 *   7. Archive — handled here (status → cancelled)
 *   8. Activity — handled here (link to /activity sub-route)
 *
 * Status pill click opens a dropdown to flip status. The "Convert to
 * PO" path threads the awarded vendor-bid id via `?fromKind=rfq&
 * fromId=` so the PO form can pre-fill.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  archiveRfqAction,
  awardRfqAction,
  updateRfqStatus,
} from '@/app/actions/crm/rfqs.actions';
import type { CrmRfqStatus } from '@/lib/rust-client/crm-rfqs';

const STATUS_OPTIONS: CrmRfqStatus[] = [
  'draft',
  'open',
  'closed',
  'awarded',
  'cancelled',
];

interface RfqDetailActionsProps {
  rfqId: string;
  status: string;
  rfqTitle: string;
}

export function RfqDetailActions({
  rfqId,
  status,
  rfqTitle,
}: RfqDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status);
  const [, startTransition] = React.useTransition();
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [awardOpen, setAwardOpen] = React.useState(false);

  React.useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const moveTo = (next: CrmRfqStatus) => {
    if (next === currentStatus) return;
    const previous = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateRfqStatus(rfqId, next);
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

  const sendToVendors = () => moveTo('open');
  const closeRfq = () => moveTo('closed');
  const isAwarded = currentStatus === 'awarded';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill → status-change dropdown */}
      <ZoruDropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill label={currentStatus || 'draft'} tone={statusToTone(currentStatus)} />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <ZoruDropdownMenuItem key={s} onSelect={() => moveTo(s)}>
              {s}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </ZoruDropdownMenu>

      <ZoruButton size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/purchases/rfqs/${rfqId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={sendToVendors}>
        <Send className="h-3.5 w-3.5" /> Send to vendors
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={closeRfq}>
        <Lock className="h-3.5 w-3.5" /> Close
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={() => setAwardOpen(true)}>
        <Award className="h-3.5 w-3.5" /> Award
      </ZoruButton>

      {isAwarded ? (
        <ZoruButton size="sm" variant="default" asChild>
          <Link
            href={`/dashboard/crm/purchases/orders/new?fromKind=rfq&fromId=${rfqId}`}
          >
            <ArrowRight className="h-3.5 w-3.5" /> Convert to PO
          </Link>
        </ZoruButton>
      ) : null}

      <ZoruButton size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/purchases/rfqs/${rfqId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </ZoruButton>

      <ZoruButton size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </ZoruButton>

      <ZoruButton size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/purchases/rfqs/${rfqId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </ZoruButton>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`Archive ${rfqTitle || 'this RFQ'}?`}
        description="Archived RFQs are flipped to `cancelled` but remain in the database. You can restore the status later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await archiveRfqAction(rfqId);
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

      <ConfirmDialog
        open={awardOpen}
        onOpenChange={setAwardOpen}
        title="Award this RFQ?"
        description="Awarding flips the RFQ to `awarded`. Use the Vendor bids card below to mark the winning bid as awarded — that's what becomes the source of the eventual PO."
        confirmLabel="Mark awarded"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await awardRfqAction(rfqId);
          if (res.success) {
            toast({ title: 'RFQ awarded' });
            router.refresh();
          } else {
            toast({
              title: 'Award failed',
              description: res.error,
              variant: 'destructive',
            });
          }
        }}
      />
    </div>
  );
}
