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
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import Link from 'next/link';
import {
  Archive,
  Download,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import {
  bulkArchiveEstimateTemplates,
  bulkDeleteEstimateTemplates,
  deleteEstimateTemplate,
  getEstimateTemplates,
} from '@/app/actions/worksuite/proposals.actions';
import type { WsEstimateTemplate } from '@/lib/worksuite/proposals-types';
import { dateStamp, downloadCsv } from '@/lib/crm-list-export';

type Row = WsEstimateTemplate & { _id: string };

type TemplateStatus = 'active' | 'draft' | 'archived';

const STATUS_OPTIONS: { value: '' | TemplateStatus; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

function fmtCurrency(v: number, currency?: string): string {
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
    }).format(v || 0);
  } catch {
    return `${currency || ''} ${(v || 0).toFixed(2)}`;
  }
}

function matchesSearch(row: Row, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (row.name ?? '').toLowerCase().includes(lower) ||
    (row.title ?? '').toLowerCase().includes(lower)
  );
}

export default function EstimateTemplatesPage() {
  const { toast } = useZoruToast();
  const [allRows, setAllRows] = React.useState<Row[]>([]);
  const [isLoading, startLoading] = React.useTransition();
  const [busy, startBusy] = React.useTransition();

  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState('');

  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<Row | null>(null);
  const [pendingBulkDelete, setPendingBulkDelete] = React.useState(false);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const rows = await getEstimateTemplates();
      setAllRows(rows);
    });
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = React.useMemo(() => {
    return allRows.filter((r) => {
      if (!matchesSearch(r, query)) return false;
      if (statusFilter && (r as Row & { status?: string }).status !== statusFilter) return false;
      return true;
    });
  }, [allRows, query, statusFilter]);

  const allIds = React.useMemo(() => filtered.map((r) => r._id), [filtered]);
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
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    const label = pendingDelete.name || id;
    startBusy(async () => {
      const res = await deleteEstimateTemplate(id);
      if (res.success) {
        toast({ title: 'Deleted', description: `${label} removed.` });
        setPendingDelete(null);
        refresh();
      } else {
        toast({ title: 'Delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }

  function confirmBulkDelete() {
    if (selected.size === 0) return;
    startBusy(async () => {
      const res = await bulkDeleteEstimateTemplates(Array.from(selected));
      toast({
        title: `Deleted ${res.processed}`,
        description: res.error ?? 'Selected templates removed.',
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      setPendingBulkDelete(false);
      refresh();
    });
  }

  function bulkArchive() {
    if (selected.size === 0) return;
    startBusy(async () => {
      const res = await bulkArchiveEstimateTemplates(Array.from(selected));
      toast({
        title: `Archived ${res.processed}`,
        description: res.error ?? 'Selected templates archived.',
        variant: res.error ? 'destructive' : undefined,
      });
      clearSelection();
      refresh();
    });
  }

  function bulkExportCsv() {
    const rows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
    if (rows.length === 0) {
      toast({ title: 'Nothing to export', description: 'Select rows first.' });
      return;
    }
    const headers = ['id', 'name', 'title', 'currency', 'total'];
    const exportRows = rows.map((r) => ({
      id: r._id,
      name: r.name ?? '',
      title: r.title ?? '',
      currency: r.currency ?? '',
      total: r.total ?? 0,
    }));
    downloadCsv(`estimate-templates-${dateStamp()}.csv`, headers, exportRows);
    toast({ title: 'Exported', description: `${rows.length} templates saved to CSV.` });
  }

  const hasActive = Boolean(statusFilter);

  return (
    <>
      <EntityListShell
        title="Estimate Templates"
        subtitle="Reusable estimate templates for quick quoting."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton asChild variant="outline">
              <Link href="/dashboard/crm/sales/proposals/templates">
                Proposal Templates
              </Link>
            </ZoruButton>
            <ZoruButton asChild>
              <Link href="/dashboard/crm/sales/estimates-templates/new">
                <Plus className="h-4 w-4" /> New Template
              </Link>
            </ZoruButton>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-zoru-ink">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" onClick={bulkArchive} disabled={busy}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" onClick={bulkExportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="ghost"
                className="text-zoru-danger-ink"
                onClick={() => setPendingBulkDelete(true)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            </div>
          ) : null
        }
      >
        <ZoruCard className="overflow-hidden p-0">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-zoru-line p-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
              <ZoruInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or title…"
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <ZoruSelect
              value={statusFilter || '__all'}
              onValueChange={(v) => setStatusFilter(v === '__all' ? '' : v)}
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
            </ZoruSelect>
            {hasActive ? (
              <ZoruButton
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('')}
                className="text-[12px] text-zoru-ink-muted"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </ZoruButton>
            ) : null}
          </div>

          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-[36px]">
                  <ZoruCheckbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Title</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Currency</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Total</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="w-24" />
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow>
                  <ZoruTableCell colSpan={7} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {hasActive || query
                      ? 'No templates match these filters.'
                      : 'No estimate templates yet.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((t) => {
                  const isSelected = selected.has(t._id);
                  const statusValue = (t as Row & { status?: string }).status;
                  return (
                    <ZoruTableRow
                      key={t._id}
                      className="border-zoru-line"
                      data-state={isSelected ? 'selected' : undefined}
                    >
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(t._id)}
                          aria-label={`Select ${t.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/sales/estimates-templates/${t._id}`}
                          label={t.name || '—'}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {t.title || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {t.currency || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right text-[13px] text-zoru-ink">
                        {fmtCurrency(t.total, t.currency)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {statusValue ? (
                          <ZoruBadge
                            variant={
                              statusValue === 'archived'
                                ? 'ghost'
                                : statusValue === 'draft'
                                  ? 'warning'
                                  : 'success'
                            }
                            className="capitalize"
                          >
                            {statusValue}
                          </ZoruBadge>
                        ) : null}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ZoruButton size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/sales/estimates-templates/${t._id}/edit`}>
                              Edit
                            </Link>
                          </ZoruButton>
                          <ZoruButton
                            size="sm"
                            variant="ghost"
                            className="text-zoru-danger-ink"
                            onClick={() => setPendingDelete(t)}
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
        </ZoruCard>
      </EntityListShell>

      {/* Single delete */}
      <ZoruAlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete template?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.name ?? ''}</strong>.
              The action cannot be undone.
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

      {/* Bulk delete */}
      <ZoruAlertDialog
        open={pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {selected.size} templates?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the selected estimate templates.
              The action cannot be undone.
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
    </>
  );
}
