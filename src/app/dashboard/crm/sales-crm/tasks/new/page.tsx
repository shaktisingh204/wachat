'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, Save, LoaderCircle, CheckSquare } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTextarea,
  useZoruToast,
} from '@/components/zoruui';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import { createCrmTask } from '@/app/actions/crm-tasks.actions';

export const dynamic = 'force-dynamic';

const initialState: { message?: string; error?: string } = {};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <ZoruButton type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      Save task
    </ZoruButton>
  );
}

export default function NewTaskPage() {
  const [state, formAction] = useActionState(createCrmTask, initialState);
  const router = useRouter();
  const { toast } = useZoruToast();

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Task created', description: state.message });
      router.push('/dashboard/crm/sales-crm/tasks');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="New Task"
        subtitle="Create a follow-up, call, or activity task."
        icon={CheckSquare}
        actions={
          <ZoruButton variant="ghost" asChild className="text-zoru-ink-muted hover:text-zoru-ink">
            <Link href="/dashboard/crm/sales-crm/tasks">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </ZoruButton>
        }
      />

      <ZoruCard className="p-6">
        <form action={formAction} className="flex flex-col gap-6">
          {/* Row 1: Title */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="title">Task Title *</ZoruLabel>
            <ZoruInput id="title" name="title" placeholder="e.g. Follow up with Priya" required />
          </div>

          {/* Row 2: Type + Priority */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="type">Type</ZoruLabel>
              <ZoruSelect name="type" defaultValue="Follow-up">
                <ZoruSelectTrigger id="type">
                  <ZoruSelectValue placeholder="Select type" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="Call">Call</ZoruSelectItem>
                  <ZoruSelectItem value="Email">Email</ZoruSelectItem>
                  <ZoruSelectItem value="Meeting">Meeting</ZoruSelectItem>
                  <ZoruSelectItem value="Follow-up">Follow-up</ZoruSelectItem>
                  <ZoruSelectItem value="Demo">Demo</ZoruSelectItem>
                  <ZoruSelectItem value="Other">Other</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="priority">Priority</ZoruLabel>
              <ZoruSelect name="priority" defaultValue="Medium">
                <ZoruSelectTrigger id="priority">
                  <ZoruSelectValue placeholder="Select priority" />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  <ZoruSelectItem value="Low">Low</ZoruSelectItem>
                  <ZoruSelectItem value="Medium">Medium</ZoruSelectItem>
                  <ZoruSelectItem value="High">High</ZoruSelectItem>
                </ZoruSelectContent>
              </ZoruSelect>
            </div>
          </div>

          {/* Row 3: Due Date */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <ZoruLabel htmlFor="dueDate">Due Date</ZoruLabel>
              <ZoruInput id="dueDate" name="dueDate" type="datetime-local" />
            </div>
          </div>

          {/* Row 4: Description */}
          <div className="space-y-1.5">
            <ZoruLabel htmlFor="description">Description</ZoruLabel>
            <ZoruTextarea
              id="description"
              name="description"
              placeholder="Notes or details about this task"
              rows={3}
            />
          </div>

          <div className="flex justify-end">
            <SubmitButton />
          </div>
        </form>
      </ZoruCard>
    </div>
  );
}
