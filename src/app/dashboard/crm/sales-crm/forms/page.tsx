'use client';

/**
 * CRM Forms list — `/dashboard/crm/sales-crm/forms`.
 *
 * Ships:
 *   - KPI strip: total forms, published, draft, total submissions
 *   - Filter: search by name, status (published/draft/archived)
 *   - Checkbox row selection
 *   - Bulk publish, bulk archive, bulk delete with confirm
 *   - Export CSV
 *   - EntityRowLink on form name → submissions page
 */

import * as React from 'react';
import { useState, useEffect, useCallback, useTransition } from 'react';

import {
  Badge,
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
  Switch,
} from '@/components/sabcrm/20ui/compat';
import {
  Archive,
  ClipboardList,
  Download,
  Edit,
  Eye,
  Globe,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { WithId } from 'mongodb';
import { useDebouncedCallback } from 'use-debounce';
import { formatDistanceToNow } from 'date-fns';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getCrmForms,
  getCrmFormKpis,
  bulkFormAction,
  deleteCrmForm,
  type CrmFormKpis,
} from '@/app/actions/crm-forms.actions';
import type { CrmForm } from '@/lib/definitions';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function resolveStatus(form: WithId<CrmForm>): string {
  return (form.settings as Record<string, unknown> | undefined)?.status as string ?? 'published';
}

function StatusBadge({ form }: { form: WithId<CrmForm> }) {
  const s = resolveStatus(form);
  if (s === 'published') return <Badge variant="success">Published</Badge>;
  if (s === 'draft') return <Badge variant="outline">Draft</Badge>;
  if (s === 'archived') return <Badge variant="default">Archived</Badge>;
  return <Badge variant="outline">{s}</Badge>;
}

/* ─── KPI card ─────────────────────────────────────────────────────── */

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-zoru-line bg-zoru-surface p-3">
      <div className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
        {icon}
        {label}
      </div>
      <span className="text-xl font-semibold text-zoru-ink">{value}</span>
    </div>
  );
}

const FORMS_PER_PAGE = 20;

/* ─── Component ────────────────────────────────────────────────────── */

