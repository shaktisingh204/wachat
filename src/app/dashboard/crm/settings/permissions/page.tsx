'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, Badge, Button, Card, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, Table, TBody, Td, Th, THead, Tr, Textarea, useToast } from '@/components/sabcrm/20ui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  KeyRound,
  Users,
  Crown,
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
  getPermissionsGroupedByModule,
  getPermissionKpis,
  getModules,
  savePermission,
  deletePermission,
  type PermissionKpis,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsPermission,
  WsModule,
} from '@/lib/worksuite/rbac-types';

type PermRow = WsPermission & { _id: string };
type ModRow = WsModule & { _id: string };
type Group = { module: ModRow | null; permissions: PermRow[] };
type FilterKind = 'all' | 'custom' | 'builtin';

const EMPTY_KPIS: PermissionKpis = {
  total: 0,
  granted_role_count: 0,
  top_role: null,
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

export default function PermissionsPage() {
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [modules, setModules] = useState<ModRow[]>([]);
  const [kpis, setKpis] = useState<PermissionKpis>(EMPTY_KPIS);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PermRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [kindFilter, setKindFilter] = useState<FilterKind>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saveState, saveAction, isSaving] = useActionState(savePermission, {
    message: '',
    error: '',
  } as { message?: string; error?: string });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [g, m, k] = await Promise.all([
        getPermissionsGroupedByModule(),
        getModules(),
        getPermissionKpis(),
      ]);
      setGroups((g as Group[]) || []);
      setModules((m as ModRow[]) || []);
      setKpis((k as PermissionKpis) || EMPTY_KPIS);
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

  const flatRows = useMemo(() => {
    const out: Array<PermRow & { module_name: string }> = [];
    for (const g of groups) {
      const mName =
        g.module?.display_name || g.module?.module_name || 'Uncategorised';
      for (const p of g.permissions) {
        out.push({ ...p, module_name: mName });
      }
    }
    return out;
  }, [groups]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatRows.filter((r) => {
      if (q) {
        const hay = `${r.display_name || ''} ${r.name || ''} ${
          r.description || ''
        } ${r.module_name}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (moduleFilter !== 'all') {
        if (moduleFilter === '__none' && r.module_id) return false;
        if (
          moduleFilter !== '__none' &&
          String(r.module_id ?? '') !== moduleFilter
        )
          return false;
      }
      if (kindFilter === 'custom' && !r.is_custom) return false;
      if (kindFilter === 'builtin' && r.is_custom) return false;
      return true;
    });
  }, [flatRows, search, moduleFilter, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasMore = page < totalPages;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deletePermission(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Permission removed.' });
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
        const r = await deletePermission(id);
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

  const exportRowsFor = (rows: typeof filtered): ExportRow[] =>
    rows.map((r) => ({
      Name: r.display_name || r.name,
      Slug: r.name,
      Module: r.module_name,
      Custom: r.is_custom ? 'Yes' : 'No',
      Description: r.description || '',
    }));

  const doExport = (format: 'csv' | 'xlsx') => {
    const subset = selected.size
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    const headers = ['Name', 'Slug', 'Module', 'Custom', 'Description'];
    const filename = `permissions-${dateStamp()}.${format}`;
    if (format === 'csv') downloadCsv(filename, headers, exportRowsFor(subset));
    else void downloadXlsx(filename, headers, exportRowsFor(subset), 'Permissions');
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
      title="Permissions"
      subtitle="Granular access keys grouped by module. Assign to roles to grant capability."
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Permission
        </Button>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search permissions…',
      }}
      filters={
        <>
          <div className="flex items-center gap-2">
            <Label className="text-[12px] text-[var(--st-text-secondary)]">
              Module
            </Label>
            <Select
              value={moduleFilter}
              onValueChange={(v) => {
                setModuleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-8 w-[180px] text-[12px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                <SelectItem value="__none">Uncategorised</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m._id} value={m._id}>
                    {m.display_name || m.module_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(['all', 'custom', 'builtin'] as FilterKind[]).map((k) => (
            <Button
              key={k}
              variant={kindFilter === k ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setKindFilter(k);
                setPage(1);
              }}
            >
              {k === 'all' ? 'All' : k === 'custom' ? 'Custom' : 'Built-in'}
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
      loading={isLoading && groups.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            label="Total permissions"
            value={kpis.total}
            icon={<KeyRound className="h-4 w-4" />}
          />
          <StatCard
            label="Granted to roles"
            value={kpis.granted_role_count}
            icon={<Users className="h-4 w-4" />}
          />
          <StatCard
            label="Top role"
            value={kpis.top_role ? kpis.top_role.name : '—'}
            period={
              kpis.top_role
                ? `${kpis.top_role.count} grants`
                : 'no grants yet'
            }
            icon={<Crown className="h-4 w-4" />}
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
                    Name
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Slug
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Module
                  </Th>
                  <Th className="text-[var(--st-text-secondary)]">
                    Type
                  </Th>
                  <Th className="w-[140px] text-right text-[var(--st-text-secondary)]">
                    Actions
                  </Th>
                </Tr>
              </THead>
              <TBody>
                {isLoading && flatRows.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={6}
                      className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </Td>
                  </Tr>
                ) : pageRows.length === 0 ? (
                  <Tr>
                    <Td
                      colSpan={6}
                      className="h-20 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      No permissions match the current filters.
                    </Td>
                  </Tr>
                ) : (
                  pageRows.map((p) => (
                    <Tr key={p._id}>
                      <Td>
                        <Checkbox
                          checked={selected.has(p._id)}
                          onCheckedChange={() => toggleOne(p._id)}
                          aria-label={`Select ${p.name}`}
                        />
                      </Td>
                      <Td className="text-[13px] text-[var(--st-text)]">
                        <RowDrawer
                          label={p.display_name || p.name}
                          subtitle={p.description || undefined}
                          title={`Permission · ${p.display_name || p.name}`}
                          description="Inline detail. Use Edit to modify fields."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Slug
                              </div>
                              <div className="font-mono">{p.name}</div>
                            </div>
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Module
                              </div>
                              <div>{p.module_name}</div>
                            </div>
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Description
                              </div>
                              <div>{p.description || '—'}</div>
                            </div>
                            <div>
                              <div className="text-[var(--st-text-secondary)] text-xs">
                                Kind
                              </div>
                              <div>{p.is_custom ? 'Custom' : 'Built-in'}</div>
                            </div>
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditing(p);
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
                      <Td className="text-[12px] text-[var(--st-text-secondary)]">
                        <code>{p.name}</code>
                      </Td>
                      <Td className="text-[12px] text-[var(--st-text-secondary)]">
                        {p.module_name}
                      </Td>
                      <Td>
                        <Badge variant={p.is_custom ? 'success' : 'ghost'}>
                          {p.is_custom ? 'Custom' : 'Built-in'}
                        </Badge>
                      </Td>
                      <Td className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditing(p);
                              setDialogOpen(true);
                            }}
                            aria-label="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(p._id)}
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
              {editing ? 'Edit Permission' : 'Add Permission'}
            </DialogTitle>
            <DialogDescription>
              Permissions belong to a module and are assigned to roles with a
              type (all / added / owned / both / none).
            </DialogDescription>
          </DialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="display_name">
                Display name <span className="text-[var(--st-danger)]">*</span>
              </Label>
              <Input
                id="display_name"
                name="display_name"
                required
                defaultValue={editing?.display_name || ''}
              />
            </div>
            <div>
              <Label htmlFor="name">Slug</Label>
              <Input
                id="name"
                name="name"
                defaultValue={editing?.name || ''}
                placeholder="auto_generated"
              />
            </div>
            <div>
              <Label htmlFor="module_id">Module</Label>
              <select
                id="module_id"
                name="module_id"
                defaultValue={editing?.module_id ? String(editing.module_id) : ''}
                className="h-10 w-full rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] px-3 text-[13px] text-[var(--st-text)]"
              >
                <option value="">— None —</option>
                {modules.map((m) => (
                  <option key={m._id} value={m._id}>
                    {m.display_name || m.module_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                defaultValue={editing?.description || ''}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="is_custom"
                type="checkbox"
                name="is_custom"
                value="true"
                defaultChecked={!!editing?.is_custom}
                className="h-4 w-4 accent-[var(--st-text)]"
              />
              <Label htmlFor="is_custom" className="text-[13px] text-[var(--st-text)]">
                Custom (user-defined)
              </Label>
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
            <AlertDialogTitle>Delete permission?</AlertDialogTitle>
            <AlertDialogDescription>
              All role and user grants for this permission will be removed.
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
              Delete {selected.size} permission(s)?
            </AlertDialogTitle>
            <AlertDialogDescription>
              All role and user grants for the selected permissions will be
              removed. This cannot be undone.
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
