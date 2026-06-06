'use client';

import { Button, StatCard, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr, Input, Label, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, Checkbox, useToast } from '@/components/sabcrm/20ui/compat';
import { useDebouncedCallback } from 'use-debounce';
import {
  X,
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
  deleteWsSubTask,
  bulkCompleteWsSubTasks,
  bulkDeleteWsSubTasks,
  bulkAssignWsSubTasks,
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

function fmtDateUTC(v: unknown): string {
  if (!v) return '—';
  const d = new Date(v as string | Date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { timeZone: 'UTC' });
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

interface SubtasksListClientProps {
  initialRows: Row[];
}

export function SubtasksListClient({ initialRows }: SubtasksListClientProps) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState<Row[]>(initialRows);
  const [loading, startLoading] = React.useTransition();
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [parentTaskFilter, setParentTaskFilter] = React.useState<string>('');
  const [deleteTargetId, setDeleteTargetId] = React.useState<string | null>(null);
  const [selection, setSelection] = React.useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = React.useTransition();
  const [confirmBulk, setConfirmBulk] = React.useState<'complete' | 'delete' | 'assign' | null>(null);

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getWsSubTasks()) as unknown as Row[];
        const serialized = (list ?? []).map((r: any) => ({
          ...r,
          _id: r._id.toString(),
          taskId: r.taskId ? r.taskId.toString() : '',
          projectId: r.projectId ? r.projectId.toString() : undefined,
          assignedTo: r.assignedTo ? r.assignedTo.toString() : undefined,
          dependencyId: r.dependencyId ? r.dependencyId.toString() : undefined,
          startDate: r.startDate ? new Date(r.startDate).toISOString() : undefined,
          dueDate: r.dueDate ? new Date(r.dueDate).toISOString() : undefined,
          createdAt: r.createdAt ? new Date(r.createdAt).toISOString() : undefined,
          updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : undefined,
        }));
        setRows(serialized);
      } catch (e) {
        toast({
          title: 'Failed to load subtasks',
          description: e instanceof Error ? e.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    });
  }, [toast]);

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

  const handleToggle = React.useCallback((id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleToggleAll = React.useCallback((checked: boolean) => {
    setSelection(checked ? new Set(filtered.map((r) => r._id)) : new Set());
  }, [filtered]);

  const handleBulkComplete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkCompleteWsSubTasks(ids);
      if (res.updated > 0 || res.failed === 0) {
        toast({ title: `Completed ${res.updated} subtask${res.updated === 1 ? '' : 's'}` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk complete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  const handleBulkDelete = React.useCallback(() => {
    const ids = Array.from(selection);
    startBulkTransition(async () => {
      const res = await bulkDeleteWsSubTasks(ids);
      if (res.deleted > 0 || res.failed === 0) {
        toast({ title: `Deleted ${res.deleted} subtask${res.deleted === 1 ? '' : 's'}` });
        setSelection(new Set());
        setConfirmBulk(null);
        refresh();
      } else {
        toast({ title: 'Bulk delete failed', description: res.error, variant: 'destructive' });
      }
    });
  }, [selection, refresh, toast]);

  const [bulkAssignState, bulkAssignAction] = useActionState(async (_prev: any, formData: FormData) => {
    const assignedTo = formData.get('assignedTo') as string;
    const assignedToName = formData.get('assignedToName') as string;
    if (!assignedTo) return { error: 'Please select an assignee.' };

    const ids = Array.from(selection);
    const res = await bulkAssignWsSubTasks(ids, assignedTo, assignedToName);
    if (res.updated > 0 || res.failed === 0) {
      toast({ title: `Assigned ${res.updated} subtask${res.updated === 1 ? '' : 's'}` });
      setSelection(new Set());
      setConfirmBulk(null);
      refresh();
      return { success: true };
    }
    return { error: res.error };
  }, null);

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
          <Button asChild>
            <Link href="/dashboard/crm/projects/subtasks/new">
              <Plus className="h-4 w-4" /> New subtask
            </Link>
          </Button>
        }
        bulkBar={
          selection.size > 0 ? (
            <div className="flex items-center gap-2 rounded-md bg-[var(--st-bg-muted)] px-3 py-2 text-[13px]">
              <span className="font-medium text-[var(--st-text)]">{selection.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('complete')} disabled={bulkPending}>
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Complete
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmBulk('assign')} disabled={bulkPending}>
                <Edit className="mr-1 h-3.5 w-3.5" /> Assign
              </Button>
              <Button variant="outline" size="sm" className="text-[var(--st-danger)]" onClick={() => setConfirmBulk('delete')} disabled={bulkPending}>
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setSelection(new Set())}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : null
        }
        filters={
          <>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-[160px] text-[13px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
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
              <ListChecks className="h-8 w-8 text-[var(--st-text-secondary)]" />
              <h3 className="text-base font-medium text-[var(--st-text)]">No subtasks yet</h3>
              <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
                Break a task down into smaller actionable items so the team can pick them up independently.
              </p>
              <Button asChild>
                <Link href="/dashboard/crm/projects/subtasks/new">
                  <Plus className="h-4 w-4" /> New subtask
                </Link>
              </Button>
            </div>
          ) : null
        }
        loading={loading && rows.length === 0}
      >
        <div className="flex flex-col gap-4 animate-in fade-in-50">
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
            <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
              <Table>
                <THead>
                  <Tr className="border-[var(--st-border)] hover:bg-transparent">
                    <Th className="w-10">
                      {(() => {
                        const allCk = filtered.length > 0 && filtered.every((r) => selection.has(r._id));
                        const someCk = !allCk && filtered.some((r) => selection.has(r._id));
                        return (
                          <Checkbox
                            checked={allCk || (someCk ? 'indeterminate' : false)}
                            onCheckedChange={(v) => handleToggleAll(!!v)}
                            aria-label="Select all"
                          />
                        );
                      })()}
                    </Th>
                    <Th>Title</Th>
                    <Th>Parent task</Th>
                    <Th>Dependency</Th>
                    <Th>Assignee</Th>
                    <Th>Due</Th>
                    <Th>Status</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </THead>
                <TBody>
                  {filtered.map((r) => {
                    const overdue = isOverdue(r);
                    return (
                      <Tr
                        key={r._id}
                        className={[
                          'border-[var(--st-border)] transition-colors',
                          overdue ? 'border-l-2 border-l-zoru-danger' : '',
                          isCompleted(r.status) ? 'opacity-70' : '',
                        ].join(' ')}
                      >
                        <Td>
                          <Checkbox
                            checked={selection.has(r._id)}
                            onCheckedChange={() => handleToggle(r._id)}
                            aria-label={`Select ${r.title ?? 'subtask'}`}
                          />
                        </Td>
                        <Td>
                          <EntityRowLink
                            href={`/dashboard/crm/projects/subtasks/${r._id}`}
                            label={r.title || 'Untitled'}
                            subtitle={r.description || undefined}
                          />
                        </Td>
                        <Td className="text-[12.5px]">
                          {r.taskId ? (
                            <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                              {String(r.taskId).slice(-8)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td className="text-[12.5px]">
                          {r.dependencyId ? (
                            <EntityPickerChip entity="subtask" id={String(r.dependencyId)} fallback="View Subtask" />
                          ) : (
                            '—'
                          )}
                        </Td>
                        <Td>
                          {r.assignedTo ? (
                            <EntityPickerChip
                              entity="employee"
                              id={String(r.assignedTo)}
                              fallback={r.assignedToName || '—'}
                            />
                          ) : (
                            <span className="text-[12px] text-[var(--st-text-secondary)]">
                              {r.assignedToName || 'Unassigned'}
                            </span>
                          )}
                        </Td>
                        <Td
                          className={[
                            'text-[12.5px]',
                            overdue ? 'text-[var(--st-danger)]' : 'text-[var(--st-text-secondary)]',
                          ].join(' ')}
                        >
                          {fmtDateUTC(r.dueDate)}
                        </Td>
                        <Td>
                          <StatusPill
                            label={r.status || 'incomplete'}
                            tone={statusToTone(r.status || '')}
                          />
                        </Td>
                        <Td className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                aria-label={`Actions for ${r.title}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)] hover:text-[var(--st-text)]"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/dashboard/crm/projects/subtasks/${r._id}/edit`}>
                                  <Eye className="mr-1.5 h-3.5 w-3.5" /> View / Edit
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/crm/sales-crm/tasks/${String(r.taskId)}`}
                                >
                                  <Edit className="mr-1.5 h-3.5 w-3.5" /> Open parent
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteTargetId(r._id)}
                                className="text-[var(--st-danger)]"
                              >
                                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </Td>
                      </Tr>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          )}
        </div>
      </EntityListShell>

      <ConfirmDialog
        open={!!deleteTargetId}
        onOpenChange={(o) => !o && setDeleteTargetId(null)}
        title="Delete this subtask?"
        description={`This permanently removes "${deleteTarget?.title ?? 'subtask'}". This action cannot be undone.`}
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleConfirmDelete}
      />

      <ConfirmDialog
        open={confirmBulk === 'complete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Mark ${selection.size} subtask${selection.size === 1 ? '' : 's'} complete?`}
        description="The selected subtasks will be marked as complete."
        confirmLabel="Mark complete"
        onConfirm={handleBulkComplete}
      />

      <ConfirmDialog
        open={confirmBulk === 'delete'}
        onOpenChange={(o) => !o && setConfirmBulk(null)}
        title={`Delete ${selection.size} subtask${selection.size === 1 ? '' : 's'}?`}
        description="This permanently removes the selected subtasks. This action cannot be undone."
        requireTyped="DELETE"
        confirmLabel="Delete"
        onConfirm={handleBulkDelete}
      />

      <Dialog open={confirmBulk === 'assign'} onOpenChange={(o) => !o && setConfirmBulk(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign {selection.size} subtask{selection.size === 1 ? '' : 's'}</DialogTitle>
          </DialogHeader>
          <form action={bulkAssignAction} className="space-y-4 pt-4">
            <div>
              <Label>Assignee</Label>
              <EntityFormField
                entity="employee"
                name="assignedTo"
                dualWriteName="assignedToName"
                placeholder="Pick an assignee"
              />
            </div>
            {bulkAssignState?.error && <p className="text-sm text-[var(--st-danger)]">{bulkAssignState.error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfirmBulk(null)}>Cancel</Button>
              <Button type="submit">Assign</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
