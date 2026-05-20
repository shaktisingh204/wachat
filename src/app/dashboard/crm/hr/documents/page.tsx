'use client';

/**
 * HR Documents — list page.
 *
 * KPI strip: total · verified · pending verification · expiring in 30 days.
 * Bulk: verify (status → verified), archive, delete with confirm.
 * Export: CSV.
 * Keeps existing status + category filters + search.
 */

import * as React from 'react';
import Link from 'next/link';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruButton,
  ZoruCheckbox,
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
import { Download, Edit, LoaderCircle, Plus, Trash2 } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, type StatusTone } from '@/components/crm/status-pill';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  deleteDocument,
  getDocuments,
  getDocumentKpis,
  bulkUpdateDocumentStatus,
  bulkDeleteDocuments,
  type DocumentKpis,
} from '@/app/actions/crm-documents.actions';
import type {
  CrmDocumentCategory,
  CrmDocumentDoc,
  CrmDocumentStatus,
} from '@/lib/rust-client/crm-documents';

const BASE = '/dashboard/crm/hr/documents';

const STATUS_OPTIONS: Array<{ value: CrmDocumentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'expired', label: 'Expired' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'archived', label: 'Archived' },
];

const CATEGORY_OPTIONS: Array<{ value: CrmDocumentCategory | 'all'; label: string }> = [
  { value: 'all', label: 'All categories' },
  { value: 'id_proof', label: 'ID proof' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'experience', label: 'Experience' },
  { value: 'contract', label: 'Contract' },
  { value: 'appointment', label: 'Appointment' },
  { value: 'resignation', label: 'Resignation' },
  { value: 'other', label: 'Other' },
];

const STATUS_TONE: Record<CrmDocumentStatus, StatusTone> = {
  pending: 'amber',
  verified: 'green',
  expired: 'red',
  rejected: 'red',
  archived: 'neutral',
};

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ');
}

function categoryLabel(c?: string): string {
  if (!c) return '—';
  return c.replace(/_/g, ' ');
}

