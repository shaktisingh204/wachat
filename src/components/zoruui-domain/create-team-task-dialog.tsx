'use client';

import {
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Button,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
} from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createTeamTask } from '@/app/actions/team-tasks.actions';
import { DatePicker } from '../ui/date-picker';

import type { WithId, User } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Task
        </Button>
    );
}

interface CreateTeamTaskDialogProps {
    onTaskCreated: () => void;
    teamMembers: WithId<User>[];
}

export function CreateTeamTaskDialog({ onTaskCreated, teamMembers }: CreateTeamTaskDialogProps) {
    const [open, setOpen] = useState(false);
    const [state, formAction] = useActionState(createTeamTask, initialState);
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);
    const [dueDate, setDueDate] = useState<Date | undefined>();

    useEffect(() => {
        if (state.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            setDueDate(undefined);
            setOpen(false);
            onTaskCreated();
        }
        if (state.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onTaskCreated]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                </Button>
            </ZoruDialogTrigger>
            <ZoruDialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
                <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
                    <input type="hidden" name="dueDate" value={dueDate?.toISOString() || ''} />

                    <ZoruDialogHeader className="px-6 pt-6 pb-2">
                        <ZoruDialogTitle>Create Team Task</ZoruDialogTitle>
                        <ZoruDialogDescription>Assign a new task to a team member.</ZoruDialogDescription>
                    </ZoruDialogHeader>
                    <div className="flex-1 overflow-y-auto px-6 py-2">
                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input id="title" name="title" required placeholder="e.g., Prepare Monthly Report" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Description (Optional)</Label>
                                <Textarea id="description" name="description" placeholder="Add more details..." />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="assignedTo">Assign To</Label>
                                <Select name="assignedTo">
                                    <ZoruSelectTrigger id="assignedTo"><ZoruSelectValue placeholder="Select team member" /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {teamMembers.map(member => (
                                            <ZoruSelectItem key={member._id.toString()} value={member._id.toString()}>
                                                {member.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Due Date</Label>
                                    <DatePicker date={dueDate} setDate={setDueDate} />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="priority">Priority</Label>
                                    <Select name="priority" defaultValue="Medium">
                                        <ZoruSelectTrigger id="priority"><ZoruSelectValue /></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="High">High</ZoruSelectItem>
                                            <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                                            <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}
