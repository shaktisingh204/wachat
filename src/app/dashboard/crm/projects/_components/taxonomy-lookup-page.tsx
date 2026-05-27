'use client';

import * as React from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import { PaginationBar } from '@/components/crm/pagination-bar';
import {
  downloadCsv,
  downloadXlsx,
  dateStamp,
  type ExportRow,
} from '@/lib/crm-list-export';

/**
 * <TaxonomyLookupPage/> — shared client shell for project taxonomy lists
 * (labels, categories, task-labels, task-tags). Provides KPI strip,
 * filter row, bulk delete + bulk export, inline RowDrawer detail, and
 * client-side pagination — all backed by `getList` / `saveAction` /
 * `deleteAction` (multi-tenant via the server action layer).
 */

export interface TaxonomyRow {
  _id: string;
  createdAt?: Date | string;
  color?: string;
  description?: string;
}

export interface TaxonomyField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'color' | 'select';
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  options?: { value: string; label: string }[];
}

export interface TaxonomyColumn<R extends TaxonomyRow> {
  key: string;
  label: string;
  render?: (row: R) => React.ReactNode;
}

export interface TaxonomyLookupPageProps<R extends TaxonomyRow> {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  singular: string;
  nameKey: keyof R & string;
  hasColor?: boolean;
  hasStatus?: boolean;
  columns: TaxonomyColumn<R>[];
  fields: TaxonomyField[];
  getList: () => Promise<R[]>;
  saveAction: (prev: unknown, fd: FormData) => Promise<{ message?: string; error?: string }>;
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  bulkDelete: (ids: string[]) => Promise<{ deleted: number; failed: number }>;
  exportFilenameStem: string;
}

const PAGE_SIZE = 25;

