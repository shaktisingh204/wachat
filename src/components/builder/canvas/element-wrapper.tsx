"use client";

import React from 'react';
import { ElementNode } from '@/lib/builder/builder-types';
import { useEditor } from '@/components/builder/editor-provider';
import { getWidgetComponent } from '@/components/builder/registry';
import { cn } from '@/lib/utils';

interface ElementWrapperProps {
    element: ElementNode;
}

export const ElementWrapper = ({ element }: ElementWrapperProps) => {
    const { state, dispatch } = useEditor();
    const isSelected = state.selectedElementId === element.id;

    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent selecting parent
        dispatch({ type: 'SELECT_ELEMENT', payload: element.id });
    };

    const WidgetComponent = element.type === 'WIDGET' && element.widgetType
        ? getWidgetComponent(element.widgetType)
        : null;

    // Base styles for the wrapper ensuring it can receive clicks and has layout
    const baseStyles = {
        ...element.style,
        border: isSelected ? '2px solid #3b82f6' : '1px dashed transparent', // Visual feedback
        position: 'relative' as const,
        minHeight: element.type === 'SECTION' ? '100px' : 'auto',
        padding: element.type === 'SECTION' || element.type === 'COLUMN' ? '10px' : '0',
    };

    const renderChildren = () => {
        return element.children.map((child) => (
            <ElementWrapper key={child.id} element={child} />
        ));
    };

    if (element.type === 'SECTION') {
        return (
            <div
                onClick={handleSelect}
                className={cn("w-full transition-all hover:border-blue-300 border-dashed border", isSelected ? "border-blue-500 z-10" : "border-slate-200")}
                style={element.style}
            >
                {/* Placeholder for Section controls (drag handle, delete) */}
                {isSelected && <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded-t">Section</div>}
                <div className="flex flex-wrap" style={{ minHeight: '50px' }}>
                    {renderChildren()}
                    {element.children.length === 0 && <div className="w-full text-center text-gray-400 py-4">Drop Columns Here</div>}
                </div>
            </div>
        );
    }

    if (element.type === 'COLUMN') {
        return (
            <div
                onClick={handleSelect}
                className={cn("flex-1 min-w-[50px] transition-all hover:border-blue-300 border-dashed border", isSelected ? "border-blue-500 z-10" : "border-slate-300")}
                style={element.style}
            >
                {isSelected && <div className="absolute -top-5 left-0 bg-blue-500 text-white text-xs px-2 rounded-t">Column</div>}
                {renderChildren()}
                {element.children.length === 0 && <div className="text-center text-gray-400 py-2 text-sm">Drop Widgets Here</div>}
            </div>
        );
    }

    // It's a Widget
    return (
        <div
            onClick={handleSelect}
            className={cn("relative transition-all hover:border-blue-300 border-dashed border", isSelected ? "border-blue-500 z-10" : "border-transparent")}
        >
            {isSelected && <div className="absolute -top-5 right-0 bg-blue-500 text-white text-xs px-2 rounded-t">Widget</div>}
            {WidgetComponent ? <WidgetComponent content={element.content} style={element.style} /> : <div>Unknown Widget</div>}
        </div>
    );
};
