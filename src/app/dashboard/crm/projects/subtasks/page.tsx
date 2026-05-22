'use client';

import {
  Button,
  StatCard,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  Input,
  Label,
  Textarea,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuTrigger,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  useZoruToast,
} from '@/components/zoruui';
import {
  useDebouncedCallback } from 'use-debounce';
import {
  AlertTriangle,
  CheckCircle2,
  Edit,
  ListChecks,
  MoreHorizontal,
  Plus,
  Trash2,
  Eye,
  } from 'lucide-react';
import { useActionState } from 'react';

/**
 * Subtasks — list page (rebuilt per §1D.1).
 *
 * Composition:
 *   <EntityListShell>
 *     • KPI strip (3 cards: Open · Completed · Overdue)
 *     • Filter row (status · parent task)
 *     • Table columns: title · parent task · assignee · due · status · actions
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EntityPickerChip } from '@/components/crm/entity-picker';
import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';
import { ConfirmDialog } from '@/components/crm/confirm-dialog';
import {
  getWsSubTasks,
  saveWsSubTask,
  deleteWsSubTask,
} from '@/app/actions/worksuite/projects.actions';
import type { WsSubTask } from '@/lib/worksuite/project-types';

type Row = WsSubTask & { _id: string };

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'completed', label: 'Completed' },
];

function fmtDate(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

function isCompleted(s: string | undefined): boolean {
  const l = (s ?? '').toLowerCase();
  return l === 'completed' || l === 'done';
}

function isOverdue(r: Row): boolean {
  if (isCompleted(r.status)) return false;
  if (!r.dueDate) return false;
  const d = new Date(r.dueDate as string | Date);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export default function SubTasksPage() {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [parentTaskFilter, setParentTaskFilter] = React.useState<string>('');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<Row | null>(null);
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsSubTasks()) as unknown as Row[];
        setRows(list ?? []);
      } catch (e) {
        toast({
          title: 'Failed to load subtasks',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSearch = useDebouncedCallback((v: string) => setSearch(v), 300);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== 'all' && (r.status || '').toLowerCase() !== statusFilter) {
        return false;
      }
      if (parentTaskFilter && String(r.taskId ?? '') !== parentTaskFilter) {
        return false;
      }
      if (!q) return true;
      const hay = [r.title, r.description, r.assignedToName]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search, statusFilter, parentTaskFilter]);

  const kpis = React.useMemo(() => {
    const open = rows.filter((r) => !isCompleted(r.status)).length;
    const completed = rows.filter((r) => isCompleted(r.status)).length;
    const overdue = rows.filter(isOverdue).length;
    return { open, completed, overdue };
  }, [rows]);

  const hasActiveFilters = statusFilter !== 'all' || !!parentTaskFilter;

  const deleteTarget = React.useMemo(
    () => rows.find((r) => r._id === deleteTargetId) ?? null,
    [rows, deleteTargetId],
  );

  const handleConfirmDelete = React.useCallback(async () => {
    if (!deleteTargetId) return;
    const res = await deleteWsSubTask(deleteTargetId);
    if (res?.success) {
      toast({ title: 'Subtask deleted' });
      refresh();
    } else {
      toast({
        title: 'Delete failed',
        description: res?.error ?? 'Unknown error',
        variant: 'destructive',
      });
    }
    setDeleteTargetId(null);
  }, [deleteTargetId, refresh, toast]);

  return (
    <>
      <EntityListShell
        title="Subtasks"
        subtitle="Break tasks into smaller actionable items, assign them, and track progress."
        search={{
          value: search,
          onChange: handleSearch,
          placeholder: 'Search title, description, assignee…',
        }}
        primaryAction={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> New subtask
          </Button>
        }
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <Input
              value={parentTaskFilter}
              onChange={(e) => setParentTaskFilter(e.target.value)}
              placeholder="Parent task id"
              className="h-9 w-[200px] text-[13px]"
            />
            {hasActiveFilters ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setParentTaskFilter('');
                }}
              >
                Clear filters
              </Button>
            ) : null}
          </>
        }
        empty={
          !loading && filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-4">
              <ListChecks className="h-8 w-8 text-zoru-ink-muted" />
              <h3 className="text-base font-medium text-zoru-ink">No subtasks yet</h3>
              <p className="max-w-sm text-sm text-zoru-ink-muted">
                Break a task down into smaller actionable items so the team can
                pick them up independently.
              </p>
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> New subtask
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className="text-left"
            >
              <StatCard
                label="Open"
                value={kpis.open.toLocaleString()}
                icon={<ListChecks className="h-4 w-4" />}
              />
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className="text-left"
            >
              <StatCard
                label="Completed"
                value={kpis.completed.toLocaleString()}
                icon={<CheckCircle2 className="h-4 w-4" />}
              />
            </button>
            <button type="button" className="text-left">
              <StatCard
                label="Overdue"
                value={kpis.overdue.toLocaleString()}
                icon={<AlertTriangle className="h-4 w-4" />}
              />
            </button>
          </div>

          {filtered.length === 0 && !loading ? null : (
            <div className="overflow-x-auto rounded-lg border border-zoru-line">
              <Table>
                <ZoruTableHeader>
                  <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                    <ZoruTableHead>Title</ZoruTableHead>
                    <ZoruTableHead>Parent task</ZoruTableHead>
                    <ZoruTableHead>Assignee</ZoruTableHead>
                    <ZoruTableHead>Due</ZoruTableHead>
                    <ZoruTableHead>Status</ZoruTableHead>
                    <ZoruTableHead className="text-right">Actions</ZoruTableHead>
                  </ZoruTableRow>
                </ZoruTableHeader>
                <ZoruTableBody>
                  {filtered.map((r) => {
                    const overdue = isOverdue(r);
                    return (
                      <ZoruTableRow
                        key={r._id}
                        className={[
                          'border-zoru-line transition-colors',
                          overdue ? 'border-l-2 border-l-zoru-danger' : '',
                          isCompleted(r.status) ? 'opacity-70' : '',
                        ].join(' ')}
                      >
                        <ZoruTableCell>
                          <EntityRowLink
                            href={`/dashboard/crm/projects/subtasks/${r._id}`}
                            label={r.title || 'Untitled'}
                            subtitle={r.description || undefined}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-[12.5px]">
                          {r.taskId ? (
                            <span className="font-mono text-[11.5px] text-zoru-ink-muted">
                              {String(r.taskId).slice(-8)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          {r.assignedTo ? (
                            <EntityPickerChip
                              entity="employee"
                              id={String(r.assignedTo)}
                              fallback={r.assignedToName || '—'}
                            />
                          ) : (
                            <span className="text-[12px] text-zoru-ink-muted">
                              {r.assignedToName || 'Unassigned'}
                            </span>
                          )}
                        </ZoruTableCell>
                        <ZoruTableCell
                          className={[
                            'text-[12.5px]',
                            overdue ? 'text-zoru-danger' : 'text-zoru-ink-muted',
                          ].join(' ')}
                        >
                          {fmtDate(r.dueDate)}
                        </ZoruTableCell>
                        <ZoruTableCell>
                          <StatusPill
                            label={r.status || 'incomplete'}
                            tone={statusToTone(r.status || '')}
                          />
                        </ZoruTableCell>
                        <ZoruTableCell className="text-right">
                          <DropdownMenu>
                            <ZoruDropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Actions for ${r.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zoru-ink-muted hover:bg-zoru-surface-2 hover:text-zoru-ink"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </ZoruDropdownMenuTrigger>
                            <ZoruDropdownMenuContent align="end">
                              <ZoruDropdownMenuItem onClick={() => setEditTarget(r)}>
                                <Eye className="mr-1.5 h-3.5 w-3.5" /> View / Edit
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/crm/sales-crm/tasks/${String(r.taskId)}`}
                                >
                                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Open parent
                                </Link>
                              </ZoruDropdownMenuItem>
                              <ZoruDropdownMenuItem
                                onClick={() => setDeleteTargetId(r._id)}
                                className="text-zoru-danger"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </ZoruDropdownMenuItem>
                            </ZoruDropdownMenuContent>
                          </DropdownMenu>
                        </ZoruTableCell>
                      </ZoruTableRow>
                    );
                  })}
                </ZoruTableBody>
              </Table>
            </div>
          )}
        </div>
      </EntityListShell>

      {/* Create / Edit dialog */}
      <SubTaskDialog
        open={createOpen || !!editTarget}
        initial={editTarget ?? undefined}
        onOpenChange={(o) => {
          if (!o) {
            setCreateOpen(false);
            setEditTarget(null);
          }
        }}
        onSaved={() => {
          setCreateOpen(false);
          setEditTarget(null);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this subtask?"
        description={`This permanently removes "${deleteTarget?.title ?? 'subtask'}". This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

/* ───── Create / Edit dialog ───── */
interface SubTaskDialogProps {
  open: boolean;
  initial?: Row;
  onOpenChange: (o: boolean) => void;
  onSaved: () => void;
}

function SubTaskDialog({ open, initial, onOpenChange, onSaved }: SubTaskDialogProps) {
  const { toast } = useZoruToast();
  const [state, action] = useActionState(
    async (
      _prev: { message?: string; error?: string; id?: string } | null,
      formData: FormData,
    ) => {
      const res = await saveWsSubTask(_prev, formData);
      if (res.error) {
        toast({
          title: 'Save failed',
          description: res.error,
          variant: 'destructive',
        });
        return res;
      }
      toast({ title: initial?._id ? 'Subtask updated' : 'Subtask created' });
      onSaved();
      return res;
    },
    null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <ZoruDialogHeader>
          <ZoruDialogTitle>
            {initial?._id ? 'Edit subtask' : 'New subtask'}
          </ZoruDialogTitle>
          <ZoruDialogDescription>
            Subtasks live under a parent task — pick the parent and assign the work.
          </ZoruDialogDescription>
        </ZoruDialogHeader>
        <form action={action} className="space-y-3">
          {initial?._id ? (
            <input type="hidden" name="_id" defaultValue={initial._id} />
          ) : null}
          <div>
            <Label htmlFor="title">
              Title <span className="text-zoru-danger-ink">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              defaultValue={initial?.title ?? ''}
              required
            />
          </div>
          <div>
            <Label htmlFor="taskId">
              Parent task <span className="text-zoru-danger-ink">*</span>
            </Label>
            <EntityFormField
              entity="task"
              name="taskId"
              initialId={initial?.taskId ? String(initial.taskId) : undefined}
              placeholder="Select a parent task"
              allowCreate
              required
            />
          </div>
          <div>
            <Label>Project</Label>
            <EntityFormField
              entity="project"
              name="projectId"
              dualWriteName="projectName"
              initialId={initial?.projectId ? String(initial.projectId) : undefined}
              placeholder="Pick a project"
            />
          </div>
          <div>
            <Label>Assignee</Label>
            <EntityFormField
              entity="employee"
              name="assignedTo"
              dualWriteName="assignedToName"
              initialId={initial?.assignedTo ? String(initial.assignedTo) : undefined}
              placeholder="Pick an assignee"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="startDate">Start</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={
                  initial?.startDate
                    ? new Date(initial.startDate as string | Date)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
              />
            </div>
            <div>
              <Label htmlFor="dueDate">Due</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="date"
                defaultValue={
                  initial?.dueDate
                    ? new Date(initial.dueDate as string | Date)
                        .toISOString()
                        .slice(0, 10)
                    : ''
                }
              />
            </div>
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select name="status" defaultValue={initial?.status ?? 'incomplete'}>
              <ZoruSelectTrigger id="status">
                <ZoruSelectValue placeholder="Status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <ZoruSelectItem key={o.value} value={o.value}>
                    {o.label}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={initial?.description ?? ''}
              rows={3}
            />
          </div>
          {state?.error ? (
            <p className="text-sm text-zoru-danger-ink">{state.error}</p>
          ) : null}
          <ZoruDialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {initial?._id ? 'Save changes' : 'Create subtask'}
            </Button>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </Dialog>
  );
}
