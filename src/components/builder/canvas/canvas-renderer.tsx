"use client";

import React from 'react';
import { useEditor } from '@/components/builder/editor-provider';
import { SortableElement } from './sortable-element';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';

export const CanvasRenderer = () => {
    const { state } = useEditor();

    // Make the root canvas itself a droppable zone (for Sections)
    const { setNodeRef, isOver } = useDroppable({
        id: 'root-canvas',
        data: {
            type: 'ROOT',
            accepts: ['SECTION']
        }
    });

    // Derive Global Styles
    const theme = state.page.settings.theme || {};
    const globalStyles = {
        '--primary': theme.colors?.primary || '#3b82f6',
        '--secondary': theme.colors?.secondary || '#64748b',
        '--bg-body': theme.colors?.background || '#ffffff',
        '--text-body': theme.colors?.text || '#0f172a',
        fontFamily: theme.fonts?.body || 'inherit',
        color: 'var(--text-body)',
        backgroundColor: 'var(--bg-body)',
    } as React.CSSProperties;

    return (
        <div
            ref={setNodeRef}
            style={globalStyles}
            className={cn(
                "w-full min-h-screen p-10 shadow-sm mx-auto max-w-6xl overflow-y-auto transition-colors font-sans",
                isOver ? "bg-blue-50 ring-2 ring-blue-300" : ""
            )}
        >
            <SortableContext
                items={state.page.elements.map(el => el.id)}
                strategy={verticalListSortingStrategy}
            >
                {state.page.elements.length === 0 ? (
                    <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg pointer-events-none">
                        Start by dragging a Section here
                    </div>
                ) : (
                    state.page.elements.map((element) => (
                        <SortableElement key={element.id} element={element} />
                    ))
                )}
            </SortableContext>
        </div>
    );
};
