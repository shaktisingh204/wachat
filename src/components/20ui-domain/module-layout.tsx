'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface ModuleLayoutProps {
    sidebar: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

export function ModuleLayout({ sidebar, children, className }: ModuleLayoutProps) {
    return (
        <div className={cn("grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] gap-6 items-start h-full", className)}>
            <aside className="hidden md:block sticky top-0 h-full overflow-y-auto pr-4 border-r">
                {sidebar}
            </aside>
            <main className="flex-1 overflow-visible min-w-0">
                {children}
            </main>
        </div>
    );
}
