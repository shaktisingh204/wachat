'use client';

import React, { useState, useEffect, useTransition } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  Button,
  Avatar,
  Separator,
  Field,
  Select,
  Input,
  Badge,
  Modal,
} from '@/components/sabcrm/20ui';
import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { Plus, Trash2, Settings, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { handleInviteAgent } from '@/app/actions/team.actions';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { getAgentOpenTickets, reassignAndRemoveAgent, updateProjectRoutingRules, updateAgentSkills } from './actions';
import { WithId } from 'mongodb';
import { Project } from '@/lib/definitions';
import { getSession } from '@/app/actions/index.ts';

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

const inviteAgentInitialState: any = { message: null, error: null };

function InviteAgentForm({ project, isDisabled, onInvited }: { project: any, isDisabled: boolean, onInvited: () => void }) {
    const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const { pending } = useFormStatus();
    const { toast } = useToast();
    const formRef = React.useRef<HTMLFormElement>(null);
    const [role, setRole] = useState('agent');

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
            setRole('agent');
            onInvited();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast, onInvited]);

    return (
       <Card variant="outlined" padding="md">
            <CardHeader>
                <CardTitle>Invite a New Team Member</CardTitle>
                <CardDescription>Assign a role to the new user.</CardDescription>
            </CardHeader>
            <CardBody>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={project._id.toString()} />
                <input type="hidden" name="role" value={role} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Email">
                        <Input id="email" name="email" type="email" placeholder="Enter agent's email" required />
                    </Field>
                    <Field label="Role">
                        <Select
                            value={role}
                            onChange={(v) => setRole(v ?? 'agent')}
                            placeholder="Select role"
                            options={[
                                { value: 'agent', label: 'Agent' },
                                { value: 'admin', label: 'Admin' },
                            ]}
                        />
                    </Field>
                </div>
                <Button type="submit" variant="primary" iconLeft={Plus} loading={pending} disabled={isDisabled} className="mt-4">
                  Invite Agent
                </Button>
            </form>
            </CardBody>
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
        <WachatPage
            width="narrow"
            breadcrumb={[
                { label: 'SabNode', href: '/dashboard' },
                { label: 'WaChat', href: '/wachat' },
                { label: 'Agents' },
            ]}
            title="Agents"
            description="Manage routing rules, team members, and agent skills for this project."
        >
        <div className="space-y-6">
            <Card variant="outlined" padding="md">
                <CardHeader>
                    <CardTitle>Routing Rules</CardTitle>
                    <CardDescription>Configure how incoming conversations are assigned to agents.</CardDescription>
                </CardHeader>
                <CardBody>
                    <div className="space-y-4">
                        <Field label="Routing Strategy">
                            <Select
                                value={routingStrategy}
                                onChange={(v) => setRoutingStrategy(v ?? 'manual')}
                                placeholder="Select strategy"
                                className="w-[300px]"
                                options={[
                                    { value: 'manual', label: 'Manual Assignment' },
                                    { value: 'round-robin', label: 'Round Robin (Distribute Evenly)' },
                                    { value: 'skill-based', label: 'Skill-Based Routing' },
                                ]}
                            />
                            <p className="text-xs mt-1" style={{ color: 'var(--st-text-tertiary)' }}>
                                {routingStrategy === 'manual' && "Agents must manually pick conversations or an admin must assign them."}
                                {routingStrategy === 'round-robin' && "New conversations are automatically assigned in a round-robin fashion."}
                                {routingStrategy === 'skill-based' && "Conversations are routed to agents based on their assigned skills."}
                            </p>
                        </Field>
                        <Button variant="primary" iconLeft={Check} onClick={handleSaveRoutingStrategy} loading={isPending}>
                            Save Routing Rules
                        </Button>
                    </div>
                </CardBody>
            </Card>

            <Card variant="outlined" padding="md">
                <CardHeader>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>Manage agents and their roles and skills for this project.</CardDescription>
                </CardHeader>
                <CardBody className="space-y-6">
                    <InviteAgentForm project={project} isDisabled={false} onInvited={() => window.location.reload()} />

                    <Separator/>

                    <div>
                        <h3 className="text-lg font-semibold mb-4">Current Agents</h3>
                        <div className="space-y-4">
                            {agentsList.length > 0 ? (
                                agentsList.map((agent: any) => (
                                    <div key={agent.userId.toString()} className="flex flex-col gap-3 rounded-md p-4" style={{ border: '1px solid var(--st-border-subtle)' }}>
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-4">
                                                <Avatar
                                                    name={agent.name}
                                                    src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.email}`}
                                                    initials={agent.name.substring(0, 2).toUpperCase()}
                                                    shape="round"
                                                />
                                                <div className="space-y-0.5">
                                                    <p className="text-sm font-medium leading-none">{agent.name}</p>
                                                    <p className="text-sm" style={{ color: 'var(--st-text-tertiary)' }}>{agent.email}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Badge kind="outline">{agent.role}</Badge>
                                                        {(agent.skills || []).map((s: string) => (
                                                            <Badge key={s} kind="soft" className="text-[10px]">{s}</Badge>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    iconLeft={Settings}
                                                    onClick={() => {
                                                        setEditingSkillsAgentId(agent.userId.toString());
                                                        setCurrentSkills(agent.skills || []);
                                                    }}
                                                >
                                                    Skills
                                                </Button>
                                                <Button
                                                    variant="danger"
                                                    size="sm"
                                                    iconLeft={Trash2}
                                                    aria-label={`Remove ${agent.name}`}
                                                    onClick={() => handleInitiateRemoveAgent(agent)}
                                                    disabled={isPending}
                                                />
                                            </div>
                                        </div>

                                        {/* Skill Editor */}
                                        {editingSkillsAgentId === agent.userId.toString() && (
                                            <div className="mt-2 p-3 rounded-md text-sm" style={{ background: 'var(--st-surface-sunken)', border: '1px solid var(--st-border-subtle)' }}>
                                                <div className="flex justify-between items-center mb-2">
                                                    <h4 className="font-medium">Edit Skills</h4>
                                                    <Button variant="ghost" size="sm" iconLeft={X} aria-label="Close skill editor" onClick={() => setEditingSkillsAgentId(null)} />
                                                </div>
                                                <div className="flex flex-wrap gap-2 mb-4">
                                                    {AVAILABLE_SKILLS.map(skill => (
                                                        <Badge
                                                            key={skill}
                                                            tone={currentSkills.includes(skill) ? 'accent' : 'neutral'}
                                                            kind={currentSkills.includes(skill) ? 'solid' : 'outline'}
                                                            className="cursor-pointer"
                                                            role="button"
                                                            tabIndex={0}
                                                            aria-pressed={currentSkills.includes(skill)}
                                                            onClick={() => toggleSkill(skill)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter' || e.key === ' ') {
                                                                    e.preventDefault();
                                                                    toggleSkill(skill);
                                                                }
                                                            }}
                                                        >
                                                            {skill}
                                                        </Badge>
                                                    ))}
                                                </div>
                                                <Button variant="primary" size="sm" onClick={() => handleSaveSkills(agent.userId.toString())} loading={isPending}>
                                                    Save Skills
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm" style={{ color: 'var(--st-text-tertiary)' }}>No team members have been added to this project yet.</p>
                            )}
                        </div>
                    </div>
                </CardBody>
            </Card>

            {/* Remove Agent Dialog */}
            <Modal
                open={isRemoveDialogOpen}
                onClose={() => setIsRemoveDialogOpen(false)}
                title="Remove Agent"
                description={`You are about to remove ${agentToRemove?.name ?? ''} from this project.`}
                footer={
                    <>
                        <Button variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={isPending}>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={handleConfirmRemove} loading={isPending} disabled={openTicketsCount > 0 && !reassignTo}>
                            Confirm Remove
                        </Button>
                    </>
                }
            >
                <div className="py-2 space-y-4">
                    {openTicketsCount > 0 ? (
                        <div className="p-3 rounded-md text-sm" style={{ background: 'var(--st-danger-soft, rgba(220,38,38,0.1))', color: 'var(--st-text-primary)', border: '1px solid var(--st-danger, rgba(220,38,38,0.2))' }}>
                            <p className="font-semibold mb-1">Warning: {openTicketsCount} open tickets assigned</p>
                            <p>You must reassign these tickets before removing the agent, or unassign them.</p>
                        </div>
                    ) : (
                        <p className="text-sm">This agent has no open tickets. Safe to remove.</p>
                    )}

                    {openTicketsCount > 0 && (
                        <Field label="Reassign tickets to:">
                            <Select
                                value={reassignTo}
                                onChange={(v) => setReassignTo(v ?? 'unassigned')}
                                placeholder="Select Agent"
                                options={[
                                    { value: 'unassigned', label: 'Leave Unassigned' },
                                    ...agentsList
                                        .filter((a: any) => a.userId.toString() !== agentToRemove?.userId.toString())
                                        .map((a: any) => ({
                                            value: a.userId.toString(),
                                            label: a.name,
                                        })),
                                ]}
                            />
                        </Field>
                    )}
                </div>
            </Modal>
        </div>
        </WachatPage>
    );
}
