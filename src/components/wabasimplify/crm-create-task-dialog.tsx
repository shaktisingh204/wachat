'use client';

import {
  Button,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogTrigger,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Textarea,
  DatePicker,
  useZoruToast,
} from '@/components/zoruui';
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
    <ZoruButton type="submit" disabled={pending}>
      {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
      Create Task
    </ZoruButton>
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
  const { toast } = useZoruToast();
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
          <input type="hidden" name="dueDate" value={dueDate?.toISOString()} />
          {contactId && <input type="hidden" name="contactId" value={contactId} />}
          {dealId && <input type="hidden" name="dealId" value={dealId} />}

          <ZoruDialogHeader className="px-6 pt-6 pb-2">
            <ZoruDialogTitle className="text-zoru-ink">Create New Task</ZoruDialogTitle>
            <ZoruDialogDescription className="text-zoru-ink-muted">Add a new to-do item for your team.</ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-2">
            <div className="grid gap-4">
              <div className="space-y-2">
                <ZoruLabel htmlFor="title" className="text-zoru-ink">Title</ZoruLabel>
                <ZoruInput id="title" name="title" required placeholder="e.g., Follow up with Acme Corp" />
              </div>
              <div className="space-y-2">
                <ZoruLabel htmlFor="description" className="text-zoru-ink">Description (Optional)</ZoruLabel>
                <ZoruTextarea id="description" name="description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <ZoruLabel className="text-zoru-ink">Due Date</ZoruLabel>
                  <ZoruDatePicker value={dueDate} onChange={setDueDate} />
                </div>
                <div className="space-y-2">
                  <ZoruLabel htmlFor="priority" className="text-zoru-ink">Priority</ZoruLabel>
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
              <div className="space-y-2">
                <ZoruLabel htmlFor="type" className="text-zoru-ink">Task Type</ZoruLabel>
                <ZoruSelect name="type" defaultValue="Follow-up">
                  <ZoruSelectTrigger id="type"><ZoruSelectValue /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="Follow-up">Follow-up</ZoruSelectItem>
                    <ZoruSelectItem value="Call">Call</ZoruSelectItem>
                    <ZoruSelectItem value="Meeting">Meeting</ZoruSelectItem>
                    <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                    <ZoruSelectItem value="WhatsApp">WhatsApp</ZoruSelectItem>
                  </ZoruSelectContent>
                </ZoruSelect>
              </div>
            </div>
          </div>
          <ZoruDialogFooter className="px-6 pb-6 pt-2">
            <ZoruButton type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</ZoruButton>
            <SubmitButton />
          </ZoruDialogFooter>
        </form>
      </ZoruDialogContent>
    </ZoruDialog>
  );
}
