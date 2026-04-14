'use client';

import { useRouter } from 'next/navigation';
import { useActionState, useEffect } from 'react';
import { LoaderCircle } from 'lucide-react';

import { ClayCard, ClayButton } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { saveWsIssue } from '@/app/actions/worksuite/projects.actions';

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
          <Label htmlFor="title" className="text-clay-ink">
            Title <span className="text-clay-red">*</span>
          </Label>
          <Input
            id="title"
            name="title"
            required
            className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
        </div>

        <div>
          <Label htmlFor="description" className="text-clay-ink">
            Description
          </Label>
          <Textarea
            id="description"
            name="description"
            rows={4}
            className="rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="projectId" className="text-clay-ink">
              Project ID
            </Label>
            <Input
              id="projectId"
              name="projectId"
              placeholder="optional"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
          <div>
            <Label htmlFor="status" className="text-clay-ink">
              Status
            </Label>
            <Select name="status" defaultValue="open">
              <SelectTrigger
                id="status"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="priority" className="text-clay-ink">
              Priority
            </Label>
            <Select name="priority" defaultValue="medium">
              <SelectTrigger
                id="priority"
                className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="assigneeName" className="text-clay-ink">
              Assignee
            </Label>
            <Input
              id="assigneeName"
              name="assigneeName"
              className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="reporterName" className="text-clay-ink">
            Reporter
          </Label>
          <Input
            id="reporterName"
            name="reporterName"
            className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <ClayButton
            type="button"
            variant="pill"
            onClick={() => router.push('/dashboard/crm/projects/issues')}
          >
            Cancel
          </ClayButton>
          <ClayButton
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
          </ClayButton>
        </div>
      </form>
    </ClayCard>
  );
}
