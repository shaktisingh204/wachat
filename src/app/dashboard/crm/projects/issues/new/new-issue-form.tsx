'use client';

import { Button, Input, Label, Textarea, Select } from '@/components/zoruui';
import { useRouter } from 'next/navigation';
import { useActionState,
  useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

import { ClayCard } from '@/components/clay';

import { useToast } from '@/hooks/use-toast';
import { saveWsIssue } from '@/app/actions/worksuite/projects.actions';
import { EntityFormField } from '@/components/crm/entity-form-field';
import { EnumFormField } from '@/components/crm/enum-form-field';

/** Controlled form to create a new issue using the existing saveWsIssue action. */
export function NewIssueForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [state, action, isPending] = useActionState(saveWsIssue, {
    message: '',
    error: '',
  } as any);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Saved', description: state.message });
      router.push('/dashboard/crm/projects/issues');
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, router]);

  return (
    <ClayCard>
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="title" className="text-foreground">
            Title <span className="text-destructive">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            required
            className="h-10 rounded-lg border-border bg-card text-[13px]"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-foreground">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            className="rounded-lg border-border bg-card text-[13px]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="projectId" className="text-foreground">
              Project
            </Label>
            <EntityFormField
              entity="project"
              name="projectId"
              placeholder="Select project (optional)"
            />
          </div>
          <div>
            <Label className="text-foreground">Status</Label>
            <EnumFormField
              enumName="issueStatus"
              name="status"
              initialId="open"
              placeholder="Status"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label className="text-foreground">Priority</Label>
            <EnumFormField
              enumName="priorityMedium"
              name="priority"
              initialId="medium"
              placeholder="Priority"
            />
          </div>
          <div>
            <Label htmlFor="assigneeId" className="text-foreground">
              Assignee
            </Label>
            <EntityFormField
              entity="employee"
              name="assigneeId"
              dualWriteName="assigneeName"
              placeholder="Select assignee"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reporterId" className="text-foreground">
            Reporter
          </Label>
          <EntityFormField
            entity="user"
            name="reporterId"
            dualWriteName="reporterName"
            placeholder="Select reporter"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="pill"
            onClick={() => router.push('/dashboard/crm/projects/issues')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="obsidian"
            disabled={isPending}
            leading={
              isPending ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : null
            }
          >
            Save
          </Button>
        </div>
      </form>
    </ClayCard>
  );
}
