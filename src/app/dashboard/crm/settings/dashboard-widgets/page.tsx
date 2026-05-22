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
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  LayoutDashboard,
  PieChart,
  Layers,
  UserCircle,
  Download,
  X,
  FileSpreadsheet,
} from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';
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
  getMyDashboardWidgets,
  getDashboardWidgetKpis,
  saveDashboardWidget,
  deleteDashboardWidget,
  reorderDashboardWidgets,
  toggleWidgetVisibility,
  type DashboardWidgetKpis,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
  WsDashboardWidget,
  WsDashboardWidgetType,
} from '@/lib/worksuite/dashboard-types';

type Row = WsDashboardWidget & { _id: string };
type TypeFilter = 'all' | WsDashboardWidgetType;
type VisibilityFilter = 'all' | 'visible' | 'hidden';

const EMPTY_KPIS: DashboardWidgetKpis = {
  total: 0,
  by_type: {},
  by_owner: [],
  visible: 0,
};

export default function DashboardWidgetsPage() {
  const { toast } = useZoruToast();
  const [widgets, setWidgets] = useState<Row[]>([]);
  const [kpis, setKpis] = useState<DashboardWidgetKpis>(EMPTY_KPIS);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState({
    widget_name: '',
    type: 'stats' as WsDashboardWidgetType,
    width: 4,
    config: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [visFilter, setVisFilter] = useState<VisibilityFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [res, k] = await Promise.all([
        getMyDashboardWidgets(),
        getDashboardWidgetKpis(),
      ]);
      setWidgets(Array.isArray(res) ? (res as Row[]) : []);
      setKpis((k as DashboardWidgetKpis) || EMPTY_KPIS);
    } catch (e) {
      console.error('Failed to load widgets', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetForm = () => {
    setEditing(null);
    setForm({ widget_name: '', type: 'stats', width: 4, config: '' });
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: Row) => {
    setEditing(row);
    setForm({
      widget_name: row.widget_name || '',
      type: row.type || 'stats',
      width: row.width || 4,
      config: row.config ? JSON.stringify(row.config, null, 2) : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.widget_name.trim()) {
      toast({
        title: 'Name required',
        description: 'Please provide a widget name.',
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    const fd = new FormData();
    if (editing?._id) fd.set('_id', editing._id);
    fd.set('widget_name', form.widget_name.trim());
    fd.set('type', form.type);
    fd.set('width', String(form.width));
    fd.set(
      'position',
      String(editing?.position ?? widgets.length),
    );
    fd.set(
      'is_visible',
      editing && editing.is_visible === false ? '0' : '1',
    );
    if (form.config) fd.set('config', form.config);
    const res = await saveDashboardWidget(null, fd);
    setSaving(false);
    if (res.error) {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: editing ? 'Updated' : 'Added',
      description: editing
        ? 'Widget updated.'
        : 'Widget added to your dashboard.',
    });
    setDialogOpen(false);
    resetForm();
    refresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteDashboardWidget(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Widget removed.' });
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
        description: res.error || 'Delete failed',
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
        const r = await deleteDashboardWidget(id);
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

  const handleToggle = async (id: string) => {
    const res = await toggleWidgetVisibility(id);
    if (res.success) refresh();
    else
      toast({
        title: 'Error',
        description: res.error || 'Toggle failed',
        variant: 'destructive',
      });
  };

  const sorted = useMemo(
    () => [...widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [widgets],
  );

  const move = (id: string, dir: -1 | 1) => {
    const idx = sorted.findIndex((w) => w._id === id);
    if (idx === -1) return;
    const j = idx + dir;
    if (j < 0 || j >= sorted.length) return;
    const reordered = [...sorted];
    [reordered[idx], reordered[j]] = [reordered[j], reordered[idx]];
    const orderedIds = reordered.map((w) => w._id);
    startTransition(async () => {
      const res = await reorderDashboardWidgets(orderedIds);
      if (res.success) refresh();
      else
        toast({
          title: 'Error',
          description: res.error || 'Reorder failed',
          variant: 'destructive',
        });
    });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sorted.filter((w) => {
      if (q) {
        const hay = `${w.widget_name || ''} ${w.type || ''} ${
          w.config?.data_source || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (typeFilter !== 'all' && w.type !== typeFilter) return false;
      if (visFilter === 'visible' && w.is_visible === false) return false;
      if (visFilter === 'hidden' && w.is_visible !== false) return false;
      return true;
    });
  }, [sorted, search, typeFilter, visFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const hasMore = page < totalPages;

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const topType = useMemo(() => {
    const entries = Object.entries(kpis.by_type);
    if (entries.length === 0) return '—';
    const top = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    return `${top[0]} (${top[1]})`;
  }, [kpis]);

  const exportRowsFor = (subset: Row[]): ExportRow[] =>
    subset.map((w) => ({
      Name: w.widget_name,
      Type: w.type,
      Width: w.width,
      Position: w.position,
      Visible: w.is_visible === false ? 'No' : 'Yes',
      DataSource: w.config?.data_source || '',
    }));

  const doExport = (format: 'csv' | 'xlsx') => {
    const subset = selected.size
      ? filtered.filter((r) => selected.has(r._id))
      : filtered;
    const headers = [
      'Name',
      'Type',
      'Width',
      'Position',
      'Visible',
      'DataSource',
    ];
    const filename = `dashboard-widgets-${dateStamp()}.${format}`;
    if (format === 'csv') downloadCsv(filename, headers, exportRowsFor(subset));
    else
      void downloadXlsx(filename, headers, exportRowsFor(subset), 'Widgets');
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

  const TYPE_OPTIONS: TypeFilter[] = [
    'all',
    'stats',
    'chart',
    'list',
    'calendar',
    'custom',
  ];

  return (
    <EntityListShell
      title="Dashboard Widgets"
      subtitle="Compose your personal CRM dashboard. Add widgets, reorder, and control visibility."
      primaryAction={
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Widget
        </Button>
      }
      search={{
        value: search,
        onChange: setSearch,
        placeholder: 'Search widgets…',
      }}
      filters={
        <>
          {TYPE_OPTIONS.map((t) => (
            <Button
              key={t}
              variant={typeFilter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTypeFilter(t);
                setPage(1);
              }}
            >
              {t === 'all' ? 'All types' : t}
            </Button>
          ))}
          <span className="mx-1 h-4 w-px bg-zoru-line" />
          {(['all', 'visible', 'hidden'] as VisibilityFilter[]).map((v) => (
            <Button
              key={v}
              variant={visFilter === v ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setVisFilter(v);
                setPage(1);
              }}
            >
              {v === 'all' ? 'Any' : v.charAt(0).toUpperCase() + v.slice(1)}
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
      loading={isLoading && widgets.length === 0}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <StatCard
            label="Total widgets"
            value={kpis.total}
            icon={<LayoutDashboard className="h-4 w-4" />}
          />
          <StatCard
            label="Top type"
            value={topType}
            icon={<PieChart className="h-4 w-4" />}
          />
          <StatCard
            label="Visible"
            value={kpis.visible}
            period={`${kpis.total - kpis.visible} hidden`}
            icon={<Layers className="h-4 w-4" />}
          />
          <StatCard
            label="Owner"
            value={kpis.by_owner[0]?.count ?? 0}
            period="this user"
            icon={<UserCircle className="h-4 w-4" />}
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
                    Type
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Width
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Position
                  </ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">
                    Visible
                  </ZoruTableHead>
                  <ZoruTableHead className="w-[180px] text-right text-zoru-ink-muted">
                    Actions
                  </ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {pageRows.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={7}
                      className="h-20 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No widgets match the current filters.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  pageRows.map((w, idx) => (
                    <ZoruTableRow key={w._id}>
                      <ZoruTableCell>
                        <Checkbox
                          checked={selected.has(w._id)}
                          onCheckedChange={() => toggleOne(w._id)}
                          aria-label={`Select ${w.widget_name}`}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        <RowDrawer
                          label={w.widget_name}
                          subtitle={w.config?.data_source || undefined}
                          title={`Widget · ${w.widget_name}`}
                          description="Inline detail. Use Edit to modify."
                        >
                          <div className="space-y-3 text-sm">
                            <div>
                              <div className="text-muted-foreground text-xs">
                                Type
                              </div>
                              <div>{w.type}</div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  Width
                                </div>
                                <div>{w.width}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  Position
                                </div>
                                <div>{w.position ?? 0}</div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  Visible
                                </div>
                                <div>
                                  {w.is_visible === false ? 'No' : 'Yes'}
                                </div>
                              </div>
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  Data source
                                </div>
                                <div className="font-mono text-xs">
                                  {w.config?.data_source || '—'}
                                </div>
                              </div>
                            </div>
                            {w.config && Object.keys(w.config).length > 0 ? (
                              <div>
                                <div className="text-muted-foreground text-xs">
                                  Config
                                </div>
                                <pre className="rounded bg-zoru-surface-2 p-2 text-[11px]">
                                  {JSON.stringify(w.config, null, 2)}
                                </pre>
                              </div>
                            ) : null}
                            <div className="pt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openEdit(w)}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                Edit
                              </Button>
                            </div>
                          </div>
                        </RowDrawer>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant="default">{w.type}</Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                        {w.width}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[12px] text-zoru-ink-muted">
                        {w.position ?? 0}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge
                          variant={
                            w.is_visible === false ? 'ghost' : 'success'
                          }
                        >
                          {w.is_visible === false ? 'Hidden' : 'Visible'}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={idx === 0 || isPending}
                            onClick={() => move(w._id, -1)}
                            aria-label="Move up"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={
                              idx === pageRows.length - 1 || isPending
                            }
                            onClick={() => move(w._id, 1)}
                            aria-label="Move down"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(w._id)}
                            aria-label="Toggle visibility"
                          >
                            {w.is_visible !== false ? (
                              <Eye className="h-3.5 w-3.5" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeletingId(w._id)}
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
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) resetForm();
        }}
      >
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>
              {editing ? 'Edit widget' : 'Add widget'}
            </ZoruDialogTitle>
            <ZoruDialogDescription>
              {editing
                ? 'Update the widget configuration.'
                : 'Add a new widget to your dashboard grid.'}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="widget-name">Widget name</Label>
              <Input
                id="widget-name"
                value={form.widget_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, widget_name: e.target.value }))
                }
                placeholder="e.g. Open deals by stage"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Type</Label>
                <EnumFormField
                  name="__widgetType"
                  enumName="dashboardWidgetType"
                  initialId={form.type}
                  onChange={(id) =>
                    setForm((f) => ({
                      ...f,
                      type: (id ?? 'stats') as WsDashboardWidgetType,
                    }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="widget-width">Width (1–12)</Label>
                <Input
                  id="widget-width"
                  type="number"
                  min={1}
                  max={12}
                  value={form.width}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      width: Math.max(
                        1,
                        Math.min(12, Number(e.target.value) || 1),
                      ),
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="widget-config">
                Config (JSON, optional)
              </Label>
              <Textarea
                id="widget-config"
                rows={4}
                placeholder='{"data_source":"deals.recent"}'
                value={form.config}
                onChange={(e) =>
                  setForm((f) => ({ ...f, config: e.target.value }))
                }
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={saving} onClick={handleSave}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Add Widget'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete widget?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              This permanently removes the widget from your dashboard.
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
              Delete {selected.size} widget(s)?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              The selected widgets will be permanently removed from your
              dashboard.
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
