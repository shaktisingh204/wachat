
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KanbanBoard } from '@/components/wabasimplify/kanban-board';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat Kanban | SabNode',
};

function KanbanPageSkeleton() {
    return (
        <div className="flex-1 flex h-full overflow-x-auto p-4 gap-4">
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
            <div className="w-80 flex-shrink-0"><Skeleton className="h-full w-full" /></div>
        </div>
    );
}

export default function KanbanPage() {
    return (
        <div className="h-full flex flex-col">
            <Suspense className="h-full" fallback={<KanbanPageSkeleton />}>
                <KanbanBoard />
            </Suspense>
        </div>
    );
}
