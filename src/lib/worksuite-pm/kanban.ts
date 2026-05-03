/**
 * Kanban board helpers.
 *
 *  - Column ordering / reordering.
 *  - WIP-limit enforcement (`assertWipOk` + `wouldExceedWip`).
 *  - Cycle-time statistics (per-column and overall).
 *
 * Cycle-time methodology:
 *   For each task that has reached a terminal status (`done`), cycle
 *   time = `completedAt - startedAt`. If `startedAt` is missing we fall
 *   back to `createdAt`. Reported in *hours* with a small statistics
 *   bundle (count, mean, p50, p90).
 */
import type { ID, KanbanBoard, KanbanColumn, Task, TaskStatus } from './types';

export function sortColumns(cols: KanbanColumn[]): KanbanColumn[] {
  return [...cols].sort((a, b) => a.order - b.order);
}

export function reorderColumns(
  board: KanbanBoard,
  orderedIds: ID[],
): KanbanBoard {
  const indexById = new Map(orderedIds.map((id, i) => [id, i]));
  return {
    ...board,
    columns: board.columns.map((c) => ({
      ...c,
      order: indexById.get(c.id) ?? c.order,
    })),
    updatedAt: new Date().toISOString(),
  };
}

export function tasksInColumn(
  tasks: Task[],
  column: KanbanColumn,
): Task[] {
  return tasks.filter(
    (t) =>
      t.status === column.status &&
      (t.columnId == null || t.columnId === column.id),
  );
}

export function wouldExceedWip(
  tasks: Task[],
  column: KanbanColumn,
  delta = 1,
): boolean {
  if (column.wipLimit == null) return false;
  return tasksInColumn(tasks, column).length + delta > column.wipLimit;
}

export class WipLimitError extends Error {
  constructor(public columnId: ID, public limit: number) {
    super(`WIP limit ${limit} exceeded for column ${columnId}`);
    this.name = 'WipLimitError';
  }
}

export function assertWipOk(
  tasks: Task[],
  column: KanbanColumn,
  delta = 1,
): void {
  if (wouldExceedWip(tasks, column, delta)) {
    throw new WipLimitError(column.id, column.wipLimit ?? 0);
  }
}

/* ─────────── Cycle-time stats ─────────── */

export interface CycleStats {
  count: number;
  meanHours: number;
  p50Hours: number;
  p90Hours: number;
  minHours: number;
  maxHours: number;
}

const EMPTY: CycleStats = {
  count: 0,
  meanHours: 0,
  p50Hours: 0,
  p90Hours: 0,
  minHours: 0,
  maxHours: 0,
};

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((p / 100) * (sorted.length - 1))),
  );
  return sorted[idx];
}

/** Hours between `from` and `to` ISO strings (negative -> 0). */
export function hoursBetween(from?: string, to?: string): number | null {
  if (!from || !to) return null;
  const a = Date.parse(from);
  const b = Date.parse(to);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.max(0, (b - a) / (1000 * 60 * 60));
}

export function cycleTimeStats(tasks: Task[]): CycleStats {
  const samples: number[] = [];
  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    const h = hoursBetween(t.startDate ?? t.createdAt, t.completedAt);
    if (h != null) samples.push(h);
  }
  if (!samples.length) return { ...EMPTY };
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((s, n) => s + n, 0);
  return {
    count: samples.length,
    meanHours: sum / samples.length,
    p50Hours: percentile(samples, 50),
    p90Hours: percentile(samples, 90),
    minHours: samples[0],
    maxHours: samples[samples.length - 1],
  };
}

/** Cycle stats grouped by status — useful per-column analytics. */
export function cycleTimeByStatus(
  tasks: Task[],
): Record<TaskStatus, CycleStats> {
  const out: Partial<Record<TaskStatus, CycleStats>> = {};
  const buckets = new Map<TaskStatus, Task[]>();
  for (const t of tasks) {
    const list = buckets.get(t.status) ?? [];
    list.push(t);
    buckets.set(t.status, list);
  }
  for (const [status, list] of buckets) {
    out[status] = cycleTimeStats(list);
  }
  return out as Record<TaskStatus, CycleStats>;
}
