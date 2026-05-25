'use client';

import {
  Button,
  Card,
  Input,
  Label,
  Textarea,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  useZoruToast,
} from '@/components/zoruui';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveWsSubTask } from '@/app/actions/worksuite/projects.actions';
import type { WsSubTask } from '@/lib/worksuite/project-types';

const BASE = '/dashboard/crm/projects/subtasks';

function toDateInput(value: unknown): string {
  if (!value) return '';
  const d = new Date(value as string | Date);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? (
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Save className="mr-2 h-4 w-4" />
      )}
      {isEditing ? 'Save changes' : 'Create subtask'}
    </Button>
  );
}

export interface SubtaskFormProps {
  initialData?: WsSubTask & { _id?: string } | null;
}

export function SubtaskForm({ initialData }: SubtaskFormProps) {
  const router = useRouter();
  const { toast } = useZoruToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(saveWsSubTask, {} as any);

  const [status, setStatus] = useState<string>(
    initialData?.status ?? 'incomplete',
  );

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      const id = state.id ?? initialData?._id;
      if (id) router.push(`${BASE}/${id}`);
      else router.push(BASE);
    }
    if (state?.error) {
      toast({
        title: 'Error',
        description: state.error,
        variant: 'destructive',
      });
    }
  }, [state, toast, router, initialData?._id]);

  return (
    <Card className="p-6">
      <form action={formAction} className="flex flex-col gap-6">
        {isEditing ? (
          <input
            type="hidden"
            name="_id"
            value={initialData!._id}
          />
        ) : null}
        <input type="hidden" name="status" value={status} />

        {/* Title */}
        <div className="space-y-1.5">
          <Label htmlFor="title">Title *</Label>
          <Input
            id="title"
            name="title"
            required
            defaultValue={initialData?.title ?? ''}
            placeholder="e.g. Update onboarding email copy"
          />
        </div>

        {/* Parent kind + parent picker */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <EntityFormField
              entity="project"
              name="projectId"
              dualWriteName="projectName"
              initialId={initialData?.projectId ? String(initialData.projectId) : undefined}
              placeholder="Pick a project"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Parent task *</Label>
            <EntityFormField
              entity="task"
              name="taskId"
              initialId={initialData?.taskId ? String(initialData.taskId) : undefined}
              allowCreate
              placeholder="Pick a parent task"
              required
            />
          </div>
        </div>

        {/* Assignee + Due */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Assignee</Label>
            <EntityFormField
              entity="employee"
              name="assignedTo"
              initialId={initialData?.assignedTo ? String(initialData.assignedTo) : undefined}
              dualWriteName="assignedToName"
              placeholder="Pick an assignee"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dueDate">Due date</Label>
            <Input
              id="dueDate"
              name="dueDate"
              type="date"
              defaultValue={toDateInput(initialData?.dueDate)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Dependency</Label>
            <EntityFormField
              entity="subtask"
              name="dependencyId"
              initialId={initialData?.dependencyId ? String(initialData.dependencyId) : undefined}
              placeholder="Pick predecessor subtask"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start date</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInput(initialData?.startDate)}
            />
          </div>
        </div>

        {/* Status */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <ZoruSelectTrigger className="w-full text-sm">
                <ZoruSelectValue placeholder="Select status" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="incomplete">Incomplete</ZoruSelectItem>
                <ZoruSelectItem value="todo">To Do</ZoruSelectItem>
                <ZoruSelectItem value="in-progress">In Progress</ZoruSelectItem>
                <ZoruSelectItem value="review">Review</ZoruSelectItem>
                <ZoruSelectItem value="completed">Completed</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            placeholder="Optional details for the subtask"
            defaultValue={initialData?.description ?? ''}
          />
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" asChild>
            <Link href={BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to subtasks
            </Link>
          </Button>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </Card>
  );
}

export default SubtaskForm;
