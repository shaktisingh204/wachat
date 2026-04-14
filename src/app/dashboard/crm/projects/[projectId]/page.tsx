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
  Flag,
  FileText,
  StickyNote,
  Activity as ActivityIcon,
  GanttChart,
  Users,
} from 'lucide-react';
import {
  getWsProjectById,
  getWsTasksByProject,
  saveWsTask,
  deleteWsTask,
  getWsProjectMembersByProject,
  saveWsProjectMember,
  deleteWsProjectMember,
  getWsProjectMilestonesByProject,
  saveWsProjectMilestone,
  deleteWsProjectMilestone,
  getWsProjectFilesByProject,
  saveWsProjectFile,
  deleteWsProjectFile,
  getWsProjectNotesByProject,
  saveWsProjectNote,
  deleteWsProjectNote,
  getWsProjectActivitiesByProject,
  getWsGanttLinksByProject,
} from '@/app/actions/worksuite/projects.actions';
import type {
  WsProject,
  WsTask,
  WsProjectMember,
  WsProjectMilestone,
  WsProjectFile,
  WsProjectNote,
  WsProjectActivity,
  WsGanttLink,
} from '@/lib/worksuite/project-types';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

type Task = WsTask & { _id: string };
type Project = WsProject & { _id: string };
type Member = WsProjectMember & { _id: string };
type Milestone = WsProjectMilestone & { _id: string };
type ProjFile = WsProjectFile & { _id: string };
type Note = WsProjectNote & { _id: string };
type ActivityRow = WsProjectActivity & { _id: string };
type GanttLink = WsGanttLink & { _id: string };

