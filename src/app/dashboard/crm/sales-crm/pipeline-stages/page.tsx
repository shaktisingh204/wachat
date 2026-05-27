'use client';

import * as React from 'react';
import { Columns3, GripVertical, Plus, Trash2 } from 'lucide-react';

import {
    Badge,
    Button,
    Card,
    Input,
    Label,
    Select,
    ZoruSelectContent,
    ZoruSelectItem,
    ZoruSelectTrigger,
    ZoruSelectValue,
    Skeleton,
    Table,
    ZoruTableBody,
    ZoruTableCell,
    ZoruTableHead,
    ZoruTableHeader,
    ZoruTableRow,
    useZoruToast,
} from '@/components/zoruui';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { RowDrawer } from '@/components/crm/row-drawer';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';

import {
    deleteLeadPipelineStage,
    getLeadPipelines,
    getLeadPipelineStages,
    saveLeadPipelineStage,
} from '@/app/actions/worksuite/crm-plus.actions';
import type {
    WsLeadPipeline,
    WsLeadPipelineStage,
} from '@/lib/worksuite/crm-types';

type StageRow = WsLeadPipelineStage & { _id: string };
type PipelineRow = WsLeadPipeline & { _id: string };

const DEFAULT_COLOR = '#64748b';

/* ─── Utility ──────────────────────────────────────────────────────── */

function buildStageFormData(input: {
    _id?: string;
    pipeline_id: string;
    name: string;
    slug?: string;
    priority: number;
    label_color?: string;
}): FormData {
    const fd = new FormData();
    if (input._id) fd.set('_id', input._id);
    fd.set('pipeline_id', input.pipeline_id);
    fd.set('name', input.name);
    fd.set('slug', input.slug ?? '');
    fd.set('priority', String(input.priority));
    fd.set('label_color', input.label_color ?? DEFAULT_COLOR);
    return fd;
}

function StatCard({ title, value, accent }: { title: string; value: number; accent?: string }) {
    return (
        <Card>
            <p className="text-[13px] font-medium text-zoru-ink-muted">{title}</p>
            <p className="mt-1 text-[28px] font-semibold text-zoru-ink">{value.toLocaleString()}</p>
            {accent ? <p className="mt-1 text-[11.5px] text-zoru-ink-muted">{accent}</p> : null}
        </Card>
    );
}

/* ─── Stage edit form ──────────────────────────────────────────────── */

interface StageEditFormProps {
    initial: StageRow | null;
    pipelines: PipelineRow[];
    defaultPipelineId?: string;
    onSaved: () => void;
    onCancel: () => void;
}

function StageEditForm({ initial, pipelines, defaultPipelineId, onSaved, onCancel }: StageEditFormProps) {
    const { toast } = useZoruToast();
    const [pipelineId, setPipelineId] = React.useState<string>(
        initial?.pipeline_id ? String(initial.pipeline_id) : defaultPipelineId ?? pipelines[0]?._id ?? '',
    );
    const [name, setName] = React.useState(initial?.name ?? '');
    const [slug, setSlug] = React.useState(initial?.slug ?? '');
    const [priority, setPriority] = React.useState<number>(
        typeof initial?.priority === 'number' ? initial.priority : 0,
    );
    const [labelColor, setLabelColor] = React.useState(initial?.label_color ?? DEFAULT_COLOR);
    const [pending, setPending] = React.useState(false);

    const submit = async () => {
        if (!pipelineId || !name.trim()) {
            toast({
                title: 'Missing fields',
                description: 'Pipeline and stage name are required.',
                variant: 'destructive',
            });
            return;
        }
        setPending(true);
        try {
            const fd = buildStageFormData({
                _id: initial?._id,
                pipeline_id: pipelineId,
                name: name.trim(),
                slug: slug.trim(),
                priority,
                label_color: labelColor,
            });
            await saveLeadPipelineStage(undefined, fd);
            toast({ title: initial ? 'Stage updated' : 'Stage created' });
            onSaved();
        } catch (e) {
            toast({
                title: 'Save failed',
                description: e instanceof Error ? e.message : 'Unknown error',
                variant: 'destructive',
            });
        } finally {
            setPending(false);
        }
    };

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <Label className="text-zoru-ink">Pipeline</Label>
                <Select value={pipelineId} onValueChange={setPipelineId}>
                    <ZoruSelectTrigger>
                        <ZoruSelectValue placeholder="Select…" />
                    </ZoruSelectTrigger>
                    <ZoruSelectContent>
                        {pipelines.map((p) => (
                            <ZoruSelectItem key={p._id} value={p._id}>
                                {p.name}
                            </ZoruSelectItem>
                        ))}
                    </ZoruSelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-zoru-ink">Stage name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Qualified" />
            </div>
            <div className="space-y-1">
                <Label className="text-zoru-ink">Slug</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="qualified" />
            </div>
            <div className="space-y-1">
                <Label className="text-zoru-ink">Order</Label>
                <Input
                    type="number"
                    value={String(priority)}
                    onChange={(e) => setPriority(Number(e.target.value) || 0)}
                />
            </div>
            <div className="space-y-1">
                <Label className="text-zoru-ink">Label color</Label>
                <div className="flex items-center gap-2">
                    <Input
                        value={labelColor}
                        onChange={(e) => setLabelColor(e.target.value)}
                        placeholder="#64748b"
                        className="font-mono"
                    />
                    <span
                        className="inline-block h-7 w-7 rounded-full border border-zoru-line"
                        style={{ backgroundColor: labelColor || DEFAULT_COLOR }}
                    />
                </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
                <Button variant="outline" onClick={onCancel} disabled={pending}>
                    Cancel
                </Button>
                <Button onClick={submit} disabled={pending}>
                    {pending ? 'Saving…' : initial ? 'Save changes' : 'Create stage'}
                </Button>
            </div>
        </div>
    );
}

