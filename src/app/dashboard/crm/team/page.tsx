'use client';

import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import type { WithId, User } from '@/lib/definitions';
import { handleInviteAgent, handleRemoveAgent, getInvitedUsers } from '@/app/actions/team.actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, LoaderCircle, Users } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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

function RemoveAgentButton({ agentId, onAgentRemoved }: { agentId: string, onAgentRemoved: () => void }) {
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
         <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isPending}>
                    {isPending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4" />}
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will remove the agent&apos;s access from all of your projects. This action cannot be undone.
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
                <h2 className="text-[16px] font-semibold text-foreground">Invite a New Team Member</h2>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                    Assign a role to the new user. They must have an existing SabNode account. This will grant them access to all your current and future projects with the selected role.
                </p>
            </div>
            <form action={handleFormSubmit} ref={formRef} className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 flex-grow">
                    <Label htmlFor="email" className="sr-only">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="Enter agent's email" required className="h-10 rounded-lg border-border bg-card text-[13px]" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="role" className="sr-only">Role</Label>
                    <Select name="role" defaultValue="agent">
                        <SelectTrigger id="role" className="w-full sm:w-[180px]"><SelectValue placeholder="Select role" /></SelectTrigger>
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
                    leading={isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" strokeWidth={1.75} />}
                >
                    Invite Agent
                </ClayButton>
            </form>
        </ClayCard>
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
        <div className="flex w-full flex-col gap-6">
            <CrmPageHeader
                title="Manage Team"
                subtitle="Invite and manage users for your account."
                icon={Users}
            />

            <InviteAgentForm onAgentInvited={fetchData} />
            <Separator />

            <ClayCard>
                <div className="mb-4">
                    <h2 className="text-[16px] font-semibold text-foreground">Team Members</h2>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">A list of all users in your team.</p>
                </div>
                <div className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : teamMembers.length > 0 ? (
                        teamMembers.map((agent: any) => (
                            <div key={agent._id.toString()} className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={`https://i.pravatar.cc/150?u=${agent.email}`} alt={agent.name} />
                                        <AvatarFallback className="bg-accent text-accent-foreground">{agent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-0.5">
                                        <p className="text-[13px] font-medium leading-none text-foreground">{agent.name}</p>
                                        <p className="text-[12.5px] text-muted-foreground">{agent.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="text-[12.5px] text-muted-foreground">
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
                        <p className="text-[13px] text-muted-foreground text-center py-8">No team members have been invited yet.</p>
                    )}
                </div>
            </ClayCard>
        </div>
    )
}
