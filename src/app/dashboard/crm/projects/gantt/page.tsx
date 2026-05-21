'use client';

import * as React from 'react';
import Link from 'next/link';
import { GanttChart, LoaderCircle } from 'lucide-react';
import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruCard,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getWsProjects,
  getWsTasksByProject,
  getWsGanttLinksByProject,
  updateTaskDates,
  createGanttDependency,
  deleteGanttDependency,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsProject,
  WsTask,
  WsGanttLink,
} from '@/lib/worksuite/project-types';
import {
  buildDays,
  GanttGrid,
  GANTT_HEADER_HEIGHT,
  GANTT_LABEL_WIDTH,
  GANTT_ROW_HEIGHT,
  type GanttDayMeta,
} from './_components/gantt-grid';
import {
  GanttBar,
  type GanttBarDragMode,
  type GanttBarTask,
} from './_components/gantt-bar';
import {
  GanttArrowDefs,
  GanttDependencyLine,
} from './_components/gantt-dependency-line';

type Project = WsProject & { _id: string };
type Task = WsTask & { _id: string };
type GanttLink = WsGanttLink & { _id: string };

interface PositionedTask {
  task: GanttBarTask;
  rowIndex: number;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 32;

function dayStartMs(d: Date | number): number {
  const date = new Date(d);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function toIsoDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function deriveTaskRange(task: Task): { startMs: number; dueMs: number } | null {
  const s = task.startDate ? new Date(task.startDate).getTime() : NaN;
  const e = task.dueDate ? new Date(task.dueDate).getTime() : NaN;
  if (!Number.isFinite(s) && !Number.isFinite(e)) return null;
  const startMs = Number.isFinite(s) ? dayStartMs(s) : dayStartMs(e);
  const dueMs = Number.isFinite(e) ? dayStartMs(e) : startMs;
  return { startMs, dueMs: Math.max(dueMs, startMs) };
}

interface DragState {
  taskId: string;
  mode: GanttBarDragMode;
  startClientX: number;
  startClientY: number;
  originStartMs: number;
  originDueMs: number;
  // For 'link' drag — current pointer position relative to chart origin.
  pointerX?: number;
  pointerY?: number;
}

export default function GanttPage() {
  const { toast } = useZoruToast();
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = React.useState<string>('');
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [links, setLinks] = React.useState<GanttLink[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [deletingLink, setDeletingLink] = React.useState<GanttLink | null>(
    null,
  );

  const chartScrollRef = React.useRef<HTMLDivElement | null>(null);
  const dragRef = React.useRef<DragState | null>(null);
  const [, forceRerender] = React.useReducer((n: number) => n + 1, 0);

  /* ── Initial load ─────────────────────────────────────────────── */

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void getWsProjects()
      .then((ps) => {
        if (cancelled) return;
        const list = (ps as Project[]) || [];
        setProjects(list);
        if (list.length > 0 && !selectedProjectId) {
          setSelectedProjectId(list[0]._id);
        }
      })
      .catch(() => setProjects([]))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // selectedProjectId intentionally not tracked here — set-once on load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshTasks = React.useCallback(
    async (projectId: string) => {
      if (!projectId) {
        setTasks([]);
        setLinks([]);
        return;
      }
      const [ts, ls] = await Promise.all([
        getWsTasksByProject(projectId),
        getWsGanttLinksByProject(projectId),
      ]);
      setTasks(Array.isArray(ts) ? (ts as Task[]) : []);
      setLinks(Array.isArray(ls) ? (ls as GanttLink[]) : []);
    },
    [],
  );

  React.useEffect(() => {
    if (selectedProjectId) {
      void refreshTasks(selectedProjectId);
    }
  }, [selectedProjectId, refreshTasks]);

  /* ── Derived: chart range + positioned bars ───────────────────── */

  const positioned: PositionedTask[] = React.useMemo(() => {
    return tasks
      .map((t, i): PositionedTask | null => {
        const r = deriveTaskRange(t);
        if (!r) return null;
        return {
          rowIndex: i,
          task: {
            _id: t._id,
            heading: t.heading,
            startMs: r.startMs,
            dueMs: r.dueMs,
            status: t.status,
            priority: t.priority,
          },
        };
      })
      .filter((x): x is PositionedTask => x !== null);
  }, [tasks]);

  const rangeMs = React.useMemo(() => {
    if (positioned.length === 0) {
      const today = dayStartMs(new Date());
      return { startMs: today - 7 * MS_PER_DAY, endMs: today + 30 * MS_PER_DAY };
    }
    let startMs = Infinity;
    let endMs = -Infinity;
    for (const p of positioned) {
      if (p.task.startMs < startMs) startMs = p.task.startMs;
      if (p.task.dueMs > endMs) endMs = p.task.dueMs;
    }
    // Pad both sides for visual breathing room.
    return {
      startMs: startMs - 3 * MS_PER_DAY,
      endMs: endMs + 7 * MS_PER_DAY,
    };
  }, [positioned]);

  const days: GanttDayMeta[] = React.useMemo(
    () => buildDays(rangeMs.startMs, rangeMs.endMs),
    [rangeMs.startMs, rangeMs.endMs],
  );

  const chartWidth = days.length * DAY_WIDTH;
  const chartHeight = Math.max(tasks.length, 1) * GANTT_ROW_HEIGHT;
  const todayMs = dayStartMs(new Date());
  const showTodayLine = todayMs >= rangeMs.startMs && todayMs <= rangeMs.endMs;

  const xFromMs = React.useCallback(
    (ms: number): number => {
      return ((ms - rangeMs.startMs) / MS_PER_DAY) * DAY_WIDTH;
    },
    [rangeMs.startMs],
  );

  const msFromDeltaX = React.useCallback(
    (deltaX: number): number => {
      return Math.round(deltaX / DAY_WIDTH) * MS_PER_DAY;
    },
    [],
  );

  /* ── Drag handling ────────────────────────────────────────────── */

  const handleBarPointerDown = React.useCallback(
    (taskId: string, mode: GanttBarDragMode, e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const task = positioned.find((p) => p.task._id === taskId);
      if (!task) return;
      const target = e.currentTarget;
      try {
        target.setPointerCapture(e.pointerId);
      } catch {
        /* ignore — pointer capture is best-effort */
      }
      dragRef.current = {
        taskId,
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originStartMs: task.task.startMs,
        originDueMs: task.task.dueMs,
      };
      forceRerender();
    },
    [positioned],
  );

  const handlePointerMove = React.useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const deltaX = e.clientX - drag.startClientX;
      const deltaMs = msFromDeltaX(deltaX);

      if (drag.mode === 'move') {
        setTasks((prev) =>
          prev.map((t) =>
            t._id === drag.taskId
              ? {
                  ...t,
                  startDate: new Date(drag.originStartMs + deltaMs),
                  dueDate: new Date(drag.originDueMs + deltaMs),
                }
              : t,
          ),
        );
      } else if (drag.mode === 'resize-left') {
        const nextStart = Math.min(
          drag.originStartMs + deltaMs,
          drag.originDueMs - MS_PER_DAY,
        );
        setTasks((prev) =>
          prev.map((t) =>
            t._id === drag.taskId
              ? { ...t, startDate: new Date(nextStart) }
              : t,
          ),
        );
      } else if (drag.mode === 'resize-right') {
        const nextDue = Math.max(
          drag.originDueMs + deltaMs,
          drag.originStartMs + MS_PER_DAY,
        );
        setTasks((prev) =>
          prev.map((t) =>
            t._id === drag.taskId ? { ...t, dueDate: new Date(nextDue) } : t,
          ),
        );
      } else if (drag.mode === 'link') {
        // Compute pointer position relative to the chart's inner area.
        const scroll = chartScrollRef.current;
        if (!scroll) return;
        const rect = scroll.getBoundingClientRect();
        drag.pointerX = e.clientX - rect.left + scroll.scrollLeft;
        drag.pointerY = e.clientY - rect.top + scroll.scrollTop;
        forceRerender();
      }
    },
    [msFromDeltaX],
  );