export default function CrmFormsPage() {
  const router = useRouter();
  const { toast } = useZoruToast();

  const [forms, setForms] = useState<WithId<CrmForm>[]>([]);
  const [kpi, setKpi] = useState<CrmFormKpis>({
    total: 0,
    published: 0,
    drafts: 0,
    totalSubmissions: 0,
  });
  const [isLoading, startTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [totalPages, setTotalPages] = useState(0);

  /* Selection */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Dialogs */
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkPublishPending, setBulkPublishPending] = useState(false);
  const [bulkArchivePending, setBulkArchivePending] = useState(false);

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [{ forms: data, total }, kpiData] = await Promise.all([
        getCrmForms(currentPage, FORMS_PER_PAGE, searchQuery || undefined),
        getCrmFormKpis(),
      ]);
      setForms(data);
      setKpi(kpiData);
      setTotalPages(Math.ceil(total / FORMS_PER_PAGE));
    });
  }, [currentPage, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = useDebouncedCallback((term: string) => {
    setSearchQuery(term);
    setCurrentPage(1);
  }, 300);

  /* Client-side status filter */
  const filtered = React.useMemo(() => {
    if (statusFilter === 'all') return forms;
    return forms.filter((f) => resolveStatus(f) === statusFilter);
  }, [forms, statusFilter]);

  const groupedFiltered = React.useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const f of filtered) {
      const cat = (f.settings as any)?.category || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(f);
    }
    return groups;
  }, [filtered]);

  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((f) => selected.has(f._id.toString()));

  const toggleRow = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      const allSel = filtered.every((f) => prev.has(f._id.toString()));
      if (allSel) {
        const next = new Set(prev);
        for (const f of filtered) next.delete(f._id.toString());
        return next;
      }
      const next = new Set(prev);
      for (const f of filtered) next.add(f._id.toString());
      return next;
    });
  }, [filtered]);

  /* Single delete */
  const handleDelete = useCallback(async () => {
    if (!deletingId) return;
    const res = await deleteCrmForm(deletingId);
    if (res.message) {
      toast({ title: 'Deleted', description: res.message });
      setDeletingId(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: res.error ?? 'Failed to delete', variant: 'destructive' });
    }
  }, [deletingId, fetchData, toast]);

  /* Quick status toggle */
  const handleToggleActive = useCallback((id: string, currentStatus: string) => {
    const nextOp = currentStatus === 'published' ? 'draft' : 'publish';
    startTransition(async () => {
      // Optimistically update local state for snappier UI
      setForms((prev) =>
        prev.map((f) =>
          f._id.toString() === id
            ? { ...f, settings: { ...(f.settings as any), status: nextOp === 'publish' ? 'published' : 'draft' } }
            : f
        )
      );
      const res = await bulkFormAction([id], nextOp);
      if (res.success) {
        toast({ title: `Form ${nextOp === 'publish' ? 'activated' : 'deactivated'}` });
        fetchData();
      } else {
        toast({ title: 'Update failed', description: res.error, variant: 'destructive' });
        fetchData(); // Revert on failure
      }
    });
  }, [toast, fetchData]);

  /* Bulk handlers */
  const selectedIds = React.useMemo(() => Array.from(selected), [selected]);

  const runBulkPublish = useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkFormAction(selectedIds, 'publish');
      toast({
        title: res.success
          ? `${res.processed ?? selectedIds.length} form${selectedIds.length === 1 ? '' : 's'} published`
          : 'Publish failed',
        description: res.error,
        variant: res.success ? 'default' : 'destructive',
      });
      if (res.success) {
        setSelected(new Set());
        router.refresh();
        fetchData();
      }
    });
  }, [selectedIds, router, toast, fetchData]);

  const runBulkArchive = useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkFormAction(selectedIds, 'archive');
      toast({
        title: res.success
          ? `${res.processed ?? selectedIds.length} form${selectedIds.length === 1 ? '' : 's'} archived`
          : 'Archive failed',
        description: res.error,
        variant: res.success ? 'default' : 'destructive',
      });
      if (res.success) {
        setSelected(new Set());
        router.refresh();
        fetchData();
      }
    });
  }, [selectedIds, router, toast, fetchData]);

  const runBulkDelete = useCallback(() => {
    if (selectedIds.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkFormAction(selectedIds, 'delete');
      toast({
        title: res.success
          ? `${res.processed ?? selectedIds.length} form${selectedIds.length === 1 ? '' : 's'} deleted`
          : 'Delete failed',
        description: res.error,
        variant: res.success ? 'default' : 'destructive',
      });
      if (res.success) {
        setSelected(new Set());
        router.refresh();
        fetchData();
      }
    });
  }, [selectedIds, router, toast, fetchData]);

  /* Export CSV */
  const handleExportCsv = useCallback(() => {
    const exportForms = filtered.filter(
      (f) => selected.size === 0 || selected.has(f._id.toString()),
    );
    if (exportForms.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `crm-forms-${dateStamp()}.csv`,
      ['Name', 'Status', 'Submissions', 'Created'],
      exportForms.map((f) => ({
        Name: f.name,
        Status: resolveStatus(f),
        Submissions: f.submissionCount ?? 0,
        Created: f.createdAt ? new Date(f.createdAt).toLocaleDateString() : '',
      })),
    );
    toast({ title: 'Exported', description: `${exportForms.length} forms saved to CSV.` });
  }, [filtered, selected, toast]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Forms"
        subtitle="Create and embed forms on your website to capture leads directly into your CRM."
        search={{ value: searchQuery, onChange: handleSearch, placeholder: 'Search forms…' }}
        primaryAction={
          <Link href="/dashboard/crm/sales-crm/forms/new">
            <Button>
              <Plus className="h-4 w-4" /> New Form
            </Button>
          </Link>
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <ZoruSelectTrigger className="h-8 w-[150px]">
                  <ZoruSelectValue />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                  <ZoruSelectItem value="published">Published</ZoruSelectItem>
                  <ZoruSelectItem value="draft">Draft</ZoruSelectItem>
                  <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                </ZoruSelectContent>
              </Select>
            </div>
            {statusFilter !== 'all' ? (
              <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="info">{selected.size} selected</Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkPublishPending(true)}
                disabled={bulkPending}
              >
                <Globe className="h-3.5 w-3.5" /> Publish
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setBulkArchivePending(true)}
                disabled={bulkPending}
              >
                <Archive className="h-3.5 w-3.5" /> Archive
              </Button>
              <Button size="sm" variant="outline" onClick={handleExportCsv}>
                <Download className="h-3.5 w-3.5" /> CSV
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeletePending(true)}
                disabled={bulkPending}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            </div>
          ) : null
        }
      >
        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KpiCard
            label="Total forms"
            value={isLoading ? '…' : kpi.total.toLocaleString()}
            icon={<ClipboardList className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Published"
            value={isLoading ? '…' : kpi.published.toLocaleString()}
            icon={<Globe className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Draft"
            value={isLoading ? '…' : kpi.drafts.toLocaleString()}
            icon={<Edit className="h-3.5 w-3.5" />}
          />
          <KpiCard
            label="Total submissions"
            value={isLoading ? '…' : kpi.totalSubmissions.toLocaleString()}
            icon={<ClipboardList className="h-3.5 w-3.5" />}
          />
        </div>

        {/* Export bar */}
        <div className="flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        {isLoading && forms.length === 0 ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card variant="outline" className="border-dashed">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                <ClipboardList
                  className="h-6 w-6 text-zoru-ink"
                  strokeWidth={1.75}
                />
              </div>
              <h3 className="text-[15px] font-semibold text-zoru-ink">No forms found</h3>
              <p className="max-w-md text-[12.5px] text-zoru-ink-muted">
                {statusFilter !== 'all'
                  ? 'No forms match the current status filter.'
                  : 'Create your first form to start capturing leads.'}
              </p>
              <Link href="/dashboard/crm/sales-crm/forms/new">
                <Button>
                  <Plus className="h-4 w-4" /> Create Form
                </Button>
              </Link>
            </div>
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10 pl-3">
                      <Checkbox
                        checked={allSelectedOnPage}
                        onCheckedChange={toggleAll}
                        aria-label="Select all on page"
                      />
                    </ZoruTableHead>
                    <ZoruTableHead>Form Name</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead>Active</ZoruTableHead>
                    <ZoruTableHead className="text-right">Submissions</ZoruTableHead>
                    <ZoruTableHead>Created</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {Object.entries(groupedFiltered).map(([category, catForms]) => (
                    <React.Fragment key={category}>
                      {Object.keys(groupedFiltered).length > 1 && (
                        <ZoruTableRow className="bg-zoru-surface/50 hover:bg-zoru-surface/50">
                          <ZoruTableCell colSpan={7} className="py-2 text-[12px] font-semibold text-zoru-ink-muted uppercase tracking-wider">
                            {category}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      )}
                      {catForms.map((form) => {
                        const id = form._id.toString();
                        const status = resolveStatus(form);
                        const isActive = status === 'published';
                        return (
                          <ZoruTableRow key={id} className="border-zoru-line">
                            <ZoruTableCell className="pl-3">
                              <Checkbox
                                checked={selected.has(id)}
                                onCheckedChange={() => toggleRow(id)}
                                aria-label={`Select ${form.name}`}
                              />
                            </ZoruTableCell>
                            <ZoruTableCell>
                              <EntityRowLink
                                href={`/dashboard/crm/sales-crm/forms/${id}/submissions`}
                                label={form.name}
                                subtitle={`${form.submissionCount ?? 0} submission${(form.submissionCount ?? 0) === 1 ? '' : 's'}`}
                              />
                            </ZoruTableCell>
                            <ZoruTableCell>
                              <StatusBadge form={form} />
                            </ZoruTableCell>
                            <ZoruTableCell>
                              <Switch
                                checked={isActive}
                                onCheckedChange={() => handleToggleActive(id, status)}
                                aria-label="Toggle active status"
                              />
                            </ZoruTableCell>
                            <ZoruTableCell className="text-right text-[13px] font-medium text-zoru-ink">
                              {(form.submissionCount ?? 0).toLocaleString()}
                            </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                          {form.createdAt
                            ? formatDistanceToNow(new Date(form.createdAt), { addSuffix: true })
                            : '—'}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <a
                              href={`/embed/crm-form/${id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Preview embed"
                            >
                              <Button variant="ghost" size="icon">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </a>
                            <Link href={`/dashboard/crm/sales-crm/forms/${id}/edit`}>
                              <Button variant="ghost" size="icon" aria-label="Edit">
                                <Edit className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Delete"
                              onClick={() => setDeletingId(id)}
                            >
                              <Trash2 className="h-4 w-4 text-zoru-ink" />
                            </Button>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 ? (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-[13px] text-zoru-ink-muted">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </EntityListShell>

      {/* Single delete */}
      <ConfirmDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
        title="Delete this form?"
        description="This permanently removes the form and all its submissions. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={handleDelete}
      />

      {/* Bulk publish */}
      <ConfirmDialog
        open={bulkPublishPending}
        onOpenChange={setBulkPublishPending}
        title={`Publish ${selected.size} form${selected.size === 1 ? '' : 's'}?`}
        description="The selected forms will be marked as published and will accept new submissions."
        confirmLabel="Publish"
        confirmTone="primary"
        onConfirm={runBulkPublish}
      />

      {/* Bulk archive */}
      <ConfirmDialog
        open={bulkArchivePending}
        onOpenChange={setBulkArchivePending}
        title={`Archive ${selected.size} form${selected.size === 1 ? '' : 's'}?`}
        description="The selected forms will be archived and will stop accepting new submissions."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={runBulkArchive}
      />

      {/* Bulk delete */}
      <ConfirmDialog
        open={bulkDeletePending}
        onOpenChange={setBulkDeletePending}
        title={`Delete ${selected.size} form${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected forms and all their submissions. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={runBulkDelete}
      />

      {bulkPending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
