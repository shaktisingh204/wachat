import { ZoruButton, ZoruButton } from '@/components/zoruui';
'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

import { ClayCard } from '@/components/clay';
import { ZoruInput } from '@/components/zoruui';
import { ZoruLabel } from '@/components/zoruui';
import { ZoruTextarea } from '@/components/zoruui';
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
          <ZoruLabel htmlFor="title" className="text-foreground">
            Title <span className="text-destructive">*</span>
          </ZoruLabel>
          <ZoruInput
            id="title"
            name="title"
            required
            className="h-10 rounded-lg border-border bg-card text-[13px]"
          />
        </div>

        <div>
          <ZoruLabel htmlFor="description" className="text-foreground">
            Description
          </ZoruLabel>
          <ZoruTextarea
            id="description"
            name="description"
            rows={4}
            className="rounded-lg border-border bg-card text-[13px]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <ZoruLabel htmlFor="projectId" className="text-foreground">
              Project
            </ZoruLabel>
            <EntityFormField
              entity="project"
              name="projectId"
              placeholder="ZoruSelect project (optional)"
            />
          </div>
          <div>
            <ZoruLabel className="text-foreground">Status</ZoruLabel>
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
            <ZoruLabel className="text-foreground">Priority</ZoruLabel>
            <EnumFormField
              enumName="priorityMedium"
              name="priority"
              initialId="medium"
              placeholder="Priority"
            />
          </div>
          <div>
            <ZoruLabel htmlFor="assigneeId" className="text-foreground">
              Assignee
            </ZoruLabel>
            <EntityFormField
              entity="employee"
              name="assigneeId"
              dualWriteName="assigneeName"
              placeholder="ZoruSelect assignee"
            />
          </div>
        </div>

        <div>
          <ZoruLabel htmlFor="reporterId" className="text-foreground">
            Reporter
          </ZoruLabel>
          <EntityFormField
            entity="user"
            name="reporterId"
            dualWriteName="reporterName"
            placeholder="ZoruSelect reporter"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ZoruButton
            type="button"
            variant="pill"
            onClick={() => router.push('/dashboard/crm/projects/issues')}
          >
            Cancel
          </ZoruButton>
          <ZoruButton
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
          </ZoruButton>
        </div>
      </form>
    </ClayCard>
  );
}
