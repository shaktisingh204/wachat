'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, useToast } from '@/components/sabcrm/20ui/compat';
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
  const { toast } = useToast();
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
            <Button asChild variant="outline">
              <Link href="/dashboard/crm/sales/proposals/templates">
                Proposal Templates
              </Link>
            </Button>
            <Button asChild>
              <Link href="/dashboard/crm/sales/estimates-templates/new">
                <Plus className="h-4 w-4" /> New Template
              </Link>
            </Button>
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="font-medium text-[var(--st-text)]">{selected.size} selected</span>
              <Button size="sm" variant="outline" onClick={bulkArchive} disabled={busy}>
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExportCsv}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-[var(--st-danger)]"
                onClick={() => setPendingBulkDelete(true)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={clearSelection}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
      >
        <Card className="overflow-hidden p-0">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[var(--st-border)] p-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or title…"
                className="h-9 pl-9 text-[13px]"
              />
            </div>
            <Select
              value={statusFilter || '__all'}
              onValueChange={(v) => setStatusFilter(v === '__all' ? '' : v)}
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
            {hasActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter('')}
                className="text-[12px] text-[var(--st-text-secondary)]"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>

          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-[36px]">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </Th>
                <Th className="text-[var(--st-text-secondary)]">Name</Th>
                <Th className="text-[var(--st-text-secondary)]">Title</Th>
                <Th className="text-[var(--st-text-secondary)]">Currency</Th>
                <Th className="text-right text-[var(--st-text-secondary)]">Total</Th>
                <Th className="text-[var(--st-text-secondary)]">Status</Th>
                <Th className="w-24" />
              </Tr>
            </THead>
            <TBody>
              {isLoading ? (
                <Tr>
                  <Td colSpan={7} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-[var(--st-text-secondary)]" />
                  </Td>
                </Tr>
              ) : filtered.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={7}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {hasActive || query
                      ? 'No templates match these filters.'
                      : 'No estimate templates yet.'}
                  </Td>
                </Tr>
              ) : (
                filtered.map((t) => {
                  const isSelected = selected.has(t._id);
                  const statusValue = (t as Row & { status?: string }).status;
                  return (
                    <Tr
                      key={t._id}
                      className="border-[var(--st-border)]"
                      data-state={isSelected ? 'selected' : undefined}
                    >
                      <Td>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(t._id)}
                          aria-label={`Select ${t.name}`}
                        />
                      </Td>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/sales/estimates-templates/${t._id}`}
                          label={t.name || '—'}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        {t.title || '—'}
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        {t.currency || '—'}
                      </Td>
                      <Td className="text-right text-[13px] text-[var(--st-text)]">
                        {fmtCurrency(t.total, t.currency)}
                      </Td>
                      <Td>
                        {statusValue ? (
                          <Badge
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
                          </Badge>
                        ) : null}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={`/dashboard/crm/sales/estimates-templates/${t._id}/edit`}>
                              Edit
                            </Link>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-[var(--st-danger)]"
                            onClick={() => setPendingDelete(t)}
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
        </Card>
      </EntityListShell>

      {/* Single delete */}
      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete template?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <strong>{pendingDelete?.name ?? ''}</strong>.
              The action cannot be undone.
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

      {/* Bulk delete */}
      <AlertDialog
        open={pendingBulkDelete}
        onOpenChange={(o) => !o && setPendingBulkDelete(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} templates?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected estimate templates.
              The action cannot be undone.
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
    </>
  );
}
