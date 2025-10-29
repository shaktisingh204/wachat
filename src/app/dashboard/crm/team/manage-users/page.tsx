
'use client';

import { useState, useEffect, useRef, useActionState, useTransition } from 'react';
import type { WithId, Project, User, Plan, Agent } from '@/lib/definitions';
import { handleInviteAgent, handleRemoveAgent, getProjectById } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Plus, Trash2, LoaderCircle, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

const removeAgentInitialState = { message: null, error: null };
const inviteAgentInitialState = { message: null, error: null };

function RemoveAgentButton({ agent, projectId, onAgentRemoved }: { agent: Agent, projectId: string, onAgentRemoved: () => void }) {
    const [state, formAction] = useActionState(handleRemoveAgent, removeAgentInitialState);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();

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
         <form action={formAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="agentUserId" value={agent.userId.toString()} />
            <Button type="submit" variant="destructive" size="icon" disabled={isPending}>
               {isPending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </Button>
        </form>
    );
}

function InviteAgentForm({ project, isDisabled, onAgentInvited }: { project: WithId<Project>, isDisabled: boolean, onAgentInvited: () => void }) {
    const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const { pending } = useFormStatus();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

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
                <CardDescription>Assign a role to the new user. They must have an existing account on the platform.</CardDescription>
            </CardHeader>
            <CardContent>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={project._id.toString()} />
                <div className="grid grid-cols-1 sm:grid-cols-[1fr,1fr,auto] gap-4">
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
                     <div className="flex items-end">
                        <Button type="submit" disabled={pending || isDisabled} className="w-full">
                          {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                          Invite Agent
                        </Button>
                    </div>
                </div>
            </form>
            </CardContent>
        </Card>
    );
}

export default function ManageUsersPage() {
    const [project, setProject] = useState<WithId<Project> | null>(null);
    const [isLoading, startLoading] = useTransition();

    const fetchData = () => {
        startLoading(async () => {
             const storedProjectId = localStorage.getItem('activeProjectId');
             if(storedProjectId) {
                const data = await getProjectById(storedProjectId);
                setProject(data);
             } else {
                 setProject(null);
             }
        });
    }

    useEffect(() => {
        fetchData();
    }, []);

    if (isLoading) {
        return <div>Loading project data...</div>
    }

    if (!project) {
         return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>No Project Selected</AlertTitle>
                <AlertDescription>Please select a project to manage its users.</AlertDescription>
            </Alert>
        );
    }
    
    const limit = project.plan?.agentLimit ?? 0;
    const isAtLimit = (project.agents?.length || 0) >= limit;

    return (
        <Card>
            <CardHeader>
                <CardTitle>Agents & Roles</CardTitle>
                <CardDescription>Manage agents and their roles for project "{project.name}".</CardDescription>
            </CardHeader>
             <CardContent className="space-y-6">
                <div className="p-4 bg-muted/50 rounded-lg space-y-2 text-sm text-muted-foreground">
                    <h4 className="font-semibold text-card-foreground">Team Management</h4>
                    <p>Invite team members to assist with managing this project.</p>
                    <p>Your current <span className="font-semibold capitalize text-primary">{project.plan?.name || 'plan'}</span> plan allows for <span className="font-semibold text-primary">{limit}</span> team members. There are currently <span className="font-semibold text-primary">{project.agents?.length || 0}</span> team member(s) assigned.</p>
                    {limit < 10 && (
                        <p className="font-semibold">
                            <Link href="/dashboard/user/billing" className="text-primary hover:underline">Upgrade your plan</Link> to invite more team members! 🚀
                        </p>
                    )}
                </div>
                
                <InviteAgentForm project={project} isDisabled={isAtLimit} onAgentInvited={fetchData} />
                <Separator/>
                <div>
                    <h3 className="text-lg font-semibold mb-2">Team Members</h3>
                    <div className="space-y-3">
                        {project.agents && project.agents.length > 0 ? (
                            project.agents.map((agent: any) => (
                                <div key={agent.userId.toString()} className="flex items-center justify-between gap-4 border rounded-md p-4">
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
                                        <Badge variant="outline">{agent.role}</Badge>
                                        <RemoveAgentButton agent={agent} projectId={project._id.toString()} onAgentRemoved={fetchData}/>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-muted-foreground">No team members have been added to this project yet.</p>
                        )}
                    </div>
                </div>
             </CardContent>
        </Card>
    )
}
