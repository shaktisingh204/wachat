'use client';

import {
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import {
  useRouter } from 'next/navigation';
import {
    ArrowDown,
  ArrowUp,
  LoaderCircle,
  Plus,
  Save,
  Trash2,
  } from 'lucide-react';

/**
 * §6.5 Dashboard editor (client).
 *
 * Renders the current widget list in a 12-column CSS grid. Each
 * widget exposes inline editing (title, kind, w/h, data source)
 * plus Move up / Move down reordering. No drag-and-drop yet —
 * `react-grid-layout` isn't installed; @dnd-kit is available but
 * adds complexity that this MVP doesn't need. The "Save layout"
 * button hands the array off to `saveDashboardLayout`.
 */

import * as React from 'react';
import Link from 'next/link';

import {
    saveDashboardLayout,
    type DashboardWidget,
    type WidgetDataSourceType,
    type WidgetKind,
} from '@/app/actions/crm-dashboards.actions';
import { AddWidgetModal } from './add-widget-modal';

const KIND_OPTIONS: ReadonlyArray<{ value: WidgetKind; label: string }> = [
    { value: 'metric', label: 'Metric' },
    { value: 'line', label: 'Line' },
    { value: 'bar', label: 'Bar' },
    { value: 'donut', label: 'Donut' },
    { value: 'funnel', label: 'Funnel' },
    { value: 'table', label: 'Table' },
];

const DS_OPTIONS: ReadonlyArray<{ value: WidgetDataSourceType; label: string }> = [
    { value: 'saved_view', label: 'Saved view' },
    { value: 'metric_query', label: 'Metric query' },
    { value: 'report', label: 'Report (stub)' },
];

export interface DashboardEditorProps {
    dashboardId: string;
    initialWidgets: DashboardWidget[];
}

export function DashboardEditor({ dashboardId, initialWidgets }: DashboardEditorProps) {
    const [widgets, setWidgets] = React.useState<DashboardWidget[]>(initialWidgets);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isSaving, startSaveTransition] = React.useTransition();
    const router = useRouter();
    const { toast } = useZoruToast();

    function patchWidget(id: string, patch: Partial<DashboardWidget>) {
        setWidgets((prev) => prev.map((w) => (w.id === id ? { ...w, ...patch } : w)));
    }

    function patchDataSource(
        id: string,
        patch: Partial<DashboardWidget['dataSource']>,
    ) {
        setWidgets((prev) =>
            prev.map((w) =>
                w.id === id ? { ...w, dataSource: { ...w.dataSource, ...patch } } : w,
            ),
        );
    }

    function removeWidget(id: string) {
        setWidgets((prev) => prev.filter((w) => w.id !== id));
    }

    function move(id: string, delta: -1 | 1) {
        setWidgets((prev) => {
            const idx = prev.findIndex((w) => w.id === id);
            if (idx < 0) return prev;
            const next = idx + delta;
            if (next < 0 || next >= prev.length) return prev;
            const copy = prev.slice();
            const [item] = copy.splice(idx, 1);
            copy.splice(next, 0, item);
            return copy;
        });
    }

    function addWidget(widget: DashboardWidget) {
        setWidgets((prev) => [...prev, { ...widget, y: prev.length }]);
    }

    function handleSave() {
        startSaveTransition(async () => {
            // Re-stamp y to match the visible order so the read-only
            // detail page can render them top-to-bottom without
            // a second sort pass.
            const payload = widgets.map((w, i) => ({ ...w, y: i }));
            const res = await saveDashboardLayout(dashboardId, payload);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
                return;
            }
            toast({ title: 'Saved', description: res.message ?? 'Layout saved.' });
            router.refresh();
        });
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-[13px] text-zoru-ink-muted">
                        {widgets.length} widget(s). Move up/down to reorder; save when done.
                    </p>
                </div>
                <div className="flex gap-2">
                    <ZoruButton variant="outline" onClick={() => setIsAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add widget
                    </ZoruButton>
                    <Link href={`/dashboard/crm/dashboards/${dashboardId}`}>
                        <ZoruButton variant="outline">Cancel</ZoruButton>
                    </Link>
                    <ZoruButton onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save layout
                    </ZoruButton>
                </div>
            </div>

            {widgets.length === 0 ? (
                <ZoruCard>
                    <ZoruCardContent className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                        <p className="text-[14px] text-zoru-ink">No widgets yet.</p>
                        <p className="text-[12.5px] text-zoru-ink-muted">
                            Add your first widget — a metric, chart, or table — to start building this board.
                        </p>
                        <ZoruButton className="mt-2" onClick={() => setIsAddOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add widget
                        </ZoruButton>
                    </ZoruCardContent>
                </ZoruCard>
            ) : (
                <div className="grid grid-cols-12 gap-3">
                    {widgets.map((w, idx) => (
                        <ZoruCard
                            key={w.id}
                            className="p-3"
                            style={{
                                gridColumn: `span ${Math.max(1, Math.min(12, w.w))} / span ${Math.max(
                                    1,
                                    Math.min(12, w.w),
                                )}`,
                            }}
                        >
                            <div className="mb-2 flex items-center justify-between gap-2">
                                <ZoruInput
                                    value={w.title}
                                    onChange={(e) => patchWidget(w.id, { title: e.target.value })}
                                    className="h-8 flex-1 text-[13px]"
                                    aria-label="Widget title"
                                />
                                <div className="flex shrink-0 gap-1">
                                    <ZoruButton
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => move(w.id, -1)}
                                        disabled={idx === 0}
                                        aria-label="Move up"
                                    >
                                        <ArrowUp className="h-4 w-4" />
                                    </ZoruButton>
                                    <ZoruButton
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => move(w.id, 1)}
                                        disabled={idx === widgets.length - 1}
                                        aria-label="Move down"
                                    >
                                        <ArrowDown className="h-4 w-4" />
                                    </ZoruButton>
                                    <ZoruButton
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => removeWidget(w.id)}
                                        aria-label="Remove widget"
                                    >
                                        <Trash2 className="h-4 w-4 text-zoru-danger-ink" />
                                    </ZoruButton>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <ZoruLabel className="text-[11px]">Kind</ZoruLabel>
                                    <ZoruSelect
                                        value={w.kind}
                                        onValueChange={(v) => patchWidget(w.id, { kind: v as WidgetKind })}
                                    >
                                        <ZoruSelectTrigger className="h-8">
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {KIND_OPTIONS.map((k) => (
                                                <ZoruSelectItem key={k.value} value={k.value}>
                                                    {k.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                                <div>
                                    <ZoruLabel className="text-[11px]">Data source</ZoruLabel>
                                    <ZoruSelect
                                        value={w.dataSource.type}
                                        onValueChange={(v) =>
                                            patchDataSource(w.id, { type: v as WidgetDataSourceType })
                                        }
                                    >
                                        <ZoruSelectTrigger className="h-8">
                                            <ZoruSelectValue />
                                        </ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            {DS_OPTIONS.map((d) => (
                                                <ZoruSelectItem key={d.value} value={d.value}>
                                                    {d.label}
                                                </ZoruSelectItem>
                                            ))}
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                                <div className="col-span-2">
                                    <ZoruLabel className="text-[11px]">
                                        {w.dataSource.type === 'metric_query' ? 'Metric slug' : 'Reference ID'}
                                    </ZoruLabel>
                                    <ZoruInput
                                        value={w.dataSource.ref}
                                        onChange={(e) => patchDataSource(w.id, { ref: e.target.value })}
                                        className="h-8 text-[12.5px]"
                                        placeholder={
                                            w.dataSource.type === 'metric_query'
                                                ? 'e.g. crm.leads.count'
                                                : 'Mongo _id'
                                        }
                                    />
                                </div>
                                <div>
                                    <ZoruLabel className="text-[11px]">Width (1-12)</ZoruLabel>
                                    <ZoruInput
                                        type="number"
                                        min={1}
                                        max={12}
                                        value={w.w}
                                        onChange={(e) =>
                                            patchWidget(w.id, { w: Number(e.target.value) || 1 })
                                        }
                                        className="h-8"
                                    />
                                </div>
                                <div>
                                    <ZoruLabel className="text-[11px]">Height (1-6)</ZoruLabel>
                                    <ZoruInput
                                        type="number"
                                        min={1}
                                        max={6}
                                        value={w.h}
                                        onChange={(e) =>
                                            patchWidget(w.id, { h: Number(e.target.value) || 1 })
                                        }
                                        className="h-8"
                                    />
                                </div>
                            </div>

                            {w.dataSource.type === 'report' ? (
                                <p className="mt-2 text-[11px] text-zoru-warning-ink">
                                    Reports engine not wired yet — see §6.8.
                                </p>
                            ) : null}
                        </ZoruCard>
                    ))}
                </div>
            )}

            <AddWidgetModal open={isAddOpen} onOpenChange={setIsAddOpen} onAdd={addWidget} />
        </div>
    );
}
