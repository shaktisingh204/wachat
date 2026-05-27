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
  Input,
  Label,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  Sparkles,
  ListChecks,
  ShieldCheck,
  Wrench,
  Activity,
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
  getPermissionTypes,
  getPermissionTypeKpis,
  savePermissionType,
  deletePermissionType,
  seedPermissionTypes,
  type PermissionTypeKpis,
} from '@/app/actions/worksuite/rbac.actions';
import type {
  WsPermissionType,
  WsPermissionTypeName,
} from '@/lib/worksuite/rbac-types';

type Row = WsPermissionType & { _id: string };
type Category = 'all' | 'builtin' | 'custom';

const BUILTIN: WsPermissionTypeName[] = [
  'none',
  'all',
  'added',
  'owned',
  'both',
];

const EMPTY_KPIS: PermissionTypeKpis = {
  total: 0,
  by_category: { custom: 0, builtin: 0 },
  in_use: 0,
  last_updated_at: null,
};

function isBuiltin(name?: string | null): boolean {
  return BUILTIN.includes((name || '') as WsPermissionTypeName);
}

export default function PermissionTypesPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<PermissionTypeKpis>(EMPTY_KPIS);
  const [isLoading, startLoading] = useTransition();
  const [isSeeding, startSeed] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [saveState, saveAction, isSaving] = useActionState(savePermissionType, {
    message: '',
    error: '',
  } as { message?: string; error?: string });

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      const [list, k] = await Promise.all([
        getPermissionTypes(),
        getPermissionTypeKpis(),
      ]);
      setRows((list as Row[]) || []);
      setKpis((k as PermissionTypeKpis) || EMPTY_KPIS);
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

  const doSeed = () =>
    startSeed(async () => {
      const res = await seedPermissionTypes();
      toast({
        title: 'Seeded',
        description: `Inserted ${res.inserted} types.`,
      });
      refresh();
    });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.display_name || ''} ${r.name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (category === 'builtin' && !isBuiltin(r.name)) return false;
      if (category === 'custom' && isBuiltin(r.name)) return false;
      return true;
    });
  }, [rows, search, category]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasMore = page < totalPages;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deletePermissionType(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Type removed.' });
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
        const r = await deletePermissionType(id);
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
      Name: r.name,
      Display: r.display_name || '',
      Category: isBuiltin(r.name) ? 'Built-in' : 'Custom',
    }));

  const doExport = (format: 'csv' | 'xlsx') => {
    const subset = selected.size
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    const headers = ['Name', 'Display', 'Category'];
    const filename = `permission-types-${dateStamp()}.${format}`;
    if (format === 'csv') downloadCsv(filename, headers, exportRowsFor(subset));
    else
      void downloadXlsx(
        filename,
        headers,
        exportRowsFor(subset),
        'Permission Types',
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

  const headerActions = (
    <>
      <Button variant="outline" disabled={isSeeding} onClick={doSeed}>
        {isSeeding ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Seed defaults
      </Button>
      <Button
        onClick={() => {
          setEditing(null);
          setDialogOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        Add Type
      </Button>
    </>
  );

  return (
    <EntityListShell
      title="Permission Types"
      subtitle="Scope vocabulary used when granting a permission to a role (none / all / added / owned / both)."
      primaryAction={headerActions}
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search types…',
      }}
      filters={
        <>
          {(['all', 'builtin', 'custom'] as Category[]).map((c) => (
            <Button
              key={c}
              variant={category === c ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setCategory(c);
                setPage(1);
              }}
            >
              {c === 'all' ? 'All' : c === 'builtin' ? 'Built-in' : 'Custom'}
            </Button>
          ))}
        </>
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
            label="Total types"
            value={kpis.total}
            icon={<ListChecks className="h-4 w-4" />}
          />
          <StatCard
            label="Built-in"
            value={kpis.by_category.builtin}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <StatCard
            label="Custom"
            value={kpis.by_category.custom}
            icon={<Wrench className="h-4 w-4" />}
          />
          <StatCard
            label="In use"
            value={kpis.in_use}
            period="role-permission grants"
            icon={<Activity className="h-4 w-4" />}
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
                    Display
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Category
                  </ZoruTableHead>
                  <ZoruTableHead className="w-[140px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && rows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      <LoaderCircle className="mx-auto h-4 w-4 animate-spin" />
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : pageRows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No types match the current filters.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  pageRows.map((row) => {
                    const builtin = isBuiltin(row.name);
                    return (
                      <ZoruTableRow key={row._id}>
                        <ZoruTableCell>
                          <Checkbox
                            checked={selected.has(row._id)}
                            onCheckedChange={() => toggleOne(row._id)}
                            aria-label={`Select ${row.name}`}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <RowDrawer
                            label={
                              <Badge variant="ghost">{row.name}</Badge>
                            }
                            subtitle={row.display_name || undefined}
                            title={`Permission Type · ${row.name}`}
                            description="Inline detail. Use Edit to modify."
                          >
                            <div className="space-y-3 text-sm">
                              <div>
                                <div className="text-zoru-ink-muted text-xs">
                                  Name
                                </div>
                                <div className="font-mono">{row.name}</div>
                              </div>
                              <div>
                                <div className="text-zoru-ink-muted text-xs">
                                  Display name
                                </div>
                                <div>{row.display_name || '—'}</div>
                              </div>
                              <div>
                                <div className="text-zoru-ink-muted text-xs">
                                  Category
                                </div>
                                <div>{builtin ? 'Built-in' : 'Custom'}</div>
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
                        <ZoruTableCell className="text-[13px] text-zoru-ink">
                          {row.display_name || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge variant={builtin ? 'default' : 'success'}>
                            {builtin ? 'Built-in' : 'Custom'}
                          </Badge>
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
                    );
                  })
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent className="max-w-md">
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit Type' : 'Add Type'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              Permission types describe the scope of a grant.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={saveAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <div>
              <Label htmlFor="name">
                Name <span className="text-zoru-danger-ink">*</span>
              </Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={editing?.name || ''}
                placeholder="all"
              />
            </div>
            <div>
              <Label htmlFor="display_name">Display name</Label>
              <Input
                id="display_name"
                name="display_name"
                defaultValue={editing?.display_name || ''}
                placeholder="All"
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
            <ZoruAlertDialogTitle>Delete type?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Role grants referencing this type may break.
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
              Delete {selected.size} type(s)?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Role grants referencing the deleted types may break.
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
