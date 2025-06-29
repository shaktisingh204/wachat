
'use client';

import { useState } from 'react';
import type { WithId } from 'mongodb';
import type { Project } from '@/app/actions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MailPlus, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AgentsRolesSettingsTabProps {
    project: WithId<Project>;
}

// Mock data - replace with actual data from props/actions later
const mockAgents = [
    { id: '1', name: 'Alice (You)', email: 'alice@example.com', role: 'Administrator' },
    { id: '2', name: 'Bob', email: 'bob@example.com', role: 'Marketer' },
    { id: '3', name: 'Charlie', email: 'charlie@example.com', role: 'Agent' },
];

const mockRoles = [
    { id: 'admin', name: 'Administrator', description: 'Full access to all features.' },
    { id: 'marketer', name: 'Marketer', description: 'Access to campaigns and templates.' },
    { id: 'agent', name: 'Agent', description: 'Access to live chat and contacts.' },
];

const features = [
    { id: 'campaigns', name: 'Campaigns' },
    { id: 'live_chat', name: 'Live Chat' },
    { id: 'contacts', name: 'Contacts' },
    { id: 'templates', name: 'Templates' },
    { id: 'flow_builder', name: 'Flow Builder' },
    { id: 'settings', name: 'Project Settings' },
];


export function AgentsRolesSettingsTab({ project }: AgentsRolesSettingsTabProps) {
    const { toast } = useToast();

    const handleAction = (action: string) => {
        toast({
            title: 'Feature in Development',
            description: `The "${action}" functionality is not yet implemented.`,
        });
    }
    
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5"/>
                        <CardTitle>Manage Agents</CardTitle>
                    </div>
                    <CardDescription>Invite, remove, and manage roles for team members in this project.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div>
                        <Label>Invite New Agent</Label>
                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                            <Input type="email" placeholder="Enter agent's email" className="flex-grow" />
                            <Select>
                                <SelectTrigger className="w-full sm:w-[180px]">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    {mockRoles.map(role => <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            <Button onClick={() => handleAction('Invite Agent')}>
                                <MailPlus className="mr-2 h-4 w-4" />
                                Invite Agent
                            </Button>
                        </div>
                    </div>
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
                                {mockAgents.map(agent => (
                                    <TableRow key={agent.id}>
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
                                            <Button variant="ghost" size="icon" onClick={() => handleAction('Remove Agent')}>
                                                <Trash2 className="h-4 w-4 text-destructive"/>
                                            </Button>
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
                           <Button onClick={() => handleAction('Create Role')}><Plus className="mr-2 h-4 w-4"/>Create Role</Button>
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
                                        <Button variant="destructive" size="sm" onClick={() => handleAction('Delete Role')}>Delete Role</Button>
                                        <Button variant="default" size="sm" onClick={() => handleAction('Save Role')}>Save Role</Button>
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
