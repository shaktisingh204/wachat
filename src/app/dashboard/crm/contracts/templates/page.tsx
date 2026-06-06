'use client';

/**
 * Contract Templates list — `/dashboard/crm/contracts/templates`.
 *
 * Ships:
 *   - KPI strip (total, active, draft, archived)
 *   - Filter row: search by name, status (active/draft/archived)
 *   - Checkbox selection
 *   - Bulk archive, bulk delete with confirm
 *   - Export CSV
 *   - EntityRowLink on template name → detail page
 */

import * as React from 'react';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui/compat';
import {
  Archive,
  Download,
  ExternalLink,
  FileText,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useTransition, useActionState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';

gsap.registerPlugin(useGSAP);

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { downloadCsv, dateStamp } from '@/lib/crm-list-export';

import {
  getContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
  bulkDeleteContractTemplates,
} from '@/app/actions/worksuite/contracts-ext.actions';
import type { WsContractTemplate } from '@/lib/worksuite/contracts-ext-types';

type Row = WsContractTemplate & { _id: string; status?: string };

/* ─── Status badge ─────────────────────────────────────────────────── */

function TemplateBadge({ status }: { status: string | undefined }) {
  if (!status || status === 'active')
    return <Badge variant="success">Active</Badge>;
  if (status === 'draft') return <Badge variant="outline">Draft</Badge>;
  if (status === 'archived')
    return <Badge variant="default">Archived</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function ContractTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [rows, setRows] = useState<Row[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);

  /* Filters */
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  /* Selection */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  /* Dialogs */
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeletePending, setBulkDeletePending] = useState(false);
  const [bulkArchivePending, setBulkArchivePending] = useState(false);

  const [saveState, saveFormAction, isSaving] = useActionState(
    saveContractTemplate,
    { message: '', error: '' } as { message?: string; error?: string },
  );

  const refresh = () => {
    startLoading(async () => {
      const data = await getContractTemplates();
      setRows(data as unknown as Row[]);
    });
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({ title: 'Error', description: saveState.error, variant: 'destructive' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveState]);

  useGSAP(
    () => {
      if (!isLoading && filtered.length > 0) {
        gsap.fromTo(
          '.gsap-row',
          { opacity: 0, y: 10 },
          { opacity: 1, y: 0, stagger: 0.05, duration: 0.3, ease: 'power2.out' }
        );
      }
    },
    { dependencies: [filtered, isLoading], scope: containerRef }
  );

  /* KPI */
  const kpi = React.useMemo(() => {
    let active = 0;
    let draft = 0;
    let archived = 0;
    for (const r of rows) {
      const s = r.status ?? 'active';
      if (s === 'active' || !s) active += 1;
      else if (s === 'draft') draft += 1;
      else if (s === 'archived') archived += 1;
    }
    return { total: rows.length, active, draft, archived };
  }, [rows]);

  /* Filtered list */
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      const s = r.status ?? 'active';
      if (statusFilter !== 'all' && s !== statusFilter) return false;
      return true;
    });
  }, [rows, search, statusFilter]);

  const filtersActive = Boolean(search) || statusFilter !== 'all';

  const allSelectedOnPage =
    filtered.length > 0 && filtered.every((r) => selected.has(r._id));

  const toggleRow = React.useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = React.useCallback(() => {
    setSelected((prev) => {
      const allSel = filtered.every((r) => prev.has(r._id));
      if (allSel) {
        const next = new Set(prev);
        for (const r of filtered) next.delete(r._id);
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) next.add(r._id);
      return next;
    });
  }, [filtered]);

  /* Single delete */
  const handleDelete = React.useCallback(async () => {
    if (!deletingId) return;
    const res = await deleteContractTemplate(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Template removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  }, [deletingId, toast]);

  /* Bulk delete */
  const runBulkDelete = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkDeleteContractTemplates(ids);
      toast({
        title: `${res.deleted} template${res.deleted === 1 ? '' : 's'} deleted`,
        variant: res.success ? 'default' : 'destructive',
      });
      setSelected(new Set());
      router.refresh();
      refresh();
    });
  }, [selected, router, toast]);

  /* Bulk archive — update status field */
  const runBulkArchive = React.useCallback(() => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      // Archive by patching each template individually via saveContractTemplate.
      // The action accepts a FormData with _id + name + body + status.
      let failed = 0;
      for (const id of ids) {
        const row = rows.find((r) => r._id === id);
        if (!row) continue;
        const fd = new FormData();
        fd.set('_id', id);
        fd.set('name', row.name);
        fd.set('body', row.body);
        fd.set('status', 'archived');
        const res = await saveContractTemplate(undefined, fd);
        if (res.error) failed += 1;
      }
      toast({
        title:
          failed === 0
            ? `${ids.length} template${ids.length === 1 ? '' : 's'} archived`
            : `${ids.length - failed} archived, ${failed} failed`,
        variant: failed > 0 ? 'destructive' : 'default',
      });
      setSelected(new Set());
      router.refresh();
      refresh();
    });
  }, [selected, rows, router, toast]);

  /* Export CSV */
  const handleExportCsv = React.useCallback(() => {
    const exportRows = filtered.filter((r) => selected.size === 0 || selected.has(r._id));
    if (exportRows.length === 0) {
      toast({ title: 'Nothing to export' });
      return;
    }
    downloadCsv(
      `contract-templates-${dateStamp()}.csv`,
      ['Name', 'Status', 'Preview'],
      exportRows.map((r) => ({
        Name: r.name,
        Status: r.status ?? 'active',
        Preview: (r.body || '').slice(0, 200),
      })),
    );
    toast({ title: 'Exported', description: `${exportRows.length} templates saved to CSV.` });
  }, [filtered, selected, toast]);

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <>
      <EntityListShell
        title="Contract Templates"
        subtitle="Reusable contract templates with placeholders."
        search={{ value: search, onChange: setSearch, placeholder: 'Search templates…' }}
        primaryAction={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Template
          </Button>
        }
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-[11px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Status
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {filtersActive ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
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
        <div ref={containerRef} className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(
            [
              { label: 'Total', value: kpi.total },
              { label: 'Active', value: kpi.active },
              { label: 'Draft', value: kpi.draft },
              { label: 'Archived', value: kpi.archived },
            ] as const
          ).map((k) => (
            <div
              key={k.label}
              className="flex flex-col gap-1 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3"
            >
              <div className="flex items-center gap-1.5 text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                <FileText className="h-3.5 w-3.5" />
                {k.label}
              </div>
              <span className="text-xl font-semibold text-[var(--st-text)]">
                {k.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        {/* Export */}
        <div className="flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" /> Export CSV
          </Button>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr className="border-[var(--st-border)] hover:bg-transparent">
                  <Th className="w-10 pl-3">
                    <Checkbox
                      checked={allSelectedOnPage}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </Th>
                  <Th>Name</Th>
                  <Th>Status</Th>
                  <Th>Preview</Th>
                  <Th className="w-[140px] text-right">Actions</Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && rows.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <Tr key={i} className="border-[var(--st-border)]">
                      <Td colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </Td>
                    </Tr>
                  ))
                ) : filtered.length === 0 ? (
                  <Tr className="border-[var(--st-border)]">
                    <Td
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {filtersActive
                        ? 'No templates match the current filters.'
                        : 'No templates yet — click Add Template to get started.'}
                    </Td>
                  </Tr>
                ) : (
                  filtered.map((row) => (
                    <Tr key={row._id} className="border-[var(--st-border)] gsap-row">
                      <Td className="pl-3">
                        <Checkbox
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleRow(row._id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </Td>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/contracts/templates/${row._id}`}
                          label={row.name}
                        />
                      </Td>
                      <Td>
                        <TemplateBadge status={row.status} />
                      </Td>
                      <Td className="max-w-[360px] truncate text-[13px] text-[var(--st-text-secondary)]">
                        {(row.body || '').slice(0, 120)}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Generate Contract"
                            onClick={() => {
                              toast({ title: 'Generate Contract', description: 'Generating contract from template...' });
                            }}
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                          <Link href={`/dashboard/crm/contracts/templates/${row._id}`}>
                            <Button variant="ghost" size="sm" aria-label="View">
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Edit"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Delete"
                            onClick={() => setDeletingId(row._id)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-text)]" />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
        </Card>
        </div>
      </EntityListShell>

      {/* Add / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-[var(--st-text)]">
              {editing ? 'Edit Template' : 'Add Template'}
            </DialogTitle>
            <DialogDescription className="text-[var(--st-text-secondary)]">
              Placeholders like {'{{client_name}}'} are supported.
            </DialogDescription>
          </DialogHeader>
          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? <input type="hidden" name="_id" value={editing._id} /> : null}
            <div>
              <Label htmlFor="name" className="text-[var(--st-text)]">
                Template Name <span className="text-[var(--st-text)]">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
              />
            </div>
            <div>
              <Label htmlFor="status" className="text-[var(--st-text)]">
                Status
              </Label>
              <Select
                name="status"
                defaultValue={editing?.status ?? 'active'}
              >
                <SelectTrigger className="mt-1.5 h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="body" className="text-[var(--st-text)]">
                Body <span className="text-[var(--st-text)]">*</span>
              </Label>
              <Textarea
                id="body"
                name="body"
                required
                rows={10}
                defaultValue={editing?.body || ''}
                className="mt-1.5 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
                placeholder="Contract body with placeholders like {{client_name}}, {{start_date}}…"
              />
            </div>
            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Single delete */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-[var(--st-text)]">Delete Template?</AlertDialogTitle>
            <AlertDialogDescription className="text-[var(--st-text-secondary)]">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk archive confirm */}
      <ConfirmDialog
        open={bulkArchivePending}
        onOpenChange={setBulkArchivePending}
        title={`Archive ${selected.size} template${selected.size === 1 ? '' : 's'}?`}
        description="Archived templates are hidden from active use but remain in the database."
        confirmLabel="Archive"
        confirmTone="primary"
        onConfirm={runBulkArchive}
      />

      {/* Bulk delete confirm */}
      <ConfirmDialog
        open={bulkDeletePending}
        onOpenChange={setBulkDeletePending}
        title={`Delete ${selected.size} template${selected.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected templates. This action cannot be undone."
        confirmLabel="Delete"
        requireTyped="DELETE"
        onConfirm={runBulkDelete}
      />

      {bulkPending ? <span className="sr-only">Working…</span> : null}
    </>
  );
}
