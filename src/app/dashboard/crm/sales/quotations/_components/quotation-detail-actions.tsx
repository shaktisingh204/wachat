'use client';

import {
  Button,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useRouter } from 'next/navigation';
import {
  Activity,
  Archive,
  ArrowRight,
  Mail,
  Pencil,
  Printer,
  Send,
  } from 'lucide-react';

/**
 * <QuotationDetailActions> — top-right action group for the quotation
 * detail page. Per `docs/ecosystem/CRM_REBUILD_PLAN.md` §1D, the
 * complete spec calls for 10 actions:
 *
 *   1. Edit — handled here
 *   2. Send — handled here (status → sent)
 *   3. Convert to Invoice — handled here
 *   4. Convert to SO — TODO (no `/sales-orders/new` flow accepts
 *      `?fromKind=quotation` yet; pending plumbing)
 *   5. Convert to Proforma — TODO (proforma route exists but accept-
 *      from-quotation seed is pending)
 *   6. Duplicate — TODO (depends on createQuotation accepting a `from`
 *      shorthand; pending the crm/quotations create-from helper)
 *   7. Email — handled here (mailto link composed client-side; richer
 *      compose dialog lands with the email-template service)
 *   8. WhatsApp — TODO (depends on contactPhone lookup which isn't
 *      part of the quotation document yet)
 *   9. Print — handled here (opens `?print=1` in a new tab)
 *  10. Archive + Activity — handled here
 *
 * Per the §1D scope-cap rule, the file ships the core 7
 * (Edit · Send · Convert to invoice · Email · Print · Archive ·
 * Activity) so the parent detail page stays under 600 lines.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  archiveQuotationAction,
  updateQuotationStatus,
} from '@/app/actions/crm/quotations.actions';
import type { CrmQuotationStatus } from '@/lib/rust-client/crm-quotations';

const STATUS_OPTIONS: CrmQuotationStatus[] = [
  'draft',
  'sent',
  'accepted',
  'rejected',
  'expired',
  'converted',
];

interface QuotationDetailActionsProps {
  quotationId: string;
  status: string;
  /** Customer email for the mailto-style Email button. */
  customerEmail?: string | null;
  quotationNo: string;
}

export function QuotationDetailActions({
  quotationId,
  status,
  customerEmail,
  quotationNo,
}: QuotationDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status);
  const [, startTransition] = React.useTransition();
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  React.useEffect(() => {
    setCurrentStatus(status);
  }, [status]);

  const moveTo = (next: CrmQuotationStatus) => {
    if (next === currentStatus) return;
    const previous = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateQuotationStatus(quotationId, next);
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

  const sendQuotation = () => moveTo('sent');

  const emailHref = (() => {
    const subject = encodeURIComponent(`Quotation ${quotationNo}`);
    const body = encodeURIComponent(
      `Hi,\n\nPlease find your quotation ${quotationNo}.\n\nThanks.`,
    );
    return `mailto:${customerEmail ?? ''}?subject=${subject}&body=${body}`;
  })();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status pill → status-change dropdown */}
      <DropdownMenu>
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
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/sales/quotations/${quotationId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={sendQuotation}>
        <Send className="h-3.5 w-3.5" /> Send
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/sales/invoices/new?fromKind=quotation&fromId=${quotationId}`}
        >
          <ArrowRight className="h-3.5 w-3.5" /> Convert to invoice
        </Link>
      </Button>

      {/* TODO §1D: Convert to SO / Proforma / Duplicate — pending the
          create-from-quotation flows on each sibling module. */}

      <Button size="sm" variant="outline" asChild>
        <a href={emailHref} target="_blank" rel="noopener noreferrer">
          <Mail className="h-3.5 w-3.5" /> Email
        </a>
      </Button>

      {/* TODO §1D: WhatsApp action — depends on a contactPhone lookup
          which isn't part of the quotation document yet. */}

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/sales/quotations/${quotationId}?print=1`}
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
        <Link href={`/dashboard/crm/sales/quotations/${quotationId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this quotation?"
        description="Archived quotations are marked expired but remain in the database. You can restore the status later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await archiveQuotationAction(quotationId);
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
