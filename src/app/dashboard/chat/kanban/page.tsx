
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { KanbanBoard } from '@/components/wabasimplify/kanban-board';
import { Skeleton } from '@/components/ui/skeleton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Chat Kanban | Wachat',
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
        <div className="flex-1 flex flex-col min-h-0">
            <Suspense fallback={<KanbanPageSkeleton />}>
                <KanbanBoard />
            </Suspense>
        </div>
    );
}
