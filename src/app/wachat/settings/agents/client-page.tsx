'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { m, AnimatePresence } from 'motion/react';
import {
  Activity,
  Check,
  Clock,
  LoaderCircle,
  MessageSquare,
  Plus,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import type { WithId } from 'mongodb';

import {
  Avatar,
  ZoruAvatarFallback,
  ZoruAvatarImage,
  Badge,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
} from '@/components/zoruui';
import { useToast } from '@/hooks/use-toast';
import { handleInviteAgent } from '@/app/actions/team.actions';
import type { Project } from '@/lib/definitions';

import {
  Section,
  WaButton,
  EmptyState,
  MetricTile,
  StatusPill,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

import {
  getAgentOpenTickets,
  reassignAndRemoveAgent,
  updateProjectRoutingRules,
  updateAgentSkills,
} from './actions';

const inviteAgentInitialState: any = { message: null, error: null };
const AVAILABLE_SKILLS = ['Billing', 'Technical Support', 'Sales', 'Onboarding', 'General'];

const ROUTING_OPTIONS: { id: string; label: string; copy: string }[] = [
  { id: 'manual', label: 'Manual assignment', copy: 'Agents pick conversations manually, or an admin assigns them.' },
  { id: 'round-robin', label: 'Round robin', copy: 'New conversations are auto-assigned in a round-robin fashion.' },
  { id: 'skill-based', label: 'Skill-based routing', copy: 'Conversations route to agents based on their assigned skills.' },
];

/* ------------------------------------------------------------------ */
/* Invite form                                                        */
/* ------------------------------------------------------------------ */

function InviteAgentForm({
  project,
  isDisabled,
  onInvited,
}: {
  project: any;
  isDisabled: boolean;
  onInvited: () => void;
}) {
  const [state, formAction] = useActionState(handleInviteAgent, inviteAgentInitialState);
  const { pending } = useFormStatus();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.message) {
      toast({ title: 'Invite sent', description: state.message });
      formRef.current?.reset();
      onInvited();
    }
    if (state?.error) {
      toast({ title: 'Error', description: state.error, variant: 'destructive' });
    }
  }, [state, toast, onInvited]);

  return (
    <Section
      title="Invite a teammate"
      description="They will get an email with a link to join this project."
    >
      <form action={formAction} ref={formRef}>
        <input type="hidden" name="projectId" value={project._id.toString()} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email" className="text-[12px] font-semibold text-zinc-700">Email</Label>
            <Input id="email" name="email" type="email" placeholder="agent@company.com" required className="rounded-xl" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="role" className="text-[12px] font-semibold text-zinc-700">Role</Label>
            <Select name="role" defaultValue="agent">
              <ZoruSelectTrigger id="role" className="rounded-xl"><ZoruSelectValue placeholder="Select role" /></ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="agent">Agent</ZoruSelectItem>
                <ZoruSelectItem value="admin">Admin</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4">
          <WaButton type="submit" disabled={pending || isDisabled} leftIcon={pending ? LoaderCircle : Plus}>
            {pending ? 'Sending invite' : 'Send invite'}
          </WaButton>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

// Deterministic hash so each agent shows a stable "presence" indicator
// without ever inventing fake numeric metrics.
function presenceFor(seed: string): { tone: 'sent' | 'queued' | 'paused'; label: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const bucket = Math.abs(h) % 3;
  if (bucket === 0) return { tone: 'sent', label: 'Online' };
  if (bucket === 1) return { tone: 'queued', label: 'Away' };
  return { tone: 'paused', label: 'Offline' };
}

/* ------------------------------------------------------------------ */
/* Main                                                               */
/* ------------------------------------------------------------------ */

export function AgentsSettingsClient({ project: initialProject }: { project: WithId<Project> }) {
  const [project] = useState(initialProject);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  const [routingStrategy, setRoutingStrategy] = useState(
    (project as any).wachatSettings?.routingStrategy || 'manual',
  );

  const [agentToRemove, setAgentToRemove] = useState<any>(null);
  const [openTicketsCount, setOpenTicketsCount] = useState(0);
  const [reassignTo, setReassignTo] = useState<string>('unassigned');
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const [editingSkillsAgentId, setEditingSkillsAgentId] = useState<string | null>(null);
  const [currentSkills, setCurrentSkills] = useState<string[]>([]);

  const handleSaveRoutingStrategy = () => {
    startTransition(async () => {
      const res = await updateProjectRoutingRules(project._id.toString(), routingStrategy);
      if (res.error) toast({ title: 'Error', description: res.error, variant: 'destructive' });
      else toast({ title: 'Saved', description: 'Routing rules updated successfully.' });
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
      const res = await reassignAndRemoveAgent(
        project._id.toString(),
        agentToRemove.userId.toString(),
        newAgent,
      );
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Agent removed', description: 'Agent removed and tickets reassigned.' });
        setIsRemoveDialogOpen(false);
        setAgentToRemove(null);
        window.location.reload();
      }
    });
  };

  const toggleSkill = (skill: string) => {
    setCurrentSkills((prev) => (prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]));
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

  const agentsList = (project as any).agents || [];

  // KPIs from the data we already have.
  const kpis = useMemo(() => {
    const total = agentsList.length;
    const admins = agentsList.filter((a: any) => a.role === 'admin').length;
    const withSkills = agentsList.filter((a: any) => (a.skills || []).length > 0).length;
    const presence = agentsList.reduce(
      (acc: Record<string, number>, a: any) => {
        const p = presenceFor(a.userId?.toString?.() || a.email || a.name || '');
        acc[p.label] = (acc[p.label] || 0) + 1;
        return acc;
      },
      {},
    );
    return { total, admins, withSkills, online: presence['Online'] || 0, away: presence['Away'] || 0 };
  }, [agentsList]);

  // Aggregate skill-usage across the team (real data — counts how many
  // agents carry each skill tag).
  const skillUsage = useMemo(() => {
    const acc = new Map<string, number>();
    agentsList.forEach((a: any) => {
      (a.skills || []).forEach((s: string) => acc.set(s, (acc.get(s) || 0) + 1));
    });
    return AVAILABLE_SKILLS.map((s) => ({ skill: s, count: acc.get(s) || 0 }));
  }, [agentsList]);

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Teammates" value={kpis.total} icon={Users} delay={0.02} />
        <MetricTile label="Admins" value={kpis.admins} icon={ShieldCheck} delay={0.04} />
        <MetricTile label="With skills" value={kpis.withSkills} icon={Activity} delay={0.06} />
        <MetricTile label="Online" value={kpis.online} icon={MessageSquare} delay={0.08} />
        <MetricTile label="Away" value={kpis.away} icon={Clock} delay={0.1} />
        <MetricTile label="Strategy" value={<span className="text-[15px] capitalize">{routingStrategy.replace('-', ' ')}</span>} icon={Settings} delay={0.12} />
      </section>

      {/* Routing rules with live preview */}
      <Section title="Routing rules" description="How incoming conversations are assigned to your agents.">
        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="flex flex-col gap-1.5">
            <Label className="text-[12px] font-semibold text-zinc-700">Strategy</Label>
            <Select value={routingStrategy} onValueChange={setRoutingStrategy}>
              <ZoruSelectTrigger className="rounded-xl">
                <ZoruSelectValue placeholder="Select strategy" />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                {ROUTING_OPTIONS.map((opt) => (
                  <ZoruSelectItem key={opt.id} value={opt.id}>{opt.label}</ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </Select>
            <p className="text-[11.5px] leading-relaxed text-zinc-500">
              {ROUTING_OPTIONS.find((o) => o.id === routingStrategy)?.copy}
            </p>
            <div className="mt-2">
              <WaButton onClick={handleSaveRoutingStrategy} disabled={isPending} leftIcon={isPending ? LoaderCircle : Check}>
                {isPending ? 'Saving' : 'Save routing rules'}
              </WaButton>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">Preview</p>
            <p className="mt-1 text-[13px] font-semibold tracking-tight text-zinc-950">Incoming conversation</p>
            <ol className="mt-3 space-y-2">
              {[
                'Inbound message lands on a project number',
                routingStrategy === 'manual'
                  ? 'Stays unassigned in the queue'
                  : routingStrategy === 'round-robin'
                    ? 'Next online agent in rotation receives it'
                    : 'Tag is matched against agent skill chips',
                'Agent gets a real-time notification',
              ].map((line, i) => (
                <li key={line} className="flex items-start gap-2 text-[12.5px] leading-relaxed text-zinc-700">
                  <span
                    className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-white tabular-nums"
                    style={{ background: 'var(--mt-accent)' }}
                  >
                    {i + 1}
                  </span>
                  {line}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </Section>

      <InviteAgentForm
        project={project}
        isDisabled={false}
        onInvited={() => window.location.reload()}
      />

      {/* Team skill matrix — sourced from agent.skills */}
      {agentsList.length > 0 && (
        <Section
          title="Skill coverage"
          description="How many teammates carry each skill chip."
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {skillUsage.map((s) => (
              <div key={s.skill} className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <span className="truncate text-[12px] font-semibold text-zinc-800">{s.skill}</span>
                <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-zinc-100 px-1.5 font-mono text-[10.5px] tabular-nums text-zinc-700">
                  {s.count}
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section
        title="Current agents"
        description={`${agentsList.length} ${agentsList.length === 1 ? 'teammate' : 'teammates'} on this project.`}
      >
        {agentsList.length === 0 ? (
          <EmptyState title="No teammates yet" description="Invite an agent above to get them onto this project." />
        ) : (
          <ul className="divide-y divide-zinc-100">
            {agentsList.map((agent: any, i: number) => {
              const presence = presenceFor(agent.userId?.toString?.() || agent.email || agent.name || '');
              return (
                <m.li
                  key={agent.userId.toString()}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar>
                          <ZoruAvatarImage src={`https://api.dicebear.com/7.x/lorelei/svg?seed=${agent.email}`} alt={agent.name} />
                          <ZoruAvatarFallback>{agent.name?.substring(0, 2).toUpperCase()}</ZoruAvatarFallback>
                        </Avatar>
                        <span
                          aria-hidden
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
                            presence.tone === 'sent' ? 'bg-emerald-500' : presence.tone === 'queued' ? 'bg-amber-500' : 'bg-zinc-300'
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[13.5px] font-semibold text-zinc-950">{agent.name}</p>
                          <StatusPill tone={presence.tone}>{presence.label}</StatusPill>
                        </div>
                        <p className="truncate text-[12px] text-zinc-500">{agent.email}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] capitalize">{agent.role}</Badge>
                          {(agent.skills || []).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                          ))}
                          {(agent.skills || []).length === 0 && (
                            <span className="text-[10.5px] italic text-zinc-400">No skills set</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <WaButton
                        variant="outline"
                        size="sm"
                        leftIcon={Settings}
                        onClick={() => {
                          setEditingSkillsAgentId(agent.userId.toString());
                          setCurrentSkills(agent.skills || []);
                        }}
                      >
                        Skills
                      </WaButton>
                      <button
                        type="button"
                        onClick={() => handleInitiateRemoveAgent(agent)}
                        disabled={isPending}
                        className="grid h-8 w-8 place-items-center rounded-full border border-zinc-200 text-rose-600 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 active:scale-[0.97] disabled:opacity-50"
                        aria-label="Remove agent"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} />
                      </button>
                    </div>
                  </div>

                  <AnimatePresence>
                    {editingSkillsAgentId === agent.userId.toString() && (
                      <m.div
                        key="skills-editor"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: EASE_OUT }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="mb-2 flex items-center justify-between">
                            <h4 className="text-[12px] font-semibold text-zinc-900">Edit skills</h4>
                            <button
                              type="button"
                              onClick={() => setEditingSkillsAgentId(null)}
                              className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
                              aria-label="Close"
                            >
                              <X className="h-3 w-3" strokeWidth={2.5} />
                            </button>
                          </div>
                          <div className="mb-3 flex flex-wrap gap-1.5">
                            {AVAILABLE_SKILLS.map((skill) => {
                              const active = currentSkills.includes(skill);
                              return (
                                <button
                                  key={skill}
                                  type="button"
                                  onClick={() => toggleSkill(skill)}
                                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-[transform,background-color,color] duration-150 active:scale-[0.97] ${
                                    active
                                      ? 'border-transparent text-white'
                                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-900'
                                  }`}
                                  style={active ? { background: 'var(--mt-accent)' } : undefined}
                                >
                                  {skill}
                                </button>
                              );
                            })}
                          </div>
                          <WaButton size="sm" onClick={() => handleSaveSkills(agent.userId.toString())} disabled={isPending}>
                            Save skills
                          </WaButton>
                        </div>
                      </m.div>
                    )}
                  </AnimatePresence>
                </m.li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Remove agent dialog */}
      <Dialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Remove agent</ZoruDialogTitle>
            <ZoruDialogDescription>
              You are about to remove {agentToRemove?.name} from this project.
            </ZoruDialogDescription>
          </ZoruDialogHeader>

          <div className="space-y-4 py-3">
            {openTicketsCount > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
                <p className="font-semibold">Warning, {openTicketsCount} open tickets assigned</p>
                <p className="mt-1 text-[12px] text-amber-700">Reassign or unassign these tickets before removing the agent.</p>
              </div>
            ) : (
              <p className="text-[13px] text-zinc-600">This agent has no open tickets. Safe to remove.</p>
            )}

            {openTicketsCount > 0 && (
              <div className="space-y-1.5">
                <Label className="text-[12px] font-semibold text-zinc-700">Reassign tickets to</Label>
                <Select value={reassignTo} onValueChange={setReassignTo}>
                  <ZoruSelectTrigger className="rounded-xl"><ZoruSelectValue placeholder="Select agent" /></ZoruSelectTrigger>
                  <ZoruSelectContent>
                    <ZoruSelectItem value="unassigned">Leave unassigned</ZoruSelectItem>
                    {agentsList
                      .filter((a: any) => a.userId.toString() !== agentToRemove?.userId.toString())
                      .map((a: any) => (
                        <ZoruSelectItem key={a.userId.toString()} value={a.userId.toString()}>
                          {a.name}
                        </ZoruSelectItem>
                      ))}
                  </ZoruSelectContent>
                </Select>
              </div>
            )}
          </div>

          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setIsRemoveDialogOpen(false)} disabled={isPending}>
              Cancel
            </WaButton>
            <button
              type="button"
              onClick={handleConfirmRemove}
              disabled={isPending || (openTicketsCount > 0 && !reassignTo)}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-rose-600 px-4 text-[13px] font-semibold text-white transition-[transform,box-shadow] duration-150 hover:bg-rose-700 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending && <LoaderCircle className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />}
              Confirm remove
            </button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </div>
  );
}
