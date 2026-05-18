'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter,
  useSearchParams,
  usePathname } from 'next/navigation';
import {
  AlertCircle,
  Pencil,
  Search,
  Trash2,
  LoaderCircle,
  } from 'lucide-react';

/**
 * Client side of the Payment Receipts list — owns the search box, the
 * table, and the hard-delete confirmation dialog. Search input is
 * debounced and writes back to the URL so the server component
 * re-fetches.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPickerChip } from '@/components/crm/entity-picker';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { deletePaymentReceiptAction } from '@/app/actions/crm/payment-receipts.actions';
import type { CrmPaymentReceiptDoc } from '@/lib/rust-client/crm-payment-receipts';

interface PaymentReceiptListClientProps {
  receipts: CrmPaymentReceiptDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  error?: string;
}

function fmtMoney(value?: number, currency?: string): string {
  if (typeof value !== 'number') return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency || 'INR'} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function PaymentReceiptListClient({
  receipts,
  page,
  limit,
  hasMore,
  initialQuery,
  error,
}: PaymentReceiptListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmPaymentReceiptDoc | null>(null);
  const [deleting, startDelete] = React.useTransition();

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(sp?.toString() ?? '');
      if (query.trim()) params.set('q', query.trim());
      else params.delete('q');
      params.set('page', '1');
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    }, 300);
    return () => clearTimeout(t);
  }, [query, initialQuery, sp, pathname, router]);

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.receiptNo || id;
    startDelete(async () => {
      const res = await deletePaymentReceiptAction(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  };

  return (
    <ZoruCard className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zoru-line p-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by receipt #, reference, txn id…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-[13px] text-amber-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <ZoruTable>
        <ZoruTableHeader>
          <ZoruTableRow>
            <ZoruTableHead>Receipt #</ZoruTableHead>
            <ZoruTableHead>Customer</ZoruTableHead>
            <ZoruTableHead>Date</ZoruTableHead>
            <ZoruTableHead>Method</ZoruTableHead>
            <ZoruTableHead>Reference</ZoruTableHead>
            <ZoruTableHead>Amount</ZoruTableHead>
            <ZoruTableHead>Status</ZoruTableHead>
            <ZoruTableHead className="text-right">Actions</ZoruTableHead>
          </ZoruTableRow>
        </ZoruTableHeader>
        <ZoruTableBody>
          {receipts.length === 0 ? (
            <ZoruTableRow>
              <ZoruTableCell colSpan={8} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                {initialQuery
                  ? 'No payment receipts match this search.'
                  : 'No payment receipts yet — click "New receipt" to add one.'}
              </ZoruTableCell>
            </ZoruTableRow>
          ) : (
            receipts.map((receipt) => {
              const id = String(receipt._id);
              return (
                <ZoruTableRow key={id}>
                  <ZoruTableCell>
                    <Link
                      href={`/dashboard/crm/sales/payments/${id}`}
                      className="font-medium text-zoru-ink hover:underline"
                    >
                      {receipt.receiptNo || id}
                    </Link>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {receipt.clientId ? (
                      <EntityPickerChip entity="client" id={receipt.clientId} />
                    ) : (
                      '—'
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    {fmtDate(receipt.date)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    <ZoruBadge variant="outline">{receipt.mode}</ZoruBadge>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] text-zoru-ink-muted">
                    <div className="flex flex-col">
                      {receipt.reference ? <span>{receipt.reference}</span> : null}
                      {receipt.txnId ? (
                        <span className="font-mono text-[11.5px]">{receipt.txnId}</span>
                      ) : null}
                      {receipt.chequeNo ? <span>Cheque {receipt.chequeNo}</span> : null}
                      {!receipt.reference && !receipt.txnId && !receipt.chequeNo ? (
                        <span>—</span>
                      ) : null}
                    </div>
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[12.5px] tabular-nums text-zoru-ink">
                    {fmtMoney(receipt.amount, receipt.currency)}
                  </ZoruTableCell>
                  <ZoruTableCell>
                    {receipt.status ? (
                      <ZoruBadge variant="outline">{receipt.status}</ZoruBadge>
                    ) : (
                      <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                    )}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <ZoruButton size="sm" variant="ghost" asChild>
                        <Link href={`/dashboard/crm/sales/payments/${id}/edit`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Link>
                      </ZoruButton>
                      <ZoruButton
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDelete(receipt)}
                        className="text-zoru-danger-ink"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </ZoruButton>
                    </div>
                  </ZoruTableCell>
                </ZoruTableRow>
              );
            })
          )}
        </ZoruTableBody>
      </ZoruTable>

      <PaginationBar page={page} limit={limit} hasMore={hasMore} />

      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete payment receipt?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes receipt{' '}
              <strong>{pendingDelete?.receiptNo ?? ''}</strong> from the
              database. The action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={deleting}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={deleting}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </ZoruCard>
  );
}
