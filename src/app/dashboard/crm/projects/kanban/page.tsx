'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { LayoutGrid, ArrowLeft, ArrowRight, ArrowRightLeft } from 'lucide-react';
import {
  getProjects,
  getProjectTasks,
  updateProjectTaskStatus,
} from '@/app/actions/crm-services.actions';
import type { HrProject, HrProjectTask } from '@/lib/hr-types';
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

type Task = HrProjectTask & { _id: string };
type Project = HrProject & { _id: string };

const COLUMNS: {
  status: Task['status'];
  label: string;
  tone: 'neutral' | 'blue' | 'amber' | 'green';
}[] = [
  { status: 'todo', label: 'To Do', tone: 'neutral' },
  { status: 'in-progress', label: 'In Progress', tone: 'blue' },
  { status: 'review', label: 'Review', tone: 'amber' },
  { status: 'done', label: 'Done', tone: 'green' },
];

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

export default function KanbanPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projectFilter, setProjectFilter] = useState<string>('all');
  const [isLoading, startLoading] = useTransition();

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [ps, ts] = await Promise.all([
        getProjects(),
        getProjectTasks(),
      ]);
      setProjects((ps as Project[]) || []);
      setTasks((ts as Task[]) || []);
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filteredTasks = useMemo(() => {
    if (projectFilter === 'all') return tasks;
    return tasks.filter((t) => String(t.projectId) === projectFilter);
  }, [tasks, projectFilter]);

  const projectNameMap = useMemo(() => {
    const m = new Map<string, string>();
    projects.forEach((p) => m.set(p._id, p.name));
    return m;
  }, [projects]);

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    const prev = tasks;
    setTasks((curr) =>
      curr.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
    );
    const res = await updateProjectTaskStatus(taskId, newStatus);
    if (!res.success) {
      setTasks(prev);
      toast({
        title: 'Error',
        description: res.error || 'Failed to update task status.',
        variant: 'destructive',
      });
    }
  };

  const getNeighbours = (status: Task['status']) => {
    const idx = COLUMNS.findIndex((c) => c.status === status);
    return {
      prev: idx > 0 ? COLUMNS[idx - 1].status : null,
      next: idx < COLUMNS.length - 1 ? COLUMNS[idx + 1].status : null,
    };
  };

  if (isLoading && tasks.length === 0) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {COLUMNS.map((c) => (
            <Skeleton key={c.status} className="h-[60vh] rounded-clay-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Task Board"
        subtitle="Move tasks across columns to reflect their current status."
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
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Link href="/dashboard/crm/projects">
              <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
                Projects
              </ClayButton>
            </Link>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) => t.status === col.status);
          return (
            <ClayCard key={col.status} variant="soft" className="flex flex-col">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClayBadge tone={col.tone} dot>
                    {col.label}
                  </ClayBadge>
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
                  colTasks.map((task) => {
                    const { prev, next } = getNeighbours(task.status);
                    return (
                      <ClayCard
                        key={task._id}
                        padded={false}
                        className="p-3"
                      >
                        <p className="text-[13px] font-medium text-clay-ink">
                          {task.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-clay-ink-muted">
                          {task.assigneeName ? <span>{task.assigneeName}</span> : null}
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
                          {prev ? (
                            <button
                              type="button"
                              onClick={() => moveTask(task._id, prev)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink"
                              aria-label="Move left"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <span className="h-7 w-7" />
                          )}
                          {next ? (
                            <button
                              type="button"
                              onClick={() => moveTask(task._id, next)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-clay-ink-muted hover:bg-clay-surface-2 hover:text-clay-ink"
                              aria-label="Move right"
                            >
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <ArrowRightLeft
                              className="h-3.5 w-3.5 text-clay-green"
                              aria-hidden
                            />
                          )}
                        </div>
                      </ClayCard>
                    );
                  })
                )}
              </div>
            </ClayCard>
          );
        })}
      </div>
    </div>
  );
}
