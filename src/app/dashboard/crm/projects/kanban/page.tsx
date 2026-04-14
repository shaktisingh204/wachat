'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import {
  LayoutGrid,
  ArrowLeft,
  ArrowRight,
  Columns3,
} from 'lucide-react';
import {
  getWsProjects,
  getWsTasks,
  getWsTaskboardColumns,
  updateWsTaskColumn,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsProject,
  WsTask,
  WsTaskboardColumn,
} from '@/lib/worksuite/project-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Task = WsTask & { _id: string };
type Project = WsProject & { _id: string };
type Column = WsTaskboardColumn & { _id: string };

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

/** Fallback columns when the user hasn't created custom ones yet. */
const DEFAULT_COLUMNS: Column[] = [
  {
    _id: 'col-incomplete',
    userId: '',
    columnName: 'To Do',
    slug: 'incomplete',
    labelColor: '#94a3b8',
    priority: 1,
  },
  {
    _id: 'col-in-progress',
    userId: '',
    columnName: 'In Progress',
    slug: 'doing',
    labelColor: '#2563eb',
    priority: 2,
  },
  {
    _id: 'col-review',
    userId: '',
    columnName: 'Review',
    slug: 'review',
    labelColor: '#d97706',
    priority: 3,
  },
  {
    _id: 'col-completed',
    userId: '',
    columnName: 'Done',
    slug: 'completed',
    labelColor: '#059669',
    priority: 4,
  },
];

export default function KanbanPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isLoading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [ps, ts, cs] = await Promise.all([
        getWsProjects(),
        getWsTasks(),
        getWsTaskboardColumns(),
      ]);
      setProjects((ps as Project[]) || []);
      setTasks((ts as Task[]) || []);
      setColumns((cs as Column[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const effectiveColumns = useMemo<Column[]>(
    () => (columns.length > 0 ? [...columns].sort((a, b) => a.priority - b.priority) : DEFAULT_COLUMNS),
    [columns],
  );

  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') return tasks;
    return tasks.filter((t) => String(t.projectId) === projectFilter);
  }, [tasks, projectFilter]);

  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p._id, p.name || p.projectName || ''));
    return m;
  }, [projects]);

  /** Match a task to a column by `boardColumnId` first, falling back to slug/status. */
  const tasksForColumn = useCallback(
    (col: Column): Task[] =>
      filteredTasks.filter((t) => {
        if (t.boardColumnId && String(t.boardColumnId) === String(col._id))
          return true;
        if (!t.boardColumnId && col.slug && t.status === col.slug) return true;
        return false;
      }),
    [filteredTasks],
  );

  const moveTask = async (taskId: string, newCol: Column) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) =>
        t._id === taskId
          ? {
              ...t,
              boardColumnId: newCol._id,
              status: (newCol.slug as Task['status']) || t.status,
            }
          : t,
      ),
    );
    const res = await updateWsTaskColumn(taskId, newCol._id);
    if (!res.success) {
      setTasks(prev);
      toast({
        title: 'Error',
        description: res.error || 'Failed to move task.',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {DEFAULT_COLUMNS.map((c) => (
            <Skeleton key={c._id} className="h-[60vh] rounded-clay-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Task Board"
        subtitle="Drag tasks across customisable columns."
        icon={LayoutGrid}
        actions={
          <>
            <div className="w-[220px]">
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger className="h-9 rounded-full border-clay-border bg-clay-surface text-[13px]">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name || p.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/dashboard/crm/projects/taskboard-columns">
              <ClayButton
                variant="pill"
                leading={<Columns3 className="h-4 w-4" />}
              >
                Columns
              </ClayButton>
            </Link>
            <Link href="/dashboard/crm/projects">
              <ClayButton
                variant="pill"
                leading={<ArrowLeft className="h-4 w-4" />}
              >
                Projects
              </ClayButton>
            </Link>
          </>
        }
      />

      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: `repeat(${Math.max(1, Math.min(effectiveColumns.length, 6))}, minmax(240px, 1fr))`,
        }}
      >
        {effectiveColumns.map((col, idx) => {
          const colTasks = tasksForColumn(col);
          const prevCol = idx > 0 ? effectiveColumns[idx - 1] : null;
          const nextCol =
            idx < effectiveColumns.length - 1
              ? effectiveColumns[idx + 1]
              : null;
          return (
            <ClayCard
              key={col._id}
              variant="soft"
              className="flex flex-col"
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: col.labelColor }}
                    aria-hidden
                  />
                  <p className="text-[13px] font-semibold text-clay-ink">
                    {col.columnName}
                  </p>
                </div>
                <span className="text-[11.5px] text-clay-ink-muted">
                  {colTasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {colTasks.length === 0 ? (
                  <div className="rounded-clay-md border border-dashed border-clay-border p-4 text-center text-[12px] text-clay-ink-muted">
                    No tasks
                  </div>
                ) : (
                  colTasks.map((task) => (
                    <ClayCard key={task._id} padded={false} className="p-3">
                      <p className="text-[13px] font-medium text-clay-ink">
                        {task.heading}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-clay-ink-muted">
                        {task.assigneeName ? (
                          <span>{task.assigneeName}</span>
                        ) : null}
                        {task.priority ? (
                          <ClayBadge
                            tone={PRIORITY_TONES[task.priority] || 'neutral'}
                            dot
                          >
                            {task.priority}
                          </ClayBadge>
                        ) : null}
                        {projectFilter === 'all' ? (
                          <span className="truncate">
                            {projectNameMap.get(String(task.projectId)) || ''}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 flex items-center justify-end gap-1">
                        {prevCol ? (
                          <button
                            type="button"
                            onClick={() => moveTask(task._id, prevCol)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink"
                            aria-label="Move left"
                          >
                            <ArrowLeft className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="h-7 w-7" />
                        )}
                        {nextCol ? (
                          <button
                            type="button"
                            onClick={() => moveTask(task._id, nextCol)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink"
                            aria-label="Move right"
                          >
                            <ArrowRight className="h-3.5 w-3.5" />
                          </button>
                        ) : (
                          <span className="h-7 w-7" />
                        )}
                      </div>
                    </ClayCard>
                  ))
                )}
              </div>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
