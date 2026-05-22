'use client';

import * as React from 'react';
import { CheckCircle2 } from 'lucide-react';

import { Badge, Button, Card } from '@/components/zoruui';
import type { RoadmapTask } from '@/app/actions/hrm-roadmaps.actions';

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
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zoru-primary/15 text-[10px] font-semibold text-zoru-primary">
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
}

/* ─── Component ─────────────────────────────────────────────────────── */

export function TaskCard({
  task,
  draggable,
  onDragStart,
  onMarkDone,
  isDragging,
}: TaskCardProps) {
  return (
    <ZoruCard
      draggable={draggable}
      onDragStart={onDragStart}
      className={[
        'cursor-grab select-none p-3 active:cursor-grabbing',
        isDragging ? 'opacity-40 ring-2 ring-zoru-primary' : '',
      ]
        .join(' ')
        .trim()}
    >
      {/* Title */}
      <p className="mb-2 text-sm font-semibold leading-snug text-zoru-ink">
        {task.title}
      </p>

      {/* Badges row */}
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <ZoruBadge variant={PRIORITY_VARIANT[task.priority]}>
          {PRIORITY_LABEL[task.priority]}
        </ZoruBadge>
        <ZoruBadge variant={STATUS_VARIANT[task.status]}>
          {STATUS_LABEL[task.status]}
        </ZoruBadge>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        {/* Assignee */}
        {task.assigneeName ? (
          <div className="flex items-center gap-1.5 min-w-0">
            <InitialsAvatar name={task.assigneeName} />
            <span className="truncate text-xs text-zoru-ink-muted">
              {task.assigneeName}
            </span>
          </div>
        ) : (
          <span className="text-xs text-zoru-ink-subtle">Unassigned</span>
        )}

        {/* Due date */}
        {task.dueDate && (
          <span className="shrink-0 text-xs tabular-nums text-zoru-ink-subtle">
            {new Date(task.dueDate).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Mark done button */}
      {task.status !== 'done' && (
        <ZoruButton
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
        </ZoruButton>
      )}
    </ZoruCard>
  );
}
