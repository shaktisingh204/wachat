'use client';

import { Skeleton } from '@/components/zoruui';
import { ZoruKanbanBoard } from '../../_components/zoru-kanban-board';
import {
  Suspense } from 'react';

/**
 * /wachat/chat/kanban — Conversations as a kanban board.
 *
 * The board itself lives in `ZoruKanbanBoard`. This page wraps it with
 * a Zoru skeleton fallback while data loads.
 */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      <div className="w-80 shrink-0">
        <ZoruSkeleton className="h-full w-full" />
      </div>
      <div className="w-80 shrink-0">
        <ZoruSkeleton className="h-full w-full" />
      </div>
      <div className="w-80 shrink-0">
        <ZoruSkeleton className="h-full w-full" />
      </div>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <div className="flex h-full flex-col">
      <Suspense fallback={<KanbanPageSkeleton />}>
        <ZoruKanbanBoard />
      </Suspense>
    </div>
  );
}
