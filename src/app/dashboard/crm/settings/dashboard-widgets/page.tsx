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
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Eye,
  EyeOff,
  Trash2,
  ArrowUp,
  ArrowDown,
  } from 'lucide-react';

import * as React from 'react';

import { EnumFormField } from '@/components/crm/enum-form-field';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getMyDashboardWidgets,
  saveDashboardWidget,
  deleteDashboardWidget,
  reorderDashboardWidgets,
  toggleWidgetVisibility,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
  WsDashboardWidget,
  WsDashboardWidgetType,
} from '@/lib/worksuite/dashboard-types';

type Row = WsDashboardWidget & { _id: string };

const TYPES: WsDashboardWidgetType[] = [
  'stats',
  'chart',
  'list',
  'calendar',
  'custom',
];

/**
 * Dashboard Widgets settings page.
 *
 * Lets each user compose their personal CRM dashboard: a 12-col grid
 * of widgets that can be added, reordered (up/down), hidden, or
 * deleted. Widths are stored as 1–12 column spans.
 */
export default function DashboardWidgetsPage() {
  const { toast } = useZoruToast();
  const [widgets, setWidgets] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isPending, startTransition] = React.useTransition();

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState({
    widget_name: '',
    type: 'stats' as WsDashboardWidgetType,
    width: 4,
    config: '',
  });
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await getMyDashboardWidgets()) as Row[];
      setWidgets(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load widgets', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleAdd = async () => {
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
    fd.set('widget_name', form.widget_name.trim());
    fd.set('type', form.type);
    fd.set('width', String(form.width));
    fd.set('position', String(widgets.length));
    fd.set('is_visible', '1');
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
    toast({ title: 'Added', description: 'Widget added to your dashboard.' });
    setDialogOpen(false);
    setForm({ widget_name: '', type: 'stats', width: 4, config: '' });
    refresh();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteDashboardWidget(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Widget removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Delete failed',
        variant: 'destructive',
      });
    }
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

  const move = (id: string, dir: -1 | 1) => {
    const sorted = [...widgets].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0),
    );
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

  const sorted = React.useMemo(
    () => [...widgets].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [widgets],
  );

  return (
    <EntityListShell
      title="Dashboard Widgets"
      subtitle="Compose your personal CRM dashboard. Add widgets, reorder, and control visibility."
      primaryAction={
        <ZoruButton onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Add Widget
        </ZoruButton>
      }
    >

      {isLoading ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] text-zoru-ink-muted">Loading…</p>
        </ZoruCard>
      ) : sorted.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              No widgets yet. Add your first widget to start building your
              dashboard.
            </p>
            <div className="mt-4">
              <ZoruButton onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add your first widget
              </ZoruButton>
            </div>
          </div>
        </ZoruCard>
      ) : (
        <div className="grid grid-cols-12 gap-4">
          {sorted.map((w, idx) => {
            const span = Math.max(1, Math.min(12, w.width ?? 4));
            const colClass = `col-span-12 md:col-span-${span}`;
            return (
              <div key={w._id} className={colClass}>
                <ZoruCard
                  className={
                    w.is_visible === false ? 'p-6 opacity-60' : 'p-6'
                  }
                >
                  <div className="flex items-start justify-between gap-3 pb-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] text-zoru-ink">
                        {w.widget_name}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <ZoruBadge variant="default">{w.type}</ZoruBadge>
                        <ZoruBadge variant="ghost">w:{span}</ZoruBadge>
                        <ZoruBadge
                          variant={w.is_visible !== false ? 'success' : 'ghost'}
                        >
                          {w.is_visible !== false ? 'Visible' : 'Hidden'}
                        </ZoruBadge>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        disabled={idx === 0 || isPending}
                        onClick={() => move(w._id, -1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </ZoruButton>
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        disabled={idx === sorted.length - 1 || isPending}
                        onClick={() => move(w._id, 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </ZoruButton>
                      <ZoruButton
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
                      </ZoruButton>
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingId(w._id)}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
                      </ZoruButton>
                    </div>
                  </div>
                  {w.config?.data_source ? (
                    <p className="text-[12px] text-zoru-ink-muted">
                      Source:{' '}
                      <span className="font-mono">{w.config.data_source}</span>
                    </p>
                  ) : (
                    <p className="text-[12px] text-zoru-ink-muted">
                      No data source configured.
                    </p>
                  )}
                </ZoruCard>
              </div>
            );
          })}
        </div>
      )}

      <ZoruDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Add widget</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add a new widget to your dashboard grid.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <ZoruLabel htmlFor="widget-name">Widget name</ZoruLabel>
              <ZoruInput
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
                <ZoruLabel>Type</ZoruLabel>
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
                <ZoruLabel htmlFor="widget-width">Width (1–12)</ZoruLabel>
                <ZoruInput
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
              <ZoruLabel htmlFor="widget-config">Config (JSON, optional)</ZoruLabel>
              <ZoruTextarea
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
            <ZoruButton variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton disabled={saving} onClick={handleAdd}>
              {saving ? 'Saving…' : 'Add Widget'}
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

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
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
