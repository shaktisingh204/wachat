
'use client';

import { useState, useEffect } from 'react';
import type { WithId } from 'mongodb';
import type { Project, User, Plan } from '@/lib/definitions';
import { handleInviteAgent, handleRemoveAgent } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActionState } from 'react-dom';
import Link from 'next/link';

interface AgentsRolesSettingsTabProps {
    project: WithId<Project>;
    user: (Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null }) | null;
}

const inviteAgentInitialState = { message: null, error: null };
const removeAgentInitialState = { message: null, error: null };

export function AgentsRolesSettingsTab({ project, user }: AgentsRolesSettingsTabProps) {
    const [isClient, setIsClient] = useState(false);
    const [inviteState, inviteAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const [removeState, removeAction] = useActionState(handleRemoveAgent, removeAgentInitialState);

    const { toast } = useToast();
    const plan = user?.plan;
    const limit = plan?.agentLimit ?? 0;
    const isAtLimit = (project.agents?.length || 0) >= limit;
    const planName = plan?.name || 'Unknown';
    
    useEffect(() => {
        setIsClient(true);
        if (inviteState?.message) toast({ title: 'Success!', description: inviteState.message });
        if (inviteState?.error) toast({ title: 'Error', description: inviteState.error, variant: 'destructive' });
    }, [inviteState, toast]);

     useEffect(() => {
        if (removeState?.message) toast({ title: 'Success!', description: removeState.message });
        if (removeState?.error) toast({ title: 'Error', description: removeState.error, variant: 'destructive' });
    }, [removeState, toast]);

    const TeamMemberCard = ({ agent }: { agent: any }) => {
        return (
            <div className="flex items-center justify-between gap-4 border rounded-md p-4">
                <div className="flex items-center gap-4">
                    <Avatar>
                        <AvatarImage src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.email}`} alt={agent.name} />
                        <AvatarFallback>{agent.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-0.5">
                        <p className="text-sm font-medium leading-none">{agent.name}</p>
                        <p className="text-sm text-muted-foreground">{agent.email}</p>
                    </div>
                </div>
                <div>
                    <RemoveAgentForm agent={agent} project={project} />
                </div>
            </div>
        );
    };
    
    return (
        <Card className="card-gradient card-gradient-green">
            <CardHeader>
                <CardTitle>Agents & Roles</CardTitle>
                <CardDescription>Manage agents and their roles for this project.</CardDescription>
            </CardHeader>
             <CardContent className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm text-muted-foreground">
                    <h4 className="font-semibold text-card-foreground">Team Management</h4>
                    <p>Invite team members to assist with managing this project.</p>
                    <p>Your current <span className="font-semibold capitalize text-primary">{planName}</span> plan allows for <span className="font-semibold text-primary">{limit}</span> team members. There are currently <span className="font-semibold text-primary">{project.agents?.length || 0}</span> team member(s) assigned to this project.</p>
                    {limit < 10 && (
                        <p className="font-semibold">
                            <Link href="/dashboard/billing" className="text-primary hover:underline">Upgrade your plan</Link> to invite more team members! 🚀
                        </p>
                    )}
                </div>
                
                <InviteAgentForm project={project} isDisabled={isAtLimit} />
                <Separator/>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Team Members</h3>
                    {project.agents && project.agents.length > 0 ? (
                        project.agents.map((agent: any) => (
                            <TeamMemberCard key={agent.userId.toString()} agent={agent} />
                        ))
                    ) : (
                        <p className="text-sm text-muted-foreground">No team members have been added to this project yet.</p>
                    )}
                </div>
             </CardContent>
        </Card>
    );
}

function InviteAgentForm({ project, isDisabled }: { project: any, isDisabled: boolean }) {
    const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const { pending } = useFormStatus();
    
    return (
       <Card className="p-4 border-dashed">
            <CardHeader>
                <CardTitle>Invite a New Team Member</CardTitle>
                <CardDescription>Assign a role to the new user.</CardDescription>
            </CardHeader>
            <CardContent>
            <form action={formAction}>
                <input type="hidden" name="projectId" value={project._id} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="Enter agent's email" required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" defaultValue="agent">
                            <SelectTrigger id="role"><SelectValue placeholder="Select role" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="agent">Agent</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button type="submit" disabled={pending || isDisabled} className="mt-4">
                  {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Invite Agent
                </Button>
            </form>
            </CardContent>
        </Card>
    );
}

function RemoveAgentForm({ agent, project }: { agent: any, project: any }) {
    const [state, formAction] = useActionState(handleRemoveAgent, removeAgentInitialState);
    const { pending } = useFormStatus();

    return (
         <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id} />
            <input type="hidden" name="agentUserId" value={agent.userId} />
            <Button type="submit" variant="destructive" size="icon" disabled={pending}>
               {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
        </form>
    );
}
