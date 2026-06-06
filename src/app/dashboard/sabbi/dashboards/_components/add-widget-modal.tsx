'use client';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Button, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/sabcrm/20ui';
/**
 * §6.5 Add-widget modal.
 *
 * Two-step picker: choose a widget kind, then bind it to a data
 * source. On confirm, the caller appends the new `DashboardWidget`
 * to the editor's array (no server round-trip — saving the full
 * layout happens via the editor's "Save layout" button).
 */

import * as React from 'react';

import type {
    DashboardWidget,
    WidgetDataSourceType,
    WidgetKind,
} from '@/app/actions/crm-dashboards.actions.types';

const WIDGET_KINDS: ReadonlyArray<{ value: WidgetKind; label: string; hint: string }> = [
    { value: 'metric', label: 'Metric', hint: 'A single big number + delta vs prior period.' },
    { value: 'line', label: 'Line chart', hint: 'Trend over time, e.g. revenue last 30 days.' },
    { value: 'bar', label: 'Bar chart', hint: 'Compare buckets — e.g. deals by stage.' },
    { value: 'donut', label: 'Donut', hint: 'Share-of-total breakdown.' },
    { value: 'funnel', label: 'Funnel', hint: 'Stacked horizontal bars (drop-off view).' },
    { value: 'table', label: 'Table', hint: 'First 10 rows of the data source.' },
];

const DATA_SOURCE_TYPES: ReadonlyArray<{
    value: WidgetDataSourceType;
    label: string;
    hint: string;
}> = [
    { value: 'saved_view', label: 'Saved view', hint: 'Reuse a stored CRM filter.' },
    {
        value: 'metric_query',
        label: 'Metric query',
        hint: 'A pre-baked slug — e.g. crm.leads.count.',
    },
    {
        value: 'report',
        label: 'Report (preview)',
        hint: 'Stubbed until §6.8 Reports engine is wired.',
    },
];

const METRIC_QUERY_SUGGESTIONS = [
    'crm.leads.count',
    'crm.deals.open.count',
    'crm.invoices.outstanding.count',
];

/**
 * Generate a client-side widget id. The server resanitizes ids on
 * save (see `sanitizeWidget`) — this just needs to be unique within
 * one editing session.
 */
function makeClientWidgetId(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
        return globalThis.crypto.randomUUID();
    }
    return `w_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export interface AddWidgetModalProps {
    open: boolean;
    onOpenChange: (next: boolean) => void;
    onAdd: (widget: DashboardWidget) => void;
}

export function AddWidgetModal({ open, onOpenChange, onAdd }: AddWidgetModalProps) {
    const [step, setStep] = React.useState<1 | 2>(1);
    const [kind, setKind] = React.useState<WidgetKind>('metric');
    const [title, setTitle] = React.useState('');
    const [dsType, setDsType] = React.useState<WidgetDataSourceType>('metric_query');
    const [dsRef, setDsRef] = React.useState('');

    React.useEffect(() => {
        if (!open) {
            // reset when modal closes so the next open is fresh
            const t = setTimeout(() => {
                setStep(1);
                setKind('metric');
                setTitle('');
                setDsType('metric_query');
                setDsRef('');
            }, 200);
            return () => clearTimeout(t);
        }
    }, [open]);

    const kindMeta = WIDGET_KINDS.find((k) => k.value === kind);

    function confirm() {
        if (!dsRef.trim()) return;
        const widget: DashboardWidget = {
            id: makeClientWidgetId(),
            kind,
            title: title.trim() || kindMeta?.label || 'Widget',
            x: 0,
            y: 999,
            w: kind === 'metric' ? 3 : 6,
            h: kind === 'metric' ? 2 : 3,
            dataSource: { type: dsType, ref: dsRef.trim() },
        };
        onAdd(widget);
        onOpenChange(false);
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>
                        {step === 1 ? 'Add a widget — pick a kind' : 'Add a widget — pick data'}
                    </DialogTitle>
                    <DialogDescription>
                        {step === 1
                            ? 'What should this widget look like?'
                            : 'Where should the widget read from?'}
                    </DialogDescription>
                </DialogHeader>

                {step === 1 ? (
                    <div className="grid grid-cols-2 gap-2">
                        {WIDGET_KINDS.map((k) => {
                            const selected = k.value === kind;
                            return (
                                <button
                                    key={k.value}
                                    type="button"
                                    onClick={() => setKind(k.value)}
                                    className={`rounded-md border p-3 text-left transition ${
                                        selected
                                            ? 'border-[var(--st-text)] bg-[var(--st-bg-muted)]'
                                            : 'border-[var(--st-border)] hover:border-[var(--st-text)]/40'
                                    }`}
                                >
                                    <div className="text-[13px] font-medium text-[var(--st-text)]">{k.label}</div>
                                    <div className="mt-0.5 text-[11.5px] text-[var(--st-text-secondary)]">{k.hint}</div>
                                </button>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="widget-title">Title</Label>
                            <Input
                                id="widget-title"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder={kindMeta?.label}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ds-type">Data source</Label>
                            <Select
                                value={dsType}
                                onValueChange={(v) => setDsType(v as WidgetDataSourceType)}
                            >
                                <SelectTrigger id="ds-type">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {DATA_SOURCE_TYPES.map((d) => (
                                        <SelectItem key={d.value} value={d.value}>
                                            {d.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                                {DATA_SOURCE_TYPES.find((d) => d.value === dsType)?.hint}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="ds-ref">
                                {dsType === 'metric_query' ? 'Metric slug' : 'Reference ID'}
                            </Label>
                            <Input
                                id="ds-ref"
                                value={dsRef}
                                onChange={(e) => setDsRef(e.target.value)}
                                placeholder={
                                    dsType === 'metric_query'
                                        ? 'e.g. crm.leads.count'
                                        : 'Mongo _id'
                                }
                                list={dsType === 'metric_query' ? 'metric-query-suggestions' : undefined}
                            />
                            {dsType === 'metric_query' ? (
                                <datalist id="metric-query-suggestions">
                                    {METRIC_QUERY_SUGGESTIONS.map((m) => (
                                        <option key={m} value={m} />
                                    ))}
                                </datalist>
                            ) : null}
                            {dsType === 'report' ? (
                                <p className="text-[11.5px] text-[var(--st-warn)]">
                                    Reports engine not wired yet — widget will render a placeholder.
                                </p>
                            ) : null}
                        </div>
                    </div>
                )}

                <DialogFooter className="flex gap-2">
                    {step === 1 ? (
                        <>
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button onClick={() => setStep(2)}>Next</Button>
                        </>
                    ) : (
                        <>
                            <Button variant="outline" onClick={() => setStep(1)}>
                                Back
                            </Button>
                            <Button onClick={confirm} disabled={!dsRef.trim()}>
                                Add widget
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
