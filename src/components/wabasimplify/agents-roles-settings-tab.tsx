'use client';

import {
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardFooter,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruButton,
  ZoruInput,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  ZoruSeparator,
  ZoruLabel,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import {
  useState,
  useEffect,
  useRef } from 'react';
import type { WithId } from 'mongodb';
import type { Project,
  User,
  Plan } from '@/lib/definitions';
import { handleInviteAgent,
  handleRemoveAgent } from '@/app/actions/team.actions';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, LoaderCircle } from 'lucide-react';
import { useFormStatus } from 'react-dom';

import { useActionState } from 'react';
import Link from 'next/link';

interface AgentsRolesSettingsTabProps {
    project: WithId<Project>;
    user: (Omit<User, 'password' | 'planId'> & { plan?: WithId<Plan> | null }) | null;
}

const removeAgentInitialState: any = { message: null, error: null };
const inviteAgentInitialState: any = { message: null, error: null };

function RemoveAgentForm({ agent, project }: { agent: any, project: any }) {
    const [state, formAction] = useActionState(handleRemoveAgent, removeAgentInitialState);
    const { pending } = useFormStatus();
    const { toast } = useToast();

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);

    return (
         <form action={formAction}>
            <input type="hidden" name="projectId" value={project._id.toString()} />
            <input type="hidden" name="agentUserId" value={agent.userId.toString()} />
            <ZoruButton type="submit" variant="destructive" size="icon" disabled={pending}>
               {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            </ZoruButton>
        </form>
    );
}

function InviteAgentForm({ project, isDisabled }: { project: any, isDisabled: boolean }) {
    const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
    const { pending } = useFormStatus();
    const { toast } = useToast();
    const formRef = useRef<HTMLFormElement>(null);

    useEffect(() => {
        if (state?.message) {
            toast({ title: 'Success!', description: state.message });
            formRef.current?.reset();
        }
        if (state?.error) {
            toast({ title: 'Error', description: state.error, variant: 'destructive' });
        }
    }, [state, toast]);
    
    return (
       <ZoruCard className="p-4 border-dashed">
            <ZoruCardHeader>
                <ZoruCardTitle>Invite a New Team Member</ZoruCardTitle>
                <ZoruCardDescription>Assign a role to the new user.</ZoruCardDescription>
            </ZoruCardHeader>
            <ZoruCardContent>
            <form action={formAction} ref={formRef}>
                <input type="hidden" name="projectId" value={project._id} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <ZoruLabel htmlFor="email">Email</ZoruLabel>
                        <ZoruInput id="email" name="email" type="email" placeholder="Enter agent's email" required />
                    </div>
                     <div className="space-y-2">
                        <ZoruLabel htmlFor="role">Role</ZoruLabel>
                        <ZoruSelect name="role" defaultValue="agent">
                            <ZoruSelectTrigger id="role"><ZoruSelectValue placeholder="ZoruSelect role" /></ZoruSelectTrigger>
                            <ZoruSelectContent>
                                <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                                <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
                            </ZoruSelectContent>
                        </ZoruSelect>
                    </div>
                </div>
                <ZoruButton type="submit" disabled={pending || isDisabled} className="mt-4">
                  {pending ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Invite Agent
                </ZoruButton>
            </form>
            </ZoruCardContent>
        </ZoruCard>
    );
}

export function AgentsRolesSettingsTab({ project, user }: AgentsRolesSettingsTabProps) {
    const [isClient, setIsClient] = useState(false);
    
    const plan = user?.plan;
    const limit = plan?.agentLimit ?? 0;
    const isAtLimit = (project.agents?.length || 0) >= limit;
    const planName = plan?.name || 'Unknown';
    
    useEffect(() => {
        setIsClient(true);
    }, []);

    const TeamMemberCard = ({ agent }: { agent: any }) => {
        return (
            <div className="flex items-center justify-between gap-4 border rounded-md p-4">
                <div className="flex items-center gap-4">
                    <ZoruAvatar>
                        <ZoruAvatarImage src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.email}`} alt={agent.name} />
                        <ZoruAvatarFallback>{agent.name.substring(0, 2).toUpperCase()} </ZoruAvatarFallback>
                    </ZoruAvatar>
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
        <ZoruCard className="card-gradient card-gradient-green">
            <ZoruCardHeader>
                <ZoruCardTitle>Agents &amp; Roles</ZoruCardTitle>
                <ZoruCardDescription>Manage agents and their roles for this project.</ZoruCardDescription>
            </ZoruCardHeader>
             <ZoruCardContent className="space-y-6">
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
                <ZoruSeparator/>
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
             </ZoruCardContent>
        </ZoruCard>
    );
}

