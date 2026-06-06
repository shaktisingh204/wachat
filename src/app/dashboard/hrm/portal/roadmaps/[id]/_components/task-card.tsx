'use client';

import * as React from 'react';
import { CheckCircle2, CheckSquare, Square } from 'lucide-react';

import { Badge, Button, Card } from '@/components/sabcrm/20ui';
import { fmtDate } from '@/lib/utils';
import type { RoadmapTask } from '@/app/actions/hrm-roadmaps.actions.types';

/* ─── Priority badge ────────────────────────────────────────────────── */

const PRIORITY_VARIANT = {
  low: 'ghost',
  medium: 'warning',
  high: 'danger',
} as const satisfies Record<RoadmapTask['priority'], 'ghost' | 'warning' | 'danger'>;

const PRIORITY_LABEL: Record<RoadmapTask['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

/* ─── Status badge ──────────────────────────────────────────────────── */

const STATUS_VARIANT = {
  todo: 'secondary',
  in_progress: 'info',
  done: 'success',
  blocked: 'danger',
} as const satisfies Record<
  RoadmapTask['status'],
  'secondary' | 'info' | 'success' | 'danger'
>;

const STATUS_LABEL: Record<RoadmapTask['status'], string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

/* ─── Initials avatar ───────────────────────────────────────────────── */

function InitialsAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--st-text)]/15 text-[10px] font-semibold text-[var(--st-text)]">
      {initials || '?'}
    </span>
  );
}

/* ─── Props ─────────────────────────────────────────────────────────── */

export interface TaskCardProps {
  task: RoadmapTask;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onMarkDone: () => void;
  isDragging?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  showSelect?: boolean;
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function TaskCard({
  task,
  draggable,
  onDragStart,
  onMarkDone,
  isDragging,
  isSelected,
  onToggleSelect,
  showSelect,
}: TaskCardProps) {
  // Use suppressHydrationWarning to avoid SSR hydration mismatches on local dates
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Card
      draggable={draggable}
      onDragStart={onDragStart}
      className={[
        'cursor-grab select-none p-3 active:cursor-grabbing relative',
        isDragging ? 'opacity-40 ring-2 ring-[var(--st-text)]' : '',
        isSelected ? 'ring-2 ring-[var(--st-text)]/50 bg-[var(--st-text)]/5' : '',
      ]
        .join(' ')
        .trim()}
    >
      {/* Optional Checkbox for bulk actions */}
      {showSelect && onToggleSelect && (
        <button
          type="button"
          onClick={onToggleSelect}
          className="absolute right-2 top-2 text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
        >
          {isSelected ? (
            <CheckSquare className="h-4 w-4 text-[var(--st-text)]" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Title */}
      <p className="mb-2 pr-6 text-sm font-semibold leading-snug text-[var(--st-text)]">
        {task.title}
      </p>

      {/* Badges row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Badge variant={PRIORITY_VARIANT[task.priority]}>
          {PRIORITY_LABEL[task.priority]}
        </Badge>
        <Badge variant={STATUS_VARIANT[task.status]}>
          {STATUS_LABEL[task.status]}
        </Badge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Assignee */}
        {task.assigneeName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <InitialsAvatar name={task.assigneeName} />
            <span className="truncate text-xs text-[var(--st-text-secondary)]">
              {task.assigneeName}
            </span>
          </div>
        ) : (
          <span className="text-xs text-[var(--st-text-tertiary)]">Unassigned</span>
        )}

        {/* Due date */}
        {task.dueDate && mounted && (
          <span className="shrink-0 text-xs tabular-nums text-[var(--st-text-tertiary)]">
            {fmtDate(task.dueDate)}
          </span>
        )}
      </div>

      {/* Mark done button */}
      {task.status !== 'done' && (
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full"
          onClick={(e) => {
            e.stopPropagation();
            onMarkDone();
          }}
        >
          <CheckCircle2 className="h-4 w-4" />
          Mark Done
        </Button>
      )}
    </Card>
  );
}