/* ─── Page ─────────────────────────────────────────────────────────── */

export default function LeadPipelineStagesPage() {
    const { toast } = useZoruToast();
    const [pipelines, setPipelines] = React.useState<PipelineRow[]>([]);
    const [stages, setStages] = React.useState<StageRow[]>([]);
    const [pipelineFilter, setPipelineFilter] = React.useState<string>('');
    const [isLoading, startLoading] = React.useTransition();
    const [reorderPending, setReorderPending] = React.useState(false);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [editing, setEditing] = React.useState<StageRow | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = React.useState<string | null>(null);
    const [dragIndex, setDragIndex] = React.useState<number | null>(null);

    const refresh = React.useCallback(() => {
        startLoading(async () => {
            const [pp, st] = await Promise.all([
                getLeadPipelines(),
                getLeadPipelineStages(),
            ]);
            setPipelines(pp as unknown as PipelineRow[]);
            setStages(st as unknown as StageRow[]);
        });
    }, []);

    React.useEffect(() => {
        refresh();
    }, [refresh]);

    /* ─── Derived ───────────────────────────────────────────────────── */

    const pipelineNameById = React.useMemo(() => {
        const map = new Map<string, string>();
        for (const p of pipelines) map.set(String(p._id), p.name);
        return map;
    }, [pipelines]);

    const defaultPipelineIds = React.useMemo(() => {
        const set = new Set<string>();
        for (const p of pipelines) {
            if (p.default === true) set.add(String(p._id));
        }
        return set;
    }, [pipelines]);

    const filteredStages = React.useMemo(() => {
        const filtered = pipelineFilter
            ? stages.filter((s) => String(s.pipeline_id) === pipelineFilter)
            : stages;
        return [...filtered].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    }, [stages, pipelineFilter]);

    const kpis = React.useMemo(() => {
        const total = stages.length;
        let defaultStages = 0;
        let customStages = 0;
        for (const s of stages) {
            if (defaultPipelineIds.has(String(s.pipeline_id))) defaultStages += 1;
            else customStages += 1;
        }
        return { total, defaultStages, customStages, pipelines: pipelines.length };
    }, [stages, defaultPipelineIds, pipelines.length]);

    /* ─── Drag-reorder ─────────────────────────────────────────────── */

    const persistReorder = React.useCallback(
        async (next: StageRow[]) => {
            if (!pipelineFilter) {
                toast({
                    title: 'Pick a pipeline',
                    description: 'Select a pipeline before reordering its stages.',
                    variant: 'destructive',
                });
                return;
            }
            setReorderPending(true);
            try {
                let priority = 0;
                for (const stage of next) {
                    const fd = buildStageFormData({
                        _id: String(stage._id),
                        pipeline_id: String(stage.pipeline_id),
                        name: stage.name,
                        slug: stage.slug,
                        priority,
                        label_color: stage.label_color,
                    });
                    await saveLeadPipelineStage(undefined, fd);
                    priority += 1;
                }
                toast({ title: 'Order saved' });
                refresh();
            } catch (e) {
                toast({
                    title: 'Reorder failed',
                    description: e instanceof Error ? e.message : 'Unknown error',
                    variant: 'destructive',
                });
            } finally {
                setReorderPending(false);
            }
        },
        [pipelineFilter, refresh, toast],
    );

    const handleDragStart = (idx: number) => setDragIndex(idx);
    const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>) => e.preventDefault();
    const handleDrop = (targetIdx: number) => {
        if (dragIndex === null || dragIndex === targetIdx) {
            setDragIndex(null);
            return;
        }
        const next = [...filteredStages];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(targetIdx, 0, moved);
        setDragIndex(null);
        persistReorder(next);
    };

    /* ─── Delete ──────────────────────────────────────────────────── */

    const handleDelete = async () => {
        if (!confirmDeleteId) return;
        try {
            await deleteLeadPipelineStage(confirmDeleteId);
            toast({ title: 'Stage deleted' });
            setConfirmDeleteId(null);
            refresh();
        } catch (e) {
            toast({
                title: 'Delete failed',
                description: e instanceof Error ? e.message : 'Unknown error',
                variant: 'destructive',
            });
        }
    };

    /* ─── Render ──────────────────────────────────────────────────── */

    return (
        <EntityListShell
            title="Pipeline stages"
            subtitle="Ordered stages inside each pipeline — drag rows to reorder."
            primaryAction={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New stage
                </Button>
            }
        >
            {/* KPI strip */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard title="Total stages" value={kpis.total} accent={`${kpis.pipelines} pipeline(s)`} />
                <StatCard title="Default-pipeline stages" value={kpis.defaultStages} accent="In tenant default pipelines" />
                <StatCard title="Custom-pipeline stages" value={kpis.customStages} accent="In user-created pipelines" />
                <StatCard
                    title="Filtered"
                    value={filteredStages.length}
                    accent={pipelineFilter ? pipelineNameById.get(pipelineFilter) ?? '—' : 'All pipelines'}
                />
            </div>

            {/* Filter + actions row */}
            <Card>
                <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[220px]">
                        <Label className="text-zoru-ink">Pipeline</Label>
                        <Select value={pipelineFilter} onValueChange={setPipelineFilter}>
                            <ZoruSelectTrigger>
                                <ZoruSelectValue placeholder="All pipelines" />
                            </ZoruSelectTrigger>
                            <ZoruSelectContent>
                                {pipelines.map((p) => (
                                    <ZoruSelectItem key={p._id} value={p._id}>
                                        {p.name}
                                        {p.default ? ' (default)' : ''}
                                    </ZoruSelectItem>
                                ))}
                            </ZoruSelectContent>
                        </Select>
                    </div>
                    {pipelineFilter ? (
                        <Button variant="ghost" size="sm" onClick={() => setPipelineFilter('')}>
                            Clear
                        </Button>
                    ) : null}
                    {reorderPending ? (
                        <span className="text-[12px] text-zoru-ink-muted">Saving order…</span>
                    ) : null}
                </div>
            </Card>

            {/* Table */}
            <Card className="overflow-hidden p-0">
                {isLoading ? (
                    <div className="space-y-2 p-4">
                        {[...Array(4)].map((_, i) => (
                            <Skeleton key={i} className="h-10 w-full" />
                        ))}
                    </div>
                ) : filteredStages.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 p-12 text-center">
                        <Columns3 className="h-8 w-8 text-zoru-ink-muted" />
                        <h3 className="text-base font-medium text-zoru-ink">No stages yet</h3>
                        <p className="max-w-sm text-sm text-zoru-ink-muted">
                            Create your first stage to start organising leads inside this pipeline.
                        </p>
                        <Button size="sm" onClick={() => setCreateOpen(true)}>
                            <Plus className="h-3.5 w-3.5" /> New stage
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <ZoruTableHeader>
                                <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                                    <ZoruTableHead className="w-[40px]" />
                                    <ZoruTableHead className="text-zoru-ink-muted">Stage</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Pipeline</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Slug</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Order</ZoruTableHead>
                                    <ZoruTableHead className="text-zoru-ink-muted">Color</ZoruTableHead>
                                    <ZoruTableHead className="w-[140px] text-right text-zoru-ink-muted">
                                        Actions
                                    </ZoruTableHead>
                                </ZoruTableRow>
                            </ZoruTableHeader>
                            <ZoruTableBody>
                                {filteredStages.map((stage, idx) => {
                                    const color = stage.label_color || DEFAULT_COLOR;
                                    const isDefaultPipeline = defaultPipelineIds.has(
                                        String(stage.pipeline_id),
                                    );
                                    return (
                                        <ZoruTableRow
                                            key={stage._id}
                                            className="border-zoru-line"
                                            draggable={Boolean(pipelineFilter)}
                                            onDragStart={() => handleDragStart(idx)}
                                            onDragOver={handleDragOver}
                                            onDrop={() => handleDrop(idx)}
                                        >
                                            <ZoruTableCell>
                                                <GripVertical
                                                    className={`h-4 w-4 ${
                                                        pipelineFilter
                                                            ? 'cursor-grab text-zoru-ink-muted'
                                                            : 'text-zoru-ink-muted/40'
                                                    }`}
                                                    aria-label="Drag to reorder"
                                                />
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <RowDrawer
                                                    label={stage.name}
                                                    subtitle={
                                                        isDefaultPipeline
                                                            ? 'Default pipeline'
                                                            : 'Custom pipeline'
                                                    }
                                                    title={`Edit stage: ${stage.name}`}
                                                    description="Update stage metadata or change the pipeline it belongs to."
                                                >
                                                    <StageEditForm
                                                        initial={stage}
                                                        pipelines={pipelines}
                                                        onSaved={() => refresh()}
                                                        onCancel={() => undefined}
                                                    />
                                                </RowDrawer>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                                                {pipelineNameById.get(String(stage.pipeline_id)) ?? '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="font-mono text-[12px] text-zoru-ink-muted">
                                                {stage.slug || '—'}
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-[13px] text-zoru-ink">
                                                {stage.priority ?? 0}
                                            </ZoruTableCell>
                                            <ZoruTableCell>
                                                <span className="inline-flex items-center gap-2">
                                                    <span
                                                        className="inline-block h-3 w-3 rounded-full border border-zoru-line"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <Badge
                                                        style={{
                                                            backgroundColor: color + '20',
                                                            color,
                                                            borderColor: color + '40',
                                                        }}
                                                    >
                                                        {color}
                                                    </Badge>
                                                </span>
                                            </ZoruTableCell>
                                            <ZoruTableCell className="text-right">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => setEditing(stage)}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setConfirmDeleteId(stage._id)}
                                                    aria-label="Delete stage"
                                                    className="ml-1"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </ZoruTableCell>
                                        </ZoruTableRow>
                                    );
                                })}
                            </ZoruTableBody>
                        </Table>
                    </div>
                )}
                {!pipelineFilter && filteredStages.length > 0 ? (
                    <div className="border-t border-zoru-line bg-zoru-surface-2/40 px-4 py-2 text-[11.5px] text-zoru-ink-muted">
                        Drag-reorder requires picking a single pipeline first.
                    </div>
                ) : null}
            </Card>

            {/* Create — inline drawer-like using RowDrawer trigger button */}
            {createOpen ? (
                <Card>
                    <h2 className="mb-3 text-[14px] font-semibold text-zoru-ink">New stage</h2>
                    <StageEditForm
                        initial={null}
                        pipelines={pipelines}
                        defaultPipelineId={pipelineFilter || pipelines[0]?._id}
                        onSaved={() => {
                            setCreateOpen(false);
                            refresh();
                        }}
                        onCancel={() => setCreateOpen(false)}
                    />
                </Card>
            ) : null}

            {/* Edit (inline panel — drawer trigger is on the row label) */}
            {editing ? (
                <Card>
                    <h2 className="mb-3 text-[14px] font-semibold text-zoru-ink">
                        Edit stage: {editing.name}
                    </h2>
                    <StageEditForm
                        initial={editing}
                        pipelines={pipelines}
                        onSaved={() => {
                            setEditing(null);
                            refresh();
                        }}
                        onCancel={() => setEditing(null)}
                    />
                </Card>
            ) : null}

            <ConfirmDialog
                open={confirmDeleteId !== null}
                onOpenChange={(open) => !open && setConfirmDeleteId(null)}
                title="Delete stage?"
                description="Leads currently in this stage will remain, but the stage label will disappear from your kanban."
                confirmLabel="Delete"
                confirmTone="danger"
                onConfirm={handleDelete}
            />
        </EntityListShell>
    );
}
