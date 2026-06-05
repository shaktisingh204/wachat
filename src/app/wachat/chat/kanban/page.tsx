'use client';

import { Suspense } from 'react';

import { Skeleton } from '@/components/sabcrm/20ui';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { ZoruKanbanBoard } from '../../_components/zoru-kanban-board';

/**
 * /wachat/chat/kanban — Conversations as a kanban board.
 *
 * The board itself lives in `ZoruKanbanBoard`. This page is a thin full-bleed
 * frame (`WachatPage variant="app"`) that wraps the board with a 20ui skeleton
 * fallback while data loads.
 */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      <div className="w-80 shrink-0">
        <Skeleton width="100%" height="100%" />
      </div>
      <div className="w-80 shrink-0">
        <Skeleton width="100%" height="100%" />
      </div>
      <div className="w-80 shrink-0">
        <Skeleton width="100%" height="100%" />
      </div>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <WachatPage variant="app">
      <div className="flex h-full flex-col">
        <Suspense fallback={<KanbanPageSkeleton />}>
          <ZoruKanbanBoard />
        </Suspense>
      </div>
    </WachatPage>
  );
}
