"use client";

import React, { useState } from 'react';
import { EditorProvider, useEditor } from './editor-provider';
import { BuilderSidebar } from './sidebar/sidebar';
import { CanvasRenderer } from './canvas/canvas-renderer';
import {
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
    PointerSensor,
    DragStartEvent,
    DragEndEvent
} from '@dnd-kit/core';
import { SidebarItemOverlay } from './sidebar/draggable-item';
import { v4 as uuidv4 } from 'uuid';

const EditorInterface = () => {
    const { state, dispatch } = useEditor();
    const [activeDragItem, setActiveDragItem] = useState<any>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Prevent accidental drags
            },
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === 'SIDEBAR_ITEM') {
            setActiveDragItem({
                type: event.active.data.current.widgetType,
                label: event.active.data.current.widgetType
            });
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveDragItem(null);
        const { active, over } = event;

        if (!over) return;

        // --- Handling Reordering (Canvas Sorting) ---
        if (active.data.current?.type === 'ELEMENT') {
            // Logic for reordering
            // This is complex as it involves:
            // 1. Finding old parent
            // 2. Finding new parent (over.id)
            // 3. Calculating new index

            // For this iteration, we will rely on a simplified MOVE_ELEMENT
            // We need `newParentId` and `index`.

            // If active.id !== over.id
            if (active.id !== over.id) {
                // Find what we are dropping OVER
                // If dropping over a COLUMN => Add to end of column? No, usually sorting means swapping or inserting.
                // If dropping over another WIDGET => Insert before/after.

                // Helper to find node
                const findNode = (nodes: any[], id: string): any => {
                    for (const node of nodes) {
                        if (node.id === id) return node;
                        if (node.children) {
                            const found = findNode(node.children, id);
                            if (found) return found;
                        }
                    }
                    return null;
                };

                const overElement = findNode(state.page.elements, over.id as string);

                if (overElement) {
                    // If dropping over a widget, we want to place it relative to that widget.
                    // We need the parent of the `overElement`.
                    // Since we don't have `findParent` handy here (it's in reducer), we might just accept dropping ON columns for now
                    // OR we assume the reducer `MOVE_ELEMENT` can handle index calculation if we pass the target-neighbor.

                    // Simplified: Only support moving if we can identify the container.
                    // If overElement is COLUMN => Add to valid index (end?).

                    if (overElement.type === 'COLUMN') {
                        dispatch({
                            type: 'MOVE_ELEMENT',
                            payload: {
                                id: active.id as string,
                                newParentId: overElement.id,
                                index: overElement.children.length // Append to end
                            }
                        });
                    } else {
                        // Dropped on a sibling widget.
                        // Ideally we find its parent and its index.
                        // For now, logging. Implementing full reorder requires more tree traversal helpers here or in reducer.
                        console.log("Reordering between widgets not fully implemented yet.");
                    }
                }
            }
        }

        // --- Handling Sidebar Item Drop ---
        if (active.data.current?.type === 'SIDEBAR_ITEM') {
            const widgetType = active.data.current.widgetType;

            // 1. Dropping a SECTION
            if (widgetType === 'SECTION') {
                const newSection = {
                    id: uuidv4(),
                    type: 'SECTION',
                    content: {},
                    style: { padding: '20px', minHeight: '100px', backgroundColor: '#f3f4f6' },
                    children: [{
                        id: uuidv4(),
                        type: 'COLUMN',
                        content: {},
                        style: { padding: '10px' },
                        children: []
                    }]
                };
                // Always add sections to root for now
                dispatch({ type: 'ADD_ELEMENT', payload: { parentId: 'root', element: newSection as any } });
                return;
            }

            // 2. Dropping a WIDGET
            // Should only be allowed if over a COLUMN (or WIDGET inside a COLUMN)
            if (widgetType !== 'SECTION') {
                // We need to find the correct parent ID.
                // If dropping over a COLUMN, parent is that Column.
                // If dropping over a WIDGET, parent is that Widget's parent (Column).

                const overId = over.id;
                const overData = over.data.current;

                let targetParentId = null;

                if (overData?.element?.type === 'COLUMN') {
                    targetParentId = overId;
                } else if (overData?.element?.type === 'WIDGET') {
                    // Find parent of this widget. 
                    // This is tricky without a "findParent" helper exposed easily, 
                    // but we can trust the reducer to handle insertion or we just append for now.
                    // IMPORTANT: To properly insert *next* to a widget, we need the parent ID.
                    // For MVP: We will only allow dropping ON A COLUMN.
                    // Users can drag-sort later.
                }

                // If we found a column target (or if the user dropped on the column/widget)
                // NOTE: `over.id` on a SortableElement refers to that element's ID.

                // Simple approach: Check if valid target.
                // Since we don't have easy tree traversal here in `handleDragEnd` without `state`, we might struggle.
                // BUT, we have `state` from `useEditor`!

                // Recursive search for the node to check its type
                const findNode = (nodes: any[], id: string): any => {
                    for (const node of nodes) {
                        if (node.id === id) return node;
                        if (node.children) {
                            const found = findNode(node.children, id);
                            if (found) return found;
                        }
                    }
                    return null;
                };

                const targetNode = findNode(state.page.elements, overId as string);

                if (targetNode) {
                    if (targetNode.type === 'COLUMN') {
                        targetParentId = targetNode.id;
                    } else if (targetNode.type === 'WIDGET') {
                        // If dropped on widget, we need that widget's parent.
                        // We will implement `ADD_ELEMENT` with `parentId` logic in reducer or here.
                        // For now, let's just accept dropping on COLUMN.
                    }
                }

                if (targetParentId) {
                    const newWidget = {
                        id: uuidv4(),
                        type: 'WIDGET',
                        widgetType: widgetType,
                        content: { text: `New ${widgetType}` },
                        style: {},
                        children: []
                    };
                    dispatch({ type: 'ADD_ELEMENT', payload: { parentId: targetParentId as string, element: newWidget as any } });
                } else {
                    console.log("Invalid drop target for widget. Must be a Column.");
                }
            }
        }
    };

    const handleSave = async () => {
        try {
            const response = await fetch('/api/builder/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(state.page)
            });
            if (response.ok) {
                alert('Page saved successfully!');
            } else {
                alert('Failed to save page.');
            }
        } catch (error) {
            console.error(error);
            alert('Error saving page.');
        }
    }

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
                <BuilderSidebar />
                <main className="flex-1 overflow-hidden flex flex-col relative">
                    <header className="h-14 border-b bg-white flex items-center px-4 justify-between shadow-sm z-10">
                        <h1 className="font-semibold text-gray-700">Page Builder</h1>
                        <div className="flex gap-2">
                            <button onClick={handleSave} className="px-3 py-1 bg-black text-white rounded text-sm hover:bg-gray-800">Publish</button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-auto bg-slate-100 p-8">
                        <CanvasRenderer />
                    </div>
                </main>
                <DragOverlay>
                    {activeDragItem ? <SidebarItemOverlay label={activeDragItem.label} /> : null}
                </DragOverlay>
            </div>
        </DndContext>
    );
}

export { EditorInterface };

export const EditorLayout = () => {
    return (
        <EditorProvider>
            <EditorInterface />
        </EditorProvider>
    );
};
