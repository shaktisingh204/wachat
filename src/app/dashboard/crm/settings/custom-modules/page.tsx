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
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruIconPicker,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  Boxes,
  Layers,
  Sigma,
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
  getCustomModules,
  getCustomModuleKpis,
  saveCustomModule,
  deleteCustomModule,
  getCustomModulePermissions,
  setCustomModulePermission,
  getRoles,
  type CustomModuleKpis,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsCustomModule,
  WsCustomModulePermission,
  WsRole,
} from '@/lib/worksuite/rbac-types';

type Row = WsCustomModule & { _id: string };
type RoleRow = WsRole & { _id: string };
type PermRow = WsCustomModulePermission & { _id: string };

type Flags = {
  can_view?: boolean;
  can_create?: boolean;
  can_edit?: boolean;
  can_delete?: boolean;
};

const EMPTY_KPIS: CustomModuleKpis = {
  total: 0,
  by_entity_kind: {},
  avg_fields_per_module: 0,
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

function entityKindOf(row: Row): string {
  const src = row.table || row.name || '';
  return (src.split('_')[0] || 'other').toLowerCase();
}

export default function CustomModulesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [perms, setPerms] = useState<PermRow[]>([]);
  const [kpis, setKpis] = useState<CustomModuleKpis>(EMPTY_KPIS);
  const [isLoading, startLoading] = useTransition();
  const [isBusy, startBusy] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [icon, setIcon] = useState<string>('');

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setIcon(editing?.icon ?? '');
  }, [editing]);

  const [saveState, saveAction, isSaving] = useActionState(saveCustomModule, {
    message: '',
    error: '',
  } as { message?: string; error?: string });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [m, r, p, k] = await Promise.all([
        getCustomModules(),
        getRoles(),
        getCustomModulePermissions(),
        getCustomModuleKpis(),
      ]);
      setRows((m as Row[]) || []);
      setRoles((r as RoleRow[]) || []);
      setPerms((p as PermRow[]) || []);
      setKpis((k as CustomModuleKpis) || EMPTY_KPIS);
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

  const permFor = (moduleId: string, roleId: string): PermRow | undefined =>
    perms.find(
      (p) =>
        String(p.custom_module_id) === moduleId &&
        String(p.role_id) === roleId,
    );

  const togglePerm = (
    moduleId: string,
    roleId: string,
    key: keyof Flags,
  ) => {
    const existing = permFor(moduleId, roleId);
    const current: Flags = existing
      ? {
          can_view: !!existing.can_view,
          can_create: !!existing.can_create,
          can_edit: !!existing.can_edit,
          can_delete: !!existing.can_delete,
        }
      : {};
    const next: Flags = { ...current, [key]: !current[key] };
    startBusy(async () => {
      const res = await setCustomModulePermission(moduleId, roleId, next);
      if (!res.success) {
        toast({
          title: 'Error',
          description: res.error || 'Failed',
          variant: 'destructive',
        });
        return;
      }
      refresh();
    });
  };

  const allKinds = useMemo(() => {
    const s = new Set<string>();
    for (const r of rows) s.add(entityKindOf(r));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay =
          `${r.display_name || ''} ${r.name || ''} ${r.table || ''} ${
            r.description || ''
          }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (kindFilter !== 'all' && entityKindOf(r) !== kindFilter) return false;
      return true;
    });
  }, [rows, search, kindFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasMore = page < totalPages;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteCustomModule(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Custom module removed.' });
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
        const r = await deleteCustomModule(id);
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
      Name: r.display_name || r.name,
      Slug: r.name,
      Table: r.table || '',
      EntityKind: entityKindOf(r),
      Icon: r.icon || '',
      Description: r.description || '',
    }));

  const doExport = (format: 'csv' | 'xlsx') => {
    const subset = selected.size
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    const headers = [
      'Name',
      'Slug',
      'Table',
      'EntityKind',
      'Icon',
      'Description',
    ];
    const filename = `custom-modules-${dateStamp()}.${format}`;
    if (format === 'csv') downloadCsv(filename, headers, exportRowsFor(subset));
    else
      void downloadXlsx(
        filename,
        headers,
        exportRowsFor(subset),
        'Custom Modules',
      );
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
      title="Custom Modules"
      subtitle="Define bespoke modules with role-scoped view/create/edit/delete permissions."
      primaryAction={
        <Button
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Add Custom Module
        </Button>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search custom modules…',
      }}
      filters={
        <div className="flex items-center gap-2">
          <Label className="text-[12px] text-zoru-ink-muted">
            Entity kind
          </Label>
          <Select
            value={kindFilter}
            onValueChange={(v) => {
              setKindFilter(v);
              setPage(1);
            }}
          >
            <ZoruSelectTrigger className="h-8 w-[180px] text-[12px]">
              <ZoruSelectValue />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="all">All kinds</ZoruSelectItem>
              {allKinds.map((k) => (
                <ZoruSelectItem key={k} value={k}>
                  {k}
                </ZoruSelectItem>
              ))}
            </ZoruSelectContent>
          </Select>
        </div>
      }
      bulkBar={
        selected.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="font-medium text-zoru-ink">
              {selected.size} selected
            </span>
            <span className="text-zoru-ink-muted">·</span>
            <Button
              variant="ghost"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
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
            label="Total modules"
            value={kpis.total}
            icon={<Boxes className="h-4 w-4" />}
          />
          <StatCard
            label="Entity kinds"
            value={Object.keys(kpis.by_entity_kind).length}
            period={
              Object.keys(kpis.by_entity_kind)
                .slice(0, 3)
                .join(', ') || 'none'
            }
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            label="Avg fields / module"
            value={kpis.avg_fields_per_module}
            icon={<Sigma className="h-4 w-4" />}
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
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="w-[40px]">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                      aria-label="Select all on page"
                    />
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Name
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Slug
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Table
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Kind
                  </ZoruTableHead>
                  <ZoruTableHead className="w-[120px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && rows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={6}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : pageRows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={6}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No custom modules match the current filters.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  pageRows.map((row) => (
                    <ZoruTableRow key={row._id}>
                      <ZoruTableCell>
                        <Checkbox
                          checked={selected.has(row._id)}
                          onCheckedChange={() => toggleOne(row._id)}
                          aria-label={`Select ${row.name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <RowDrawer
                          label={row.display_name || row.name}
                          subtitle={row.description || undefined}
                          title={`Custom Module · ${row.display_name || row.name}`}
                          description="Inline detail. Use Edit to modify."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-zoru-ink-muted text-xs">
                                Slug
                              </div>
                              <div className="font-mono">{row.name}</div>
                            </div>
                            <div>
                              <div className="text-zoru-ink-muted text-xs">
                                Table
                              </div>
                              <div className="font-mono">
                                {row.table || '—'}
                              </div>
                            </div>
                            <div>
                              <div className="text-zoru-ink-muted text-xs">
                                Entity kind
                              </div>
                              <div>{entityKindOf(row)}</div>
                            </div>
                            <div>
                              <div className="text-zoru-ink-muted text-xs">
                                Icon
                              </div>
                              <div>{row.icon || '—'}</div>
                            </div>
                            <div>
                              <div className="text-zoru-ink-muted text-xs">
                                Description
                              </div>
                              <div>{row.description || '—'}</div>
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
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant="ghost">
                          <code>{row.name}</code>
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                        {row.table || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                        {entityKindOf(row)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
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
                            <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                          </Button>
                        </div>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
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

        {rows.length > 0 && roles.length > 0 ? (
          <Card className="p-0">
            <div className="border-b border-zoru-line p-5">
              <h2 className="text-[15px] text-zoru-ink">Permission matrix</h2>
              <p className="text-[13px] text-zoru-ink-muted">
                For each custom module × role pair, toggle the CRUD flags.
                {isBusy ? (
                  <LoaderCircle className="ml-2 inline h-3 w-3 animate-spin" />
                ) : null}
              </p>
            </div>
            <div className="overflow-x-auto p-5">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="hover:bg-transparent">
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Module
                    </ZoruTableHead>
                    <ZoruTableHead className="text-zoru-ink-muted">
                      Role
                    </ZoruTableHead>
                    <ZoruTableHead className="text-center text-zoru-ink-muted">
                      View
                    </ZoruTableHead>
                    <ZoruTableHead className="text-center text-zoru-ink-muted">
                      Create
                    </ZoruTableHead>
                    <ZoruTableHead className="text-center text-zoru-ink-muted">
                      Edit
                    </ZoruTableHead>
                    <ZoruTableHead className="text-center text-zoru-ink-muted">
                      Delete
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.flatMap((m) =>
                    roles.map((r) => {
                      const p = permFor(m._id, r._id);
                      return (
                        <ZoruTableRow key={`${m._id}:${r._id}`}>
                          <ZoruTableCell className="text-[13px] text-zoru-ink">
                            {m.display_name || m.name}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                            {r.display_name || r.name}
                          </ZoruTableCell>
                          {(
                            [
                              'can_view',
                              'can_create',
                              'can_edit',
                              'can_delete',
                            ] as const
                          ).map((key) => (
                            <ZoruTableCell
                              key={key}
                              className="text-center"
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 cursor-pointer accent-zoru-ink"
                                checked={!!p?.[key]}
                                disabled={isBusy}
                                onChange={() => togglePerm(m._id, r._id, key)}
                                aria-label={`${m.name}/${r.name}/${key}`}
                              />
                            </ZoruTableCell>
                          ))}
                        </ZoruTableRow>
                      );
                    }),
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </Card>
        ) : null}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-lg">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Custom Module' : 'Add Custom Module'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Custom modules are tenant-specific entities with their own
              permission matrix.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="display_name">
                Display name <span className="text-zoru-danger-ink">*</span>
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
              />
            </div>
            <div>
              <Label>Icon</Label>
              <input type="hidden" name="icon" value={icon} />
              <ZoruIconPicker value={icon} onChange={setIcon} />
            </div>
            <div>
              <Label htmlFor="table">Table / collection</Label>
              <Input
                id="table"
                name="table"
                defaultValue={editing?.table || ''}
                placeholder="crm_custom_entity_x"
              />
            </div>
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={2}
                defaultValue={editing?.description || ''}
              />
            </div>
            <ZoruDialogFooter className="gap-2">
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
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete custom module?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Its role permissions will also be removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <ZoruAlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} module(s)?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Role permissions for the deleted modules will also be removed.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleBulkDelete}>
              {bulkDeleting ? 'Deleting…' : 'Delete'}
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
