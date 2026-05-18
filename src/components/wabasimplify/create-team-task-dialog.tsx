'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
    ZoruDialog,
    ZoruDialogContent,
    ZoruDialogDescription,
    ZoruDialogFooter,
    ZoruDialogHeader,
    ZoruDialogTitle,
    ZoruDialogTrigger,
} from '@/components/zoruui';
import { ZoruButton } from '@/components/zoruui';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createTeamTask } from '@/app/actions/team-tasks.actions';
import { ZoruSelect, ZoruSelectContent, ZoruSelectItem, ZoruSelectTrigger, ZoruSelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { ZoruTextarea } from '../ui/textarea';
import type { WithId, User } from '@/lib/definitions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <ZoruButton type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
            Create Task
        </ZoruButton>
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
        <ZoruDialog open={open} onOpenChange={setOpen}>
            <ZoruDialogTrigger asChild>
                <ZoruButton>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Task
                </ZoruButton>
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
                                <ZoruLabel htmlFor="title">Title</ZoruLabel>
                                <ZoruInput id="title" name="title" required placeholder="e.g., Prepare Monthly Report" />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="description">Description (Optional)</ZoruLabel>
                                <ZoruTextarea id="description" name="description" placeholder="Add more details..." />
                            </div>
                            <div className="space-y-2">
                                <ZoruLabel htmlFor="assignedTo">Assign To</ZoruLabel>
                                <ZoruSelect name="assignedTo">
                                    <ZoruSelectTrigger id="assignedTo"><ZoruSelectValue placeholder="ZoruSelect team member" /></ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        {teamMembers.map(member => (
                                            <ZoruSelectItem key={member._id.toString()} value={member._id.toString()}>
                                                {member.name}
                                            </ZoruSelectItem>
                                        ))}
                                    </ZoruSelectContent>
                                </ZoruSelect>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <ZoruLabel>Due Date</ZoruLabel>
                                    <DatePicker date={dueDate} setDate={setDueDate} />
                                </div>
                                <div className="space-y-2">
                                    <ZoruLabel htmlFor="priority">Priority</ZoruLabel>
                                    <ZoruSelect name="priority" defaultValue="Medium">
                                        <ZoruSelectTrigger id="priority"><ZoruSelectValue /></ZoruSelectTrigger>
                                        <ZoruSelectContent>
                                            <ZoruSelectItem value="High">High</ZoruSelectItem>
                                            <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                                            <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                                        </ZoruSelectContent>
                                    </ZoruSelect>
                                </div>
                            </div>
                        </div>
                    </div>
                    <ZoruDialogFooter className="px-6 pb-6 pt-2">
                        <ZoruButton type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</ZoruButton>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </ZoruDialog>
    );
}