  const handlePointerUp = React.useCallback(
    async (e: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;

      if (drag.mode === 'link') {
        // Hit-test: did we release over a task bar (different from source)?
        const target = document.elementFromPoint(e.clientX, e.clientY);
        const barEl = target?.closest('[data-gantt-bar-id]') as HTMLElement | null;
        const targetId = barEl?.getAttribute('data-gantt-bar-id') ?? null;
        if (targetId && targetId !== drag.taskId) {
          setSaving(true);
          const res = await createGanttDependency(
            drag.taskId,
            targetId,
            selectedProjectId,
          );
          setSaving(false);
          if (res.error) {
            toast({
              title: 'Link failed',
              description: res.error,
              variant: 'destructive',
            });
          } else {
            await refreshTasks(selectedProjectId);
            toast({ title: 'Linked', description: 'Dependency created.' });
          }
        }
        forceRerender();
        return;
      }

      // Move / resize — persist new start + due.
      const task = tasks.find((t) => t._id === drag.taskId);
      if (!task) return;
      const startIso = task.startDate
        ? toIsoDate(new Date(task.startDate).getTime())
        : '';
      const dueIso = task.dueDate
        ? toIsoDate(new Date(task.dueDate).getTime())
        : '';
      setSaving(true);
      const res = await updateTaskDates(drag.taskId, startIso, dueIso);
      setSaving(false);
      if (res.error) {
        toast({
          title: 'Update failed',
          description: res.error,
          variant: 'destructive',
        });
        await refreshTasks(selectedProjectId);
      } else {
        toast({ title: 'Saved', description: 'Task dates updated.' });
      }
    },
    [tasks, toast, selectedProjectId, refreshTasks],
  );

