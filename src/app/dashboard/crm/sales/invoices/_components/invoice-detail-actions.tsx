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
  Banknote,
  Copy,
  CircleX,
  FileMinus,
  Mail,
  MessageCircle,
  Pencil,
  Printer,
  Receipt,
  Trash2,
  } from 'lucide-react';

/**
 * <InvoiceDetailActions> — top-right action group on the invoice detail
 * page. Renders 10+ actions: Edit, Send, Mark paid, Record payment,
 * Convert to credit note, Email, WhatsApp, Print, Duplicate, Archive,
 * Delete, Activity. The status pill is a clickable dropdown.
 */

import * as React from 'react';
import Link from 'next/link';

import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  deleteInvoiceAction,
  updateInvoiceStatus,
} from '@/app/actions/crm/invoices.actions';
import type { CrmInvoiceStatus } from '@/lib/rust-client/crm-invoices';

import {
  InvoiceEmailDialog,
  InvoiceMarkPaidDialog,
  InvoiceWhatsAppDialog,
} from './invoice-dialogs';

const STATUS_OPTIONS: { value: CrmInvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partially_paid', label: 'Partially paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface InvoiceDetailActionsProps {
  invoiceId: string;
  invoiceNo: string;
  status?: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

export function InvoiceDetailActions({
  invoiceId,
  invoiceNo,
  status,
  contactEmail,
  contactPhone,
}: InvoiceDetailActionsProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const [currentStatus, setCurrentStatus] = React.useState(status ?? 'draft');
  const [, startTransition] = React.useTransition();

  const [emailOpen, setEmailOpen] = React.useState(false);
  const [whatsAppOpen, setWhatsAppOpen] = React.useState(false);
  const [markPaidOpen, setMarkPaidOpen] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  React.useEffect(() => setCurrentStatus(status ?? 'draft'), [status]);

  const moveTo = (next: string) => {
    if (next === currentStatus) return;
    const prev = currentStatus;
    setCurrentStatus(next);
    startTransition(async () => {
      const res = await updateInvoiceStatus(invoiceId, next);
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
        <Link href={`/dashboard/crm/sales/invoices/${invoiceId}/edit`}>
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
        <Mail className="h-3.5 w-3.5" /> Send
      </Button>

      <Button size="sm" variant="outline" onClick={() => setMarkPaidOpen(true)}>
        <Banknote className="h-3.5 w-3.5" /> Mark paid
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/sales/receipts/new?fromKind=invoice&fromId=${invoiceId}`}
        >
          <Receipt className="h-3.5 w-3.5" /> Record payment
        </Link>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/sales/credit-notes/new?fromKind=invoice&fromId=${invoiceId}`}
        >
          <FileMinus className="h-3.5 w-3.5" /> Convert to credit note
        </Link>
      </Button>

      <Button size="sm" variant="outline" onClick={() => setWhatsAppOpen(true)}>
        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
      </Button>

      <Button size="sm" variant="outline" asChild>
        <a
          href={`/dashboard/crm/sales/invoices/${invoiceId}?print=1`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Printer className="h-3.5 w-3.5" /> Print
        </a>
      </Button>

      <Button size="sm" variant="outline" asChild>
        <Link
          href={`/dashboard/crm/sales/invoices/new?fromKind=invoice&fromId=${invoiceId}`}
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
        <Link href={`/dashboard/crm/sales/invoices/${invoiceId}/activity`}>
          <Activity className="h-3.5 w-3.5" /> Activity
        </Link>
      </Button>

      <InvoiceEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        invoiceId={invoiceId}
        invoiceNo={invoiceNo}
        initialTo={contactEmail ?? ''}
      />
      <InvoiceWhatsAppDialog
        open={whatsAppOpen}
        onOpenChange={setWhatsAppOpen}
        invoiceId={invoiceId}
        invoiceNo={invoiceNo}
        initialPhone={contactPhone ?? ''}
      />
      <InvoiceMarkPaidDialog
        open={markPaidOpen}
        onOpenChange={setMarkPaidOpen}
        invoiceId={invoiceId}
      />
      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title="Archive this invoice?"
        description="The invoice is marked cancelled and hidden from default views. You can restore it later."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={async () => {
          const res = await updateInvoiceStatus(invoiceId, 'cancelled');
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
        title="Delete this invoice?"
        description="This permanently removes the invoice. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={async () => {
          const res = await deleteInvoiceAction(invoiceId);
          if (res.success) {
            toast({ title: 'Deleted' });
            router.push('/dashboard/crm/sales/invoices');
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
