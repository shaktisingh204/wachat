'use client';

import { useState } from 'react';
import { Search, ClipboardList } from 'lucide-react';
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  type BadgeTone,
} from '@/components/sabcrm/20ui';
import { PublicTaskboardView } from '@/app/actions/public-taskboard.actions';

function formatDate(iso: string | null): string {
  if (!iso) return 'No date';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'No date'
    : d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
}

const PRIORITY_TONE: Record<string, BadgeTone> = {
  urgent: 'danger',
  high: 'warning',
  medium: 'accent',
  low: 'neutral',
};

const STATUS_TONE: Record<string, BadgeTone> = {
  done: 'success',
  completed: 'success',
  'in-progress': 'info',
  review: 'info',
  todo: 'neutral',
  incomplete: 'neutral',
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
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader bordered={false} compact className="flex-1">
            <PageHeaderHeading>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                Project taskboard
              </p>
              <PageTitle>{project.name}</PageTitle>
              <PageDescription>
                {formatDate(project.startDate)} to {formatDate(project.deadline)}
              </PageDescription>
            </PageHeaderHeading>
          </PageHeader>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge tone="neutral" kind="outline">
                {project.status}
              </Badge>
              <Badge tone="neutral">
                {totalCards} tasks, {columns.length} columns
              </Badge>
            </div>
            <div className="mt-2 w-full sm:w-64">
              <Field label="Filter tasks">
                <Input
                  iconLeft={Search}
                  placeholder="Filter by assignee, tag, or title"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  aria-label="Filter tasks by assignee, tag, or title"
                  className="w-full"
                />
              </Field>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="overflow-x-auto">
        <div className="flex min-w-full gap-4 pb-2">
          {filteredColumns.length === 0 ? (
            <div className="w-full">
              <EmptyState
                icon={ClipboardList}
                title="No taskboard columns"
                description="No taskboard columns are configured for this project."
              />
            </div>
          ) : (
            filteredColumns.map((col) => (
              <div
                key={col._id}
                className="flex w-72 shrink-0 flex-col rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]"
              >
                <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: col.color }}
                      aria-hidden
                    />
                    <span className="truncate text-sm font-semibold text-[var(--st-text)]">
                      {col.name}
                    </span>
                  </div>
                  <Badge tone="neutral" kind="outline">
                    {col.cards.length}
                  </Badge>
                </div>
                <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-2">
                  {col.cards.length === 0 ? (
                    <p className="px-2 py-6 text-center text-xs text-[var(--st-text-secondary)]">
                      No tasks match filter
                    </p>
                  ) : (
                    col.cards.map((card) => (
                      <article
                        key={card._id}
                        className="rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-3 shadow-sm"
                      >
                        <h3 className="text-sm font-medium text-[var(--st-text)]">
                          {card.heading || 'Untitled task'}
                        </h3>
                        {card.description ? (
                          <p className="mt-1 line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                            {card.description}
                          </p>
                        ) : null}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {card.priority ? (
                            <Badge
                              tone={
                                PRIORITY_TONE[card.priority.toLowerCase()] ||
                                'neutral'
                              }
                            >
                              {card.priority}
                            </Badge>
                          ) : null}
                          <Badge
                            tone={
                              STATUS_TONE[card.status.toLowerCase()] || 'neutral'
                            }
                          >
                            {card.status}
                          </Badge>
                          {card.tags && card.tags.length > 0
                            ? card.tags.map((tag) => (
                                <Badge
                                  key={tag}
                                  tone="neutral"
                                  className="text-[10px]"
                                >
                                  {tag}
                                </Badge>
                              ))
                            : null}
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-[var(--st-text-secondary)]">
                          <span>{formatDate(card.dueDate)}</span>
                          {card.assigneeName ? (
                            <span className="inline-flex items-center gap-1">
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[10px] font-semibold text-[var(--st-text)]">
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
