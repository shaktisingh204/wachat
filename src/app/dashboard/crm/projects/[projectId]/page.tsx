'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  Badge,
  Button,
  Card,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Textarea,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  use,
  useCallback,
  useEffect,
  useState,
  useTransition,
  useActionState } from 'react';
import Link from 'next/link';
import {
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
  ListChecks,
  Bug,
  Clock,
  Paperclip,
} from 'lucide-react';
import { format, isValid } from 'date-fns';
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
  getCrmProjectRelatedCounts,
  } from '@/app/actions/worksuite/projects.actions';
import { RelatedRail } from '@/components/crm/RelatedRail';
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

import { EntityDetailShell } from '@/components/crm/entity-detail-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import dynamic from 'next/dynamic';
const BurndownChart = dynamic(
  () => import('../_components/burndown-chart').then((m) => m.BurndownChart),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  }
);
import { PinButton } from '@/components/crm/pin-button';
const ProjectPublicSharePanel = dynamic(
  () => import('../_components/project-public-share-panel').then((m) => m.ProjectPublicSharePanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-32 w-full" />,
  }
);

type Task = WsTask & { _id: string };
type Project = WsProject & { _id: string };
type Member = WsProjectMember & { _id: string };
type Milestone = WsProjectMilestone & { _id: string };
type ProjFile = WsProjectFile & { _id: string };
type Note = WsProjectNote & { _id: string };
type ActivityRow = WsProjectActivity & { _id: string };
type GanttLink = WsGanttLink & { _id: string };

const TASK_STATUS_VARIANTS: Record<
  string,
  'ghost' | 'warning' | 'success' | 'danger'
> = {
  incomplete: 'ghost',
  todo: 'ghost',
  'in-progress': 'warning',
  review: 'warning',
  completed: 'success',
  done: 'success',
};

const PRIORITY_VARIANTS: Record<
  string,
  'ghost' | 'success' | 'warning' | 'danger'
> = {
  low: 'ghost',
  medium: 'success',
  high: 'warning',
  urgent: 'danger',
};

type TabId =
  | 'overview'
  | 'tasks'
  | 'milestones'
  | 'members'
  | 'files'
  | 'notes'
  | 'activity'
  | 'gantt'
  | 'burndown';

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as any);
  if (!isValid(d)) return '—';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getUTCDate();
  const month = months[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  return `${month} ${day}, ${year}`;
}

