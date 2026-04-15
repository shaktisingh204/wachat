'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import type { WithId } from 'mongodb';
import { getCrmGoals, saveCrmGoal, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { CrmGoal, CrmEmployee } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { useFormStatus } from 'react-dom';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Target, LoaderCircle, Save } from 'lucide-react';
import { format } from 'date-fns';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '@/app/dashboard/crm/_components/crm-page-header';

const saveInitialState: any = { message: null, error: null };

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
      {isEditing ? 'Save Goal' : 'Create Goal'}
    </Button>
  );
}

function GoalFormDialog({
    isOpen, onOpenChange, goal, onSave, employees
}: {
    isOpen: boolean; onOpenChange: (open: boolean) => void; goal?: WithId<CrmGoal> | null; onSave: () => void; employees: WithId<CrmEmployee>[];
}) {
  const [state, formAction] = useActionState(saveCrmGoal, saveInitialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [targetDate, setTargetDate] = useState<Date | undefined>(goal ? new Date(goal.targetDate) : undefined);
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

  useEffect(() => {
      if(isOpen) {
          setTargetDate(goal ? new Date(goal.targetDate) : undefined);
      }
  }, [isOpen, goal]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} ref={formRef}>
          {isEditing && <input type="hidden" name="id" value={goal._id.toString()} />}
          <input type="hidden" name="targetDate" value={targetDate?.toISOString() || ''} />
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Goal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label>Title *</Label><Input name="title" defaultValue={goal?.title} required className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]" /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" defaultValue={goal?.description} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Assign To (Optional)</Label><Select name="assigneeId" defaultValue={goal?.assigneeId?.toString()}><SelectTrigger><SelectValue placeholder="Select Employee..."/></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e._id.toString()} value={e._id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Target Date *</Label><DatePicker date={targetDate} setDate={setTargetDate} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Status</Label><Select name="status" defaultValue={goal?.status || 'Not Started'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Not Started">Not Started</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="On Hold">On Hold</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Progress (%)</Label><Input name="progress" type="number" min="0" max="100" defaultValue={goal?.progress || 0} className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"/></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancel</Button><SubmitButton isEditing={isEditing} /></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, onEdit, onDelete }: { goal: WithId<CrmGoal>, onEdit: () => void, onDelete: () => void }) {
    const statusTone: Record<string, 'neutral' | 'amber' | 'green' | 'red'> = {
        'Not Started': 'neutral', 'In Progress': 'amber', 'Completed': 'green', 'On Hold': 'neutral', 'Cancelled': 'red'
    };
    return (
        <ClayCard className="flex flex-col">
            <div className="flex items-start justify-between">
                <h3 className="text-[15px] font-semibold text-clay-ink">{goal.title}</h3>
                <ClayBadge tone={statusTone[goal.status] || 'neutral'}>{goal.status}</ClayBadge>
            </div>
            <p className="mt-1 text-[12.5px] text-clay-ink-muted">Target Date: {format(new Date(goal.targetDate), 'PPP')}</p>
            <div className="mt-3 flex-grow space-y-3">
                <p className="line-clamp-3 text-[13px] text-clay-ink-muted">{goal.description}</p>
                <div className="space-y-1">
                    <Label className="text-[11.5px] text-clay-ink-muted">Progress</Label>
                    <Progress value={goal.progress} />
                    <p className="text-right text-[11.5px] text-clay-ink-muted">{goal.progress}%</p>
                </div>
                {(goal as any).assigneeInfo && <p className="text-[12.5px] text-clay-ink">Assigned to: <span className="font-semibold">{((goal as any).assigneeInfo as any).firstName} {((goal as any).assigneeInfo as any).lastName}</span></p>}
            </div>
            <div className="mt-4 flex justify-end gap-2">
                <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Goal?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" size="sm" onClick={onEdit}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
            </div>
        </ClayCard>
    )
}

export default function GoalSettingPage() {
    const [goals, setGoals] = useState<WithId<CrmGoal>[]>([]);
    const [employees, setEmployees] = useState<WithId<CrmEmployee>[]>([]);
    const [isLoading, startTransition] = useTransition();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<WithId<CrmGoal> | null>(null);
    const { toast } = useToast();

    const fetchData = useCallback(() => {
        startTransition(async () => {
            const [goalsData, employeesData] = await Promise.all([
                getCrmGoals(),
                getCrmEmployees()
            ]);
            setGoals(goalsData);
            setEmployees(employeesData);
        });
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleOpenDialog = (goal: WithId<CrmGoal> | null) => {
        setEditingGoal(goal);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        const result = await deleteCrmGoal(id);
        if (result.success) {
            toast({ title: 'Success', description: 'Goal deleted.' });
            fetchData();
        } else {
            toast({ title: 'Error', description: result.error, variant: 'destructive' });
        }
    }

    return (
        <>
            <GoalFormDialog isOpen={isDialogOpen} onOpenChange={setIsDialogOpen} goal={editingGoal} onSave={fetchData} employees={employees} />
            <div className="flex w-full flex-col gap-6">
                <CrmPageHeader
                    title="Goal Setting"
                    subtitle="Set, track, and manage goals for your team and employees."
                    icon={Target}
                    actions={
                        <ClayButton variant="obsidian" leading={<Plus className="h-4 w-4" />} onClick={() => handleOpenDialog(null)}>
                            New Goal
                        </ClayButton>
                    }
                />
                {isLoading && goals.length === 0 ? <p className="text-[13px] text-clay-ink-muted">Loading...</p> : goals.length > 0 ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {goals.map(goal => (
                            <GoalCard
                                key={goal._id.toString()}
                                goal={goal}
                                onEdit={() => handleOpenDialog(goal)}
                                onDelete={() => handleDelete(goal._id.toString())}
                            />
                        ))}
                    </div>
                ) : (
                    <ClayCard variant="outline" className="border-dashed">
                        <div className="flex flex-col items-center gap-3 py-12 text-center">
                            <div className="flex h-12 w-12 items-center justify-center rounded-clay-md bg-clay-rose-soft">
                                <Target className="h-6 w-6 text-clay-rose-ink" strokeWidth={1.75} />
                            </div>
                            <h3 className="text-[15px] font-semibold text-clay-ink">No Goals Yet</h3>
                            <p className="text-[12.5px] text-clay-ink-muted">Create a new goal to get started.</p>
                        </div>
                    </ClayCard>
                )}
            </div>
        </>
    );
}
