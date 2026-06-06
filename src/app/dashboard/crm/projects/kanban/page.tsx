'use client';

import { Badge, Button, Card, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, useToast } from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition } from 'react';
import Link from 'next/link';
import {
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

import { EntityListShell } from '@/components/crm/entity-list-shell';

type Task = WsTask & { _id: string };
type Project = WsProject & { _id: string };
type Column = WsTaskboardColumn & { _id: string };

const PRIORITY_VARIANTS: Record<
  string,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  low: 'ghost',
  medium: 'success',
  high: 'warning',
  urgent: 'danger',
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
  const [swimlaneBy, setSwimlaneBy] = useState<'none' | 'assignee' | 'project'>('none');
  const [isLoading, startLoading] = useTransition();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === 'undefined') return;

    // Real-time Kanban board updates via WebSockets
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/realtime/kanban`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TASK_MOVED') {
          setTasks((curr) =>
            curr.map((t) =>
              t._id === data.taskId
                ? {
                    ...t,
                    boardColumnId: data.boardColumnId,
                    status: data.status || t.status,
                  }
                : t
            )
          );
        }
      } catch (e) {
        console.error('Failed to parse websocket message', e);
      }
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [mounted]);

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
    let prevTask: Task | undefined;
    setTasks((curr) => {
      prevTask = curr.find((t) => t._id === taskId);
      return curr.map((t) =>
        t._id === taskId
          ? {
              ...t,
              boardColumnId: newCol._id,
              status: (newCol.slug as Task['status']) || t.status,
            }
          : t
      );
    });
    
    const res = await updateWsTaskColumn(taskId, newCol._id);
    if (!res.success) {
      setTasks((curr) =>
        curr.map((t) => (t._id === taskId && prevTask ? prevTask : t))
      );
      toast({
        title: 'Error',
        description: res.error || 'Failed to move task.',
        variant: 'destructive',
      });
    }
  };

  const swimlanes = useMemo(() => {
    if (swimlaneBy === 'none') {
      return [{ id: 'all', label: null, tasks: filteredTasks }];
    }
    const map = new Map<string, { id: string; label: string; tasks: Task[] }>();
    filteredTasks.forEach((t) => {
      let key = 'unassigned';
      let label = 'Unassigned';
      if (swimlaneBy === 'assignee') {
        key = t.assigneeName || 'unassigned';
        label = t.assigneeName || 'Unassigned';
      } else if (swimlaneBy === 'project') {
        key = String(t.projectId) || 'unassigned';
        label = projectNameMap.get(key) || 'No Project';
      }
      if (!map.has(key)) {
        map.set(key, { id: key, label, tasks: [] });
      }
      map.get(key)!.tasks.push(t);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [filteredTasks, swimlaneBy, projectNameMap]);

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {DEFAULT_COLUMNS.map((c) => (
            <Skeleton key={c._id} className="h-[60vh] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <EntityListShell
      title="Task Board"
      subtitle="Drag tasks across customisable columns."
      primaryAction={
        <>
          <div className="w-[220px]">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
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
          <div className="w-[180px]">
            <Select value={swimlaneBy} onValueChange={(val) => setSwimlaneBy(val as any)}>
              <SelectTrigger className="h-9 rounded-full border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                <SelectValue placeholder="Swimlanes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Swimlanes</SelectItem>
                <SelectItem value="assignee">By Assignee</SelectItem>
                <SelectItem value="project">By Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Link href="/dashboard/crm/projects/taskboard-columns">
            <Button variant="outline" size="sm">
              <Columns3 className="mr-1.5 h-3.5 w-3.5" />
              Columns
            </Button>
          </Link>
        </>
      }
    >

      <div className="flex flex-col gap-8 overflow-x-auto pb-4">
        {swimlanes.map((swimlane) => (
          <div key={swimlane.id} className="flex flex-col gap-4">
            {swimlane.label && (
              <h3 className="text-[14px] font-semibold text-[var(--st-text)] border-b border-[var(--st-border)] pb-2 sticky left-0">
                {swimlane.label}
              </h3>
            )}
            <div
              className="grid gap-4"
              style={{
                gridTemplateColumns: `repeat(${Math.max(1, Math.min(effectiveColumns.length, 6))}, minmax(240px, 1fr))`,
              }}
            >
              {effectiveColumns.map((col, idx) => {
                const colTasks = swimlane.tasks.filter((t) => {
                  if (t.boardColumnId && String(t.boardColumnId) === String(col._id)) return true;
                  if (!t.boardColumnId && col.slug && t.status === col.slug) return true;
                  return false;
                });
                const prevCol = idx > 0 ? effectiveColumns[idx - 1] : null;
                const nextCol =
                  idx < effectiveColumns.length - 1
                    ? effectiveColumns[idx + 1]
                    : null;
                return (
                  <Card key={col._id} className="flex flex-col p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: col.labelColor }}
                          aria-hidden
                        />
                        <p className="text-[13px] font-semibold text-[var(--st-text)]">
                          {col.columnName}
                        </p>
                      </div>
                      <span className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {colTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-[var(--st-border)] p-4 text-center text-[12px] text-[var(--st-text-secondary)]">
                          No tasks
                        </div>
                      ) : (
                        colTasks.map((task) => (
                          <Card key={task._id} interactive className="p-3">
                            <p className="text-[13px] font-medium text-[var(--st-text)]">
                              {task.heading}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-[var(--st-text-secondary)]">
                              {task.assigneeName ? (
                                <span>{task.assigneeName}</span>
                              ) : null}
                              {task.priority ? (
                                <Badge
                                  variant={
                                    PRIORITY_VARIANTS[task.priority] || 'ghost'
                                  }
                                >
                                  {task.priority}
                                </Badge>
                              ) : null}
                              {projectFilter === 'all' && swimlaneBy !== 'project' ? (
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
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
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
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                                  aria-label="Move right"
                                >
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              ) : (
                                <span className="h-7 w-7" />
                              )}
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </EntityListShell>
  );
}
