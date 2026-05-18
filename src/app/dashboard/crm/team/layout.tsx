'use client';

import {
  ZoruButton,
  ZoruInput,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruSeparator,
  ZoruSkeleton,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
} from '@/components/zoruui';
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
import { useToast } from '@/hooks/use-toast';

import { ClayCard } from '@/components/clay';
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
    <ZoruAlertDialog>
      <ZoruAlertDialogTrigger asChild>
        <ZoruButton variant="destructive" size="sm" disabled={isPending}>
          {isPending ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </ZoruButton>
      </ZoruAlertDialogTrigger>
      <ZoruAlertDialogContent>
        <ZoruAlertDialogHeader>
          <ZoruAlertDialogTitle className="text-foreground">Are you sure?</ZoruAlertDialogTitle>
          <ZoruAlertDialogDescription className="text-muted-foreground">
            This will remove the agent&apos;s access from all of your projects. This action cannot
            be undone.
          </ZoruAlertDialogDescription>
        </ZoruAlertDialogHeader>
        <ZoruAlertDialogFooter>
          <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
          <ZoruAlertDialogAction onClick={handleDelete}>Confirm</ZoruAlertDialogAction>
        </ZoruAlertDialogFooter>
      </ZoruAlertDialogContent>
    </ZoruAlertDialog>
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
        <h2 className="text-[16px] font-semibold text-foreground">Invite a New Team Member</h2>
        <p className="mt-0.5 text-[12.5px] text-muted-foreground">
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
          <ZoruLabel htmlFor="email" className="sr-only">
            Email
          </ZoruLabel>
          <ZoruInput
            id="email"
            name="email"
            type="email"
            placeholder="Enter agent's email"
            required
            className="h-10 rounded-lg border-border bg-card text-[13px]"
          />
        </div>
        <div className="space-y-2">
          <ZoruLabel htmlFor="role" className="sr-only">
            Role
          </ZoruLabel>
          <ZoruSelect name="role" defaultValue="agent">
            <ZoruSelectTrigger
              id="role"
              className="h-10 w-full rounded-lg border-border bg-card text-[13px] sm:w-[180px]"
            >
              <ZoruSelectValue placeholder="ZoruSelect role" />
            </ZoruSelectTrigger>
            <ZoruSelectContent>
              <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
              <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
            </ZoruSelectContent>
          </ZoruSelect>
        </div>
        <ZoruButton
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
        </ZoruButton>
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
    <EntityListShell
      title="Manage Team"
      subtitle="Invite and manage users for your account."
    >

      <InviteAgentForm onAgentInvited={fetchData} />
      <ZoruSeparator className="bg-border" />

      <ClayCard>
        <div className="mb-4">
          <h2 className="text-[16px] font-semibold text-foreground">Team Members</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            A list of all users in your team.
          </p>
        </div>
        <div className="space-y-3">
          {isLoading ? (
            <>
              <ZoruSkeleton className="h-16 w-full rounded-lg" />
              <ZoruSkeleton className="h-16 w-full rounded-lg" />
            </>
          ) : teamMembers.length > 0 ? (
            teamMembers.map((agent: any) => (
              <div
                key={agent._id.toString()}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-secondary p-4"
              >
                <div className="flex items-center gap-4">
                  <ZoruAvatar className="border border-border">
                    <ZoruAvatarImage
                      src={`https://i.pravatar.cc/150?u=${agent.email}`}
                      alt={agent.name}
                    />
                    <ZoruAvatarFallback className="bg-accent text-[12px] text-accent-foreground">
                      {agent.name.substring(0, 2).toUpperCase()}
                    </ZoruAvatarFallback>
                  </ZoruAvatar>
                  <div className="space-y-0.5">
                    <p className="text-[13px] font-medium leading-none text-foreground">
                      {agent.name}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">{agent.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-[12.5px] text-muted-foreground">
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
            <p className="py-8 text-center text-[13px] text-muted-foreground">
              No team members have been invited yet.
            </p>
          )}
        </div>
      </ClayCard>
    </EntityListShell>
  );
}