function fmtDate(value: unknown): string {
  if (!value) return '—';
  const d = new Date(value as string);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

/* ─── KPI strip ─────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string | number;
  tone?: 'green' | 'amber' | 'red' | 'blue';
}

function KpiCard({ label, value, tone }: KpiCardProps) {
  const cls: Record<string, string> = {
    green: 'text-green-600',
    amber: 'text-amber-600',
    red: 'text-red-600',
    blue: 'text-blue-600',
  };
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-3">
      <span className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{label}</span>
      <span className={`text-xl font-semibold tabular-nums ${tone ? (cls[tone] ?? '') : 'text-zoru-ink'}`}>
        {value}
      </span>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────── */

type BulkOp = 'verify' | 'archive' | 'delete';

export default function DocumentsListPage() {
  const [documents, setDocuments] = React.useState<CrmDocumentDoc[]>([]);
  const [kpis, setKpis] = React.useState<DocumentKpis | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<CrmDocumentStatus | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = React.useState<CrmDocumentCategory | 'all'>('all');

  // Single delete
  const [pendingDelete, setPendingDelete] = React.useState<CrmDocumentDoc | null>(null);
  const [deletePending, startDeleteTransition] = React.useTransition();

  // Bulk
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [bulkOp, setBulkOp] = React.useState<BulkOp | null>(null);
  const [bulkPending, startBulkTransition] = React.useTransition();

  const { toast } = useZoruToast();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, kpiData] = await Promise.all([
        getDocuments({
          q: search.trim() || undefined,
          status: statusFilter === 'all' ? undefined : statusFilter,
          category: categoryFilter === 'all' ? undefined : categoryFilter,
          limit: 100,
        }),
        getDocumentKpis(),
      ]);
      setDocuments(res.items ?? []);
      setKpis(kpiData);
    } catch {
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, categoryFilter]);

  React.useEffect(() => {
    const t = window.setTimeout(() => {
      void refresh();
    }, 250);
    return () => window.clearTimeout(t);
  }, [refresh]);

  // Selection
  const allIds = documents.map((d) => d._id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Single delete
  const handleDelete = () => {
    if (!pendingDelete) return;
    const id = pendingDelete._id;
    startDeleteTransition(async () => {
      const result = await deleteDocument(id);
      if (result.success) {
        toast({ title: 'Document deleted' });
        setPendingDelete(null);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: result.error ?? 'Could not delete document.',
          variant: 'destructive',
        });
      }
    });
  };

  // Bulk execute
  const executeBulk = (op: BulkOp) => {
    const ids = Array.from(selected);
    startBulkTransition(async () => {
      let result: { succeeded: number; failed: number };

      if (op === 'verify') {
        result = await bulkUpdateDocumentStatus(ids, 'verified');
      } else if (op === 'archive') {
        result = await bulkUpdateDocumentStatus(ids, 'archived');
      } else {
        result = await bulkDeleteDocuments(ids);
      }

      const verb = op === 'verify' ? 'verified' : op === 'archive' ? 'archived' : 'deleted';
      toast({
        title: `${result.succeeded} document${result.succeeded !== 1 ? 's' : ''} ${verb}`,
        variant: result.failed > 0 ? 'destructive' : 'default',
      });

      setSelected(new Set());
      setBulkOp(null);
      await refresh();
    });
  };

  // Export CSV
  const handleExport = () => {
    downloadCsv(
      `documents-${dateStamp()}.csv`,
      ['Name', 'Category', 'Employee', 'Document number', 'Status', 'Expiry'],
      documents.map((d) => ({
        Name: d.name,
        Category: categoryLabel(d.category),
        Employee: d.employeeName ?? d.employeeId ?? '',
        'Document number': d.documentNumber ?? '',
        Status: statusLabel(d.status ?? ''),
        Expiry: fmtDate(d.expiryDate),
      })),
    );
  };

  const colSpan = 8; // checkbox + name + category + employee + number + status + expiry + actions

  return (
    <>
      <EntityListShell
        title="Documents"
        subtitle="HR documents — contracts, IDs, certifications and other files."
        primaryAction={
          <div className="flex items-center gap-2">
            <ZoruButton variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </ZoruButton>
            <ZoruButton asChild>
              <Link href={`${BASE}/new`}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> New document
              </Link>
            </ZoruButton>
          </div>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: 'Search documents…',
        }}
        filters={
          <>
            <ZoruSelect
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as CrmDocumentStatus | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[180px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
            <ZoruSelect
              value={categoryFilter}
              onValueChange={(v) => setCategoryFilter(v as CrmDocumentCategory | 'all')}
            >
              <ZoruSelectTrigger className="h-9 w-[200px]">
                <ZoruSelectValue placeholder="Category" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {CATEGORY_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-zoru-line bg-zoru-surface px-4 py-2">
              <span className="text-[13px] text-zoru-ink-muted">{selected.size} selected</span>
              <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => executeBulk('verify')}>
                Verify
              </ZoruButton>
              <ZoruButton size="sm" variant="outline" disabled={bulkPending} onClick={() => executeBulk('archive')}>
                Archive
              </ZoruButton>
              <ZoruButton
                size="sm"
                variant="outline"
                disabled={bulkPending}
                onClick={() => setBulkOp('delete')}
                className="text-destructive"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </ZoruButton>
              <ZoruButton size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Clear
              </ZoruButton>
            </div>
          ) : null
        }
        loading={isLoading && documents.length === 0}
      >
        {/* KPI strip */}
        {kpis && (
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="Total documents" value={kpis.total} />
            <KpiCard label="Verified" value={kpis.verified} tone="green" />
            <KpiCard label="Pending verification" value={kpis.pendingVerification} tone="amber" />
            <KpiCard label="Expiring in 30 days" value={kpis.expiringIn30Days} tone="red" />
          </div>
        )}

        <div className="overflow-x-auto rounded-lg border border-zoru-line">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-10 px-3">
                  <ZoruCheckbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Name</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Category</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Employee</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Number</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Status</ZoruTableHead>
                <ZoruTableHead className="text-zoru-ink-muted">Expiry</ZoruTableHead>
                <ZoruTableHead className="text-right text-zoru-ink-muted">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {isLoading ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell colSpan={colSpan} className="h-24 text-center">
                    <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-zoru-ink-muted" />
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : documents.length === 0 ? (
                <ZoruTableRow className="border-zoru-line">
                  <ZoruTableCell
                    colSpan={colSpan}
                    className="h-24 text-center text-zoru-ink-muted"
                  >
                    No documents match this filter.
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                documents.map((d) => {
                  const status = (d.status ?? 'pending') as CrmDocumentStatus;
                  const tone = STATUS_TONE[status] ?? 'neutral';
                  const isChecked = selected.has(d._id);
                  return (
                    <ZoruTableRow
                      key={d._id}
                      className={`border-zoru-line ${isChecked ? 'bg-zoru-surface-active' : ''}`}
                    >
                      <ZoruTableCell className="px-3">
                        <ZoruCheckbox
                          checked={isChecked}
                          onCheckedChange={() => toggleOne(d._id)}
                          aria-label={`Select ${d.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="font-medium text-zoru-ink">
                        <EntityRowLink href={`${BASE}/${d._id}`} label={d.name} />
                      </ZoruTableCell>
                      <ZoruTableCell className="capitalize text-zoru-ink">
                        {categoryLabel(d.category)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {d.employeeName ?? d.employeeId ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="font-mono text-[12px] text-zoru-ink">
                        {d.documentNumber ?? '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill label={statusLabel(status)} tone={tone} />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDate(d.expiryDate)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton variant="ghost" size="icon" asChild>
                          <Link href={`${BASE}/${d._id}/edit`}>
                            <Edit className="h-4 w-4" />
                          </Link>
                        </ZoruButton>
                        <ZoruButton
                          variant="ghost"
                          size="icon"
                          onClick={() => setPendingDelete(d)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </EntityListShell>

      {/* Single delete dialog */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete document?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Deleting &ldquo;{pendingDelete?.name}&rdquo; will remove it from the active
              document list. Audit records remain intact.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete} disabled={deletePending}>
              {deletePending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog
        open={bulkOp === 'delete'}
        onOpenChange={(o) => !o && setBulkOp(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} document{selected.size !== 1 ? 's' : ''}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The selected documents will be removed from the active list. Audit records
              remain intact.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={() => executeBulk('delete')}
              disabled={bulkPending}
            >
              {bulkPending ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
