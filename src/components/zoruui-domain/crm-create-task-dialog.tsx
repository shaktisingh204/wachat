'use client';

import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea, DatePicker, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useActionState,
  useEffect,
  useRef,
  useState } from 'react';
import { useFormStatus } from 'react-dom';

import { LoaderCircle, Plus } from 'lucide-react';
import { createCrmTask } from '@/app/actions/crm-tasks.actions';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Create Task
    </Button>
  );
}

interface CrmCreateTaskDialogProps {
  onTaskCreated: () => void;
  contactId?: string;
  dealId?: string;
}

export function CreateTaskDialog({ onTaskCreated, contactId, dealId }: CrmCreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCrmTask, initialState);
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
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Task
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden p-0">
        <form action={formAction} ref={formRef} className="flex h-full flex-col overflow-hidden">
          <input type="hidden" name="dueDate" value={dueDate?.toISOString()} />
          {contactId && <input type="hidden" name="contactId" value={contactId} />}
          {dealId && <input type="hidden" name="dealId" value={dealId} />}

          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-[var(--st-text)]">Create New Task</DialogTitle>
            <DialogDescription className="text-[var(--st-text-secondary)]">Add a new to-do item for your team.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-[var(--st-text)]">Title</Label>
                <Input id="title" name="title" required placeholder="e.g., Follow up with Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-[var(--st-text)]">Description (Optional)</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[var(--st-text)]">Due Date</Label>
                  <DatePicker value={dueDate} onChange={setDueDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-[var(--st-text)]">Priority</Label>
                  <Select name="priority" defaultValue="Medium">
                    <SelectTrigger id="priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="High">High</SelectItem>
                      <SelectItem value="Medium">Medium</SelectItem>
                      <SelectItem value="Low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="text-[var(--st-text)]">Task Type</Label>
                <Select name="type" defaultValue="Follow-up">
                  <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Follow-up">Follow-up</SelectItem>
                    <SelectItem value="Call">Call</SelectItem>
                    <SelectItem value="Meeting">Meeting</SelectItem>
                    <SelectItem value="Email">Email</SelectItem>
                    <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 pb-6 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