export function TaxonomyLookupPage<R extends TaxonomyRow>({
  title,
  subtitle,
  icon: Icon,
  singular,
  nameKey,
  hasColor,
  hasStatus,
  columns,
  fields,
  getList,
  saveAction,
  deleteAction,
  bulkDelete,
  exportFilenameStem,
}: TaxonomyLookupPageProps<R>) {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<R[]>([]);
  const [isLoading, startLoading] = React.useTransition();
  const [, startMutate] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<R | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = React.useState<R | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [colorFilter, setColorFilter] = React.useState<'all' | 'has' | 'none'>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'active' | 'archived'>('all');
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(PAGE_SIZE);

  const load = React.useCallback(() => {
    startLoading(async () => {
      const list = await getList();
      setRows(list);
    });
  }, [getList]);

  React.useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const kpiTotal = rows.length;
  const kpiInUse = hasColor
    ? rows.filter((r) => Boolean(r.color)).length
    : rows.filter((r) => Boolean(r.description)).length;
  const kpiRecent = rows.filter((r) => {
    const t = r.createdAt ? new Date(r.createdAt).getTime() : NaN;
    return Number.isFinite(t) && t >= sevenDaysAgo;
  }).length;

  const filtered = React.useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (needle) {
        const haystack = `${String(r[nameKey] ?? '')} ${r.description ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      if (hasColor && colorFilter !== 'all') {
        const has = Boolean(r.color);
        if (colorFilter === 'has' && !has) return false;
        if (colorFilter === 'none' && has) return false;
      }
      if (hasStatus && statusFilter !== 'all') {
        const s = String((r as Record<string, unknown>).status ?? 'active');
        if (s !== statusFilter) return false;
      }
      return true;
    });
  }, [rows, q, colorFilter, statusFilter, hasColor, hasStatus, nameKey]);

  React.useEffect(() => {
    setPage(1);
  }, [q, colorFilter, statusFilter, limit]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / limit));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = React.useMemo(
    () => filtered.slice((pageSafe - 1) * limit, pageSafe * limit),
    [filtered, pageSafe, limit],
  );

  const buildExport = (subset: R[]): { headers: string[]; rows: ExportRow[] } => {
    const headers = columns.map((c) => c.label);
    const out: ExportRow[] = subset.map((r) => {
      const o: ExportRow = {};
      for (const c of columns) {
        const raw = (r as Record<string, unknown>)[c.key];
        o[c.label] = raw == null ? '' : String(raw);
      }
      return o;
    });
    return { headers, rows: out };
  };

  const onExportCsv = (subset: R[]) => {
    const { headers, rows: out } = buildExport(subset);
    downloadCsv(`${exportFilenameStem}-${dateStamp()}.csv`, headers, out);
  };
  const onExportXlsx = (subset: R[]) => {
    const { headers, rows: out } = buildExport(subset);
    void downloadXlsx(`${exportFilenameStem}-${dateStamp()}.xlsx`, headers, out, title);
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selected);
    const r = await bulkDelete(ids);
    if (r.failed === 0) {
      toast({ title: 'Deleted', description: `${r.deleted} ${singular.toLowerCase()}(s) removed` });
    } else {
      toast({
        title: 'Partial failure',
        description: `${r.deleted} deleted, ${r.failed} failed`,
        variant: 'destructive',
      });
    }
    setSelected(new Set());
    setPendingBulk(false);
    load();
  };

  const onSubmit = async (formData: FormData) => {
    const res = await saveAction(undefined, formData);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: 'Saved', description: res.message ?? `${singular} saved.` });
    setOpen(false);
    setEditing(null);
    load();
  };

  const openNew = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (row: R) => {
    setEditing(row);
    setOpen(true);
  };

  const handleSingleDelete = (row: R) => {
    startMutate(async () => {
      const r = await deleteAction(row._id);
      if (r.success) {
        toast({ title: 'Deleted' });
        setSelected((s) => {
          const next = new Set(s);
          next.delete(row._id);
          return next;
        });
        load();
      } else {
        toast({ title: 'Error', description: r.error, variant: 'destructive' });
      }
    });
    setPendingDelete(null);
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((s) => {
      const next = new Set(s);
      for (const r of pageRows) {
        if (checked) next.add(r._id);
        else next.delete(r._id);
      }
      return next;
    });
  };

  return (
    <>
      <EntityListShell
        title={title}
        subtitle={subtitle}
        search={{ value: q, onChange: setQ, placeholder: `Search ${title.toLowerCase()}…` }}
        primaryAction={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onExportCsv(filtered)}>
              <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
              CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => onExportXlsx(filtered)}>
              <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} />
              XLSX
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New {singular}
            </Button>
          </div>
        }
        filters={
          <>
            {hasColor ? (
              <div className="w-44">
                <Select value={colorFilter} onValueChange={(v) => setColorFilter(v as typeof colorFilter)}>
                  <ZoruSelectTrigger><ZoruSelectValue placeholder="Color" /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All colors</ZoruSelectItem>
                    <ZoruSelectItem value="has">Has color</ZoruSelectItem>
                    <ZoruSelectItem value="none">No color</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            ) : null}
            {hasStatus ? (
              <div className="w-44">
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                  <ZoruSelectTrigger><ZoruSelectValue placeholder="Status" /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                    <ZoruSelectItem value="active">Active</ZoruSelectItem>
                    <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
            ) : null}
          </>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] text-zoru-ink-muted">{selected.size} selected</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onExportCsv(rows.filter((r) => selected.has(r._id)))}
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Export selected
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPendingBulk(true)}>
                  <Trash2 className="h-3.5 w-3.5 text-zoru-ink" strokeWidth={1.75} />
                  Delete selected
                </Button>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard
              label={`Total ${title.toLowerCase()}`}
              value={kpiTotal.toLocaleString('en-IN')}
              icon={<Icon className="h-4 w-4" />}
            />
            <StatCard
              label={hasColor ? 'With color' : 'With description'}
              value={kpiInUse.toLocaleString('en-IN')}
              icon={<Icon className="h-4 w-4" />}
            />
            <StatCard
              label="Recently added"
              value={kpiRecent.toLocaleString('en-IN')}
              icon={<Icon className="h-4 w-4" />}
              period="last 7 days"
            />
          </div>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead>
                  <tr className="border-b border-zoru-line bg-zoru-surface-2">
                    <th className="w-10 px-3 py-3">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={(c) => toggleAllOnPage(Boolean(c))}
                        aria-label="Select all on page"
                      />
                    </th>
                    {columns.map((c) => (
                      <th key={c.key} className="px-4 py-3 font-medium text-zoru-ink-muted">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right font-medium text-zoru-ink-muted">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 2} className="px-4 py-10 text-center text-zoru-ink-muted">
                        {rows.length === 0
                          ? `No ${title.toLowerCase()} yet. Click "New ${singular}" to create one.`
                          : `No ${title.toLowerCase()} match the current filters.`}
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const isSel = selected.has(row._id);
                      const name = String(row[nameKey] ?? '');
                      return (
                        <tr key={row._id} className="border-b border-zoru-line last:border-0">
                          <td className="px-3 py-3">
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={(c) => {
                                setSelected((s) => {
                                  const next = new Set(s);
                                  if (c) next.add(row._id);
                                  else next.delete(row._id);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${name}`}
                            />
                          </td>
                          {columns.map((c, idx) => (
                            <td key={c.key} className="px-4 py-3 text-zoru-ink">
                              {idx === 0 ? (
                                <RowDrawer
                                  label={
                                    <span className="inline-flex items-center gap-2">
                                      {hasColor && row.color ? (
                                        <span
                                          aria-hidden
                                          className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                                          style={{ backgroundColor: row.color }}
                                        />
                                      ) : null}
                                      {c.render ? c.render(row) : name}
                                    </span>
                                  }
                                  subtitle={row.description ?? undefined}
                                  title={`${singular} · ${name}`}
                                  description="Inline details. Use the row Edit action to modify."
                                >
                                  <RowDrawerBody row={row} columns={columns} onEdit={() => openEdit(row)} />
                                </RowDrawer>
                              ) : c.render ? (
                                c.render(row)
                              ) : (
                                String((row as Record<string, unknown>)[c.key] ?? '—')
                              )}
                            </td>
                          ))}
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                                <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => setPendingDelete(row)}>
                                <Trash2 className="h-3.5 w-3.5 text-zoru-ink" strokeWidth={1.75} />
                                Delete
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <PaginationBar
              page={pageSafe}
              limit={limit}
              hasMore={pageSafe < totalPages}
              total={filtered.length}
              controlled={{
                onChange: (next) => {
                  setPage(next.page);
                  setLimit(next.limit);
                },
              }}
            />
          </Card>
        </div>
      </EntityListShell>

      <TaxonomyDialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
        singular={singular}
        fields={fields}
        editing={editing}
        onSubmit={onSubmit}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${singular.toLowerCase()}?`}
        description={`Removing "${String(pendingDelete?.[nameKey] ?? '')}" cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) handleSingleDelete(pendingDelete);
        }}
      />

      <ConfirmDialog
        open={pendingBulk}
        onOpenChange={setPendingBulk}
        title={`Delete ${selected.size} ${singular.toLowerCase()}(s)?`}
        description="This bulk action cannot be undone."
        confirmLabel="Delete all"
        onConfirm={handleBulkDelete}
      />
    </>
  );
}

