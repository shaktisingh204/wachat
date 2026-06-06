'use client';

import { Button, Card, Input, Label, Textarea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, useToast } from '@/components/sabcrm/20ui/compat';
import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react';

import { EntityFormField } from '@/components/crm/entity-form-field';
import { saveWsProjectMilestone } from '@/app/actions/worksuite/projects.actions';
import type { WsProjectMilestone } from '@/lib/worksuite/project-types';

const BASE = '/dashboard/crm/projects/milestones';

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
      {isEditing ? 'Save changes' : 'Create milestone'}
    </Button>
  );
}

export interface MilestoneFormProps {
  initialData?: WsProjectMilestone & { _id?: string } | null;
}

export function MilestoneForm({ initialData }: MilestoneFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEditing = !!initialData?._id;

  const [state, formAction] = useActionState(saveWsProjectMilestone, {} as any);

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

        {/* Name */}
        <div className="space-y-1.5">
          <Label htmlFor="milestoneTitle">Name *</Label>
          <Input
            id="milestoneTitle"
            name="milestoneTitle"
            required
            defaultValue={initialData?.milestoneTitle ?? ''}
            placeholder="e.g. Beta launch"
          />
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <Label htmlFor="summary">Description</Label>
          <Textarea
            id="summary"
            name="summary"
            rows={3}
            defaultValue={initialData?.summary ?? ''}
            placeholder="What does reaching this milestone mean?"
          />
        </div>

        {/* Project Selector */}
        <div className="space-y-1.5">
          <Label>Project *</Label>
          <EntityFormField
            entity="project"
            name="projectId"
            dualWriteName="projectName"
            initialId={initialData?.projectId ? String(initialData.projectId) : undefined}
            placeholder="Pick a project"
            required
          />
        </div>

        {/* Cost + Currency */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cost">Cost / payment</Label>
            <Input
              id="cost"
              name="cost"
              type="number"
              step="0.01"
              defaultValue={initialData?.cost ? String(initialData.cost) : ''}
              placeholder="e.g. 50000"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="currency">Currency</Label>
            <Input
              id="currency"
              name="currency"
              defaultValue={initialData?.currency ?? 'INR'}
            />
          </div>
        </div>

        {/* Status + Dates */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full text-sm">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="incomplete">Incomplete</SelectItem>
                <SelectItem value="complete">Complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInput(initialData?.startDate)}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="endDate">Target / End Date</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={toDateInput(initialData?.endDate)}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
          <Button variant="ghost" asChild>
            <Link href={BASE}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to milestones
            </Link>
          </Button>
          <SubmitButton isEditing={isEditing} />
        </div>
      </form>
    </Card>
  );
}

export default MilestoneForm;
