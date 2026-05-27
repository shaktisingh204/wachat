'use client';

import { Suspense } from 'react';
import { ZoruKanbanBoard } from '../../_components/zoru-kanban-board';

/**
 * /wachat/chat/kanban - Conversations as a kanban board.
 *
 * The board itself lives in `ZoruKanbanBoard`. Column headers include
 * conversation count, median wait time, and WIP-limit warnings. Each
 * card shows avatar, name, last-touch, tag chips, and a small SLA dot.
 * This route wraps it with a wachat-shaped skeleton fallback while
 * data loads.
 */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full flex-1 gap-4 overflow-x-auto p-4">
      {[320, 360, 300, 340].map((w, i) => (
        <div key={i} className="shrink-0" style={{ width: w }}>
          <div className="mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-zinc-200" />
            <div className="h-3 w-20 rounded-full bg-zinc-100" />
            <div className="ml-auto h-4 w-10 rounded-full bg-zinc-100" />
          </div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-zinc-100 bg-white px-2.5 py-1.5">
            <div className="h-2.5 w-16 rounded-full bg-zinc-100" />
            <div className="ml-auto h-2.5 w-10 rounded-full bg-zinc-100" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="animate-pulse rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-zinc-100" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 w-24 rounded-full bg-zinc-100" />
                    <div className="h-2.5 w-16 rounded-full bg-zinc-100" />
                  </div>
                  <div className="h-2 w-2 rounded-full bg-zinc-100" />
                </div>
                <div className="mt-2 flex gap-1.5">
                  <div className="h-4 w-12 rounded-full bg-zinc-100" />
                  <div className="h-4 w-14 rounded-full bg-zinc-100" />
                </div>
              </div>
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
