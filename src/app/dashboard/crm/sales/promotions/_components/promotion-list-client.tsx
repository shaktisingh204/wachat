'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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
 * Deep-list client for CRM Promotions — KPI strip, filter row, bulk-bar,
 * CSV/XLSX export, search debounce → URL, multi-row selection, delete
 * confirmation. Mirrors the patterns of `<PaymentReceiptListClient>` /
 * `<SalesOrdersListClient>`.
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  bulkDeletePromotions,
  bulkSetPromotionStatus,
  deletePromotion,
  type CrmPromotionDoc,
  type CrmPromotionStatus,
  type CrmPromotionType,
  type PromotionKpis,
} from '@/app/actions/crm-promotions.actions';
import { dateStamp, downloadCsv, downloadXlsx } from '@/lib/crm-list-export';

interface PromotionListClientProps {
  promotions: CrmPromotionDoc[];
  page: number;
  limit: number;
  hasMore: boolean;
  initialQuery: string;
  initialStatus: string;
  initialType: string;
  initialDateFrom: string;
  initialDateTo: string;
  kpis: PromotionKpis;
  error?: string;
}

function fmtDate(v?: string): string {
  if (!v) return '—';
  const d = new Date(v);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function fmtValue(row: CrmPromotionDoc): string {
  if (row.type === 'percent') return `${row.value ?? 0}%`;
  if (row.type === 'free_shipping') return 'Free shipping';
  if (row.type === 'buy_x_get_y') return 'Buy X get Y';
  if (typeof row.value === 'number') return row.value.toLocaleString();
  return '—';
}

const STATUS_OPTIONS: { value: '' | CrmPromotionStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

const TYPE_OPTIONS: { value: '' | CrmPromotionType; label: string }[] = [
  { value: '', label: 'All types' },
  { value: 'flat', label: 'Flat' },
  { value: 'percent', label: 'Percent' },
  { value: 'buy_x_get_y', label: 'Buy X get Y' },
  { value: 'free_shipping', label: 'Free shipping' },
];

const STATUS_TONES: Record<CrmPromotionStatus, 'info' | 'success' | 'warning' | 'ghost' | 'destructive'> = {
  draft: 'ghost',
  scheduled: 'info',
  active: 'success',
  paused: 'warning',
  expired: 'destructive',
  archived: 'ghost',
};

interface KpiCardProps {
  label: string;
  value: string;
  tone: 'neutral' | 'amber' | 'green' | 'red';
}

function KpiCard({ label, value, tone }: KpiCardProps) {
  const ring =
    tone === 'amber'
      ? 'border-[var(--st-border)]/40'
      : tone === 'green'
        ? 'border-[var(--st-border)]/40'
        : tone === 'red'
          ? 'border-[var(--st-border)]/40'
          : 'border-[var(--st-border)]';
  return (
    <div
      className={`flex flex-1 flex-col gap-1 rounded-md border bg-[var(--st-bg-muted)] px-3 py-2.5 ${ring}`}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        {label}
      </span>
      <span className="text-[18px] font-semibold tabular-nums text-[var(--st-text)]">
        {value}
      </span>
    </div>
  );
}

export function PromotionListClient({
  promotions,
  page,
  limit,
  hasMore,
  initialQuery,
  initialStatus,
  initialType,
  initialDateFrom,
  initialDateTo,
  kpis,
  error,
}: PromotionListClientProps) {
  const { toast } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [query, setQuery] = React.useState(initialQuery);
  const [pendingDelete, setPendingDelete] =
    React.useState<CrmPromotionDoc | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);
  const [busy, startBusy] = React.useTransition();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

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

  const allIds = React.useMemo(
    () => promotions.map((p) => String(p._id)),
    [promotions],
  );
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

  function confirmDelete() {
    if (!pendingDelete?._id) return;
    const id = String(pendingDelete._id);
    const label = pendingDelete.name || id;
    startBusy(async () => {
      const res = await deletePromotion(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        router.refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  function confirmBulkDelete() {
    if (selected.size === 0) return;
    startBusy(async () => {
      const res = await bulkDeletePromotions(Array.from(selected));
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

  function bulkStatus(next: CrmPromotionStatus) {
    if (selected.size === 0) return;
    startBusy(async () => {
      const res = await bulkSetPromotionStatus(Array.from(selected), next);
      toast({
        title: `Updated ${res.processed}`,
        description: res.error ?? `Status → ${next}.`,
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      router.refresh();
    });
  }

  function makeExportRows() {
    return promotions
      .filter((r) => selected.has(String(r._id)))
      .map((r) => ({
        name: r.name ?? '',
        code: r.code ?? '',
        type: r.type ?? '',
        value: r.value ?? '',
        min_cart: r.minCart ?? '',
        max_uses: r.maxUses ?? '',
        used_count: r.usedCount ?? 0,
        valid_from: r.validFrom ?? '',
        valid_to: r.validTo ?? '',
        status: r.status ?? '',
      }));
  }

  function bulkExportCsv() {
    const rows = makeExportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows first.' });
      return;
    }
    const headers = Object.keys(rows[0]!);
    downloadCsv(`promotions-${dateStamp()}.csv`, headers, rows);
    toast({ title: 'Exported', description: `${rows.length} promotions saved to CSV.` });
  }

  function bulkExportXlsx() {
    const rows = makeExportRows();
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows first.' });
      return;
    }
    const headers = Object.keys(rows[0]!);
    void downloadXlsx(
      `promotions-${dateStamp()}.xlsx`,
      headers,
      rows,
      'Promotions',
    );
  }

  const hasActive =
    !!initialStatus || !!initialType || !!initialDateFrom || !!initialDateTo;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <KpiCard
          label="Total active"
          value={kpis.totalActive.toLocaleString()}
          tone="green"
        />
        <KpiCard
          label="Expiring this week"
          value={kpis.expiringThisWeek.toLocaleString()}
          tone="amber"
        />
        <KpiCard
          label="Total redemptions"
          value={kpis.totalRedemptions.toLocaleString()}
          tone="neutral"
        />
        <KpiCard
          label="Avg discount %"
          value={`${kpis.avgDiscountPct}%`}
          tone="neutral"
        />
      </div>

      <Card className="overflow-hidden p-0">
        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, code, description…"
              className="h-9 pl-9 text-[13px]"
            />
          </div>
          <Select
            value={initialStatus || '__all'}
            onValueChange={(v) =>
              pushParams({ status: v === '__all' ? undefined : v, page: '1' })
            }
          >
            <SelectTrigger className="h-9 w-[150px] text-[13px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((o) => (
                <SelectItem key={o.value || '__all'} value={o.value || '__all'}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={initialType || '__all'}
            onValueChange={(v) =>
              pushParams({ type: v === '__all' ? undefined : v, page: '1' })
            }
          >
            <SelectTrigger className="h-9 w-[160px] text-[13px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              {TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value || '__all'} value={o.value || '__all'}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <details className="relative">
            <summary className="list-none">
              <Button variant="outline" size="sm" className="h-9 text-[12.5px]">
                <CalendarRange className="h-3.5 w-3.5" /> Validity range
              </Button>
            </summary>
            <div className="absolute right-0 z-20 mt-2 grid w-[280px] gap-2 rounded-md border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3 shadow-md">
              <label className="text-[11px] text-[var(--st-text-secondary)]">Valid from</label>
              <Input
                type="date"
                value={initialDateFrom}
                onChange={(e) =>
                  pushParams({ dateFrom: e.target.value || undefined, page: '1' })
                }
                className="h-8 text-[12.5px]"
              />
              <label className="text-[11px] text-[var(--st-text-secondary)]">Valid to</label>
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
              className="ml-auto text-[12px] text-[var(--st-text-secondary)]"
            >
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </div>

        {error ? (
          <div className="flex items-center gap-2 border-b border-[var(--st-border)]/40 bg-[var(--st-text)]/10 px-4 py-2.5 text-[13px] text-[var(--st-text)]">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : null}

        {/* Bulk-action bar */}
        {selected.size > 0 ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px]">
            <span className="font-medium text-[var(--st-text)]">{selected.size} selected</span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
            <span className="mx-1 h-4 w-px bg-[var(--st-border)]" />
            <Select onValueChange={(v) => bulkStatus(v as CrmPromotionStatus)}>
              <SelectTrigger className="h-8 w-[150px] text-[12px]">
                <SelectValue placeholder="Change status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Activate</SelectItem>
                <SelectItem value="paused">Pause</SelectItem>
                <SelectItem value="archived">Archive</SelectItem>
                <SelectItem value="expired">Expire</SelectItem>
              </SelectContent>
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
              className="text-[var(--st-danger)]"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        ) : null}

        <Table>
          <THead>
            <Tr>
              <Th className="w-[36px]">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleAll}
                  aria-label="Select all"
                />
              </Th>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Type</Th>
              <Th className="text-right">Value</Th>
              <Th>Valid window</Th>
              <Th className="text-right">Used</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </Tr>
          </THead>
          <TBody>
            {promotions.length === 0 ? (
              <Tr>
                <Td colSpan={9} className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]">
                  {initialQuery || hasActive
                    ? 'No promotions match these filters.'
                    : 'No promotions yet — click "New promotion" to add one.'}
                </Td>
              </Tr>
            ) : (
              promotions.map((row) => {
                const id = String(row._id);
                const isSelected = selected.has(id);
                const tone = STATUS_TONES[row.status] ?? 'ghost';
                return (
                  <Tr key={id} data-state={isSelected ? 'selected' : undefined}>
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleOne(id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </Td>
                    <Td>
                      <EntityRowLink
                        href={`/dashboard/crm/sales/promotions/${id}`}
                        label={row.name || '—'}
                        subtitle={row.description ?? undefined}
                      />
                    </Td>
                    <Td className="text-[12.5px] font-mono text-[var(--st-text-secondary)]">
                      {row.code ?? '—'}
                    </Td>
                    <Td>
                      <Badge variant="outline">{row.type}</Badge>
                    </Td>
                    <Td className="text-right text-[12.5px] tabular-nums text-[var(--st-text)]">
                      {fmtValue(row)}
                    </Td>
                    <Td className="text-[12.5px] text-[var(--st-text-secondary)]">
                      {fmtDate(row.validFrom)} → {fmtDate(row.validTo)}
                    </Td>
                    <Td className="text-right text-[12.5px] tabular-nums text-[var(--st-text-secondary)]">
                      {(row.usedCount ?? 0).toLocaleString()}
                      {row.maxUses ? ` / ${row.maxUses}` : ''}
                    </Td>
                    <Td>
                      <Badge variant={tone}>{row.status}</Badge>
                    </Td>
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/sales/promotions/${id}/edit`}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPendingDelete(row)}
                          className="text-[var(--st-danger)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </Td>
                  </Tr>
                );
              })
            )}
          </TBody>
        </Table>

        <PaginationBar page={page} limit={limit} hasMore={hasMore} />
      </Card>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete promotion?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.name ?? ''}</strong>{' '}
              from the database. The action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
              disabled={busy}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} promotions?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected promotions. The action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmBulkDelete();
              }}
              disabled={busy}
              className="bg-[var(--st-danger)] text-white hover:bg-[var(--st-danger)]/90"
            >
              {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : null}
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
