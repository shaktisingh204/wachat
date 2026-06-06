'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Textarea,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useFormStatus } from 'react-dom';
import { LoaderCircle,
  Plus } from 'lucide-react';

/**
 * <LeadsAddTaskDialog> — small inline dialog for the lead detail page's
 * "Add Task" quick-action button.
 *
 * Captures title · due date · assignee, then submits to the existing
 * `createCrmTask` FormData action with `linkedKind='lead'`. After save,
 * fires the supplied `onCreated` callback so the right-rail counts can
 * refresh.
 */

import * as React from 'react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';
import { createCrmTask } from '@/app/actions/crm-tasks.actions';

interface LeadsAddTaskDialogProps {
    leadId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: () => void;
}

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
                <Plus className="h-4 w-4" />
            )}
            Create Task
        </Button>
    );
}

export function LeadsAddTaskDialog({
    leadId,
    open,
    onOpenChange,
    onCreated,
}: LeadsAddTaskDialogProps) {
    const { toast } = useZoruToast();
    const formRef = React.useRef<HTMLFormElement>(null);
    const [isPending, startTransition] = React.useTransition();

    const submitForm = React.useCallback(
        (formData: FormData) => {
            startTransition(async () => {
                const res = await createCrmTask(null, formData);
                if (res.error) {
                    toast({
                        title: 'Could not create task',
                        description: res.error,
                        variant: 'destructive',
                    });
                    return;
                }
                toast({ title: 'Task created' });
                formRef.current?.reset();
                onCreated?.();
                onOpenChange(false);
            });
        },
        [onCreated, onOpenChange, toast],
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <ZoruDialogContent className="sm:max-w-md">
                <ZoruDialogHeader>
                    <ZoruDialogTitle>Add task for this lead</ZoruDialogTitle>
                    <ZoruDialogDescription>
                        The task will be linked to this lead and surface on the right rail.
                    </ZoruDialogDescription>
                </ZoruDialogHeader>
                <form
                    ref={formRef}
                    action={submitForm}
                    className="flex flex-col gap-3"
                >
                    <input type="hidden" name="linkedKind" value="lead" />
                    <input type="hidden" name="linkedId" value={leadId} />

                    <div className="space-y-1">
                        <Label htmlFor="leadTaskTitle">Title</Label>
                        <Input
                            id="leadTaskTitle"
                            name="title"
                            required
                            placeholder="Follow up on demo…"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label htmlFor="leadTaskDescription">Description</Label>
                        <Textarea
                            id="leadTaskDescription"
                            name="description"
                            rows={2}
                            placeholder="Optional details…"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label htmlFor="leadTaskDue">Due date</Label>
                            <Input
                                id="leadTaskDue"
                                type="date"
                                name="dueDate"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Priority</Label>
                            <EnumFormField
                                enumName="priorityLegacy"
                                name="priority"
                                initialId="Medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label>Assign to</Label>
                        <EntityFormField
                            entity="user"
                            name="assignedTo"
                            placeholder="Defaults to me"
                        />
                    </div>

                    <ZoruDialogFooter className="pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={isPending}
                        >
                            Cancel
                        </Button>
                        <SubmitButton />
                    </ZoruDialogFooter>
                </form>
            </ZoruDialogContent>
        </Dialog>
    );
}

export default LeadsAddTaskDialog;
