"use client";

import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DraggableSidebarItemProps {
    type: string;
    label: string;
}

export const DraggableSidebarItem = ({ type, label }: DraggableSidebarItemProps) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `sidebar-${type}`,
        data: {
            type: 'SIDEBAR_ITEM',
            widgetType: type,
        },
    });

    return (
        <div ref={setNodeRef} {...listeners} {...attributes} className={cn("w-full mb-2", isDragging ? "opacity-50" : "opacity-100")}>
            <Button variant="secondary" className="w-full justify-start text-sm cursor-grab active:cursor-grabbing">
                {label}
            </Button>
        </div>
    );
};

export const SidebarItemOverlay = ({ label }: { label: string }) => {
    return (
        <Button variant="secondary" className="w-[200px] justify-start text-sm cursor-grabbing shadow-xl ring-2 ring-primary">
            {label}
        </Button>
    )
}
