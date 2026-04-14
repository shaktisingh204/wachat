'use client';

import { use, useCallback, useEffect, useState, useTransition, useActionState } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  Plus,
  Pencil,
  Trash2,
  LoaderCircle,
  ArrowLeft,
  Calendar,
  DollarSign,
  User,
} from 'lucide-react';
import {
  getProjectById,
  getProjectTasks,
  saveProjectTask,
  deleteProjectTask,
} from '@/app/actions/crm-services.actions';
import type { HrProject, HrProjectTask } from '@/lib/hr-types';
import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Task = HrProjectTask & { _id: string };
type Project = HrProject & { _id: string };

const TASK_STATUS_TONES: Record<string, 'neutral' | 'amber' | 'blue' | 'green'> = {
  todo: 'neutral',
  'in-progress': 'blue',
  review: 'amber',
  done: 'green',
};

const PRIORITY_TONES: Record<string, 'neutral' | 'blue' | 'amber' | 'red'> = {
  low: 'neutral',
  medium: 'blue',
  high: 'amber',
  urgent: 'red',
};

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export default function ProjectDetailPage(props: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(props.params);
  const { toast } = useToast();

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [saveState, saveFormAction, isSaving] = useActionState(saveProjectTask, {
    message: '',
    error: '',
  } as any);

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [p, ts] = await Promise.all([
        getProjectById(projectId),
        getProjectTasks(projectId),
      ]);
      setProject(p as Project | null);
      setTasks(Array.isArray(ts) ? (ts as Task[]) : []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (saveState?.message) {
      toast({ title: 'Saved', description: saveState.message });
      setDialogOpen(false);
      setEditing(null);
      refresh();
    }
    if (saveState?.error) {
      toast({
        title: 'Error',
        description: saveState.error,
        variant: 'destructive',
      });
    }
  }, [saveState, toast, refresh]);

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const computedProgress =
    tasks.length > 0 ? Math.round((doneCount / tasks.length) * 100) : project?.progress ?? 0;

  const handleDelete = async () => {
    if (!deletingId) return;
    const res = await deleteProjectTask(deletingId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Task removed.' });
      setDeletingId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  if (isLoading && !project) {
    return (
      <div className="flex w-full flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!project) {
    return (
      <ClayCard variant="outline" className="border-dashed">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-clay-ink-muted">Project not found.</p>
          <Link href="/dashboard/crm/projects">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              Back to Projects
            </ClayButton>
          </Link>
        </div>
      </ClayCard>
    );
  }

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={project.name}
        subtitle={project.description || 'Project details and tasks.'}
        icon={Briefcase}
        actions={
          <Link href="/dashboard/crm/projects">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              All Projects
            </ClayButton>
          </Link>
        }
      />

      <ClayCard>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <User className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Client</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {project.clientName || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <User className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Manager</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {project.managerName || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <Calendar className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Timeline</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {fmtDate(project.startDate)} – {fmtDate(project.endDate)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
              <DollarSign className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[11.5px] text-clay-ink-muted">Budget</p>
              <p className="text-[13px] font-medium text-clay-ink">
                {project.budget != null
                  ? new Intl.NumberFormat('en-IN', {
                      style: 'currency',
                      currency: project.currency || 'INR',
                    }).format(project.budget)
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-clay-ink">
              Progress ({doneCount}/{tasks.length} tasks done)
            </p>
            <ClayBadge tone="blue">{computedProgress}%</ClayBadge>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-clay-surface-2">
            <div
              className="h-full bg-clay-rose transition-all"
              style={{ width: `${Math.max(0, Math.min(100, computedProgress))}%` }}
            />
          </div>
        </div>
      </ClayCard>

      <ClayCard>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[16px] font-semibold text-clay-ink">Tasks</h2>
            <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
              Break the project down into trackable tasks.
            </p>
          </div>
          <ClayButton
            variant="obsidian"
            leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            Add Task
          </ClayButton>
        </div>

        <div className="overflow-x-auto rounded-clay-md border border-clay-border">
          <Table>
            <TableHeader>
              <TableRow className="border-clay-border hover:bg-transparent">
                <TableHead className="text-clay-ink-muted">Title</TableHead>
                <TableHead className="text-clay-ink-muted">Assignee</TableHead>
                <TableHead className="text-clay-ink-muted">Status</TableHead>
                <TableHead className="text-clay-ink-muted">Priority</TableHead>
                <TableHead className="text-clay-ink-muted">Due</TableHead>
                <TableHead className="w-[120px] text-right text-clay-ink-muted">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.length === 0 ? (
                <TableRow className="border-clay-border">
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-[13px] text-clay-ink-muted"
                  >
                    No tasks yet — click Add Task to get started.
                  </TableCell>
                </TableRow>
              ) : (
                tasks.map((task) => (
                  <TableRow key={task._id} className="border-clay-border">
                    <TableCell className="text-[13px] font-medium text-clay-ink">
                      {task.title}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {task.assigneeName || '—'}
                    </TableCell>
                    <TableCell>
                      <ClayBadge
                        tone={TASK_STATUS_TONES[task.status] || 'neutral'}
                        dot
                      >
                        {task.status}
                      </ClayBadge>
                    </TableCell>
                    <TableCell>
                      {task.priority ? (
                        <ClayBadge
                          tone={PRIORITY_TONES[task.priority] || 'neutral'}
                          dot
                        >
                          {task.priority}
                        </ClayBadge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-[13px] text-clay-ink">
                      {fmtDate(task.dueDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(task);
                            setDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeletingId(task._id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ClayCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editing ? 'Edit Task' : 'Add Task'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Fill in the task details below.
            </DialogDescription>
          </DialogHeader>

          <form action={saveFormAction} className="space-y-4">
            {editing?._id ? (
              <input type="hidden" name="_id" value={editing._id} />
            ) : null}
            <input type="hidden" name="projectId" value={projectId} />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-clay-ink">
                  Title <span className="text-clay-red">*</span>
                </Label>
                <Input
                  name="title"
                  required
                  defaultValue={editing?.title || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Assignee</Label>
                <Input
                  name="assigneeName"
                  defaultValue={editing?.assigneeName || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Status</Label>
                <Select
                  name="status"
                  defaultValue={editing?.status || 'todo'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">Priority</Label>
                <Select
                  name="priority"
                  defaultValue={editing?.priority || 'medium'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">Start Date</Label>
                <Input
                  type="date"
                  name="startDate"
                  defaultValue={
                    editing?.startDate
                      ? new Date(editing.startDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Due Date</Label>
                <Input
                  type="date"
                  name="dueDate"
                  defaultValue={
                    editing?.dueDate
                      ? new Date(editing.dueDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Estimated Hours</Label>
                <Input
                  type="number"
                  name="estimatedHours"
                  defaultValue={editing?.estimatedHours ?? ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Actual Hours</Label>
                <Input
                  type="number"
                  name="actualHours"
                  defaultValue={editing?.actualHours ?? ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-clay-ink">Description</Label>
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={editing?.description || ''}
                  className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isSaving}
                leading={
                  isSaving ? (
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      strokeWidth={1.75}
                    />
                  ) : null
                }
              >
                Save
              </ClayButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">Delete task?</AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
