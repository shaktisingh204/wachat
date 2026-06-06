'use client';

/**
 * <SettingsDeepPage /> — light Deep treatment for lookup/category-style
 * CRM settings entities.
 *
 * These entities don't get their own detail page; instead they receive:
 *   - KPI strip (total · in-use · unused · last added)
 *   - Filter row (search + status)
 *   - Bulk delete + bulk export (CSV / XLSX)
 *   - Inline edit via <RowDrawer /> (the row label opens the drawer)
 *   - <PaginationBar /> (client-side, controlled)
 *
 * Used by:
 *   - contracts/types
 *   - tickets/channels
 *   - tickets/tags
 *   - tickets/agent-groups
 *   - projects/task-categories
 */

import * as React from 'react';
import {
  CalendarClock,
  Download,
  FileSpreadsheet,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from 'lucide-react';

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
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { PaginationBar } from '@/components/crm/pagination-bar';
import { RowDrawer } from '@/components/crm/row-drawer';
import {
  dateStamp,
  downloadCsv,
  downloadXlsx,
} from '@/lib/crm-list-export';

/* ─── Types ─────────────────────────────────────────────────────── */

export type SettingsRow = {
  _id: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  archived?: boolean;
  [key: string]: unknown;
};

export interface SettingsColumn<T extends SettingsRow> {
  key: string;
  label: string;
  /** Value used in the table cell. Defaults to row[key]. */
  render?: (row: T) => React.ReactNode;
  /** Value used in CSV/XLSX export. Defaults to row[key]. */
  exportValue?: (row: T) => unknown;
  className?: string;
}

export interface SettingsField {
  name: string;
  label: string;
  type?: 'text' | 'textarea' | 'select';
  required?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  options?: { value: string; label: string }[];
}

export interface SettingsDeepPageKpis {
  total: number;
  inUse: number;
  unused: number;
  lastAddedAt: string | null;
}

export interface SettingsDeepPageProps<T extends SettingsRow> {
  /** Page title. */
  title: string;
  /** Page subtitle. */
  subtitle: string;
  /** Singular noun, e.g. "Channel", "Tag". */
  singular: string;
  /** Label for the row-drawer subtitle ("Channel" / "Tag" / etc). */
  drawerKind: string;
  /** Columns shown in the table and used as the export schema. */
  columns: SettingsColumn<T>[];
  /** Inline-create / edit dialog fields. */
  fields: SettingsField[];
  /** Filename base for exports (no extension, no date stamp). */
  exportBaseName: string;
  /** Server action: list all rows. */
  getAllAction: () => Promise<T[]>;
  /** Server action: KPI snapshot. */
  getKpisAction: () => Promise<SettingsDeepPageKpis>;
  /** Server action: save (create / update). */
  saveAction: (
    prev: unknown,
    formData: FormData,
  ) => Promise<{ message?: string; error?: string; id?: string }>;
  /** Server action: delete a single row by id. */
  deleteAction: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Server action: bulk delete by ids. */
  bulkDeleteAction: (
    ids: string[],
  ) => Promise<{ success: boolean; deleted: number; error?: string }>;
  /** Returns the searchable text for a row. Defaults to JSON-of-fields. */
  searchText?: (row: T) => string;
  /** Returns the display name for a row (used in delete confirm dialogs). */
  displayName: (row: T) => string;
}

type StatusFilter = 'all' | 'active' | 'archived';

const PAGE_SIZE_DEFAULT = 20;

/* ─── Submit button ─────────────────────────────────────────────── */

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
      {isEditing ? 'Save changes' : 'Create'}
    </Button>
  );
}

/* ─── Edit dialog ───────────────────────────────────────────────── */

