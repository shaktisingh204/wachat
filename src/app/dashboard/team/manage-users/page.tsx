
'use client';

import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import type { WithId, User } from '@/lib/definitions';
import { handleInviteAgent, handleRemoveAgent, getInvitedUsers } from '@/app/actions/team.actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, LoaderCircle, Users } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormStatus } from 'react-dom';

const removeAgentInitialState = { message: null, error: null };
const inviteAgentInitialState = { message: null, error: null };

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
                        This will remove the agent's access from all of your projects. This action cannot be undone.
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
        <Card className="p-4 border-dashed">
            <CardHeader>
                <CardTitle>Invite a New Team Member</CardTitle>
                <CardDescription>Assign a role to the new user. They must have an existing SabNode account. This will grant them access to all your current and future projects with the selected role.</CardDescription>
            </CardHeader>
            <CardContent>
            <form action={handleFormSubmit} ref={formRef} className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 flex-grow">
                    <Label htmlFor="email" className="sr-only">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="Enter agent's email" required />
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
                <Button type="submit" disabled={isPending} className="mt-auto">
                  {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Invite Agent
                </Button>
            </form>
            </CardContent>
        </Card>
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
        <div className="flex flex-col gap-8">
            <div>
                <h1 className="text-3xl font-bold font-headline flex items-center gap-3">
                    <Users className="h-8 w-8" />
                    Manage Team
                </h1>
                <p className="text-muted-foreground">Invite and manage users for your account.</p>
            </div>
            
            <InviteAgentForm onAgentInvited={fetchData} />
            <Separator />
            
            <Card>
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>A list of all users in your team.</CardDescription>
                </CardHeader>
                 <CardContent className="space-y-4">
                    {isLoading ? (
                        <div className="space-y-3">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : teamMembers.length > 0 ? (
                        teamMembers.map((agent: any) => (
                            <div key={agent._id.toString()} className="flex items-center justify-between gap-4 border rounded-md p-4">
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <AvatarImage src={`https://i.pravatar.cc/150?u=${agent.email}`} alt={agent.name} />
                                        <AvatarFallback>{agent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div className="space-y-0.5">
                                        <p className="text-sm font-medium leading-none">{agent.name}</p>
                                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                     <div className="text-sm text-muted-foreground">
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
                        <p className="text-sm text-muted-foreground text-center py-8">No team members have been invited yet.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
