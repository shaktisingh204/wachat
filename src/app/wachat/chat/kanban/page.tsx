'use client';

import { Suspense } from 'react';
import { ZoruKanbanBoard } from '../../_components/zoru-kanban-board';

/**
 * /wachat/chat/kanban — Conversations as a kanban board.
 *
 * The board itself lives in `ZoruKanbanBoard`. This route wraps it
 * with a wachat-shaped skeleton fallback while data loads.
 */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      {[320, 360, 300, 340].map((w, i) => (
        <div key={i} className="shrink-0" style={{ width: w }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-200" />
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-24 animate-pulse rounded-2xl border border-zinc-200 bg-white" />
            ))}
          </div>
        </div>
      ))}
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
