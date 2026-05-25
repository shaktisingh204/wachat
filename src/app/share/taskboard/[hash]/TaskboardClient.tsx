'use client';

import { useState } from 'react';
import { Badge, Card, ZoruCardHeader, ZoruCardTitle, Input } from '@/components/zoruui';
import { PublicTaskboardView } from '@/app/actions/public-taskboard.actions';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

const PRIORITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  urgent: 'destructive',
  high: 'secondary',
  medium: 'default',
  low: 'outline',
};

const STATUS_VARIANT: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  done: 'default',
  completed: 'default',
  'in-progress': 'secondary',
  review: 'secondary',
  todo: 'outline',
  incomplete: 'outline',
};

export default function TaskboardClient({
  data,
}: {
  data: PublicTaskboardView;
}) {
  const { project, columns } = data;
  const [filterText, setFilterText] = useState('');

  const filteredColumns = columns.map((col) => {
    return {
      ...col,
      cards: col.cards.filter((card) => {
        if (!filterText) return true;
        const text = filterText.toLowerCase();
        if (card.assigneeName?.toLowerCase().includes(text)) return true;
        if (card.tags?.some((tag) => tag.toLowerCase().includes(text))) return true;
        if (card.heading?.toLowerCase().includes(text)) return true;
        return false;
      }),
    };
  });

  const totalCards = columns.reduce((s, c) => s + c.cards.length, 0);

  return (
    <div className="space-y-6">
      <Card>
        <ZoruCardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Project taskboard
            </p>
            <ZoruCardTitle className="mt-1">{project.name}</ZoruCardTitle>
            <p className="mt-1 text-sm text-zinc-500">
              {formatDate(project.startDate)} &middot;{' '}
              {formatDate(project.deadline)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">{project.status}</Badge>
              <Badge variant="secondary">
                {totalCards} tasks &middot; {columns.length} columns
              </Badge>
            </div>
            <div className="w-full sm:w-64 mt-2">
              <Input
                placeholder="Filter by assignee, tag, or title..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </ZoruCardHeader>
      </Card>

      <div className="overflow-x-auto">
        <div className="flex min-w-full gap-4 pb-2">
          {filteredColumns.length === 0 ? (
            <div className="w-full rounded-md border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500">
              No taskboard columns configured for this project.
            </div>
          ) : (
            filteredColumns.map((col) => (
              <div
                key={col._id}
                className="flex w-72 shrink-0 flex-col rounded-md border border-zinc-200 bg-zinc-50"
              >
                <div className="flex items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: col.color }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-semibold text-zinc-900">
                      {col.name}
                    </span>
                  </div>
                  <Badge variant="outline">{col.cards.length}</Badge>
                </div>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                  {col.cards.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-zinc-400">
                      No tasks match filter
                    </p>
                  ) : (
                    col.cards.map((card) => (
                      <article
                        key={card._id}
                        className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm"
                      >
                        <h3 className="text-sm font-medium text-zinc-900">
                          {card.heading || 'Untitled task'}
                        </h3>
                        {card.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-zinc-600">
                            {card.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {card.priority ? (
                            <Badge
                              variant={
                                PRIORITY_VARIANT[card.priority.toLowerCase()] ||
                                'outline'
                              }
                            >
                              {card.priority}
                            </Badge>
                          ) : null}
                          <Badge
                            variant={
                              STATUS_VARIANT[card.status.toLowerCase()] ||
                              'outline'
                            }
                          >
                            {card.status}
                          </Badge>
                          {card.tags && card.tags.length > 0
                            ? card.tags.map((tag) => (
                                <Badge key={tag} variant="secondary" className="text-[10px]">
                                  {tag}
                                </Badge>
                              ))
                            : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-500">
                          <span>{formatDate(card.dueDate)}</span>
                          {card.assigneeName ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-semibold text-zinc-700">
                                {card.assigneeName
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((s) => s[0]?.toUpperCase() ?? '')
                                  .join('')}
                              </span>
                              <span className="max-w-[100px] truncate">
                                {card.assigneeName}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </article>
                    ))
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
