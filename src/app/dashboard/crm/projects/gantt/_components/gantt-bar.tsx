'use client';

import * as React from 'react';
import { cn } from '@/components/sabcrm/20ui/compat';

export const GANTT_BAR_HEIGHT = 22;

export type GanttBarDragMode = 'move' | 'resize-left' | 'resize-right' | 'link';

export interface GanttBarTask {
  _id: string;
  heading: string;
  startMs: number;
  dueMs: number;
  status?: string;
  priority?: string;
  isCritical?: boolean;
}

export interface GanttBarProps {
  task: GanttBarTask;
  /** X offset from the chart origin in px. */
  left: number;
  /** Width in px. */
  width: number;
  /** Row Y offset in px (top of bar's row). */
  top: number;
  rowHeight: number;
  /** Drag handler from the parent. Called on pointerdown on any handle. */
  onDragStart: (
    taskId: string,
    mode: GanttBarDragMode,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
}

const STATUS_BG: Record<string, string> = {
  done: 'bg-[var(--st-text)]/80 border-[var(--st-border)]',
  completed: 'bg-[var(--st-text)]/80 border-[var(--st-border)]',
  'in-progress': 'bg-[var(--st-text)]/80 border-[var(--st-border)]',
  review: 'bg-[var(--st-text)]/80 border-[var(--st-border)]',
  todo: 'bg-[var(--st-bg-muted)]/70 border-[var(--st-border)]',
  incomplete: 'bg-[var(--st-bg-muted)]/70 border-[var(--st-border)]',
};

const PRIORITY_RING: Record<string, string> = {
  urgent: 'ring-2 ring-[var(--st-border)]/50',
  high: 'ring-2 ring-[var(--st-border)]/40',
};

export function GanttBar({
  task,
  left,
  width,
  top,
  rowHeight,
  onDragStart,
}: GanttBarProps) {
  const barTop = top + (rowHeight - GANTT_BAR_HEIGHT) / 2;
  const statusClass = STATUS_BG[task.status ?? ''] ?? STATUS_BG.todo;
  const priorityRing = PRIORITY_RING[task.priority ?? ''] ?? '';
  const criticalRing = task.isCritical ? 'ring-2 ring-[var(--st-border)] ring-offset-1 ring-offset-zoru-bg shadow-md z-10' : '';

  return (
    <div
      className={cn(
        'absolute flex items-center rounded-md border text-[11.5px] text-white shadow-sm',
        statusClass,
        priorityRing,
        criticalRing
      )}
      style={{
        left,
        width: Math.max(width, 16),
        top: barTop,
        height: GANTT_BAR_HEIGHT,
      }}
      role="button"
      aria-label={`Task ${task.heading}`}
      tabIndex={0}
    >
      {/* Left resize handle */}
      <div
        className="h-full w-2 cursor-ew-resize rounded-l-md bg-black/15 hover:bg-black/30"
        onPointerDown={(e) => onDragStart(task._id, 'resize-left', e)}
        aria-label="Resize start date"
      />
      {/* Body — drag to move */}
      <div
        className="min-w-0 flex-1 cursor-grab truncate px-2 active:cursor-grabbing"
        onPointerDown={(e) => onDragStart(task._id, 'move', e)}
        title={task.heading}
      >
        {task.heading}
      </div>
      {/* Right resize handle — also acts as link-start when right-clicked or
          when the user drags from the very edge. Pointerdown here triggers a
          resize. To create a link, the user should click the small "+"
          circle further to the right. */}
      <div
        className="h-full w-2 cursor-ew-resize rounded-r-md bg-black/15 hover:bg-black/30"
        onPointerDown={(e) => onDragStart(task._id, 'resize-right', e)}
        aria-label="Resize due date"
      />
      {/* Link-out anchor (right of bar). */}
      <button
        type="button"
        onPointerDown={(e) => onDragStart(task._id, 'link', e)}
        className="absolute -right-3 top-1/2 flex h-4 w-4 -translate-y-1/2 cursor-crosshair items-center justify-center rounded-full border border-[var(--st-border)] bg-[var(--st-bg)] text-[10px] text-[var(--st-text)] shadow-sm hover:bg-[var(--st-bg-muted)]"
        title="Drag to another bar to create a dependency"
        aria-label="Create dependency"
      >
        +
      </button>
    </div>
  );
}
