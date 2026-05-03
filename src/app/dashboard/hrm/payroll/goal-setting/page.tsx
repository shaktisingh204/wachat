'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useTransition, useActionState } from 'react';
import type { WithId } from 'mongodb';
import { getCrmGoals, saveCrmGoal, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { CrmGoal, CrmEmployee } from '@/lib/definitions';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Edit,
  Trash2,
  Target,
  LoaderCircle,
} from 'lucide-react';
import { format } from 'date-fns';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
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

const STATUS_TONES: Record<string, 'neutral' | 'amber' | 'green' | 'red'> = {
  'not-started': 'neutral',
  'in-progress': 'amber',
  completed: 'green',
  cancelled: 'red',
  // legacy values
  'Not Started': 'neutral',
  'In Progress': 'amber',
  Completed: 'green',
  Cancelled: 'red',
  'On Hold': 'neutral',
};

const PRIORITY_TONES: Record<string, 'red' | 'amber' | 'neutral'> = {
  high: 'red',
  medium: 'amber',
  low: 'neutral',
};

function ProgressBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value || 0));
  const color =
    pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-border';
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-border">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-right text-[11.5px] tabular-nums text-muted-foreground">{pct}%</p>
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
  const { toast } = useToast();
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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <form action={formAction}>
          {isEditing && (
            <input type="hidden" name="id" value={goal._id.toString()} />
          )}
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isEditing ? 'Edit Goal' : 'Create Goal'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Set a clear objective with a due date and priority.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-foreground">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                name="title"
                defaultValue={goal?.title}
                required
                placeholder="e.g. Launch new product feature"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-foreground">Description</Label>
              <Textarea
                name="description"
                defaultValue={goal?.description}
                rows={3}
                placeholder="Describe the goal in detail…"
                className="rounded-lg border-border bg-card text-[13px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Assign To
                </Label>
                <Select
                  name="assigneeId"
                  defaultValue={goal?.assigneeId?.toString() ?? ''}
                >
                  <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue placeholder="Select employee…" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e._id.toString()} value={e._id.toString()}>
                        {e.firstName} {e.lastName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground">
                  Due Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  name="targetDate"
                  type="date"
                  required
                  defaultValue={
                    goal?.targetDate
                      ? new Date(goal.targetDate).toISOString().slice(0, 10)
                      : ''
                  }
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-foreground">Priority</Label>
                <Select name="priority" defaultValue={(goal as any)?.priority ?? 'medium'}>
                  <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground">Status</Label>
                <Select
                  name="status"
                  defaultValue={(goal?.status as string) ?? 'not-started'}
                >
                  <SelectTrigger className="h-10 rounded-lg border-border bg-card text-[13px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-foreground">Progress (%)</Label>
                <Input
                  name="progress"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={goal?.progress ?? 0}
                  className="h-10 rounded-lg border-border bg-card text-[13px]"
                />
              </div>
            </div>
          </div>

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
              disabled={isPending}
              leading={
                isPending ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : null
              }
            >
              {isEditing ? 'Save Goal' : 'Create Goal'}
            </ClayButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
    <ClayCard className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[15px] font-semibold text-foreground">{goal.title}</h3>
        <div className="flex shrink-0 gap-1">
          {priority && (
            <ClayBadge tone={PRIORITY_TONES[priority] ?? 'neutral'}>
              {priority}
            </ClayBadge>
          )}
          <ClayBadge tone={STATUS_TONES[goal.status] ?? 'neutral'}>
            {goal.status}
          </ClayBadge>
        </div>
      </div>

      {goal.targetDate && (
        <p className="text-[12.5px] text-muted-foreground">
          Due: {format(new Date(goal.targetDate), 'PPP')}
        </p>
      )}

      {goal.description && (
        <p className="line-clamp-2 text-[13px] text-muted-foreground">{goal.description}</p>
      )}

      <ProgressBar value={goal.progress ?? 0} />

      {(goal as any).assigneeInfo && (
        <p className="text-[12.5px] text-foreground">
          Assigned to:{' '}
          <span className="font-semibold">
            {(goal as any).assigneeInfo.firstName} {(goal as any).assigneeInfo.lastName}
          </span>
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <ClayButton
          variant="pill"
          size="sm"
          leading={<Trash2 className="h-3.5 w-3.5 text-destructive" strokeWidth={1.75} />}
          onClick={onDelete}
        />
        <ClayButton
          variant="pill"
          size="sm"
          leading={<Edit className="h-3.5 w-3.5" strokeWidth={1.75} />}
          onClick={onEdit}
        >
          Edit
        </ClayButton>
      </div>
    </ClayCard>
  );
}

export default function GoalSettingPage() {
  const [goals, setGoals] = useState<WithId<CrmGoal>[]>([]);
  const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<WithId<CrmGoal> | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

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
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(o) => !o && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Goal?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex w-full flex-col gap-6">
        <CrmPageHeader
          title="Goal Setting"
          subtitle="Set, track, and manage goals for your team and employees."
          icon={Target}
          actions={
            <ClayButton
              variant="obsidian"
              leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
              onClick={() => handleOpenDialog(null)}
            >
              New Goal
            </ClayButton>
          }
        />

        {isLoading && goals.length === 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <ClayCard key={i}>
                <div className="h-32 animate-pulse rounded-lg bg-secondary" />
              </ClayCard>
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
          <ClayCard variant="outline" className="border-dashed">
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent">
                <Target className="h-6 w-6 text-accent-foreground" strokeWidth={1.75} />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground">No Goals Yet</h3>
              <p className="text-[12.5px] text-muted-foreground">
                Create a new goal to get started.
              </p>
              <ClayButton
                variant="obsidian"
                leading={<Plus className="h-4 w-4" strokeWidth={1.75} />}
                onClick={() => handleOpenDialog(null)}
              >
                New Goal
              </ClayButton>
            </div>
          </ClayCard>
        )}
      </div>
    </>
  );
}
