'use client';

import { useActionState, useEffect, useState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import type { WithId } from 'mongodb';
import type { Project, User, Agent } from '@/app/actions';
import { handleInviteAgent, handleRemoveAgent } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MailPlus, Plus, Shield, Trash2, Users, LoaderCircle } from 'lucide-react';

interface AgentsRolesSettingsTabProps {
    project: WithId<Project>;
    user: Omit<User, 'password'> | null;
}

const inviteInitialState = { message: null, error: null };
const removeInitialState = { message: null, error: null };

function InviteSubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <MailPlus className="mr-2 h-4 w-4" />}
            Invite Agent
        </Button>
    )
}

function RemoveAgentForm({ projectId, agentUserId }: { projectId: string, agentUserId: string }) {
    const [state, formAction] = useActionState(handleRemoveAgent, removeInitialState);
    const { toast } = useToast();
    const { pending } = useFormStatus();

    useEffect(() => {
        if(state?.message) toast({ title: "Success", description: state.message });
        if(state?.error) toast({ title: "Error", description: state.error, variant: 'destructive' });
    }, [state, toast]);

    return (
        <form action={formAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="agentUserId" value={agentUserId} />
            <Button type="submit" variant="ghost" size="icon" disabled={pending}>
                {pending ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 text-destructive"/>}
            </Button>
        </form>
    )
}

const mockRoles = [
    { id: 'Administrator', name: 'Administrator', description: 'Full access to all features.' },
    { id: 'Marketer', name: 'Marketer', description: 'Access to campaigns and templates.' },
    { id: 'Agent', name: 'Agent', description: 'Access to live chat and contacts.' },
];

const features = [
    { id: 'campaigns', name: 'Campaigns' },
    { id: 'live_chat', name: 'Live Chat' },
    { id: 'contacts', name: 'Contacts' },
    { id: 'templates', name: 'Templates' },
    { id: 'flow_builder', name: 'Flow Builder' },
    { id: 'settings', name: 'Project Settings' },
];


export function AgentsRolesSettingsTab({ project, user }: AgentsRolesSettingsTabProps) {
    const { toast } = useToast();
    const [inviteState, inviteAction] = useActionState(handleInviteAgent, inviteInitialState);
    const inviteFormRef = useRef<HTMLFormElement>(null);
    const isOwner = project.userId.toString() === user?._id.toString();
    const plan = user?.plan || 'free';
    const agentLimit = plan === 'pro' ? 10 : 1;
    const currentAgentCount = project.agents?.length || 0;

    useEffect(() => {
        if (inviteState?.message) {
            toast({ title: 'Success!', description: inviteState.message });
            inviteFormRef.current?.reset();
        }
        if (inviteState?.error) {
            toast({ title: 'Error', description: inviteState.error, variant: 'destructive' });
        }
    }, [inviteState, toast]);

    const handleComingSoon = (action: string) => {
        toast({
            title: 'Feature in Development',
            description: `The "${action}" functionality is not yet implemented.`,
        });
    }
    
    if (!isOwner) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Agents & Roles</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">Only the project owner can manage agents and roles.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5"/>
                        <CardTitle>Manage Agents</CardTitle>
                    </div>
                    <CardDescription>
                        Invite, remove, and manage roles for team members. 
                        Your <span className="font-semibold capitalize text-primary">{plan}</span> plan allows for {agentLimit} agent(s). 
                        You have {currentAgentCount} of {agentLimit} agents.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <form action={inviteAction} ref={inviteFormRef}>
                        <input type="hidden" name="projectId" value={project._id.toString()} />
                        <div>
                            <Label>Invite New Agent</Label>
                            <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                <Input type="email" name="email" placeholder="Enter agent's email" className="flex-grow" required />
                                <Select name="role" required>
                                    <SelectTrigger className="w-full sm:w-[180px]">
                                        <SelectValue placeholder="Select a role" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {mockRoles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                <InviteSubmitButton />
                            </div>
                        </div>
                    </form>
                    <Separator/>
                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                <TableRow>
                                    <TableCell className="font-medium">{user?.name} (Owner)</TableCell>
                                    <TableCell>{user?.email}</TableCell>
                                    <TableCell><Badge>Owner</Badge></TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                                {project.agents && project.agents.map(agent => (
                                    <TableRow key={agent.userId.toString()}>
                                        <TableCell className="font-medium">{agent.name}</TableCell>
                                        <TableCell>{agent.email}</TableCell>
                                        <TableCell>
                                            <Select defaultValue={agent.role}>
                                                <SelectTrigger className="h-8 w-[150px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {mockRoles.map(role => <SelectItem key={role.id} value={role.name}>{role.name}</SelectItem>)}
                                                </SelectContent>
                                            </Select>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <RemoveAgentForm projectId={project._id.toString()} agentUserId={agent.userId.toString()} />
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

             <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Shield className="h-5 w-5"/>
                        <CardTitle>Manage Roles &amp; Permissions</CardTitle>
                    </div>
                    <CardDescription>Create custom roles and define what each role can see and do.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <Label>Create New Role</Label>
                        <div className="flex gap-2 mt-2">
                           <Input placeholder="Enter role name (e.g., Support Lead)" />
                           <Button onClick={() => handleComingSoon('Create Role')}><Plus className="mr-2 h-4 w-4"/>Create Role</Button>
                        </div>
                    </div>
                     <Separator/>
                     <Accordion type="single" collapsible className="w-full">
                        {mockRoles.map(role => (
                             <AccordionItem key={role.id} value={role.id}>
                                <AccordionTrigger>
                                    <div className="flex flex-col items-start text-left">
                                        <span className="font-semibold text-base">{role.name}</span>
                                        <span className="text-sm text-muted-foreground font-normal">{role.description}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="border rounded-md overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Feature</TableHead>
                                                    <TableHead className="text-center">Read</TableHead>
                                                    <TableHead className="text-center">Write</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {features.map(feature => (
                                                    <TableRow key={feature.id}>
                                                        <TableCell className="font-medium">{feature.name}</TableCell>
                                                        <TableCell className="text-center"><Checkbox/></TableCell>
                                                        <TableCell className="text-center"><Checkbox/></TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-4">
                                        <Button variant="destructive" size="sm" onClick={() => handleComingSoon('Delete Role')}>Delete Role</Button>
                                        <Button variant="default" size="sm" onClick={() => handleComingSoon('Save Role')}>Save Role</Button>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                     </Accordion>
                </CardContent>
            </Card>
        </div>
    )
}
