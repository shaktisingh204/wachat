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
  CheckCheck,
  CircleX,
  Copy,
  FileText,
  Mail,
  MessageCircle,
  PackageCheck,
  Pencil,
  Printer,
  Trash2,
  } from 'lucide-react';

/**
 * <PurchaseOrderDetailActions> — top-right action group on the PO
 * detail page. Renders 10+ actions: Edit · Approve (when awaiting) ·
 * Send · Convert to GRN · Convert to Bill · Email · WhatsApp · Print ·
 * Duplicate · Archive · Delete · Activity. The status pill is a
 * clickable dropdown.
 *
 * Status pill dropdown respects allowed transitions:
 *   draft → awaiting_approval | cancelled
 *   awaiting_approval → approved | draft | cancelled
 *   approved → sent | cancelled
 *   sent → partial | received | cancelled
 *   partial → received | cancelled
 *   received → closed
 *   closed → (terminal)
 *   cancelled → (terminal)
 * Any status can be forced to any other via the dropdown — the UI hints
 * the canonical next step.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deletePurchaseOrderAction,
  updatePurchaseOrderStatus,
} from '@/app/actions/crm/purchase-orders.actions';
import type { CrmPurchaseOrderStatus } from '@/lib/rust-client/crm-purchase-orders';

import {
  PurchaseOrderApproveDialog,
  PurchaseOrderEmailDialog,
  PurchaseOrderWhatsAppDialog,
} from './purchase-order-dialogs';

const STATUS_OPTIONS: { value: CrmPurchaseOrderStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'awaiting_approval', label: 'Awaiting approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial', label: 'Partial' },
  { value: 'received', label: 'Received' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface PurchaseOrderDetailActionsProps {
  poId: string;
  poNo: string;
  status?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function PurchaseOrderDetailActions({
  poId,
  poNo,
  status,
  contactEmail,
  contactPhone,
}: PurchaseOrderDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'draft');
  const [, startTransition] = React.useTransition();

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = React.useState(false);
  const [approveOpen, setApproveOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => setCurrentStatus(status ?? 'draft'), [status]);

  const moveTo = (next: string) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updatePurchaseOrderStatus(poId, next);
      if (!res.success) {
        setCurrentStatus(prev);
        toast({
          title: 'Status change failed',
          description: res.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: 'Status updated',
        description: `Now ${next.replace(/_/g, ' ')}`,
      });
      router.refresh();
    });
  };

  const showApprove = currentStatus === 'awaiting_approval';

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <ZoruDropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full transition-opacity hover:opacity-80"
            aria-label="Change status"
          >
            <StatusPill
              label={currentStatus.replace(/_/g, ' ')}
              tone={statusToTone(currentStatus)}
            />
          </button>
        </ZoruDropdownMenuTrigger>
        <ZoruDropdownMenuContent>
          {STATUS_OPTIONS.map((s) => (
            <ZoruDropdownMenuItem
              key={s.value}
              onSelect={() => moveTo(s.value)}
            >
              {s.label}
            </ZoruDropdownMenuItem>
          ))}
        </ZoruDropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" asChild>
        <Link href={`/dashboard/crm/purchases/orders/${poId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      {showApprove ? (
        <Button size="sm" onClick={() => setApproveOpen(true)}>
          <CheckCheck className="h-3.5 w-3.5" /> Approve
        </Button>
      ) : null}

      <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="h-3.5 w-3.5" /> Send
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/inventory/grn/new?fromKind=purchaseOrder&fromId=${poId}`}
        >
          <PackageCheck className="h-3.5 w-3.5" /> Convert to GRN
        </Link>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/bills/new?fromKind=purchaseOrder&fromId=${poId}`}
        >
          <FileText className="h-3.5 w-3.5" /> Convert to bill
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setWhatsAppOpen(true)}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/purchases/orders/${poId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/purchases/orders/new?fromKind=purchaseOrder&fromId=${poId}`}
        >
          <Copy className="h-3.5 w-3.5" /> Duplicate
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setArchiveOpen(true)}>
        <Archive className="h-3.5 w-3.5" /> Archive
      </Button>

      <Button size="sm" variant="destructive" onClick={() => setDeleteOpen(true)}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </Button>

      <Button size="sm" variant="ghost" asChild>
        <Link href={`/dashboard/crm/purchases/orders/${poId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <PurchaseOrderEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        poId={poId}
        poNo={poNo}
        initialTo={contactEmail ?? ''}
      />
      <PurchaseOrderWhatsAppDialog
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        poId={poId}
        poNo={poNo}
        initialPhone={contactPhone ?? ''}
      />
      <PurchaseOrderApproveDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        poId={poId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this purchase order?"
        description="The PO is marked cancelled and hidden from default views. You can restore it later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await updatePurchaseOrderStatus(poId, 'cancelled');
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
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this purchase order?"
        description="This permanently removes the purchase order. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deletePurchaseOrderAction(poId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/purchases/orders');
          } else {
            toast({
              title: 'Delete failed',
              description: res.error,
              variant: 'destructive',
            });
            throw new Error(res.error);
          }
        }}
      />

      <span aria-hidden className="sr-only">
        <CircleX />
      </span>
    </div>
  );
}
