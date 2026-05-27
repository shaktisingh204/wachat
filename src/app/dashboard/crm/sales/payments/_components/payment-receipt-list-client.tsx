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
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
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
  usePathname,
} from 'next/navigation';
import {
  AlertCircle,
  CalendarRange,
  Download,
  LoaderCircle,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Deep-list client for Payment Receipts — KPI strip, filter row,
 * bulk-bar, CSV/XLSX export, search debounce → URL, multi-row selection,
 * delete confirmation. Server component re-fetches on URL change.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityPicker, EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkPaymentReceiptAction,
  deletePaymentReceiptAction,
  setPaymentReceiptStatus,
  type PaymentReceiptKpis,
} from '@/app/actions/crm/payment-receipts.actions';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';
import type {
  CrmPaymentReceiptDoc,
  CrmReceiptStatus,
} from '@/lib/rust-client/crm-payment-receipts';

interface PaymentReceiptListClientProps {
  receipts: CrmPaymentReceiptDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  initialClientId: string;
  initialMode: string;
  initialDateFrom: string;
  initialDateTo: string;
  kpis: PaymentReceiptKpis;
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

function fmtMoneyShort(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      notation: value >= 100_000 ? 'compact' : 'standard',
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

const STATUS_OPTIONS: { value: '' | CrmReceiptStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'received', label: 'Received' },
  { value: 'cleared', label: 'Cleared' },
  { value: 'bounced', label: 'Bounced' },
];

const MODE_OPTIONS: { value: ''; label: string }[] | { value: string; label: string }[] = [
  { value: '', label: 'All methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'card', label: 'Card' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'other', label: 'Other' },
];

interface KpiCardProps {
  label: string;
  value: string;
  tone: 'neutral' | 'amber' | 'green' | 'red';
}

function KpiCard({ label, value, tone }: KpiCardProps) {
  const ring =
    tone === 'amber'
      ? 'border-zoru-line/40'
      : tone === 'green'
        ? 'border-zoru-line/40'
        : tone === 'red'
          ? 'border-zoru-line/40'
          : 'border-zoru-line';
  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-md border bg-zoru-surface-2 px-3 py-2.5 ${ring}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-zoru-ink-muted">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-zoru-ink">
        {value}
      </span>
    </div>
  );
}

export function PaymentReceiptListClient({
  receipts,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  initialClientId,
  initialMode,
  initialDateFrom,
  initialDateTo,
  kpis,
  error,
}: PaymentReceiptListClientProps) {
  const { toast } = useZoruToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmPaymentReceiptDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  // Debounce search → URL.
  React.useEffect(() => {
    if (query === initialQuery) return;
    const t = setTimeout(() => {
      pushParams({ q: query.trim() || undefined, page: '1' });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function pushParams(updates: Record<string, string | undefined>) {
    const params = new URLSearchParams(sp?.toString() ?? '');
    for (const [k, v] of Object.entries(updates)) {
      if (v == null || v === '') params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAllFilters() {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  const allIds = React.useMemo(() => receipts.map((r) => String(r._id)), [receipts]);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  const confirmDelete = () => {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.receiptNo || id;
    startBusy(async () => {
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

  function confirmBulkDelete() {
    if (selected.size === 0) return;
    startBusy(async () => {
      const res = await bulkPaymentReceiptAction(Array.from(selected), 'delete');
      toast({
        title: `Deleted ${res.processed}`,
        description: res.error ?? 'Selection removed.',
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      router.refresh();
    });
  }

  function bulkStatus(next: CrmReceiptStatus) {
    if (selected.size === 0) return;
    startBusy(async () => {
      let ok = 0;
      let fail = 0;
      for (const id of selected) {
        const res = await setPaymentReceiptStatus(id, next);
        if (res.success) ok++;
        else fail++;
      }
      toast({
        title: `Updated ${ok}`,
        description: fail > 0 ? `${fail} failed.` : `Status → ${next}.`,
        variant: fail > 0 ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });
  }

  function bulkExportCsv() {
    const sel = receipts.filter((r) => selected.has(String(r._id)));
    if (sel.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows first.' });
      return;
    }
    const headers = [
      'receipt_no',
      'date',
      'client_id',
      'mode',
      'reference',
      'txn_id',
      'amount',
      'currency',
      'status',
    ];
    const rows = sel.map((r) => ({
      receipt_no: r.receiptNo ?? '',
      date: r.date ?? '',
      client_id: r.clientId ?? '',
      mode: r.mode ?? '',
      reference: r.reference ?? '',
      txn_id: r.txnId ?? '',
      amount: r.amount ?? '',
      currency: r.currency ?? '',
      status: r.status ?? '',
    }));
    downloadCsv(`payment-receipts-${dateStamp()}.csv`, headers, rows);
    toast({ title: 'Exported', description: `${sel.length} receipts saved to CSV.` });
  }

  function bulkExportXlsx() {
    const sel = receipts.filter((r) => selected.has(String(r._id)));
    if (sel.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows first.' });
      return;
    }
    const headers = [
      'receipt_no',
      'date',
      'client_id',
      'mode',
      'reference',
      'txn_id',
      'amount',
      'currency',
      'status',
    ];
    const rows = sel.map((r) => ({
      receipt_no: r.receiptNo ?? '',
      date: r.date ?? '',
      client_id: r.clientId ?? '',
      mode: r.mode ?? '',
      reference: r.reference ?? '',
      txn_id: r.txnId ?? '',
      amount: r.amount ?? '',
      currency: r.currency ?? '',
      status: r.status ?? '',
    }));
    void downloadXlsx(
      `payment-receipts-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Receipts',
    );
  }

  const hasActive =
    !!initialStatus ||
    !!initialClientId ||
    !!initialMode ||
    !!initialDateFrom ||
    !!initialDateTo;

  return (
    <div className="flex flex-col gap-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Received MTD"
          value={fmtMoneyShort(kpis.receivedThisMonthTotal, kpis.currency)}
          tone="green"
        />
        <KpiCard
          label="Pending"
          value={kpis.pendingCount.toLocaleString()}
          tone="amber"
        />
        <KpiCard
          label="Failed"
          value={kpis.failedCount.toLocaleString()}
          tone="red"
        />
        <KpiCard
          label="Top method"
          value={kpis.topMethod}
          tone="neutral"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by receipt #, reference, txn id…"
              className="h-9 pl-9 text-[13px]"
            />
          </div>
          <Select
            value={initialStatus || '__all'}
            onValueChange={(v) =>
              pushParams({ status: v === '__all' ? undefined : v, page: '1' })
            }
          >
            <ZoruSelectTrigger className="h-9 w-[150px] text-[13px]">
              <ZoruSelectValue placeholder="Status" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {STATUS_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value || '__all'} value={o.value || '__all'}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <Select
            value={initialMode || '__all'}
            onValueChange={(v) =>
              pushParams({ mode: v === '__all' ? undefined : v, page: '1' })
            }
          >
            <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
              <ZoruSelectValue placeholder="Method" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              {MODE_OPTIONS.map((o) => (
                <ZoruSelectItem key={o.value || '__all'} value={o.value || '__all'}>
                  {o.label}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
          <div className="w-[200px]">
            <EntityPicker
              entity="client"
              value={initialClientId || null}
              placeholder="Customer…"
              onChange={(next) => {
                const id = Array.isArray(next) ? (next[0] ?? '') : (next ?? '');
                pushParams({ clientId: id || undefined, page: '1' });
              }}
            />
          </div>
          <details className="relative">
            <summary className="list-none">
              <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                <CalendarRange className="h-3.5 w-3.5" /> Date range
              </Button>
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-zoru-line bg-zoru-surface p-3 shadow-md">
              <label className="text-[11px] text-zoru-ink-muted">From</label>
              <Input
                type="date"
                value={initialDateFrom}
                onChange={(e) =>
                  pushParams({ dateFrom: e.target.value || undefined, page: '1' })
                }
                className="h-8 text-[12.5px]"
              />
              <label className="text-[11px] text-zoru-ink-muted">To</label>
              <Input
                type="date"
                value={initialDateTo}
                onChange={(e) =>
                  pushParams({ dateTo: e.target.value || undefined, page: '1' })
                }
                className="h-8 text-[12.5px]"
              />
            </div>
          </details>
          {hasActive ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="ml-auto text-[12px] text-zoru-ink-muted"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-center gap-2 border-b border-zoru-line/40 bg-zoru-ink/10 px-4 py-2.5 text-[13px] text-zoru-ink">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Bulk-action bar */}
        {selected.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-zoru-line bg-zoru-surface px-3 py-2 text-[12.5px]">
            <span className="font-medium text-zoru-ink">{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
            <span className="mx-1 h-4 w-px bg-zoru-line" />
            <Select onValueChange={(v) => bulkStatus(v as CrmReceiptStatus)}>
              <ZoruSelectTrigger className="h-8 w-[150px] text-[12px]">
                <ZoruSelectValue placeholder="Change status…" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="received">Received</ZoruSelectItem>
                <ZoruSelectItem value="cleared">Cleared</ZoruSelectItem>
                <ZoruSelectItem value="bounced">Bounced</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={bulkExportCsv}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={bulkExportXlsx}>
              <Download className="h-3.5 w-3.5" /> Export XLSX
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPendingBulkDelete(true)}
              className="text-zoru-danger-ink"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        ) : null}

        <Table>
          <ZoruTableHeader>
            <ZoruTableRow>
              <ZoruTableHead className="w-[36px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </ZoruTableHead>
              <ZoruTableHead>Receipt #</ZoruTableHead>
              <ZoruTableHead>Customer</ZoruTableHead>
              <ZoruTableHead>Date</ZoruTableHead>
              <ZoruTableHead>Method</ZoruTableHead>
              <ZoruTableHead>Reference</ZoruTableHead>
              <ZoruTableHead className="text-right">Amount</ZoruTableHead>
              <ZoruTableHead>Status</ZoruTableHead>
              <ZoruTableHead className="text-right">Actions</ZoruTableHead>
            </ZoruTableRow>
          </ZoruTableHeader>
          <ZoruTableBody>
            {receipts.length === 0 ? (
              <ZoruTableRow>
                <ZoruTableCell colSpan={9} className="h-24 text-center text-[13px] text-zoru-ink-muted">
                  {initialQuery || hasActive
                    ? 'No payment receipts match these filters.'
                    : 'No payment receipts yet — click "New receipt" to add one.'}
                </ZoruTableCell>
              </ZoruTableRow>
            ) : (
              receipts.map((receipt) => {
                const id = String(receipt._id);
                const isSelected = selected.has(id);
                return (
                  <ZoruTableRow key={id} data-state={isSelected ? 'selected' : undefined}>
                    <ZoruTableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select ${receipt.receiptNo}`}
                      />
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/payments/${id}`}
                        label={receipt.receiptNo || id}
                        subtitle={fmtDate(receipt.date)}
                      />
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
                      <Badge variant="outline">{receipt.mode}</Badge>
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
                    <ZoruTableCell className="text-right text-[12.5px] tabular-nums text-zoru-ink">
                      {fmtMoney(receipt.amount, receipt.currency)}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      {receipt.status ? (
                        <Badge variant="outline">{receipt.status}</Badge>
                      ) : (
                        <span className="text-[12.5px] text-zoru-ink-muted">—</span>
                      )}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/sales/payments/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(receipt)}
                          className="text-zoru-danger-ink"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </ZoruTableCell>
                  </ZoruTableRow>
                );
              })
            )}
          </ZoruTableBody>
        </Table>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </Card>

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
            <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={busy}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <ZoruAlertDialog
        open={pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {selected.size} payment receipts?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the selected receipts. The action
              cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel disabled={busy}>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkDelete();
              }}
              disabled={busy}
              className="bg-zoru-danger text-white hover:bg-zoru-danger/90"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </div>
  );
}
