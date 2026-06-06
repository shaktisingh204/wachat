'use client';

import { Button, Input, Avatar, AvatarFallback, AvatarImage, Separator, Skeleton, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, Card, useToast } from '@/components/sabcrm/20ui';
import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import { Plus,
  Trash2,
  LoaderCircle } from 'lucide-react';

import type { WithId,
  User } from '@/lib/definitions';
import {
  handleInviteAgent,
  handleRemoveAgent,
  getInvitedUsers,
  } from '@/app/actions/team.actions';

import { EntityListShell } from '@/components/crm/entity-list-shell';

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
          <AlertDialogTitle className="text-[var(--st-text)]">Are you sure?</AlertDialogTitle>
          <AlertDialogDescription className="text-[var(--st-text-secondary)]">
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
    <Card className="border-dashed p-6">
      <div className="mb-4">
        <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Invite a New Team Member</h2>
        <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
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
            className="h-10 rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role" className="sr-only">
            Role
          </Label>
          <Select name="role" defaultValue="agent">
            <SelectTrigger
              id="role"
              className="h-10 w-full rounded-lg border-[var(--st-border)] bg-[var(--st-bg-secondary)] text-[13px] sm:w-[180px]"
            >
              <SelectValue placeholder="Select role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="agent">Agent</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
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
        </Button>
      </form>
    </Card>
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
    <EntityListShell
      title="Manage Team"
      subtitle="Invite and manage users for your account."
    >

      <InviteAgentForm onAgentInvited={fetchData} />
      <Separator className="bg-[var(--st-border)]" />

      <Card className="p-6">
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-[var(--st-text)]">Team Members</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--st-text-secondary)]">
            A list of all users in your team.
          </p>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-full rounded-lg" />
              <Skeleton className="h-16 w-full rounded-lg" />
            </>
          ) : teamMembers.length > 0 ? (
            teamMembers.map((agent: any) => (
              <div
                key={agent._id.toString()}
                className="flex items-center justify-between gap-4 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="border border-[var(--st-border)]">
                    <AvatarImage
                      src={`https://i.pravatar.cc/150?u=${agent.email}`}
                      alt={agent.name}
                    />
                    <AvatarFallback className="bg-[var(--st-bg-muted)] text-[12px] text-[var(--st-text)]">
                      {agent.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium leading-none text-[var(--st-text)]">
                      {agent.name}
                    </p>
                    <p className="text-[12.5px] text-[var(--st-text-secondary)]">{agent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[12.5px] text-[var(--st-text-secondary)]">
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
            <p className="py-8 text-center text-[13px] text-[var(--st-text-secondary)]">
              No team members have been invited yet.
            </p>
          )}
        </div>
      </Card>
    </EntityListShell>
  );
}