function RowDrawerBody<R extends TaxonomyRow>({
  row,
  columns,
  onEdit,
}: {
  row: R;
  columns: TaxonomyColumn<R>[];
  onEdit: () => void;
}) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="space-y-3">
        {columns.map((c) => (
          <div key={c.key}>
            <dt className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">{c.label}</dt>
            <dd className="text-zoru-ink">
              {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
            </dd>
          </div>
        ))}
        {row.description ? (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">Description</dt>
            <dd className="text-zoru-ink">{row.description}</dd>
          </div>
        ) : null}
      </dl>
      <Button onClick={onEdit} variant="outline" size="sm">
        <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
        Edit
      </Button>
    </div>
  );
}

function TaxonomyDialog<R extends TaxonomyRow>({
  open,
  onOpenChange,
  singular,
  fields,
  editing,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  singular: string;
  fields: TaxonomyField[];
  editing: R | null;
  onSubmit: (fd: FormData) => Promise<void>;
}) {
  const [pending, setPending] = React.useState(false);
  const isEditing = !!editing;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPending(true);
    try {
      await onSubmit(new FormData(e.currentTarget));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          {isEditing ? <input type="hidden" name="_id" value={editing!._id} /> : null}
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? `Edit ${singular.toLowerCase()}` : `Create new ${singular.toLowerCase()}`}
            </ZoruDialogTitle>
          </ZoruDialogHeader>
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            {fields.map((f) => {
              const defaultVal = editing
                ? String((editing as unknown as Record<string, unknown>)[f.name] ?? '')
                : '';
              return (
                <div
                  key={f.name}
                  className={f.fullWidth ? 'space-y-2 sm:col-span-2' : 'space-y-2'}
                >
                  <Label htmlFor={f.name}>
                    {f.label}
                    {f.required ? ' *' : null}
                  </Label>
                  {f.type === 'textarea' ? (
                    <Textarea
                      id={f.name}
                      name={f.name}
                      rows={3}
                      placeholder={f.placeholder}
                      required={f.required}
                      defaultValue={defaultVal}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      id={f.name}
                      name={f.name}
                      required={f.required}
                      defaultValue={defaultVal}
                      className="flex h-10 w-full rounded-md border border-zoru-line bg-zoru-surface px-3 py-2 text-sm ring-offset-zoru-surface placeholder:text-zoru-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zoru-line disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {f.placeholder ? (
                        <option value="">{f.placeholder}</option>
                      ) : (
                        <option value="">-- Select {f.label} --</option>
                      )}
                      {f.options?.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={f.name}
                      name={f.name}
                      type={f.type === 'color' ? 'text' : 'text'}
                      placeholder={f.placeholder}
                      required={f.required}
                      defaultValue={defaultVal}
                    />
                  )}
                  {f.type === 'color' ? (
                    <Badge variant="secondary">Hex color e.g. #2563eb</Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
          <ZoruDialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {isEditing ? 'Save changes' : `Create ${singular.toLowerCase()}`}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
