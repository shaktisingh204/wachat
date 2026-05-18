'use client';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruAlertDialogTrigger,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruButton,
  ZoruCard,
  ZoruInput,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSeparator,
  ZoruSkeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useRef,
  useActionState,
  useTransition } from 'react';
import type { WithId,
  User } from '@/lib/definitions';
import { handleInviteAgent,
  handleRemoveAgent,
  getInvitedUsers } from '@/app/actions/team.actions';
import { Plus,
  Trash2,
  LoaderCircle } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

const removeAgentInitialState: any = { message: null, error: null };
const inviteAgentInitialState: any = { message: null, error: null };

function RemoveAgentButton({ agentId, onAgentRemoved }: { agentId: string, onAgentRemoved: () => void }) {
    const [state, formAction] = useActionState(handleRemoveAgent, removeAgentInitialState);
    const { toast } = useZoruToast();
    const [isPending, startTransition] = useTransition();

    const handleDelete = (e: React.MouseEvent) => {
        e.preventDefault();
        startTransition(() => {
            const formData = new FormData();
            formData.append('agentUserId', agentId);
            formAction(formData);
        });
    }

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
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                </ZoruButton>
            </ZoruAlertDialogTrigger>
            <ZoruAlertDialogContent>
                <ZoruAlertDialogHeader>
                    <ZoruAlertDialogTitle>Are you sure?</ZoruAlertDialogTitle>
                    <ZoruAlertDialogDescription>
                        This will remove the agent&apos;s access from all of your projects. This action cannot be undone.
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
    const { toast } = useZoruToast();
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
        <ZoruCard className="border-dashed p-6">
            <div className="mb-4">
                <h2 className="text-[16px] font-semibold text-zoru-ink">Invite a New Team Member</h2>
                <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">
                    Assign a role to the new user. They must have an existing SabNode account. This will grant them access to all your current and future projects with the selected role.
                </p>
            </div>
            <form action={handleFormSubmit} ref={formRef} className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 flex-grow">
                    <ZoruLabel htmlFor="email" className="sr-only">Email</ZoruLabel>
                    <ZoruInput id="email" name="email" type="email" placeholder="Enter agent's email" required className="h-10 rounded-lg border-zoru-line bg-zoru-bg text-[13px]" />
                </div>
                <div className="space-y-2">
                    <ZoruLabel htmlFor="role" className="sr-only">Role</ZoruLabel>
                    <ZoruSelect name="role" defaultValue="agent">
                        <ZoruSelectTrigger id="role" className="w-full sm:w-[180px]"><ZoruSelectValue placeholder="Select role" /></ZoruSelectTrigger>
                        <ZoruSelectContent>
                            <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                            <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                        </ZoruSelectContent>
                    </ZoruSelect>
                </div>
                <ZoruButton type="submit" disabled={isPending}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
                    Invite Agent
                </ZoruButton>
            </form>
        </ZoruCard>
    );
}

export default function ManageUsersPage() {
    const [teamMembers, setTeamMembers] = useState<WithId<User & { roles: Record<string, string> }>[]>([]);
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
            title="Manage Users"
            subtitle="Invite and manage users for your account."
        >

            <InviteAgentForm onAgentInvited={fetchData} />
            <ZoruSeparator />

            <ZoruCard className="p-6">
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-zoru-ink">Team Members</h2>
                    <p className="mt-0.5 text-[12.5px] text-zoru-ink-muted">A list of all users in your team.</p>
                </div>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <ZoruSkeleton className="h-16 w-full" />
                            <ZoruSkeleton className="h-16 w-full" />
                        </div>
                    ) : teamMembers.length > 0 ? (
                        teamMembers.map((agent: any) => (
                            <div key={agent._id.toString()} className="flex items-center justify-between gap-4 rounded-lg border border-zoru-line p-4">
                                <div className="flex items-center gap-4">
                                    <ZoruAvatar>
                                        <ZoruAvatarImage src={`https://i.pravatar.cc/150?u=${agent.email}`} alt={agent.name} />
                                        <ZoruAvatarFallback className="bg-accent text-accent-foreground">{agent.name.substring(0, 2).toUpperCase()}</ZoruAvatarFallback>
                                    </ZoruAvatar>
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-medium leading-none text-zoru-ink">{agent.name}</p>
                                        <p className="text-[12.5px] text-zoru-ink-muted">{agent.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-[12.5px] text-zoru-ink-muted">
                                        {agent.roles && Object.keys(agent.roles).length > 0
                                            ? `Role: ${Object.values(agent.roles)[0]}`
                                            : 'No specific project roles'
                                        }
                                    </div>
                                    <RemoveAgentButton agentId={agent._id.toString()} onAgentRemoved={fetchData} />
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-[13px] text-zoru-ink-muted text-center py-8">No team members have been invited yet.</p>
                    )}
                </div>
            </ZoruCard>
        </EntityListShell>
    )
}