export default function ProjectDetailPage(props: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(props.params);
  const { toast } = useZoruToast();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [files, setFiles] = useState<ProjFile[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [ganttLinks, setGanttLinks] = useState<GanttLink[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [relatedCounts, setRelatedCounts] = useState<{
    tasks: number;
    milestones: number;
    issues: number;
    timeLogs: number;
    attachments: number;
  }>({ tasks: 0, milestones: 0, issues: 0, timeLogs: 0, attachments: 0 });

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
      const [p, ts, ms, mls, fs, ns, acts, gls, rc] = await Promise.all([
        getWsProjectById(projectId),
        getWsTasksByProject(projectId),
        getWsProjectMembersByProject(projectId),
        getWsProjectMilestonesByProject(projectId),
        getWsProjectFilesByProject(projectId),
        getWsProjectNotesByProject(projectId),
        getWsProjectActivitiesByProject(projectId),
        getWsGanttLinksByProject(projectId),
        getCrmProjectRelatedCounts(projectId),
      ]);
      setProject(p as Project | null);
      setTasks(Array.isArray(ts) ? (ts as Task[]) : []);
      setMembers(Array.isArray(ms) ? (ms as Member[]) : []);
      setMilestones(Array.isArray(mls) ? (mls as Milestone[]) : []);
      setFiles(Array.isArray(fs) ? (fs as ProjFile[]) : []);
      setNotes(Array.isArray(ns) ? (ns as Note[]) : []);
      setActivity(Array.isArray(acts) ? (acts as ActivityRow[]) : []);
      setGanttLinks(Array.isArray(gls) ? (gls as GanttLink[]) : []);
      setRelatedCounts(rc);
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
      <Card className="border-dashed p-6">
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <p className="text-[13px] text-[var(--st-text-secondary)]">Project not found.</p>
          <Link href="/dashboard/crm/projects">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4" />
              Back to Projects
            </Button>
          </Link>
        </div>
      </Card>
    );
  }

  const projectName = project.name || project.projectName || 'Project';

  const TABS: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks (${tasks.length})` },
    { id: 'milestones', label: `Milestones (${milestones.length})` },
    { id: 'members', label: `Members (${members.length})` },
    { id: 'files', label: `Files (${files.length})` },
    { id: 'notes', label: `Notes (${notes.length})` },
    { id: 'activity', label: 'Activity' },
    { id: 'gantt', label: 'Gantt' },
    { id: 'burndown', label: 'Burndown Chart' },
  ];

  return (
    <EntityDetailShell
      eyebrow="PROJECT"
      title={projectName}
      back={{ href: '/dashboard/crm/projects', label: 'Projects' }}
      actions={
        <PinButton
          entityType="project"
          entityId={projectId}
          title={projectName}
        />
      }
    >

      {/* Overview summary */}
      <Card className="p-6">
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
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">Status</p>
            <Badge variant="success">{project.status}</Badge>
          </div>
          <div className="flex flex-col">
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">Category</p>
            <p className="text-[13px] font-medium text-[var(--st-text)]">
              {project.categoryName || '—'}
              {project.subCategoryName ? ` · ${project.subCategoryName}` : ''}
            </p>
          </div>
          <div className="flex flex-col">
            <p className="text-[11.5px] text-[var(--st-text-secondary)]">Department</p>
            <p className="text-[13px] font-medium text-[var(--st-text)]">
              {project.departmentName || '—'}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <div className="flex items-center justify-between">
            <p className="text-[12.5px] font-medium text-[var(--st-text)]">
              Progress ({doneCount}/{tasks.length} tasks done)
            </p>
            <Badge variant="success">{computedProgress}%</Badge>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--st-bg-muted)]">
            <div
              className="h-full bg-[var(--st-text)] transition-all"
              style={{
                width: `${Math.max(0, Math.min(100, computedProgress))}%`,
              }}
            />
          </div>
        </div>
      </Card>

      {/* Related rail (chip strip) */}
      <RelatedRail
        items={[
          {
            label: 'Tasks',
            count: relatedCounts.tasks,
            icon: <ListChecks className="h-3.5 w-3.5" />,
            href: `/dashboard/crm/tasks?projectId=${projectId}`,
          },
          {
            label: 'Milestones',
            count: relatedCounts.milestones,
            icon: <Flag className="h-3.5 w-3.5" />,
            href: `/dashboard/crm/projects/${projectId}#milestones`,
          },
          {
            label: 'Issues',
            count: relatedCounts.issues,
            icon: <Bug className="h-3.5 w-3.5" />,
            href: `/dashboard/crm/projects/issues?projectId=${projectId}`,
          },
          {
            label: 'Time logs',
            count: relatedCounts.timeLogs,
            icon: <Clock className="h-3.5 w-3.5" />,
            href: `/dashboard/crm/time-tracking?projectId=${projectId}`,
          },
          {
            label: 'Attachments',
            count: relatedCounts.attachments,
            icon: <Paperclip className="h-3.5 w-3.5" />,
            href: `/dashboard/crm/projects/${projectId}#files`,
          },
        ]}
      />

      {/* Public Share */}
      {mounted ? (
        <ProjectPublicSharePanel projectId={projectId} />
      ) : (
        <Skeleton className="h-32 w-full" />
      )}

      {/* Tabs */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap gap-1 rounded-[var(--zoru-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'flex-1 rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                activeTab === t.id
                  ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--zoru-shadow-sm)]'
                  : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Description
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {project.description || project.projectSummary || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Notes
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--st-text)]">
                {project.notes || '—'}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Hours Allocated
              </p>
              <p className="mt-1 text-[13px] text-[var(--st-text)]">
                {project.hoursAllocated ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-[11.5px] uppercase tracking-wide text-[var(--st-text-secondary)]">
                Short Code
              </p>
              <p className="mt-1 text-[13px] text-[var(--st-text)]">
                {project.projectShortCode || '—'}
              </p>
            </div>
          </div>
        )}

        {/* ── Tasks ── */}
        {activeTab === 'tasks' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setTaskDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={1.75} />
                Add Task
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-[var(--st-border)] hover:bg-transparent">
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Title</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Assignee</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Status</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Priority</ZoruTableHead>
                    <ZoruTableHead className="text-[var(--st-text-secondary)]">Due</ZoruTableHead>
                    <ZoruTableHead className="w-[120px] text-right text-[var(--st-text-secondary)]">
                      Actions
                    </ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {tasks.length === 0 ? (
                    <ZoruTableRow className="border-[var(--st-border)]">
                      <ZoruTableCell
                        colSpan={6}
                        className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                      >
                        No tasks yet — click Add Task to get started.
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ) : (
                    tasks.map((t) => (
                      <ZoruTableRow key={t._id} className="border-[var(--st-border)]">
                        <ZoruTableCell className="text-[13px] font-medium text-[var(--st-text)]">
                          {t.heading}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                          {t.assigneeName || '—'}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <Badge
                            variant={
                              TASK_STATUS_VARIANTS[t.status] || 'ghost'
                            }
                          >
                            {t.status}
                          </Badge>
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {t.priority ? (
                            <Badge
                              variant={
                                PRIORITY_VARIANTS[t.priority] || 'ghost'
                              }
                            >
                              {t.priority}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                          {fmtDate(t.dueDate)}
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <PinButton
                              entityType="task"
                              entityId={t._id}
                              title={t.heading}
                            />
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
                              <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                            </Button>
                          </div>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    ))
                  )}
                </ZoruTableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ── Milestones ── */}
        {activeTab === 'milestones' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setMilestoneDialogOpen(true)}>
                <Flag className="h-4 w-4" strokeWidth={1.75} />
                Add Milestone
              </Button>
            </div>
            {milestones.length === 0 ? (
              <EmptyRow text="No milestones yet." />
            ) : (
              <ul className="space-y-2">
                {milestones.map((m) => (
                  <li
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--st-border)] p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[var(--st-text)]">
                        {m.milestoneTitle}
                      </p>
                      <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {fmtDate(m.startDate)} – {fmtDate(m.endDate)}
                        {m.cost ? ` · ${m.currency || 'INR'} ${m.cost}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={m.status === 'complete' ? 'success' : 'warning'}
                      >
                        {m.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMilestone(m._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Members ── */}
                {activeTab === 'members' && (
          <div>
            <div className="mb-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">Total Members</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">{members.length}</p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">Avg Hourly Rate</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">
                  ₹{members.length > 0 ? Math.round(members.reduce((acc, m) => acc + (m.hourlyRate || 0), 0) / members.length) : 0}/hr
                </p>
              </div>
              <div className="rounded-lg border border-[var(--st-border)] p-4">
                <p className="text-[11.5px] text-[var(--st-text-secondary)]">Total Hourly Burn</p>
                <p className="mt-1 text-2xl font-semibold text-[var(--st-text)]">
                  ₹{members.reduce((acc, m) => acc + (m.hourlyRate || 0), 0)}/hr
                </p>
              </div>
            </div>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setMemberDialogOpen(true)}>
                <Users className="h-4 w-4" strokeWidth={1.75} />
                Add Member
              </Button>
            </div>
            {members.length === 0 ? (
              <EmptyRow text="No members yet." />
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--st-border)] p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[var(--st-text)]">
                        {m.memberName || String(m.memberUserId)}
                      </p>
                      <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {m.memberEmail || m.role || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.hourlyRate ? (
                        <Badge variant="success">₹{m.hourlyRate}/hr</Badge>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(m._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Files ── */}
        {activeTab === 'files' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setFileDialogOpen(true)}>
                <FileText className="h-4 w-4" strokeWidth={1.75} />
                Add File
              </Button>
            </div>
            {files.length === 0 ? (
              <EmptyRow text="No files yet." />
            ) : (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li
                    key={f._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--st-border)] p-3"
                  >
                    <div>
                      <p className="text-[13px] font-medium text-[var(--st-text)]">
                        {f.filename}
                      </p>
                      <p className="text-[11.5px] text-[var(--st-text-secondary)]">
                        {f.description || f.externalLinkName || '—'}
                      </p>
                      {f.url || f.externalLink ? (
                        <a
                          href={f.url || f.externalLink}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="mt-0.5 inline-block text-[11.5px] text-[var(--st-text)] hover:underline"
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
                      <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Notes ── */}
        {activeTab === 'notes' && (
          <div>
            <div className="mb-4 flex justify-end">
              <Button onClick={() => setNoteDialogOpen(true)}>
                <StickyNote className="h-4 w-4" strokeWidth={1.75} />
                Add Note
              </Button>
            </div>
            {notes.length === 0 ? (
              <EmptyRow text="No notes yet." />
            ) : (
              <ul className="space-y-2">
                {notes.map((n) => (
                  <li key={n._id} className="rounded-lg border border-[var(--st-border)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-medium text-[var(--st-text)]">
                        {n.title}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteNote(n._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-[var(--st-danger)]" />
                      </Button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[12.5px] text-[var(--st-text-secondary)]">
                      {n.details || '—'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Activity ── */}
        {activeTab === 'activity' && (
          <div>
            {activity.length === 0 ? (
              <EmptyRow text="No activity yet." />
            ) : (
              <ul className="space-y-2">
                {activity.map((a) => (
                  <li
                    key={a._id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--st-border)] p-3"
                  >
                    <ActivityIcon
                      className="mt-0.5 h-4 w-4 text-[var(--st-text-secondary)]"
                      strokeWidth={1.75}
                    />
                    <div>
                      <p className="text-[13px] text-[var(--st-text)]">{a.activity}</p>
                      <p className="text-[11px] text-[var(--st-text-secondary)]">
                        {a.actorName ? `${a.actorName} · ` : ''}
                        {fmtDate(a.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ── Burndown ── */}
        {activeTab === 'burndown' && (
          mounted ? (
            <BurndownChart projectId={projectId} />
          ) : (
            <Skeleton className="h-64 w-full" />
          )
        )}

        {/* ── Gantt (simple task + dependency count view) ── */}
        {activeTab === 'gantt' && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <GanttChart className="h-4 w-4 text-[var(--st-text-secondary)]" />
              <p className="text-[12.5px] text-[var(--st-text-secondary)]">
                {tasks.length} tasks · {ganttLinks.length} dependencies ·{' '}
                {milestones.length} milestones
              </p>
            </div>
            {tasks.length === 0 ? (
              <EmptyRow text="No tasks to chart." />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
                <Table>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-[var(--st-border)]">
                      <ZoruTableHead className="text-[var(--st-text-secondary)]">Task</ZoruTableHead>
                      <ZoruTableHead className="text-[var(--st-text-secondary)]">Start</ZoruTableHead>
                      <ZoruTableHead className="text-[var(--st-text-secondary)]">Due</ZoruTableHead>
                      <ZoruTableHead className="text-[var(--st-text-secondary)]">Deps</ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {tasks.map((t) => {
                      const deps = ganttLinks.filter(
                        (g) => String(g.target) === t._id,
                      ).length;
                      return (
                        <ZoruTableRow key={t._id} className="border-[var(--st-border)]">
                          <ZoruTableCell className="text-[13px] font-medium text-[var(--st-text)]">
                            {t.heading}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                            {fmtDate(t.startDate)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                            {fmtDate(t.dueDate)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                            {deps}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ── Task dialog ── */}
      <Dialog open={taskDialogOpen} onOpenChange={setTaskDialogOpen}>
        <ZoruDialogContent className="max-w-2xl">
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-[var(--st-text)]">
              {editingTask ? 'Edit Task' : 'Add Task'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-[var(--st-text-secondary)]">
              Fill in the task details below.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={taskSaveAction} className="space-y-4">
            {editingTask?._id ? (
              <input type="hidden" name="_id" value={editingTask._id} />
            ) : null}
            <input type="hidden" name="projectId" value={projectId} />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label className="text-[var(--st-text)]">
                  Title <span className="text-[var(--st-danger)]">*</span>
                </Label>
                <Input
                  name="heading"
                  required
                  defaultValue={editingTask?.heading || ''}
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Assignee</Label>
                <div className="mt-1.5">
                  <EntityFormField
                    entity="employee"
                    name="assigneeId"
                    dualWriteName="assigneeName"
                    initialLabel={editingTask?.assigneeName || ''}
                    placeholder="Select assignee"
                  />
                </div>
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Status</Label>
                <Select
                  name="status"
                  defaultValue={editingTask?.status || 'incomplete'}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="incomplete">Incomplete</ZoruSelectItem>
                    <ZoruSelectItem value="todo">To Do</ZoruSelectItem>
                    <ZoruSelectItem value="in-progress">In Progress</ZoruSelectItem>
                    <ZoruSelectItem value="review">Review</ZoruSelectItem>
                    <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Priority</Label>
                <Select
                  name="priority"
                  defaultValue={editingTask?.priority || 'medium'}
                >
                  <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="low">Low</ZoruSelectItem>
                    <ZoruSelectItem value="medium">Medium</ZoruSelectItem>
                    <ZoruSelectItem value="high">High</ZoruSelectItem>
                    <ZoruSelectItem value="urgent">Urgent</ZoruSelectItem>
                  </ZoruSelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Start Date</Label>
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
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Due Date</Label>
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
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Estimate Hours</Label>
                <Input
                  type="number"
                  name="estimatedHours"
                  defaultValue={editingTask?.estimatedHours ?? ''}
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div>
                <Label className="text-[var(--st-text)]">Actual Hours</Label>
                <Input
                  type="number"
                  name="actualHours"
                  defaultValue={editingTask?.actualHours ?? ''}
                  className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-[var(--st-text)]">Description</Label>
                <Textarea
                  name="description"
                  rows={3}
                  defaultValue={editingTask?.description || ''}
                  className="mt-1.5 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
                />
              </div>
            </div>
            <ZoruDialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setTaskDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isTaskSaving}>
                {isTaskSaving ? (
                  <LoaderCircle
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                ) : null}
                Save
              </Button>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      <ZoruAlertDialog
        open={deletingTaskId !== null}
        onOpenChange={(o) => !o && setDeletingTaskId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-[var(--st-text)]">
              Delete task?
            </ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-[var(--st-text-secondary)]">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDeleteTask}>
              Delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

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
        <div>
          <Label className="text-[var(--st-text)]">
            Linked User (optional)
          </Label>
          <div className="mt-1.5">
            <EntityFormField
              entity="user"
              name="memberUserId"
              placeholder="Select user"
            />
          </div>
        </div>
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
    </EntityDetailShell>
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
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--st-bg-muted)]">
        <Icon className="h-4 w-4 text-[var(--st-text)]" strokeWidth={1.75} />
      </div>
      <div>
        <p className="text-[11.5px] text-[var(--st-text-secondary)]">{label}</p>
        <p className="text-[13px] font-medium text-[var(--st-text)]">{value}</p>
      </div>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--st-border)] p-8 text-center text-[13px] text-[var(--st-text-secondary)]">
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
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle className="text-[var(--st-text)]">{title}</ZoruDialogTitle>
        </ZoruDialogHeader>
        <form action={action} className="space-y-3">
          {children}
          <ZoruDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : null}
              Save
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
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
      <Label className="text-[var(--st-text)]">
        {label}
        {required ? <span className="text-[var(--st-danger)]"> *</span> : null}
      </Label>
      {type === 'textarea' ? (
        <Textarea
          name={name}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="mt-1.5 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
        />
      ) : (
        <Input
          name={name}
          type={type}
          required={required}
          placeholder={placeholder}
          defaultValue={defaultValue}
          className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]"
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
      <Label className="text-[var(--st-text)]">{label}</Label>
      <Select name={name} defaultValue={defaultValue}>
        <ZoruSelectTrigger className="mt-1.5 h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg)] text-[13px]">
          <ZoruSelectValue />
        </ZoruSelectTrigger>
        <ZoruSelectContent>
          {options.map((o) => (
            <ZoruSelectItem key={o.value} value={o.value}>
              {o.label}
            </ZoruSelectItem>
          ))}
        </ZoruSelectContent>
      </Select>
    </div>
  );
}
