'use client';

import type { Metadata } from 'next';
import { Suspense } from 'react';
import { FacebookKanbanBoard } from '@/components/wabasimplify/facebook-kanban-board';
import { Skeleton } from '@/components/ui/skeleton';

export default function FacebookKanbanPage() {
    return (
        <div className="h-full flex flex-col">
            <Suspense fallback={<Skeleton className="h-full w-full" />}>
                <FacebookKanbanBoard />
            </Suspense>
        </div>
    );
}
