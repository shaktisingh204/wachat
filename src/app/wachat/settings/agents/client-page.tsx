'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Card,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  Button,
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Separator,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Input,
  Badge,
  Dialog,
  ZoruDialogContent,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruDialogDescription,
  ZoruDialogFooter,
} from '@/components/zoruui';
import { Plus, Trash2, LoaderCircle, Settings, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleInviteAgent } from '@/app/actions/team.actions';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getAgentOpenTickets, reassignAndRemoveAgent, updateProjectRoutingRules, updateAgentSkills } from './actions';
import { WithId } from 'mongodb';
import { Project } from '@/lib/definitions';
import { getSession } from '@/app/actions/index.ts';

const inviteAgentInitialState: any = { message: null, error: null };

function InviteAgentForm({ project, isDisabled, onInvited }: { project: any, isDisabled: boolean, onInvited: () => void }) {
    const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const { pending } = useFormStatus();
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            onInvited();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onInvited]);
    
    return (
       <Card className="p-4 border-dashed">
            <ZoruCardHeader>
                <ZoruCardTitle>Invite a New Team Member</ZoruCardTitle>
                <ZoruCardDescription>Assign a role to the new user.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={project._id.toString()} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" name="email" type="email" placeholder="Enter agent's email" required />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select name="role" defaultValue="agent">
                            <ZoruSelectTrigger id="role"><ZoruSelectValue placeholder="Select role" /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                                <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                            </ZoruSelectContent>
                        </Select>
                    </div>
                </div>
                <Button type="submit" disabled={pending || isDisabled} className="mt-4">
                  {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Invite Agent
                </Button>
            </form>
            </ZoruCardContent>
        </Card>
    );
}

const AVAILABLE_SKILLS = ['Billing', 'Technical Support', 'Sales', 'Onboarding', 'General'];