const TASK_STATUS_TONES: Record<string, 'neutral' | 'amber' | 'blue' | 'green'> = {
  incomplete: 'neutral',
  todo: 'neutral',
  'in-progress': 'blue',
  review: 'amber',
  completed: 'green',
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
  const [members, setMembers] = useState<Member[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<ProjFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [ganttLinks, setGanttLinks] = useState<GanttLink[]>([]);

  const [isLoading, startLoading] = useTransition();

  /* ── Task dialog state ── */
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  const [taskSaveState, taskSaveAction, isTaskSaving] = useActionState(
    saveWsTask,
    { message: '', error: '' } as any,
  );

  /* ── Member / milestone / file / note dialogs ── */
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [fileDialogOpen, setFileDialogOpen] = useState(false);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);

  const [memberSaveState, memberSaveAction, isMemberSaving] = useActionState(
    saveWsProjectMember,
    { message: '', error: '' } as any,
  );
  const [milestoneSaveState, milestoneSaveAction, isMilestoneSaving] =
    useActionState(saveWsProjectMilestone, { message: '', error: '' } as any);
  const [fileSaveState, fileSaveAction, isFileSaving] = useActionState(
    saveWsProjectFile,
    { message: '', error: '' } as any,
  );
  const [noteSaveState, noteSaveAction, isNoteSaving] = useActionState(
    saveWsProjectNote,
    { message: '', error: '' } as any,
  );

  const refresh = useCallback(() => {
    startLoading(async () => {
      const [p, ts, ms, mls, fs, ns, acts, gls] = await Promise.all([
        getWsProjectById(projectId),
        getWsTasksByProject(projectId),
        getWsProjectMembersByProject(projectId),
        getWsProjectMilestonesByProject(projectId),
        getWsProjectFilesByProject(projectId),
        getWsProjectNotesByProject(projectId),
        getWsProjectActivitiesByProject(projectId),
        getWsGanttLinksByProject(projectId),
      ]);
      setProject(p as Project | null);
      setTasks(Array.isArray(ts) ? (ts as Task[]) : []);
      setMembers(Array.isArray(ms) ? (ms as Member[]) : []);
      setMilestones(Array.isArray(mls) ? (mls as Milestone[]) : []);
      setFiles(Array.isArray(fs) ? (fs as ProjFile[]) : []);
      setNotes(Array.isArray(ns) ? (ns as Note[]) : []);
      setActivity(Array.isArray(acts) ? (acts as ActivityRow[]) : []);
      setGanttLinks(Array.isArray(gls) ? (gls as GanttLink[]) : []);
    });
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Toast on save states
  useEffect(() => {
    if (taskSaveState?.message) {
      toast({ title: 'Saved', description: taskSaveState.message });
      setTaskDialogOpen(false);
      setEditingTask(null);
      refresh();
    }
    if (taskSaveState?.error)
      toast({
        title: 'Error',
        description: taskSaveState.error,
        variant: 'destructive',
      });
  }, [taskSaveState, toast, refresh]);

  useEffect(() => {
    if (memberSaveState?.message) {
      toast({ title: 'Saved', description: memberSaveState.message });
      setMemberDialogOpen(false);
      refresh();
    }
    if (memberSaveState?.error)
      toast({
        title: 'Error',
        description: memberSaveState.error,
        variant: 'destructive',
      });
  }, [memberSaveState, toast, refresh]);

  useEffect(() => {
    if (milestoneSaveState?.message) {
      toast({ title: 'Saved', description: milestoneSaveState.message });
      setMilestoneDialogOpen(false);
      refresh();
    }
    if (milestoneSaveState?.error)
      toast({
        title: 'Error',
        description: milestoneSaveState.error,
        variant: 'destructive',
      });
  }, [milestoneSaveState, toast, refresh]);

  useEffect(() => {
    if (fileSaveState?.message) {
      toast({ title: 'Saved', description: fileSaveState.message });
      setFileDialogOpen(false);
      refresh();
    }
    if (fileSaveState?.error)
      toast({
        title: 'Error',
        description: fileSaveState.error,
        variant: 'destructive',
      });
  }, [fileSaveState, toast, refresh]);

  useEffect(() => {
    if (noteSaveState?.message) {
      toast({ title: 'Saved', description: noteSaveState.message });
      setNoteDialogOpen(false);
      refresh();
    }
    if (noteSaveState?.error)
      toast({
        title: 'Error',
        description: noteSaveState.error,
        variant: 'destructive',
      });
  }, [noteSaveState, toast, refresh]);

  const doneCount = tasks.filter(
    (t) => t.status === 'done' || t.status === 'completed',
  ).length;
  const computedProgress =
    tasks.length > 0
      ? Math.round((doneCount / tasks.length) * 100)
      : project?.completionPercent ?? project?.progress ?? 0;

  const handleDeleteTask = async () => {
    if (!deletingTaskId) return;
    const res = await deleteWsTask(deletingTaskId);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Task removed.' });
      setDeletingTaskId(null);
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Failed to delete',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMember = async (id: string) => {
    const res = await deleteWsProjectMember(id);
    if (res.success) {
      toast({ title: 'Removed', description: 'Member removed.' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteMilestone = async (id: string) => {
    const res = await deleteWsProjectMilestone(id);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Milestone removed.' });
      refresh();
    }
  };

  const handleDeleteFile = async (id: string) => {
    const res = await deleteWsProjectFile(id);
    if (res.success) {
      toast({ title: 'Deleted', description: 'File removed.' });
      refresh();
    }
  };

  const handleDeleteNote = async (id: string) => {
    const res = await deleteWsProjectNote(id);
    if (res.success) {
      toast({ title: 'Deleted', description: 'Note removed.' });
      refresh();
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

  const projectName = project.name || project.projectName || 'Project';

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title={projectName}
        subtitle={project.description || project.projectSummary || 'Project details.'}
        icon={Briefcase}
        actions={
          <Link href="/dashboard/crm/projects">
            <ClayButton variant="pill" leading={<ArrowLeft className="h-4 w-4" />}>
              All Projects
            </ClayButton>
          </Link>
        }
      />

      {/* Overview summary */}
      <ClayCard>
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryTile
            icon={User}
            label="Client"
            value={project.clientName || '—'}
          />
          <SummaryTile
            icon={User}
            label="Manager"
            value={project.managerName || '—'}
          />
          <SummaryTile
            icon={Calendar}
            label="Timeline"
            value={`${fmtDate(project.startDate)} – ${fmtDate(project.deadline || project.endDate)}`}
          />
          <SummaryTile
            icon={DollarSign}
            label="Budget"
            value={
              project.projectBudget != null || project.budget != null
                ? new Intl.NumberFormat('en-IN', {
                    style: 'currency',
                    currency: project.currency || 'INR',
                  }).format(project.projectBudget ?? project.budget ?? 0)
                : '—'
            }
          />
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="flex flex-col">
            <p className="text-[11.5px] text-clay-ink-muted">Status</p>
            <ClayBadge tone="blue" dot>
              {project.status}
            </ClayBadge>
          </div>
          <div className="flex flex-col">
            <p className="text-[11.5px] text-clay-ink-muted">Category</p>
            <p className="text-[13px] font-medium text-clay-ink">
              {project.categoryName || '—'}
              {project.subCategoryName ? ` · ${project.subCategoryName}` : ''}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-[11.5px] text-clay-ink-muted">Department</p>
            <p className="text-[13px] font-medium text-clay-ink">
              {project.departmentName || '—'}
            </p>
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
              style={{
                width: `${Math.max(0, Math.min(100, computedProgress))}%`,
              }}
            />
          </div>
        </div>
      </ClayCard>

      {/* Tabs */}
      <ClayCard>
        <Tabs defaultValue="overview">
          <TabsList className="mb-4 grid w-full grid-cols-4 md:grid-cols-8">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tasks">
              Tasks ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="milestones">
              Milestones ({milestones.length})
            </TabsTrigger>
            <TabsTrigger value="members">
              Members ({members.length})
            </TabsTrigger>
            <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
            <TabsTrigger value="notes">Notes ({notes.length})</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
            <TabsTrigger value="gantt">Gantt</TabsTrigger>
          </TabsList>

          {/* ── Overview ── */}
          <TabsContent value="overview">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                  Description
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-clay-ink">
                  {project.description || project.projectSummary || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                  Notes
                </p>
                <p className="mt-1 whitespace-pre-wrap text-[13px] text-clay-ink">
                  {project.notes || '—'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                  Hours Allocated
                </p>
                <p className="mt-1 text-[13px] text-clay-ink">
                  {project.hoursAllocated ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11.5px] uppercase tracking-wide text-clay-ink-muted">
                  Short Code
                </p>
                <p className="mt-1 text-[13px] text-clay-ink">
                  {project.projectShortCode || '—'}
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── Tasks ── */}
          <TabsContent value="tasks">
            <div className="mb-4 flex justify-end">
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => {
                  setEditingTask(null);
                  setTaskDialogOpen(true);
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
                    <TableHead className="text-clay-ink-muted">
                      Assignee
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">Status</TableHead>
                    <TableHead className="text-clay-ink-muted">
                      Priority
                    </TableHead>
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
                    tasks.map((t) => (
                      <TableRow key={t._id} className="border-clay-border">
                        <TableCell className="text-[13px] font-medium text-clay-ink">
                          {t.heading}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {t.assigneeName || '—'}
                        </TableCell>
                        <TableCell>
                          <ClayBadge
                            tone={TASK_STATUS_TONES[t.status] || 'neutral'}
                            dot
                          >
                            {t.status}
                          </ClayBadge>
                        </TableCell>
                        <TableCell>
                          {t.priority ? (
                            <ClayBadge
                              tone={PRIORITY_TONES[t.priority] || 'neutral'}
                              dot
                            >
                              {t.priority}
                            </ClayBadge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {fmtDate(t.dueDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingTask(t);
                                setTaskDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingTaskId(t._id)}
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
          </TabsContent>

          {/* ── Milestones ── */}
          <TabsContent value="milestones">
            <div className="mb-4 flex justify-end">
              <ClayButton
                variant="obsidian"
                leading={<Flag className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => setMilestoneDialogOpen(true)}
              >
                Add Milestone
              </ClayButton>
            </div>
            {milestones.length === 0 ? (
              <EmptyRow text="No milestones yet." />
            ) : (
              <ul className="space-y-2">
                {milestones.map((m) => (
                  <li
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-clay-md border border-clay-border p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-clay-ink">
                        {m.milestoneTitle}
                      </p>
                      <p className="text-[11.5px] text-clay-ink-muted">
                        {fmtDate(m.startDate)} – {fmtDate(m.endDate)}
                        {m.cost ? ` · ${m.currency || 'INR'} ${m.cost}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ClayBadge
                        tone={m.status === 'complete' ? 'green' : 'amber'}
                        dot
                      >
                        {m.status}
                      </ClayBadge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMilestone(m._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Members ── */}
          <TabsContent value="members">
            <div className="mb-4 flex justify-end">
              <ClayButton
                variant="obsidian"
                leading={<Users className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => setMemberDialogOpen(true)}
              >
                Add Member
              </ClayButton>
            </div>
            {members.length === 0 ? (
              <EmptyRow text="No members yet." />
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-clay-md border border-clay-border p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-clay-ink">
                        {m.memberName || String(m.memberUserId)}
                      </p>
                      <p className="text-[11.5px] text-clay-ink-muted">
                        {m.memberEmail || m.role || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.hourlyRate ? (
                        <ClayBadge tone="blue">₹{m.hourlyRate}/hr</ClayBadge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(m._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Files ── */}
          <TabsContent value="files">
            <div className="mb-4 flex justify-end">
              <ClayButton
                variant="obsidian"
                leading={<FileText className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => setFileDialogOpen(true)}
              >
                Add File
              </ClayButton>
            </div>
            {files.length === 0 ? (
              <EmptyRow text="No files yet." />
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={f._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-clay-md border border-clay-border p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-clay-ink">
                        {f.filename}
                      </p>
                      <p className="text-[11.5px] text-clay-ink-muted">
                        {f.description || f.externalLinkName || '—'}
                      </p>
                      {f.url || f.externalLink ? (
                        <a
                          href={f.url || f.externalLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 inline-block text-[11.5px] text-clay-blue hover:underline"
                        >
                          Open link
                        </a>
                      ) : null}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(f._id)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Notes ── */}
          <TabsContent value="notes">
            <div className="mb-4 flex justify-end">
              <ClayButton
                variant="obsidian"
                leading={<StickyNote className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => setNoteDialogOpen(true)}
              >
                Add Note
              </ClayButton>
            </div>
            {notes.length === 0 ? (
              <EmptyRow text="No notes yet." />
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li
                    key={n._id}
                    className="rounded-clay-md border border-clay-border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-clay-ink">
                        {n.title}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteNote(n._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-clay-red" />
                      </Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-clay-ink-muted">
                      {n.details || '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Activity ── */}
          <TabsContent value="activity">
            {activity.length === 0 ? (
              <EmptyRow text="No activity yet." />
            ) : (
              <ul className="space-y-2">
                {activity.map((a) => (
                  <li
                    key={a._id}
                    className="flex items-start gap-3 rounded-clay-md border border-clay-border p-3"
                  >
                    <ActivityIcon
                      className="mt-0.5 h-4 w-4 text-clay-ink-muted"
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className="text-[13px] text-clay-ink">{a.activity}</p>
                      <p className="text-[11px] text-clay-ink-muted">
                        {a.actorName ? `${a.actorName} · ` : ''}
                        {fmtDate(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ── Gantt (simple task + dependency count view) ── */}
          <TabsContent value="gantt">
            <div className="mb-3 flex items-center gap-2">
              <GanttChart className="h-4 w-4 text-clay-ink-muted" />
              <p className="text-[12.5px] text-clay-ink-muted">
                {tasks.length} tasks · {ganttLinks.length} dependencies ·{' '}
                {milestones.length} milestones
              </p>
            </div>
            {tasks.length === 0 ? (
              <EmptyRow text="No tasks to chart." />
            ) : (
              <div className="overflow-x-auto rounded-clay-md border border-clay-border">
                <Table>
                  <TableHeader>
                    <TableRow className="border-clay-border">
                      <TableHead className="text-clay-ink-muted">Task</TableHead>
                      <TableHead className="text-clay-ink-muted">Start</TableHead>
                      <TableHead className="text-clay-ink-muted">Due</TableHead>
                      <TableHead className="text-clay-ink-muted">Deps</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((t) => {
                      const deps = ganttLinks.filter(
                        (g) => String(g.target) === t._id,
                      ).length;
                      return (
                        <TableRow key={t._id} className="border-clay-border">
                          <TableCell className="text-[13px] font-medium text-clay-ink">
                            {t.heading}
                          </TableCell>
                          <TableCell className="text-[13px] text-clay-ink">
                            {fmtDate(t.startDate)}
                          </TableCell>
                          <TableCell className="text-[13px] text-clay-ink">
                            {fmtDate(t.dueDate)}
                          </TableCell>
                          <TableCell className="text-[13px] text-clay-ink">
                            {deps}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ClayCard>

      {/* ── Task dialog ── */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-clay-ink">
              {editingTask ? 'Edit Task' : 'Add Task'}
            </DialogTitle>
            <DialogDescription className="text-clay-ink-muted">
              Fill in the task details below.
            </DialogDescription>
          </DialogHeader>
          <form action={taskSaveAction} className="space-y-4">
            {editingTask?._id ? (
              <input type="hidden" name="_id" value={editingTask._id} />
            ) : null}
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-clay-ink">
                  Title <span className="text-clay-red">*</span>
                </Label>
                <Input
                  name="heading"
                  required
                  defaultValue={editingTask?.heading || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Assignee</Label>
                <Input
                  name="assigneeName"
                  defaultValue={editingTask?.assigneeName || ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Status</Label>
                <Select
                  name="status"
                  defaultValue={editingTask?.status || 'incomplete'}
                >
                  <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="incomplete">Incomplete</SelectItem>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-clay-ink">Priority</Label>
                <Select
                  name="priority"
                  defaultValue={editingTask?.priority || 'medium'}
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
                    editingTask?.startDate
                      ? new Date(editingTask.startDate as any)
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
                    editingTask?.dueDate
                      ? new Date(editingTask.dueDate as any)
                          .toISOString()
                          .slice(0, 10)
                      : ''
                  }
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Estimate Hours</Label>
                <Input
                  type="number"
                  name="estimatedHours"
                  defaultValue={editingTask?.estimatedHours ?? ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div>
                <Label className="text-clay-ink">Actual Hours</Label>
                <Input
                  type="number"
                  name="actualHours"
                  defaultValue={editingTask?.actualHours ?? ''}
                  className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-clay-ink">Description</Label>
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={editingTask?.description || ''}
                  className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <ClayButton
                type="button"
                variant="pill"
                onClick={() => setTaskDialogOpen(false)}
              >
                Cancel
              </ClayButton>
              <ClayButton
                type="submit"
                variant="obsidian"
                disabled={isTaskSaving}
                leading={
                  isTaskSaving ? (
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
        open={deletingTaskId !== null}
        onOpenChange={(o) => !o && setDeletingTaskId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-clay-ink">
              Delete task?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-clay-ink-muted">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Add-Member dialog ── */}
      <SimpleFormDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        title="Add Member"
        action={memberSaveAction}
        isSaving={isMemberSaving}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <FormInput label="Name" name="memberName" required />
        <FormInput label="Email" name="memberEmail" type="email" />
        <FormInput label="Role" name="role" />
        <FormInput label="Hourly Rate" name="hourlyRate" type="number" />
        <FormInput
          label="Member User ID (optional)"
          name="memberUserId"
          placeholder="ObjectId"
        />
      </SimpleFormDialog>

      {/* ── Add-Milestone dialog ── */}
      <SimpleFormDialog
        open={milestoneDialogOpen}
        onOpenChange={setMilestoneDialogOpen}
        title="Add Milestone"
        action={milestoneSaveAction}
        isSaving={isMilestoneSaving}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <FormInput label="Title" name="milestoneTitle" required />
        <FormInput label="Summary" name="summary" type="textarea" />
        <FormInput label="Cost" name="cost" type="number" />
        <FormInput label="Currency" name="currency" defaultValue="INR" />
        <FormInput label="Start Date" name="startDate" type="date" />
        <FormInput label="End Date" name="endDate" type="date" />
        <FormSelect
          label="Status"
          name="status"
          options={[
            { value: 'incomplete', label: 'Incomplete' },
            { value: 'complete', label: 'Complete' },
          ]}
          defaultValue="incomplete"
        />
      </SimpleFormDialog>

      {/* ── Add-File dialog ── */}
      <SimpleFormDialog
        open={fileDialogOpen}
        onOpenChange={setFileDialogOpen}
        title="Add File"
        action={fileSaveAction}
        isSaving={isFileSaving}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <FormInput label="Filename" name="filename" required />
        <FormInput label="URL" name="url" type="url" />
        <FormInput label="Description" name="description" type="textarea" />
        <FormInput label="Size" name="size" placeholder="e.g. 1.2 MB" />
      </SimpleFormDialog>

      {/* ── Add-Note dialog ── */}
      <SimpleFormDialog
        open={noteDialogOpen}
        onOpenChange={setNoteDialogOpen}
        title="Add Note"
        action={noteSaveAction}
        isSaving={isNoteSaving}
      >
        <input type="hidden" name="projectId" value={projectId} />
        <FormInput label="Title" name="title" required />
        <FormInput label="Details" name="details" type="textarea" />
      </SimpleFormDialog>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
 *  Small presentational helpers (kept inline — only used on this page)
 * ══════════════════════════════════════════════════════════════════ */

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-clay-md bg-clay-rose-soft">
        <Icon className="h-4 w-4 text-clay-rose-ink" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[11.5px] text-clay-ink-muted">{label}</p>
        <p className="text-[13px] font-medium text-clay-ink">{value}</p>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-clay-md border border-dashed border-clay-border p-8 text-center text-[13px] text-clay-ink-muted">
      {text}
    </div>
  );
}

function SimpleFormDialog({
  open,
  onOpenChange,
  title,
  action,
  isSaving,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  action: (formData: FormData) => void;
  isSaving: boolean;
  children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-clay-ink">{title}</DialogTitle>
        </DialogHeader>
        <form action={action} className="space-y-3">
          {children}
          <DialogFooter className="gap-2">
            <ClayButton
              type="button"
              variant="pill"
              onClick={() => onOpenChange(false)}
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
  );
}

function FormInput({
  label,
  name,
  type = 'text',
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <Label className="text-clay-ink">
        {label}
        {required ? <span className="text-clay-red"> *</span> : null}
      </Label>
      {type === 'textarea' ? (
        <Textarea
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="mt-1.5 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
        />
      ) : (
        <Input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
        />
      )}
    </div>
  );
}

function FormSelect({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue?: string;
}) {
  return (
    <div>
      <Label className="text-clay-ink">{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <SelectTrigger className="mt-1.5 h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
