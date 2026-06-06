'use client';

import { Button, Card, CardBody, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, LoaderCircle, Plus, Save, Trash2, GripHorizontal } from 'lucide-react';
import * as React from 'react';
import Link from 'next/link';

import {
    saveDashboardLayout,
    type DashboardWidget,
    type WidgetDataSourceType,
    type WidgetKind,
} from '@/app/actions/crm-dashboards.actions';
import { AddWidgetModal } from './add-widget-modal';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { useGSAP } from '@gsap/react';

gsap.registerPlugin(Flip, useGSAP);

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

function SortableWidgetCard({ w, patchWidget, patchDataSource, move, removeWidget, idx, widgetsLength }: any) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: w.id });
    
    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        gridColumn: `span ${Math.max(1, Math.min(12, w.w))} / span ${Math.max(1, Math.min(12, w.w))}`,
        zIndex: isDragging ? 10 : 1,
        opacity: isDragging ? 0.9 : 1,
    };

    const handleResize = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const startX = e.pageX;
        const startW = w.w;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const diffX = moveEvent.pageX - startX;
            // Assume 1 column is roughly ~80px
            const colsToChange = Math.round(diffX / 80);
            let newW = startW + colsToChange;
            newW = Math.max(1, Math.min(12, newW));
            
            if (newW !== w.w) {
                patchWidget(w.id, { w: newW });
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    return (
        <Card
            ref={setNodeRef}
            style={style}
            className="p-3 relative group widget-card flex flex-col"
            data-flip-id={w.id}
        >
            <div className="mb-2 flex items-center justify-between gap-2">
                <div {...attributes} {...listeners} className="cursor-grab text-[var(--st-text-secondary)] hover:text-[var(--st-text)] active:cursor-grabbing">
                    <GripHorizontal className="h-4 w-4" />
                </div>
                <Input
                    value={w.title}
                    onChange={(e) => patchWidget(w.id, { title: e.target.value })}
                    className="h-8 flex-1 text-[13px]"
                    aria-label="Widget title"
                />
                <div className="flex shrink-0 gap-1">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(w.id, -1)}
                        disabled={idx === 0}
                        aria-label="Move up"
                    >
                        <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => move(w.id, 1)}
                        disabled={idx === widgetsLength - 1}
                        aria-label="Move down"
                    >
                        <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeWidget(w.id)}
                        aria-label="Remove widget"
                    >
                        <Trash2 className="h-4 w-4 text-[var(--st-danger)]" />
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 flex-1">
                <div>
                    <Label className="text-[11px]">Kind</Label>
                    <Select
                        value={w.kind}
                        onValueChange={(v) => patchWidget(w.id, { kind: v as WidgetKind })}
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {KIND_OPTIONS.map((k) => (
                                <SelectItem key={k.value} value={k.value}>
                                    {k.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="text-[11px]">Data source</Label>
                    <Select
                        value={w.dataSource.type}
                        onValueChange={(v) =>
                            patchDataSource(w.id, { type: v as WidgetDataSourceType })
                        }
                    >
                        <SelectTrigger className="h-8">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DS_OPTIONS.map((d) => (
                                <SelectItem key={d.value} value={d.value}>
                                    {d.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="col-span-2">
                    <Label className="text-[11px]">
                        {w.dataSource.type === 'metric_query' ? 'Metric slug' : 'Reference ID'}
                    </Label>
                    <Input
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
                    <Label className="text-[11px]">Width (1-12)</Label>
                    <Input
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
                    <Label className="text-[11px]">Height (1-6)</Label>
                    <Input
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
                <p className="mt-2 text-[11px] text-[var(--st-warn)]">
                    Reports engine not wired yet — see §6.8.
                </p>
            ) : null}
            
            <div 
                className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize flex items-end justify-end opacity-20 hover:opacity-100 transition-opacity"
                onMouseDown={handleResize}
            >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 0L0 12H12V0Z" fill="currentColor"/>
                </svg>
            </div>
        </Card>
    );
}

export function DashboardEditor({ dashboardId, initialWidgets }: DashboardEditorProps) {
    const [widgets, setWidgets] = React.useState<DashboardWidget[]>(initialWidgets);
    const [isAddOpen, setIsAddOpen] = React.useState(false);
    const [isSaving, startSaveTransition] = React.useTransition();
    const router = useRouter();
    const { toast } = useToast();
    const containerRef = React.useRef<HTMLDivElement>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useGSAP(() => {
        // We capture state right after the component updates, so Flip.from will animate changes.
        const state = Flip.getState('.widget-card');
        Flip.from(state, {
            duration: 0.4,
            ease: 'power2.out',
            absolute: true,
            zIndex: 1,
        });
    }, { dependencies: [widgets.map(w => `${w.id}-${w.w}-${w.h}`).join(',')], scope: containerRef });

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setWidgets((items) => {
                const oldIndex = items.findIndex(w => w.id === active.id);
                const newIndex = items.findIndex(w => w.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    }

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
        <div className="space-y-4" ref={containerRef}>
            <div className="flex items-center justify-between gap-2">
                <div>
                    <p className="text-[13px] text-[var(--st-text-secondary)]">
                        {widgets.length} widget(s). Drag and drop or move up/down to reorder; resize using bottom-right handle.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsAddOpen(true)}>
                        <Plus className="h-4 w-4" />
                        Add widget
                    </Button>
                    <Link href={`/dashboard/sabbi/dashboards/${dashboardId}`}>
                        <Button variant="outline">Cancel</Button>
                    </Link>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save layout
                    </Button>
                </div>
            </div>

            {widgets.length === 0 ? (
                <Card>
                    <CardBody className="flex flex-col items-center justify-center gap-2 p-10 text-center">
                        <p className="text-[14px] text-[var(--st-text)]">No widgets yet.</p>
                        <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                            Add your first widget — a metric, chart, or table — to start building this board.
                        </p>
                        <Button className="mt-2" onClick={() => setIsAddOpen(true)}>
                            <Plus className="h-4 w-4" />
                            Add widget
                        </Button>
                    </CardBody>
                </Card>
            ) : (
                <DndContext 
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext 
                        items={widgets.map(w => w.id)}
                        strategy={rectSortingStrategy}
                    >
                        <div className="grid grid-cols-12 gap-3 relative">
                            {widgets.map((w, idx) => (
                                <SortableWidgetCard 
                                    key={w.id} 
                                    w={w} 
                                    idx={idx} 
                                    widgetsLength={widgets.length}
                                    patchWidget={patchWidget}
                                    patchDataSource={patchDataSource}
                                    move={move}
                                    removeWidget={removeWidget}
                                />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
            )}

            <AddWidgetModal open={isAddOpen} onOpenChange={setIsAddOpen} onAdd={addWidget} />
        </div>
    );
}
