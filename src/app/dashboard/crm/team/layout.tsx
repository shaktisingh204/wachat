'use client';

import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import { Plus, Trash2, LoaderCircle, Users } from 'lucide-react';

import type { WithId, User } from '@/lib/definitions';
import {
  handleInviteAgent,
  handleRemoveAgent,
  getInvitedUsers,
} from '@/app/actions/team.actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import { ClayCard, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';

const removeAgentInitialState: any = { message: null, error: null };
const inviteAgentInitialState: any = { message: null, error: null };

function RemoveAgentButton({
  agentId,
  onAgentRemoved,
}: {
  agentId: string;
  onAgentRemoved: () => void;
}) {
  const [state, formAction] = useActionState(handleRemoveAgent, removeAgentInitialState);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    startTransition(() => {
      const formData = new FormData();
      formData.append('agentUserId', agentId);
      formAction(formData);
    });
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      onAgentRemoved();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onAgentRemoved]);

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-clay-ink">Are you sure?</AlertDialogTitle>
          <AlertDialogDescription className="text-clay-ink-muted">
            This will remove the agent&apos;s access from all of your projects. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function InviteAgentForm({ onAgentInvited }: { onAgentInvited: () => void }) {
  const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const handleFormSubmit = (formData: FormData) => {
    startTransition(() => {
      formAction(formData);
    });
  };

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Success!', description: state.message });
      formRef.current?.reset();
      onAgentInvited();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onAgentInvited]);

  return (
    <ClayCard variant="outline" className="border-dashed">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-clay-ink">Invite a New Team Member</h2>
        <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
          Assign a role to the new user. They must have an existing SabNode account. This will
          grant them access to all your current and future projects with the selected role.
        </p>
      </div>
      <form
        action={handleFormSubmit}
        ref={formRef}
        className="flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-grow space-y-2">
          <Label htmlFor="email" className="sr-only">
            Email
          </Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="Enter agent's email"
            required
            className="h-10 rounded-clay-md border-clay-border bg-clay-surface text-[13px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role" className="sr-only">
            Role
          </Label>
          <Select name="role" defaultValue="agent">
            <SelectTrigger
              id="role"
              className="h-10 w-full rounded-clay-md border-clay-border bg-clay-surface text-[13px] sm:w-[180px]"
            >
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ClayButton
          type="submit"
          variant="obsidian"
          disabled={isPending}
          leading={
            isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Plus className="h-4 w-4" strokeWidth={1.75} />
            )
          }
        >
          Invite Agent
        </ClayButton>
      </form>
    </ClayCard>
  );
}

export default function ManageUsersPage() {
  const [teamMembers, setTeamMembers] = useState<
    WithId<User & { roles: Record<string, string> }>[]
  >([]);
  const [isLoading, startTransition] = useTransition();

  const fetchData = () => {
    startTransition(async () => {
      const users = await getInvitedUsers();
      setTeamMembers(users);
    });
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Manage Team"
        subtitle="Invite and manage users for your account."
        icon={Users}
      />

      <InviteAgentForm onAgentInvited={fetchData} />
      <Separator className="bg-clay-border" />

      <ClayCard>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-clay-ink">Team Members</h2>
          <p className="mt-0.5 text-[12.5px] text-clay-ink-muted">
            A list of all users in your team.
          </p>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-clay-md" />
              <Skeleton className="h-16 w-full rounded-clay-md" />
            </>
          ) : teamMembers.length > 0 ? (
            teamMembers.map((agent: any) => (
              <div
                key={agent._id.toString()}
                className="flex items-center justify-between gap-4 rounded-clay-md border border-clay-border bg-clay-surface-2 p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="border border-clay-border">
                    <AvatarImage
                      src={`https://i.pravatar.cc/150?u=${agent.email}`}
                      alt={agent.name}
                    />
                    <AvatarFallback className="bg-clay-rose-soft text-[12px] text-clay-rose-ink">
                      {agent.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium leading-none text-clay-ink">
                      {agent.name}
                    </p>
                    <p className="text-[12.5px] text-clay-ink-muted">{agent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[12.5px] text-clay-ink-muted">
                    {agent.roles && Object.keys(agent.roles).length > 0
                      ? `Role: ${Object.values(agent.roles)[0]}`
                      : 'No specific project roles'}
                  </div>
                  <RemoveAgentButton
                    agentId={agent._id.toString()}
                    onAgentRemoved={fetchData}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-[13px] text-clay-ink-muted">
              No team members have been invited yet.
            </p>
          )}
        </div>
      </ClayCard>
    </div>
  );
}
