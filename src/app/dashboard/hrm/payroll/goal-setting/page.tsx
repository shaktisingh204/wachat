'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useTransition, useActionState } from 'react';
import type { WithId } from 'mongodb';
import { getCrmGoals, saveCrmGoal, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { CrmGoal, CrmEmployee } from '@/lib/definitions';
import {
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruInput,
  ZoruLabel,
  ZoruTextarea,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruCard,
  ZoruBadge,
  ZoruButton,
  useZoruToast,
} from '@/components/zoruui';
import {
  Plus,
  Edit,
  Trash2,
  Target,
  LoaderCircle,
} from 'lucide-react';
import { format } from 'date-fns';

import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const SAVE_INITIAL: any = { message: null, error: null };

const STATUS_OPTIONS = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

const STATUS_VARIANTS: Record<string, 'secondary' | 'warning' | 'success' | 'danger'> = {
  'not-started': 'secondary',
  'in-progress': 'warning',
  completed: 'success',
  cancelled: 'danger',
  'Not Started': 'secondary',
  'In Progress': 'warning',
  Completed: 'success',
  Cancelled: 'danger',
  'On Hold': 'secondary',
};

const PRIORITY_VARIANTS: Record<string, 'danger' | 'warning' | 'secondary'> = {
  high: 'danger',
  medium: 'warning',
  low: 'secondary',
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-zoru-line';
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zoru-line">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-right text-[11.5px] tabular-nums text-zoru-ink-muted">{pct}%</p>
    </div>
  );
}