  React.useEffect(() => {
    const onMove = (e: PointerEvent) => handlePointerMove(e);
    const onUp = (e: PointerEvent) => {
      void handlePointerUp(e);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [handlePointerMove, handlePointerUp]);

  /* ── Dependency line geometry ─────────────────────────────────── */

  const rowYCenter = (i: number): number =>
    i * GANTT_ROW_HEIGHT + GANTT_ROW_HEIGHT / 2;

  const linkLines = React.useMemo(() => {
    const idx = new Map<string, number>();
    positioned.forEach((p, i) => idx.set(p.task._id, i));
    return links
      .map((l) => {
        const sIdx = idx.get(String(l.source));
        const tIdx = idx.get(String(l.target));
        if (sIdx === undefined || tIdx === undefined) return null;
        const sourceTask = positioned[sIdx].task;
        const targetTask = positioned[tIdx].task;
        const sourceX = xFromMs(sourceTask.dueMs) + DAY_WIDTH;
        const sourceY = rowYCenter(sIdx);
        const targetX = xFromMs(targetTask.startMs);
        const targetY = rowYCenter(tIdx);
        return { linkId: l._id, sourceX, sourceY, targetX, targetY };
      })
      .filter(
        (x): x is {
          linkId: string;
          sourceX: number;
          sourceY: number;
          targetX: number;
          targetY: number;
        } => x !== null,
      );
  }, [links, positioned, xFromMs]);

  /* ── Delete link dialog ───────────────────────────────────────── */

  const handleDeleteLink = async () => {
    if (!deletingLink) return;
    const id = deletingLink._id;
    setDeletingLink(null);
    setSaving(true);
    const res = await deleteGanttDependency(id);
    setSaving(false);
    if (res.error) {
      toast({
        title: 'Delete failed',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    setLinks((prev) => prev.filter((l) => l._id !== id));
    toast({ title: 'Deleted', description: 'Dependency removed.' });
  };

  /* ── Render ───────────────────────────────────────────────────── */

  if (loading && projects.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <ZoruSkeleton className="h-10 w-64" />
        <ZoruSkeleton className="h-96 w-full" />
      </div>
    );
  }

  const drag = dragRef.current;
  const linkPreview =
    drag && drag.mode === 'link' && drag.pointerX !== undefined
      ? (() => {
          const sourceTask = positioned.find((p) => p.task._id === drag.taskId);
          if (!sourceTask) return null;
          const sourceIdx = positioned.findIndex(
            (p) => p.task._id === drag.taskId,
          );
          const sourceX = xFromMs(sourceTask.task.dueMs) + DAY_WIDTH;
          const sourceY = rowYCenter(sourceIdx);
          return { sourceX, sourceY, targetX: drag.pointerX, targetY: drag.pointerY ?? sourceY };
        })()
      : null;

  return (
    <EntityListShell
      title="Project Timeline"
      subtitle="Drag bars to reschedule. Drag from a bar's right edge (+ icon) to another bar to create a dependency."
    >
      <ZoruCard className="p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <GanttChart
              className="h-4 w-4 text-zoru-ink-muted"
              strokeWidth={1.75}
            />
            <ZoruSelect
              value={selectedProjectId}
              onValueChange={(v) => setSelectedProjectId(v)}
            >
              <ZoruSelectTrigger className="h-9 w-[260px] rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                <ZoruSelectValue placeholder="Select a project" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {projects.map((p) => (
                  <ZoruSelectItem key={p._id} value={p._id}>
                    {p.name || p.projectName}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>

          <span className="text-[11.5px] text-zoru-ink-muted">Legend:</span>
          <ZoruBadge variant="warning">In progress</ZoruBadge>
          <ZoruBadge variant="success">Done</ZoruBadge>
          <ZoruBadge variant="ghost">To-do</ZoruBadge>

          <span className="ml-auto flex items-center gap-2 text-[11.5px] text-zoru-ink-muted">
            {saving ? (
              <>
                <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                Saving…
              </>
            ) : null}
            {tasks.length} task{tasks.length === 1 ? '' : 's'} · {links.length}{' '}
            link{links.length === 1 ? '' : 's'}
          </span>
        </div>

        {!selectedProjectId ? (
          <div className="rounded-lg border border-dashed border-zoru-line p-12 text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              Select a project to view its Gantt chart.
            </p>
          </div>
        ) : tasks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zoru-line p-12 text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              This project has no tasks yet. Add tasks with start + due dates
              to see them on the timeline.
            </p>
          </div>
        ) : (
          <div className="flex overflow-hidden rounded-lg border border-zoru-line">
            {/* Left column: task labels */}
            <div
              className="shrink-0 border-r border-zoru-line bg-zoru-surface"
              style={{ width: GANTT_LABEL_WIDTH }}
            >
              <div
                className="border-b border-zoru-line bg-zoru-surface-2 px-3 text-[11.5px] font-medium uppercase tracking-wide text-zoru-ink-muted"
                style={{
                  height: GANTT_HEADER_HEIGHT,
                  lineHeight: `${GANTT_HEADER_HEIGHT}px`,
                }}
              >
                Task
              </div>
              {tasks.map((t) => (
                <div
                  key={t._id}
                  className="flex items-center border-b border-zoru-line px-3 text-[12.5px] text-zoru-ink"
                  style={{ height: GANTT_ROW_HEIGHT }}
                  title={t.heading}
                >
                  <Link
                    href={`/dashboard/crm/tasks/${t._id}`}
                    className="truncate hover:underline"
                  >
                    {t.heading}
                  </Link>
                </div>
              ))}
            </div>

            {/* Chart scroller */}
            <div
              ref={chartScrollRef}
              className="relative overflow-x-auto"
              style={{ flex: 1 }}
            >
              <div
                className="relative"
                style={{ width: chartWidth, minWidth: chartWidth }}
              >
                <GanttGrid
                  days={days}
                  dayWidth={DAY_WIDTH}
                  rowCount={tasks.length}
                  todayMs={showTodayLine ? todayMs : null}
                />

                {/* Bars layer — absolutely positioned over the grid. */}
                <div
                  className="absolute left-0 right-0"
                  style={{
                    top: GANTT_HEADER_HEIGHT,
                    height: chartHeight,
                  }}
                >
                  {positioned.map((p) => {
                    const left = xFromMs(p.task.startMs);
                    const width =
                      Math.max(
                        1,
                        (p.task.dueMs - p.task.startMs) / MS_PER_DAY + 1,
                      ) * DAY_WIDTH;
                    return (
                      <div
                        key={p.task._id}
                        data-gantt-bar-id={p.task._id}
                        className="absolute left-0 right-0"
                        style={{
                          top: p.rowIndex * GANTT_ROW_HEIGHT,
                          height: GANTT_ROW_HEIGHT,
                        }}
                      >
                        <GanttBar
                          task={p.task}
                          left={left}
                          width={width}
                          top={0}
                          rowHeight={GANTT_ROW_HEIGHT}
                          onDragStart={handleBarPointerDown}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Dependency-line layer */}
                <svg
                  className="pointer-events-none absolute left-0"
                  style={{
                    top: GANTT_HEADER_HEIGHT,
                    width: chartWidth,
                    height: chartHeight,
                  }}
                >
                  <GanttArrowDefs />
                  <g pointerEvents="auto">
                    {linkLines.map((l) => {
                      const link = links.find((x) => x._id === l.linkId);
                      return (
                        <GanttDependencyLine
                          key={l.linkId}
                          linkId={l.linkId}
                          sourceX={l.sourceX}
                          sourceY={l.sourceY}
                          targetX={l.targetX}
                          targetY={l.targetY}
                          onClick={() => link && setDeletingLink(link)}
                        />
                      );
                    })}
                  </g>
                  {linkPreview ? (
                    <line
                      x1={linkPreview.sourceX}
                      y1={linkPreview.sourceY}
                      x2={linkPreview.targetX}
                      y2={linkPreview.targetY}
                      stroke="#0ea5e9"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  ) : null}
                </svg>
              </div>
            </div>
          </div>
        )}
      </ZoruCard>

      <ZoruAlertDialog
        open={deletingLink !== null}
        onOpenChange={(o) => !o && setDeletingLink(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">
              Delete dependency?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              Remove the link between these two tasks? This does not delete the
              tasks themselves.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDeleteLink}>
              Delete dependency
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </EntityListShell>
  );
}
