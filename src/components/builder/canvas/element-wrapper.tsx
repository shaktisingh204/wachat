"use client";

import React from 'react';
import { ElementNode } from '@/lib/builder/builder-types';
import { useEditor } from '@/components/builder/editor-provider';
import { getWidgetComponent } from '@/components/builder/registry';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/sabcrm/20ui';

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

    const renderChildren = () => {
        return element.children.map((child) => (
            <ElementWrapper key={child.id} element={child} />
        ));
    };

    if (element.type === 'SECTION') {
        return (
            <div
                onClick={handleSelect}
                className={cn(
                    "relative w-full border border-dashed border-[var(--st-border)] transition-all hover:border-[var(--st-border)]",
                    isSelected && "z-10",
                )}
                style={element.style}
            >
                {/* Placeholder for Section controls (drag handle, delete) */}
                {isSelected && (
                    <Badge tone="accent" kind="solid" className="absolute -top-6 left-0">
                        Section
                    </Badge>
                )}
                <div className="flex min-h-[50px] flex-wrap">
                    {renderChildren()}
                    {element.children.length === 0 && (
                        <div className="w-full py-4 text-center text-[var(--st-text-secondary)]">
                            Drop Columns Here
                        </div>
                    )}
                </div>
            </div>
        );
    }

    if (element.type === 'COLUMN') {
        return (
            <div
                onClick={handleSelect}
                className={cn(
                    "relative min-w-[50px] flex-1 border border-dashed border-[var(--st-border)] transition-all hover:border-[var(--st-border)]",
                    isSelected && "z-10",
                )}
                style={element.style}
            >
                {isSelected && (
                    <Badge tone="accent" kind="solid" className="absolute -top-5 left-0">
                        Column
                    </Badge>
                )}
                {renderChildren()}
                {element.children.length === 0 && (
                    <div className="py-2 text-center text-sm text-[var(--st-text-secondary)]">
                        Drop Widgets Here
                    </div>
                )}
            </div>
        );
    }

    // It's a Widget
    return (
        <div
            onClick={handleSelect}
            className={cn(
                "relative border border-dashed transition-all hover:border-[var(--st-border)]",
                isSelected ? "z-10 border-[var(--st-border)]" : "border-transparent",
            )}
        >
            {isSelected && (
                <Badge tone="accent" kind="solid" className="absolute -top-5 right-0">
                    Widget
                </Badge>
            )}
            {WidgetComponent ? (
                <WidgetComponent content={element.content} style={element.style} />
            ) : (
                <div className="text-sm text-[var(--st-text-secondary)]">Unknown Widget</div>
            )}
        </div>
    );
};