function SettingsEditDialog<T extends SettingsRow>({
  isOpen,
  onOpenChange,
  onSaved,
  initial,
  singular,
  fields,
  saveAction,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  initial: T | null;
  singular: string;
  fields: SettingsField[];
  saveAction: SettingsDeepPageProps<T>['saveAction'];
}) {
  const isEditing = !!initial;
  const [state, formAction] = useActionState(saveAction, {
    message: '',
    error: '',
  } as { message?: string; error?: string; id?: string });
  const { toast } = useZoruToast();

  React.useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      onSaved();
      onOpenChange(false);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, onSaved, onOpenChange]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="sm:max-w-xl">
        <form action={formAction}>
          {isEditing ? (
            <input type="hidden" name="_id" value={initial!._id} />
          ) : null}

          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {isEditing ? `Edit ${singular}` : `Create ${singular}`}
            </ZoruDialogTitle>
          </ZoruDialogHeader>

          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2">
            {fields.map((field) => {
              const initialValue =
                initial && initial[field.name] != null
                  ? String(initial[field.name])
                  : '';
              return (
                <div
                  key={field.name}
                  className={
                    field.fullWidth ? 'space-y-2 sm:col-span-2' : 'space-y-2'
                  }
                >
                  <Label htmlFor={field.name}>
                    {field.label}
                    {field.required ? (
                      <span className="text-zoru-danger-ink"> *</span>
                    ) : null}
                  </Label>
                  {field.type === 'textarea' ? (
                    <textarea
                      id={field.name}
                      name={field.name}
                      rows={3}
                      defaultValue={initialValue}
                      placeholder={field.placeholder}
                      required={field.required}
                      className="flex min-h-[60px] w-full rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-bg px-3 py-2 text-sm text-zoru-ink"
                    />
                  ) : field.type === 'select' ? (
                    <Select
                      name={field.name}
                      defaultValue={initialValue || undefined}
                    >
                      <ZoruSelectTrigger id={field.name}>
                        <ZoruSelectValue
                          placeholder={field.placeholder ?? 'Select…'}
                        />
                      </ZoruSelectTrigger>
                      <ZoruSelectContent>
                        {(field.options ?? []).map((opt) => (
                          <ZoruSelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </ZoruSelectItem>
                        ))}
                      </ZoruSelectContent>
                    </Select>
                  ) : (
                    <Input
                      id={field.name}
                      name={field.name}
                      type="text"
                      defaultValue={initialValue}
                      placeholder={field.placeholder}
                      required={field.required}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <ZoruDialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <SubmitButton isEditing={isEditing} />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function formatStamp(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
}

function defaultSearchText<T extends SettingsRow>(
  row: T,
  columns: SettingsColumn<T>[],
): string {
  return columns
    .map((c) => {
      const raw = row[c.key];
      return raw == null ? '' : String(raw);
    })
    .join(' ')
    .toLowerCase();
}

/* ─── Component ─────────────────────────────────────────────────── */

export function SettingsDeepPage<T extends SettingsRow>({
  title,
  subtitle,
  singular,
  drawerKind,
  columns,
  fields,
  exportBaseName,
  getAllAction,
  getKpisAction,
  saveAction,
  deleteAction,
  bulkDeleteAction,
  searchText,
  displayName,
}: SettingsDeepPageProps<T>): React.JSX.Element {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<T[]>([]);
  const [kpis, setKpis] = React.useState<SettingsDeepPageKpis>({
    total: 0,
    inUse: 0,
    unused: 0,
    lastAddedAt: null,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all');
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(PAGE_SIZE_DEFAULT);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [editing, setEditing] = React.useState<T | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<T | null>(null);
  const [pendingBulk, setPendingBulk] = React.useState(false);
  const [deletePending, startDeleteTransition] = React.useTransition();
  const [bulkPending, startBulkTransition] = React.useTransition();

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [list, snapshot] = await Promise.all([
        getAllAction(),
        getKpisAction(),
      ]);
      setRows(Array.isArray(list) ? list : []);
      setKpis(snapshot);
    } finally {
      setIsLoading(false);
    }
  }, [getAllAction, getKpisAction]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  /* ── Filtering / pagination ──────────────────────────────────── */

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all') {
        const isArchived = r.archived === true;
        if (statusFilter === 'archived' && !isArchived) return false;
        if (statusFilter === 'active' && isArchived) return false;
      }
      if (!q) return true;
      const txt = searchText ? searchText(r) : defaultSearchText(r, columns);
      return txt.toLowerCase().includes(q);
    });
  }, [rows, search, statusFilter, searchText, columns]);

  React.useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const pageRows = React.useMemo(() => {
    const from = (page - 1) * pageSize;
    return filtered.slice(from, from + pageSize);
  }, [filtered, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const hasMore = page < totalPages;

  /* ── Selection ───────────────────────────────────────────────── */

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = (checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of pageRows) {
        if (checked) next.add(r._id);
        else next.delete(r._id);
      }
      return next;
    });
  };

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selected.has(r._id));
  const someOnPageSelected =
    !allOnPageSelected && pageRows.some((r) => selected.has(r._id));

  /* ── Exports ─────────────────────────────────────────────────── */

  const headers = columns.map((c) => c.label);

  const buildExportRows = React.useCallback(
    (source: T[]): Record<string, unknown>[] =>
      source.map((row) => {
        const out: Record<string, unknown> = {};
        for (const c of columns) {
          const v = c.exportValue ? c.exportValue(row) : row[c.key];
          out[c.label] = v == null ? '' : v;
        }
        return out;
      }),
    [columns],
  );

  const exportSet = React.useCallback((): T[] => {
    if (selected.size > 0) return rows.filter((r) => selected.has(r._id));
    return filtered;
  }, [rows, filtered, selected]);

  const handleExportCsv = () => {
    const src = exportSet();
    if (src.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No rows match the current filter.',
      });
      return;
    }
    downloadCsv(
      `${exportBaseName}-${dateStamp()}.csv`,
      headers,
      buildExportRows(src),
    );
  };

  const handleExportXlsx = async () => {
    const src = exportSet();
    if (src.length === 0) {
      toast({
        title: 'Nothing to export',
        description: 'No rows match the current filter.',
      });
      return;
    }
    await downloadXlsx(
      `${exportBaseName}-${dateStamp()}.xlsx`,
      headers,
      buildExportRows(src),
      exportBaseName,
    );
  };

  /* ── Delete handlers ─────────────────────────────────────────── */

  const handleDeleteOne = () => {
    if (!pendingDelete) return;
    startDeleteTransition(async () => {
      const res = await deleteAction(pendingDelete._id);
      if (res.success) {
        toast({ title: `${singular} deleted` });
        setPendingDelete(null);
        setSelected((prev) => {
          const next = new Set(prev);
          next.delete(pendingDelete._id);
          return next;
        });
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    startBulkTransition(async () => {
      const res = await bulkDeleteAction(ids);
      if (res.success) {
        toast({
          title: 'Bulk delete complete',
          description: `${res.deleted} ${
            res.deleted === 1 ? singular.toLowerCase() : `${singular.toLowerCase()}s`
          } removed.`,
        });
        setSelected(new Set());
        setPendingBulk(false);
        await refresh();
      } else {
        toast({
          title: 'Error',
          description: res.error,
          variant: 'destructive',
        });
      }
    });
  };

  /* ── Render ──────────────────────────────────────────────────── */

  return (
    <>
      <SettingsEditDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSaved={() => {
          void refresh();
        }}
        initial={editing}
        singular={singular}
        fields={fields}
        saveAction={saveAction}
      />

      <EntityListShell
        title={title}
        subtitle={subtitle}
        primaryAction={
          <Button
            onClick={() => {
              setEditing(null);
              setIsDialogOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New {singular}
          </Button>
        }
        search={{
          value: search,
          onChange: setSearch,
          placeholder: `Search ${singular.toLowerCase()}s…`,
        }}
        filters={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <ZoruSelectTrigger className="h-9 w-[150px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                <ZoruSelectItem value="active">Active</ZoruSelectItem>
                <ZoruSelectItem value="archived">Archived</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            {search || statusFilter !== 'all' ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setStatusFilter('all');
                }}
              >
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>
        }
        bulkBar={
          selected.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
                <Badge variant="default">
                  {selected.size} selected
                </Badge>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="text-zoru-ink-muted hover:text-zoru-ink"
                >
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                >
                  <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void handleExportXlsx();
                  }}
                >
                  <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setPendingBulk(true)}
                  disabled={bulkPending}
                >
                  <Trash2 className="mr-1 h-3.5 w-3.5" />
                  Delete {selected.size}
                </Button>
              </div>
            </div>
          ) : null
        }
        loading={isLoading && rows.length === 0}
        pagination={
          filtered.length > 0 ? (
            <PaginationBar
              page={page}
              limit={pageSize}
              hasMore={hasMore}
              total={filtered.length}
              controlled={{
                onChange: (next) => {
                  setPage(next.page);
                  setPageSize(next.limit);
                },
              }}
            />
          ) : null
        }
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard
              label={`Total ${singular.toLowerCase()}s`}
              value={kpis.total.toLocaleString()}
            />
            <StatCard
              label="Active"
              value={Math.max(
                0,
                kpis.total - rows.filter((r) => r.archived === true).length,
              ).toLocaleString()}
            />
            <StatCard label="In use" value={kpis.inUse.toLocaleString()} />
            <StatCard
              label="Last added"
              value={formatStamp(kpis.lastAddedAt)}
              icon={<CalendarClock className="h-4 w-4" />}
            />
          </div>

          {/* Toolbar action — bulk export when nothing is selected */}
          {selected.size === 0 ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportCsv}
                disabled={filtered.length === 0}
              >
                <Download className="mr-1 h-3.5 w-3.5" /> Export CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleExportXlsx();
                }}
                disabled={filtered.length === 0}
              >
                <FileSpreadsheet className="mr-1 h-3.5 w-3.5" /> Export XLSX
              </Button>
            </div>
          ) : null}

          {/* Table */}
          <Card className="p-0">
            <div className="overflow-x-auto rounded-[var(--zoru-radius)] border border-zoru-line">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead className="w-10">
                      <Checkbox
                        checked={
                          allOnPageSelected
                            ? true
                            : someOnPageSelected
                              ? 'indeterminate'
                              : false
                        }
                        onCheckedChange={(v) =>
                          toggleAllOnPage(v === true)
                        }
                        aria-label="Select all rows on this page"
                      />
                    </ZoruTableHead>
                    {columns.map((c) => (
                      <ZoruTableHead
                        key={c.key}
                        className={c.className ?? 'text-zoru-ink-muted'}
                      >
                        {c.label}
                      </ZoruTableHead>
                    ))}
                    <ZoruTableHead className="text-right text-zoru-ink-muted">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {isLoading && rows.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <ZoruTableRow key={i}>
                        <ZoruTableCell colSpan={columns.length + 2}>
                          <Skeleton className="h-8 w-full" />
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  ) : pageRows.length === 0 ? (
                    <ZoruTableRow>
                      <ZoruTableCell
                        colSpan={columns.length + 2}
                        className="h-24 text-center text-[13px] text-zoru-ink-muted"
                      >
                        No {singular.toLowerCase()}s match this filter.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    pageRows.map((row) => {
                      const id = row._id;
                      return (
                        <ZoruTableRow key={id} className="border-zoru-line">
                          <ZoruTableCell>
                            <Checkbox
                              checked={selected.has(id)}
                              onCheckedChange={() => toggleOne(id)}
                              aria-label={`Select ${displayName(row)}`}
                            />
                          </ZoruTableCell>
                          {columns.map((c, colIdx) => {
                            const content = c.render
                              ? c.render(row)
                              : ((row[c.key] as React.ReactNode) ?? '—');
                            // First column wraps the value in a RowDrawer so
                            // clicking it opens a read-only summary, while the
                            // pencil action in the Actions column opens the
                            // edit dialog (settings entities have no detail
                            // page).
                            if (colIdx === 0) {
                              return (
                                <ZoruTableCell
                                  key={c.key}
                                  className="font-medium text-zoru-ink"
                                >
                                  <RowDrawer
                                    label={content}
                                    title={`${drawerKind} · ${displayName(row)}`}
                                    description={`Read-only ${drawerKind.toLowerCase()} summary. Use the row Edit action to modify.`}
                                  >
                                    <div className="space-y-3 text-sm">
                                      {columns.map((cc) => {
                                        const raw = cc.exportValue
                                          ? cc.exportValue(row)
                                          : row[cc.key];
                                        const display =
                                          raw == null || raw === ''
                                            ? '—'
                                            : String(raw);
                                        return (
                                          <div key={cc.key}>
                                            <div className="text-zoru-ink-muted text-xs">
                                              {cc.label}
                                            </div>
                                            <div>{display}</div>
                                          </div>
                                        );
                                      })}
                                      <div>
                                        <div className="text-zoru-ink-muted text-xs">
                                          Created
                                        </div>
                                        <div>
                                          {row.createdAt
                                            ? new Date(
                                                String(row.createdAt),
                                              ).toLocaleString()
                                            : '—'}
                                        </div>
                                      </div>
                                    </div>
                                  </RowDrawer>
                                </ZoruTableCell>
                              );
                            }
                            return (
                              <ZoruTableCell
                                key={c.key}
                                className="text-[13px] text-zoru-ink"
                              >
                                {content}
                              </ZoruTableCell>
                            );
                          })}
                          <ZoruTableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(row);
                                  setIsDialogOpen(true);
                                }}
                                aria-label={`Edit ${displayName(row)}`}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPendingDelete(row)}
                                aria-label={`Delete ${displayName(row)}`}
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
          </Card>
        </div>
      </EntityListShell>

      {/* Single-row delete confirm */}
      <ZoruAlertDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete {singular}?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {pendingDelete
                ? `Deleting "${displayName(pendingDelete)}" cannot be undone.`
                : 'This action cannot be undone.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleDeleteOne}
              disabled={deletePending}
            >
              {deletePending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Bulk delete confirm */}
      <ZoruAlertDialog
        open={pendingBulk}
        onOpenChange={(o) => !o && setPendingBulk(false)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>
              Delete {selected.size} {selected.size === 1 ? singular.toLowerCase() : `${singular.toLowerCase()}s`}?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              Selected rows will be permanently removed. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkPending}
            >
              {bulkPending ? (
                <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </>
  );
}
