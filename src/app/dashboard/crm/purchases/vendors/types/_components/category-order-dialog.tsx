'use client';

import * as React from 'react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import { Button, ZoruDialog, ZoruDialogContent, ZoruDialogHeader, ZoruDialogTitle, useZoruToast } from '@/components/zoruui';
import { updateVendorTypeOrder } from '@/app/actions/crm-vendor-types.actions';

function SortableItem({ id, item }: { id: string, item: any }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 border border-zoru-line rounded-md bg-zoru-surface-2 mb-2">
            <button {...attributes} {...listeners} className="cursor-grab text-zoru-ink-muted hover:text-zoru-ink focus:outline-none">
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="text-[13px] text-zoru-ink font-medium">{item.name}</span>
            {item.code && <span className="text-xs text-zoru-ink-muted">({item.code})</span>}
            {item.parentName && <span className="text-xs text-zoru-ink-subtle ml-auto">Parent: {item.parentName}</span>}
        </div>
    );
}

export function CategoryOrderDialog({ items, open, onOpenChange, onSaved }: { items: any[], open: boolean, onOpenChange: (open: boolean) => void, onSaved: () => void }) {
    const { toast } = useZoruToast();
    const [orderedItems, setOrderedItems] = React.useState(items);
    const [isSaving, setIsSaving] = React.useState(false);

    React.useEffect(() => {
        if (open) {
            setOrderedItems([...items].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)));
        }
    }, [open, items]);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setOrderedItems((items) => {
                const oldIndex = items.findIndex((i) => i._id === active.id);
                const newIndex = items.findIndex((i) => i._id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const updates = orderedItems.map((item, index) => ({
            id: item._id,
            parentId: item.parentId || null,
            sortOrder: index,
        }));
        const res = await updateVendorTypeOrder(updates);
        setIsSaving(false);
        if (res.success) {
            toast({ title: 'Order updated' });
            onSaved();
            onOpenChange(false);
        } else {
            toast({ title: 'Failed to update order', description: res.error, variant: 'destructive' });
        }
    };

    return (
        <ZoruDialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="max-w-md">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Reorder Categories</ZoruDialogTitle>
                </ZoruDialogHeader>
                <div className="py-4">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={orderedItems.map(i => i._id)} strategy={verticalListSortingStrategy}>
                            {orderedItems.map((item) => (
                                <SortableItem key={item._id} id={item._id} item={item} />
                            ))}
                        </SortableContext>
                    </DndContext>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Order'}
                    </Button>
                </div>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