export function AgentsSettingsClient({ project: initialProject }: { project: WithId<Project> }) {
    const [project, setProject] = useState(initialProject);
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();

    // Routing Strategy
    const [routingStrategy, setRoutingStrategy] = useState((project as any).wachatSettings?.routingStrategy || 'manual');

    // Remove Agent State
    const [agentToRemove, setAgentToRemove] = useState<any>(null);
    const [openTicketsCount, setOpenTicketsCount] = useState<number>(0);
    const [reassignTo, setReassignTo] = useState<string>('unassigned');
    const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

    // Edit Skills State
    const [editingSkillsAgentId, setEditingSkillsAgentId] = useState<string | null>(null);
    const [currentSkills, setCurrentSkills] = useState<string[]>([]);

    const handleSaveRoutingStrategy = () => {
        startTransition(async () => {
            const res = await updateProjectRoutingRules(project._id.toString(), routingStrategy);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Saved', description: 'Routing rules updated successfully.' });
            }
        });
    };

    const handleInitiateRemoveAgent = (agent: any) => {
        setAgentToRemove(agent);
        setReassignTo('unassigned');
        startTransition(async () => {
            const res = await getAgentOpenTickets(project._id.toString(), agent.userId.toString());
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                setOpenTicketsCount(res.count || 0);
                setIsRemoveDialogOpen(true);
            }
        });
    };

    const handleConfirmRemove = () => {
        startTransition(async () => {
            const newAgent = reassignTo === 'unassigned' ? null : reassignTo;
            const res = await reassignAndRemoveAgent(project._id.toString(), agentToRemove.userId.toString(), newAgent);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Agent Removed', description: 'Agent removed and tickets reassigned.' });
                setIsRemoveDialogOpen(false);
                setAgentToRemove(null);
                // In a real app we'd refresh the project data or use router.refresh(). 
                window.location.reload();
            }
        });
    };

    const toggleSkill = (skill: string) => {
        setCurrentSkills(prev => 
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
    };

    const handleSaveSkills = (agentId: string) => {
        startTransition(async () => {
            const res = await updateAgentSkills(project._id.toString(), agentId, currentSkills);
            if (res.error) {
                toast({ title: 'Error', description: res.error, variant: 'destructive' });
            } else {
                toast({ title: 'Saved', description: 'Agent skills updated.' });
                setEditingSkillsAgentId(null);
                window.location.reload();
            }
        });
    };

    const agentsList = project.agents || [];

    return (
        <div className="space-y-6">
            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Routing Rules</ZoruCardTitle>
                    <ZoruCardDescription>Configure how incoming conversations are assigned to agents.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Routing Strategy</Label>
                            <Select value={routingStrategy} onValueChange={setRoutingStrategy}>
                                <ZoruSelectTrigger className="w-[300px]">
                                    <ZoruSelectValue placeholder="Select strategy" />
                                </ZoruSelectTrigger>
                                <ZoruSelectContent>
                                    <ZoruSelectItem value="manual">Manual Assignment</ZoruSelectItem>
                                    <ZoruSelectItem value="round-robin">Round Robin (Distribute Evenly)</ZoruSelectItem>
                                    <ZoruSelectItem value="skill-based">Skill-Based Routing</ZoruSelectItem>
                                </ZoruSelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground mt-1">
                                {routingStrategy === 'manual' && "Agents must manually pick conversations or an admin must assign them."}
                                {routingStrategy === 'round-robin' && "New conversations are automatically assigned in a round-robin fashion."}
                                {routingStrategy === 'skill-based' && "Conversations are routed to agents based on their assigned skills."}
                            </p>
                        </div>
                        <Button onClick={handleSaveRoutingStrategy} disabled={isPending}>
                            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Save Routing Rules
                        </Button>
                    </div>
                </ZoruCardContent>
            </Card>

            <Card>
                <ZoruCardHeader>
                    <ZoruCardTitle>Team Members</ZoruCardTitle>
                    <ZoruCardDescription>Manage agents and their roles and skills for this project.</ZoruCardDescription>
                </ZoruCardHeader>
                <ZoruCardContent className="space-y-6">
                    <InviteAgentForm project={project} isDisabled={false} onInvited={() => window.location.reload()} />
                    
                    <Separator/>
                    
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Current Agents</h3>
                        <div className="space-y-4">
                            {agentsList.length > 0 ? (
                                agentsList.map((agent: any) => (
                                    <div key={agent.userId.toString()} className="flex flex-col gap-3 border rounded-md p-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar>
                                                    <ZoruAvatarImage src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.email}`} alt={agent.name} />
                                                    <ZoruAvatarFallback>{agent.name.substring(0, 2).toUpperCase()}</ZoruAvatarFallback>
                                                </Avatar>
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-medium leading-none">{agent.name}</p>
                                                    <p className="text-sm text-muted-foreground">{agent.email}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge variant="outline">{agent.role}</Badge>
                                                        {(agent.skills || []).map((s: string) => (
                                                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => {
                                                        setEditingSkillsAgentId(agent.userId.toString());
                                                        setCurrentSkills(agent.skills || []);
                                                    }}
                                                >
                                                    <Settings className="h-4 w-4 mr-2" />
                                                    Skills
                                                </Button>
                                                <Button 
                                                    variant="destructive" 
                                                    size="icon"
                                                    onClick={() => handleInitiateRemoveAgent(agent)}
                                                    disabled={isPending}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        
                                        {/* Skill Editor */}
                                        {editingSkillsAgentId === agent.userId.toString() && (
                                            <div className="mt-2 p-3 bg-muted/30 rounded-md border text-sm">
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium">Edit Skills</h4>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingSkillsAgentId(null)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {AVAILABLE_SKILLS.map(skill => (
                                                        <Badge 
                                                            key={skill} 
                                                            variant={currentSkills.includes(skill) ? "default" : "outline"}
                                                            className="cursor-pointer"
                                                            onClick={() => toggleSkill(skill)}
                                                        >
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <Button size="sm" onClick={() => handleSaveSkills(agent.userId.toString())} disabled={isPending}>
                                                    Save Skills
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-muted-foreground">No team members have been added to this project yet.</p>
                            )}
                        </div>
                    </div>
                </ZoruCardContent>
            </Card>

            {/* Remove Agent Dialog */}
            <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
                <ZoruDialogContent>
                    <ZoruDialogHeader>
                        <ZoruDialogTitle>Remove Agent</ZoruDialogTitle>
                        <ZoruDialogDescription>
                            You are about to remove {agentToRemove?.name} from this project.
                        </ZoruDialogDescription>
                    </ZoruDialogHeader>
                    
                    <div className="py-4 space-y-4">
                        {openTicketsCount > 0 ? (
                            <div className="p-3 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-sm">
                                <p className="font-semibold mb-1">Warning: {openTicketsCount} open tickets assigned</p>
                                <p>You must reassign these tickets before removing the agent, or unassign them.</p>
                            </div>
                        ) : (
                            <p className="text-sm">This agent has no open tickets. Safe to remove.</p>
                        )}
                        
                        {openTicketsCount > 0 && (
                            <div className="space-y-2">
                                <Label>Reassign tickets to:</Label>
                                <Select value={reassignTo} onValueChange={setReassignTo}>
                                    <ZoruSelectTrigger>
                                        <ZoruSelectValue placeholder="Select Agent" />
                                    </ZoruSelectTrigger>
                                    <ZoruSelectContent>
                                        <ZoruSelectItem value="unassigned">Leave Unassigned</ZoruSelectItem>
                                        {agentsList
                                            .filter((a: any) => a.userId.toString() !== agentToRemove?.userId.toString())
                                            .map((a: any) => (
                                                <ZoruSelectItem key={a.userId.toString()} value={a.userId.toString()}>
                                                    {a.name}
                                                </ZoruSelectItem>
                                            ))
                                        }
                                    </ZoruSelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <ZoruDialogFooter>
                        <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={handleConfirmRemove} disabled={isPending || (openTicketsCount > 0 && !reassignTo)}>
                            {isPending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Confirm Remove
                        </Button>
                    </ZoruDialogFooter>
                </ZoruDialogContent>
            </Dialog>
        </div>
    );
}
