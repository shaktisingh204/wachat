'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, StatCard, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  ListChecks,
  CheckCircle2,
  FileText,
  Clock,
  Download,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

import * as React from 'react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { RowDrawer } from '@/components/crm/row-drawer';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';
import {
  getPurposeConsents,
  getPurposeConsentKpis,
  savePurposeConsent,
  deletePurposeConsent,
  type PurposeConsentKpis,
} from '@/app/actions/worksuite/gdpr.actions';
import type {
  WsPurposeConsent,
  WsConsentAppliesTo,
} from '@/lib/worksuite/gdpr-types';

type Row = WsPurposeConsent & { _id: string };
type StatusFilter = 'all' | 'active' | 'inactive';
type AppliesFilter = 'all' | WsConsentAppliesTo;

const EMPTY_KPIS: PurposeConsentKpis = {
  total: 0,
  active: 0,
  with_consent_text: 0,
  last_updated_at: null,
};

function formatRelative(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const diff = Date.now() - d.getTime();
  const day = 24 * 60 * 60 * 1000;
  if (diff < day) return 'today';
  if (diff < 2 * day) return 'yesterday';
  const days = Math.floor(diff / day);
  if (days < 30) return `${days}d ago`;
  return d.toISOString().slice(0, 10);
}

export default function PurposeConsentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<PurposeConsentKpis>(EMPTY_KPIS);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [appliesFilter, setAppliesFilter] = useState<AppliesFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saveState, saveAction, isSaving] = useActionState(savePurposeConsent, {
    message: undefined,
    error: undefined,
  } as { message?: string; error?: string });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [list, k] = await Promise.all([
        getPurposeConsents(),
        getPurposeConsentKpis(),
      ]);
      setRows((list as Row[]) || []);
      setKpis((k as PurposeConsentKpis) || EMPTY_KPIS);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.title || ''} ${r.description || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (statusFilter === 'active' && r.is_active === false) return false;
      if (statusFilter === 'inactive' && r.is_active !== false) return false;
      if (
        appliesFilter !== 'all' &&
        (r.applies_to || 'both') !== appliesFilter
      )
        return false;
      return true;
    });
  }, [rows, search, statusFilter, appliesFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasMore = page < totalPages;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deletePurposeConsent(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Purpose removed.' });
      setDeletingId(null);
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(deletingId);
        return next;
      });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    if (!ids.length) return;
    setBulkDeleting(true);
    let ok = 0;
    let failed = 0;
    for (const id of ids) {
      try {
        const r = await deletePurposeConsent(id);
        if (r.success) ok += 1;
        else failed += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkDeleting(false);
    setSelected(new Set());
    setBulkDeleteOpen(false);
    toast({
      title: 'Bulk delete',
      description: `${ok} removed${failed ? `, ${failed} failed` : ''}.`,
      variant: failed ? 'destructive' : undefined,
    });
    refresh();
  };

  const exportRowsFor = (subset: Row[]): ExportRow[] =>
    subset.map((r) => ({
      Title: r.title || '',
      Description: r.description || '',
      AppliesTo: r.applies_to || 'both',
      Required: r.is_required ? 'Yes' : 'No',
      Active: r.is_active === false ? 'No' : 'Yes',
      Order: r.sort_order ?? 0,
    }));

  const doExport = (format: 'csv' | 'xlsx') => {
    const subset = selected.size
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    const headers = [
      'Title',
      'Description',
      'AppliesTo',
      'Required',
      'Active',
      'Order',
    ];
    const filename = `purpose-consents-${dateStamp()}.${format}`;
    if (format === 'csv') downloadCsv(filename, headers, exportRowsFor(subset));
    else
      void downloadXlsx(filename, headers, exportRowsFor(subset), 'Purposes');
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const ids = pageRows.map((r) => r._id);
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  return (
    <EntityListShell
      title="Purpose Consents"
      subtitle="Processing purposes leads and users can grant or revoke consent for."
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Purpose
        </Button>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search purposes…',
      }}
      filters={
        <>
          {(['all', 'active', 'inactive'] as StatusFilter[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
            >
              {s === 'all' ? 'All' : s === 'active' ? 'Active' : 'Inactive'}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-[var(--st-border)]" />
          {(['all', 'both', 'lead', 'user'] as AppliesFilter[]).map((a) => (
            <Button
              key={a}
              variant={appliesFilter === a ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setAppliesFilter(a);
                setPage(1);
              }}
            >
              {a === 'all'
                ? 'Any'
                : a.charAt(0).toUpperCase() + a.slice(1)}
            </Button>
          ))}
        </>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-[var(--st-text)]">
              {selected.size} selected
            </span>
            <span className="text-[var(--st-text-secondary)]">·</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => doExport('csv')}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => doExport('xlsx')}
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              Export XLSX
            </Button>
            <span className="ml-auto" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          </div>
        ) : null
      }
      loading={isLoading && rows.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            label="Total purposes"
            value={kpis.total}
            icon={<ListChecks className="h-4 w-4" />}
          />
          <StatCard
            label="Active"
            value={kpis.active}
            icon={<CheckCircle2 className="h-4 w-4" />}
          />
          <StatCard
            label="With consent text"
            value={kpis.with_consent_text}
            icon={<FileText className="h-4 w-4" />}
          />
          <StatCard
            label="Last updated"
            value={formatRelative(kpis.last_updated_at)}
            icon={<Clock className="h-4 w-4" />}
          />
        </div>

        <Card className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <Tr className="hover:bg-transparent">
                  <Th className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Title
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Applies to
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Required
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Status
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Order
                  </Th>
                  <Th className="w-[140px] text-right text-[var(--st-text-secondary)]">
                    Actions
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && rows.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={7}
                      className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </Td>
                  </Tr>
                ) : pageRows.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={7}
                      className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      No purposes match the current filters.
                    </Td>
                  </Tr>
                ) : (
                  pageRows.map((row) => (
                    <Tr key={row._id}>
                      <Td>
                        <Checkbox
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleOne(row._id)}
                          aria-label={`Select ${row.title}`}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <RowDrawer
                          label={row.title}
                          subtitle={row.description || undefined}
                          title={`Purpose · ${row.title}`}
                          description="Inline detail. Use Edit to modify."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Title
                              </div>
                              <div>{row.title}</div>
                            </div>
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Description
                              </div>
                              <div className="whitespace-pre-wrap">
                                {row.description || '—'}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-[var(--st-text-secondary)] text-xs">
                                  Applies to
                                </div>
                                <div>{row.applies_to || 'both'}</div>
                              </div>
                              <div>
                                <div className="text-[var(--st-text-secondary)] text-xs">
                                  Required
                                </div>
                                <div>{row.is_required ? 'Yes' : 'No'}</div>
                              </div>
                              <div>
                                <div className="text-[var(--st-text-secondary)] text-xs">
                                  Active
                                </div>
                                <div>
                                  {row.is_active === false ? 'No' : 'Yes'}
                                </div>
                              </div>
                              <div>
                                <div className="text-[var(--st-text-secondary)] text-xs">
                                  Sort order
                                </div>
                                <div>{row.sort_order ?? 0}</div>
                              </div>
                            </div>
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditing(row);
                                  setDialogOpen(true);
                                }}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        </RowDrawer>
                      </Td>
                      <Td>
                        <Badge variant="ghost">
                          {row.applies_to
                            ? row.applies_to.charAt(0).toUpperCase() +
                              row.applies_to.slice(1)
                            : 'Both'}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant={row.is_required ? 'default' : 'ghost'}>
                          {row.is_required ? 'Required' : 'Optional'}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge
                          variant={
                            row.is_active === false ? 'ghost' : 'success'
                          }
                        >
                          {row.is_active === false ? 'Inactive' : 'Active'}
                        </Badge>
                      </Td>
                      <Td className="text-[12px] text-[var(--st-text-secondary)]">
                        {row.sort_order ?? 0}
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(row);
                              setDialogOpen(true);
                            }}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(row._id)}
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                          </Button>
                        </div>
                      </Td>
                    </Tr>
                  ))
                )}
              </TBody>
            </Table>
          </div>
          <PaginationBar
            page={page}
            limit={pageSize}
            hasMore={hasMore}
            total={filtered.length}
            controlled={{
              onChange: ({ page: p, limit: l }) => {
                setPage(p);
                setPageSize(l);
              },
            }}
          />
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? 'Edit Purpose' : 'Add Purpose'}
            </DialogTitle>
            <DialogDescription>
              Purposes appear on consent prompts to leads and users.
            </DialogDescription>
          </DialogHeader>
          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="title">
                Title <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                defaultValue={editing?.title || ''}
                placeholder="Marketing communications"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
                placeholder="We process your data to send product updates and newsletters."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="applies_to">Applies to</Label>
                <select
                  id="applies_to"
                  name="applies_to"
                  defaultValue={editing?.applies_to || 'both'}
                  className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)]"
                >
                  <option value="both">Both leads and users</option>
                  <option value="lead">Leads only</option>
                  <option value="user">Users only</option>
                </select>
              </div>
              <div>
                <Label htmlFor="sort_order">Sort order</Label>
                <Input
                  id="sort_order"
                  name="sort_order"
                  type="number"
                  defaultValue={String(editing?.sort_order ?? 0)}
                />
              </div>
              <div>
                <Label htmlFor="is_required">Required</Label>
                <select
                  id="is_required"
                  name="is_required"
                  defaultValue={editing?.is_required ? 'true' : 'false'}
                  className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)]"
                >
                  <option value="false">Optional</option>
                  <option value="true">Required</option>
                </select>
              </div>
              <div>
                <Label htmlFor="is_active">Status</Label>
                <select
                  id="is_active"
                  name="is_active"
                  defaultValue={editing?.is_active === false ? 'false' : 'true'}
                  className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)]"
                >
                  <option value="true">Active</option>
                  <option value="false">Inactive</option>
                </select>
              </div>
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
                {isSaving ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                ) : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete purpose?</AlertDialogTitle>
            <AlertDialogDescription>
              Lead and user consent records pointing to this purpose will be
              orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {selected.size} purpose(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All consent records referencing the selected purposes will be
              orphaned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete}>
              {bulkDeleting ? 'Deleting…' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EntityListShell>
  );
}
