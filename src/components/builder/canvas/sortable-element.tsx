"use client";

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ElementNode } from '@/lib/builder/builder-types';
import { useEditor } from '@/components/builder/editor-provider';
import { getWidgetComponent } from '@/components/builder/registry';
import { cn } from '@/lib/utils';

// Helper to check if a drop is coming from sidebar vs sorting
function isSidebarDrag(active: any) {
    return active?.data?.current?.type === 'SIDEBAR_ITEM';
}

export const SortableElement = ({ element }: { element: ElementNode }) => {
    const { state, dispatch } = useEditor();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        over
    } = useSortable({
        id: element.id,
        data: {
            type: 'ELEMENT',
            element: element,
        },
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    const isSelected = state.selectedElementId === element.id;

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'SELECT_ELEMENT', payload: element.id });
    };

    const WidgetComponent = element.type === 'WIDGET' && element.widgetType
        ? getWidgetComponent(element.widgetType)
        : null;

    // Recursive render
    const renderChildren = () => {
        return element.children.map((child) => (
            <SortableElement key={child.id} element={child} />
        ));
    };

    // --- RENDER SECTION ---
    if (element.type === 'SECTION') {
        const isOver = over?.id === element.id;

        return (
            <div
                ref={setNodeRef}
                style={{ ...style, ...element.style }}
                onClick={handleSelect}
                className={cn(
                    "relative w-full border border-dashed transition-all group",
                    isSelected ? "border-blue-500 z-10" : "border-slate-300",
                    isOver && !isDragging ? "bg-blue-50 border-blue-400" : ""
                )}
            >
                {/* Drag Handle for Section */}
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-200 text-xs px-2 py-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    :: Section
                </div>

                <div className="flex flex-wrap relative min-h-[50px]">
                    {renderChildren()}
                    {element.children.length === 0 && (
                        <div className="w-full text-center text-gray-300 py-4 pointer-events-none">
                            Drop Columns Here
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER COLUMN ---
    if (element.type === 'COLUMN') {
        const isOver = over?.id === element.id;

        return (
            <div
                ref={setNodeRef}
                style={{ ...style, ...element.style }}
                onClick={handleSelect}
                className={cn(
                    "flex-1 min-w-[50px] border border-dashed transition-all group relative",
                    isSelected ? "border-blue-500 z-10" : "border-slate-300 hover:border-blue-300",
                    isOver && !isDragging ? "bg-blue-50 border-blue-400" : ""
                )}
            >
                {/* Drag Handle for Column */}
                <div
                    {...attributes}
                    {...listeners}
                    className="absolute -top-3 left-2 bg-slate-200 text-xs px-2 py-0.5 rounded cursor-grab active:cursor-grabbing hover:bg-slate-300 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                >
                    :: Col
                </div>

                <div className="min-h-[50px] w-full p-2">
                    {renderChildren()}
                    {element.children.length === 0 && (
                        <div className="text-center text-gray-300 py-2 text-xs pointer-events-none">
                            Drop Widgets
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // --- RENDER WIDGET ---
    return (
        <div
            ref={setNodeRef}
            style={{ ...style, ...element.style }}
            {...attributes}
            {...listeners}
            onClick={handleSelect}
            className={cn(
                "relative transition-all ring-offset-2 group cursor-move",
                isSelected ? "ring-2 ring-blue-500 z-10" : "hover:ring-1 hover:ring-blue-300"
            )}
        >
            {WidgetComponent ? <WidgetComponent content={element.content} style={element.style} /> : <div>Unknown</div>}
        </div>
    );
};