function GoalFormDialog({
  isOpen,
  onOpenChange,
  goal,
  onSave,
  employees,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  goal?: WithId<CrmGoal> | null;
  onSave: () => void;
  employees: WithId<CrmEmployee>[];
}) {
  const [state, formAction, isPending] = useActionState(saveCrmGoal, SAVE_INITIAL);
  const { toast } = useZoruToast();
  const isEditing = !!goal;

  useEffect(() => {
    if (state.message) {
      toast({ title: 'Success!', description: state.message });
      onSave();
      onOpenChange(false);
    }
    if (state.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onSave, onOpenChange]);

  return (
    <ZoruDialog open={isOpen} onOpenChange={onOpenChange}>
      <ZoruDialogContent className="max-w-lg">
        <form action={formAction}>
          {isEditing && (
            <input type="hidden" name="id" value={goal._id.toString()} />
          )}
          <ZoruDialogHeader>
            <ZoruDialogTitle className="text-zoru-ink">
              {isEditing ? 'Edit Goal' : 'Create Goal'}
            </ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">
              Set a clear objective with a due date and priority.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">
                Title <span className="text-zoru-danger-ink">*</span>
              </ZoruLabel>
              <ZoruInput
                name="title"
                defaultValue={goal?.title}
                required
                placeholder="e.g. Launch new product feature"
                className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <ZoruLabel className="text-zoru-ink">Description</ZoruLabel>
              <ZoruTextarea
                name="description"
                defaultValue={goal?.description}
                rows={3}
                placeholder="Describe the goal in detail…"
                className="rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <ZoruLabel className="text-zoru-ink">
                  Assign To
                </ZoruLabel>
                <ZoruSelect
                  name="assigneeId"
                  defaultValue={goal?.assigneeId?.toString() ?? undefined}
                >
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue placeholder="Select employee…" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {employees.map((e) => (
                      <ZoruSelectItem key={e._id.toString()} value={e._id.toString()}>
                        {e.firstName} {e.lastName}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>

              <div className="space-y-1.5">
                <ZoruLabel className="text-zoru-ink">
                  Due Date <span className="text-zoru-danger-ink">*</span>
                </ZoruLabel>
                <ZoruInput
                  name="targetDate"
                  type="date"
                  required
                  defaultValue={
                    goal?.targetDate
                      ? new Date(goal.targetDate).toISOString().slice(0, 10)
                      : ''
                  }
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <ZoruLabel className="text-zoru-ink">Priority</ZoruLabel>
                <ZoruSelect name="priority" defaultValue={(goal as any)?.priority ?? 'medium'}>
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <ZoruSelectItem key={o.value} value={o.value}>
                        {o.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>

              <div className="space-y-1.5">
                <ZoruLabel className="text-zoru-ink">Status</ZoruLabel>
                <ZoruSelect
                  name="status"
                  defaultValue={(goal?.status as string) ?? 'not-started'}
                >
                  <ZoruSelectTrigger className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]">
                    <ZoruSelectValue />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <ZoruSelectItem key={o.value} value={o.value}>
                        {o.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>

              <div className="space-y-1.5">
                <ZoruLabel className="text-zoru-ink">Progress (%)</ZoruLabel>
                <ZoruInput
                  name="progress"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={goal?.progress ?? 0}
                  className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]"
                />
              </div>
            </div>
          </div>

          <ZoruDialogFooter className="gap-2">
            <ZoruButton
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </ZoruButton>
            <ZoruButton
              type="submit"
              disabled={isPending}
            >
              {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {isEditing ? 'Save Goal' : 'Create Goal'}
            </ZoruButton>
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
}: {
  goal: WithId<CrmGoal>;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const priority = (goal as any).priority as string | undefined;
  return (
    <ZoruCard className="flex flex-col gap-3 p-6">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] text-zoru-ink">{goal.title}</h3>
        <div className="flex shrink-0 gap-1">
          {priority && (
            <ZoruBadge variant={PRIORITY_VARIANTS[priority] ?? 'secondary'}>
              {priority}
            </ZoruBadge>
          )}
          <ZoruBadge variant={STATUS_VARIANTS[goal.status] ?? 'secondary'}>
            {goal.status}
          </ZoruBadge>
        </div>
      </div>

      {goal.targetDate && (
        <p className="text-[12.5px] text-zoru-ink-muted">
          Due: {format(new Date(goal.targetDate), 'PPP')}
        </p>
      )}

      {goal.description && (
        <p className="line-clamp-2 text-[13px] text-zoru-ink-muted">{goal.description}</p>
      )}

      <ProgressBar value={goal.progress ?? 0} />

      {(goal as any).assigneeInfo && (
        <p className="text-[12.5px] text-zoru-ink">
          Assigned to:{' '}
          <span className="text-zoru-ink">
            {(goal as any).assigneeInfo.firstName} {(goal as any).assigneeInfo.lastName}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <ZoruButton
          variant="ghost"
          size="sm"
          onClick={onDelete}
        >
          <Trash2 className="h-3.5 w-3.5 text-zoru-danger-ink" />
        </ZoruButton>
        <ZoruButton
          variant="outline"
          size="sm"
          onClick={onEdit}
        >
          <Edit className="h-3.5 w-3.5" />
          Edit
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

export default function GoalSettingPage() {
  const [goals, setGoals] = useState<WithId<CrmGoal>[]>([]);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WithId<CrmGoal> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useZoruToast();

  const fetchData = useCallback(() => {
    startTransition(async () => {
      const [goalsData, employeesData] = await Promise.all([
        getCrmGoals(),
        getCrmEmployees(),
      ]);
      setGoals(goalsData);
      setEmployees(employeesData);
    });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (goal: WithId<CrmGoal> | null) => {
    setEditingGoal(goal);
    setIsDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const result = await deleteCrmGoal(deletingId);
    if (result.success) {
      toast({ title: 'Deleted', description: 'Goal removed.' });
      setDeletingId(null);
      fetchData();
    } else {
      toast({ title: 'Error', description: result.error, variant: 'destructive' });
    }
  };

  return (
    <>
      <GoalFormDialog
        isOpen={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        goal={editingGoal}
        onSave={fetchData}
        employees={employees}
      />
      <ZoruAlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle className="text-zoru-ink">Delete Goal?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription className="text-zoru-ink-muted">
              This action cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction onClick={handleDelete}>Delete</ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Goal Setting"
          subtitle="Set, track, and manage goals for your team and employees."
          icon={Target}
          actions={
            <ZoruButton onClick={() => handleOpenDialog(null)}>
              <Plus className="h-4 w-4" />
              New Goal
            </ZoruButton>
          }
        />

        {isLoading && goals.length === 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ZoruCard key={i} className="p-6">
                <div className="h-32 animate-pulse rounded-lg bg-zoru-surface-2" />
              </ZoruCard>
            ))}
          </div>
        ) : goals.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {goals.map((goal) => (
              <GoalCard
                key={goal._id.toString()}
                goal={goal}
                onEdit={() => handleOpenDialog(goal)}
                onDelete={() => setDeletingId(goal._id.toString())}
              />
            ))}
          </div>
        ) : (
          <ZoruCard className="border-dashed p-6">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zoru-surface-2">
                <Target className="h-6 w-6 text-zoru-ink" />
              </div>
              <h3 className="text-[15px] text-zoru-ink">No Goals Yet</h3>
              <p className="text-[12.5px] text-zoru-ink-muted">
                Create a new goal to get started.
              </p>
              <ZoruButton onClick={() => handleOpenDialog(null)}>
                <Plus className="h-4 w-4" />
                New Goal
              </ZoruButton>
            </div>
          </ZoruCard>
        )}
      </div>
    </>
  );
}
