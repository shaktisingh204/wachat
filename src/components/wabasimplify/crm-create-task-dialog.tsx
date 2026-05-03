

'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoaderCircle, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createCrmTask } from '@/app/actions/crm-tasks.actions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { DatePicker } from '../ui/date-picker';
import { Textarea } from '../ui/textarea';
import { ClayButton } from '@/components/clay';

const initialState = { message: undefined, error: undefined };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ClayButton
      type="submit"
      variant="obsidian"
      disabled={pending}
      leading={pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : undefined}
    >
      Create Task
    </ClayButton>
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
            <DialogTitle className="text-foreground">Create New Task</DialogTitle>
            <DialogDescription className="text-muted-foreground">Add a new to-do item for your team.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-foreground">Title</Label>
                <Input id="title" name="title" required placeholder="e.g., Follow up with Acme Corp" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description" className="text-foreground">Description (Optional)</Label>
                <Textarea id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Due Date</Label>
                  <DatePicker date={dueDate} setDate={setDueDate} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="text-foreground">Priority</Label>
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
                <Label htmlFor="type" className="text-foreground">Task Type</Label>
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
            <ClayButton type="button" variant="pill" onClick={() => setOpen(false)}>Cancel</ClayButton>
            <SubmitButton />
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
