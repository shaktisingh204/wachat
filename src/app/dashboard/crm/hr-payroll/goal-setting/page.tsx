
'use client';

import { useState, useEffect, useCallback, useTransition, useActionState, useRef } from 'react';
import type { WithId } from 'mongodb';
import { getCrmGoals, saveCrmGoal, deleteCrmGoal } from '@/app/actions/crm-hr.actions';
import { getCrmEmployees } from '@/app/actions/crm-employees.actions';
import type { CrmGoal, CrmEmployee } from '@/lib/definitions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const saveInitialState = { message: null, error: null };

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
          <div className="py-4 space-y-4">
            <div className="space-y-2"><Label>Title *</Label><Input name="title" defaultValue={goal?.title} required /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea name="description" defaultValue={goal?.description} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Assign To (Optional)</Label><Select name="assigneeId" defaultValue={goal?.assigneeId?.toString()}><SelectTrigger><SelectValue placeholder="Select Employee..."/></SelectTrigger><SelectContent>{employees.map(e => <SelectItem key={e._id.toString()} value={e._id.toString()}>{e.firstName} {e.lastName}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Target Date *</Label><DatePicker date={targetDate} setDate={setTargetDate} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Status</Label><Select name="status" defaultValue={goal?.status || 'Not Started'}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Not Started">Not Started</SelectItem><SelectItem value="In Progress">In Progress</SelectItem><SelectItem value="Completed">Completed</SelectItem><SelectItem value="On Hold">On Hold</SelectItem><SelectItem value="Cancelled">Cancelled</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Progress (%)</Label><Input name="progress" type="number" min="0" max="100" defaultValue={goal?.progress || 0}/></div>
            </div>
          </div>
          <DialogFooter><Button variant="ghost" type="button" onClick={() => onOpenChange(false)}>Cancel</Button><SubmitButton isEditing={isEditing} /></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function GoalCard({ goal, onEdit, onDelete }: { goal: WithId<CrmGoal>, onEdit: () => void, onDelete: () => void }) {
    const statusVariant: { [key: string]: 'default' | 'secondary' | 'destructive' | 'outline' } = {
        'Not Started': 'outline', 'In Progress': 'secondary', 'Completed': 'default', 'On Hold': 'outline', 'Cancelled': 'destructive'
    };
    return (
        <Card className="flex flex-col">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-base">{goal.title}</CardTitle>
                     <Badge variant={statusVariant[goal.status]}>{goal.status}</Badge>
                </div>
                <CardDescription>Target Date: {format(new Date(goal.targetDate), 'PPP')}</CardDescription>
            </CardHeader>
             <CardContent className="flex-grow space-y-3">
                <p className="text-sm text-muted-foreground line-clamp-3">{goal.description}</p>
                <div className="space-y-1">
                    <Label className="text-xs">Progress</Label>
                    <Progress value={goal.progress} />
                    <p className="text-xs text-right">{goal.progress}%</p>
                </div>
                 {goal.assigneeInfo && <p className="text-xs">Assigned to: <span className="font-semibold">{(goal.assigneeInfo as any).firstName} {(goal.assigneeInfo as any).lastName}</span></p>}
             </CardContent>
             <CardFooter className="flex justify-end gap-2">
                 <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button></AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Goal?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                <Button variant="outline" size="sm" onClick={onEdit}><Edit className="mr-2 h-4 w-4"/>Edit</Button>
            </CardFooter>
        </Card>
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
            <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold font-headline flex items-center gap-3"><Target className="h-8 w-8"/> Goal Setting</h1>
                        <p className="text-muted-foreground">Set, track, and manage goals for your team and employees.</p>
                    </div>
                     <Button onClick={() => handleOpenDialog(null)}><Plus className="mr-2 h-4 w-4"/> New Goal</Button>
                </div>
                 {isLoading && goals.length === 0 ? <p>Loading...</p> : goals.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                    <Card className="text-center py-20">
                        <CardHeader><CardTitle>No Goals Yet</CardTitle><CardDescription>Create a new goal to get started.</CardDescription></CardHeader>
                    </Card>
                )}
            </div>
        </>
    );
}
