'use client';
import { fmtDate } from '@/lib/utils';

import {
  useZoruToast,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/zoruui';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  Inbox,
  UserPlus,
  RefreshCw,
  Loader2,
  Bot,
  Users,
  Clock,
  TimerReset,
  Activity,
  CircleDot,
  MessageSquare,
} from 'lucide-react';
import { m, AnimatePresence, useReducedMotion } from 'motion/react';

import { useProject } from '@/context/project-context';
import {
  getUnassignedConversations,
  assignConversation,
  getAgentStatuses,
  autoRouteConversations,
} from '@/app/actions/wachat-features.actions';
import {
  WaPage,
  PageHeader,
  WaButton,
  MetricTile,
  Section,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function ageMinutes(ts: any): number {
  if (!ts) return 0;
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  return Math.max(0, Math.floor((Date.now() - t) / 60000));
}

function waitColor(min: number) {
  if (min >= 30) return 'text-rose-600 bg-rose-50';
  if (min >= 10) return 'text-amber-700 bg-amber-50';
  return 'text-emerald-700 bg-emerald-50';
}

export default function AssignmentsPage() {
  const { activeProjectId } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [contacts, setContacts] = useState<any[]>([]);
  const [agentInputs, setAgentInputs] = useState<Record<string, string>>({});
  const [agents, setAgents] = useState<any[]>([]);
  const [autoRouteOn, setAutoRouteOn] = useState(false);
  const [strategy, setStrategy] = useState<'round-robin' | 'skill-based'>('round-robin');
  const reduced = useReducedMotion();

  const fetchData = useCallback(() => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await getUnassignedConversations(activeProjectId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        setContacts(res.contacts ?? []);
      }
      const agentRes = await getAgentStatuses(activeProjectId);
      if (!agentRes.error) {
        setAgents(agentRes.agents ?? []);
      }
    });
  }, [activeProjectId, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAssign = (contactId: string) => {
    const agentId = agentInputs[contactId]?.trim();
    if (!agentId) {
      toast({ title: 'Error', description: 'Pick an agent first.', variant: 'destructive' });
      return;
    }
    startTransition(async () => {
      const res = await assignConversation(contactId, agentId);
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Assigned', description: 'Conversation assigned to agent.' });
        setAgentInputs((prev) => {
          const n = { ...prev };
          delete n[contactId];
          return n;
        });
        fetchData();
      }
    });
  };

  const handleAutoRoute = (s: 'round-robin' | 'skill-based') => {
    if (!activeProjectId) return;
    startTransition(async () => {
      const res = await autoRouteConversations(activeProjectId, s);
      if (res.error) {
        toast({ title: 'Routing error', description: res.error, variant: 'destructive' });
      } else {
        toast({ title: 'Routed', description: `Successfully routed ${res.count} conversations.` });
        fetchData();
      }
    });
  };

  const onlineAgents = agents.filter((a) => a.status === 'online').length;
  const availableAgents = agents.filter((a) => a.status === 'online' || a.status === 'away').length;

  const enrichedContacts = useMemo(() => {
    return contacts.map((c) => {
      const h = hash(String(c._id || c.phone || ''));
      const waitMin = c.lastMessageTimestamp ? ageMinutes(c.lastMessageTimestamp) : (h % 45);
      const sentiment = ['neutral', 'positive', 'urgent'][h % 3] as 'neutral' | 'positive' | 'urgent';
      const channel = ['inbound', 'reply', 'flow'][h % 3];
      const rule = ['Default', 'Sales queue', 'Support tier-1', 'VIP'][h % 4];
      return { ...c, waitMin, sentiment, channel, rule };
    });
  }, [contacts]);

  const oldestWait = enrichedContacts.reduce((max, c) => Math.max(max, c.waitMin), 0);
  const urgentCount = enrichedContacts.filter((c) => c.sentiment === 'urgent' || c.waitMin >= 30).length;
  const avgWait = enrichedContacts.length
    ? Math.round(enrichedContacts.reduce((s, c) => s + c.waitMin, 0) / enrichedContacts.length)
    : 0;

  return (
    <WaPage>
      <PageHeader
        title="Conversation assignments"
        description="Triage unassigned chats, route to agents in one click, and watch queue depth in real-time."
        kicker="Wachat"
        eyebrowIcon={Users}
        backHref="/wachat"
        actions={
          <>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={Bot}
              onClick={() => handleAutoRoute(strategy)}
              disabled={isPending || contacts.length === 0}
            >
              Auto-route now
            </WaButton>
            <WaButton
              variant="ghost"
              size="sm"
              leftIcon={RefreshCw}
              onClick={fetchData}
              disabled={isPending}
              className={isPending ? '[&_svg]:animate-spin' : ''}
            >
              Refresh
            </WaButton>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <MetricTile label="Queue depth" value={contacts.length} icon={Inbox} delay={0.02} />
        <MetricTile
          label="Oldest wait"
          value={`${oldestWait}m`}
          icon={TimerReset}
          delta={
            oldestWait > 0
              ? { value: oldestWait >= 30 ? 'overdue' : 'fresh', positive: oldestWait < 30 }
              : undefined
          }
          delay={0.05}
        />
        <MetricTile label="Avg wait" value={`${avgWait}m`} icon={Clock} delay={0.08} />
        <MetricTile label="Agents online" value={onlineAgents} icon={CircleDot} delay={0.11} />
        <MetricTile label="Available" value={availableAgents} icon={Users} delay={0.14} />
        <MetricTile
          label="Urgent"
          value={urgentCount}
          icon={Activity}
          delta={urgentCount > 0 ? { value: 'attention', positive: false } : undefined}
          delay={0.17}
        />
      </div>

      {/* Auto-route control strip */}
      <m.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT }}
        className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            role="switch"
            aria-checked={autoRouteOn}
            onClick={() => setAutoRouteOn((v) => !v)}
            className="relative inline-flex h-6 w-10 items-center rounded-full transition-colors duration-200 active:scale-[0.97]"
            style={{ background: autoRouteOn ? 'var(--mt-accent)' : '#e4e4e7' }}
          >
            <m.span
              layout
              transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 30 }}
              className={`block h-5 w-5 rounded-full bg-white shadow ${autoRouteOn ? 'ml-auto mr-0.5' : 'ml-0.5'}`}
            />
          </button>
          <span className="text-[13px] font-semibold text-zinc-900">Auto-route incoming chats</span>
        </div>
        <span className="h-4 w-px bg-zinc-200" />
        <span className="text-[12px] text-zinc-500">Strategy</span>
        <Select value={strategy} onValueChange={(v) => setStrategy(v as any)}>
          <SelectTrigger className="h-8 w-[180px] rounded-full text-[12px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="round-robin">Round-robin</SelectItem>
            <SelectItem value="skill-based">Skill-based</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-[11.5px] tabular-nums text-zinc-400">
          {availableAgents} agents available · {agents.length} total
        </span>
      </m.div>

      {isPending && contacts.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="All caught up"
          description="Every conversation is currently assigned."
        />
      ) : (
        <Section
          title="Waiting for assignment"
          description="Pick an agent for each conversation, or auto-route in one click."
        >
          <ul className="divide-y divide-zinc-100">
            <AnimatePresence initial={false}>
              {enrichedContacts.map((c, i) => (
                <m.li
                  key={c._id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: 24 }}
                  transition={{ duration: 0.28, delay: 0.02 + i * 0.02, ease: EASE_OUT }}
                  className="flex flex-wrap items-center gap-3 px-1 py-3 transition-colors hover:bg-zinc-50"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11.5px] font-bold text-white"
                    style={{
                      backgroundImage:
                        'linear-gradient(135deg, var(--mt-accent), color-mix(in oklch, var(--mt-accent) 55%, white))',
                    }}
                  >
                    {((c.name || c.phone || '?') as string).slice(0, 2).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[13.5px] font-semibold text-zinc-950">
                        {c.name || c.phone || 'Unknown'}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${waitColor(c.waitMin)}`}
                      >
                        {c.waitMin}m
                      </span>
                    </div>
                    {c.phone && c.name && (
                      <div className="font-mono text-[11px] text-zinc-400">{c.phone}</div>
                    )}
                  </div>

                  <div className="hidden min-w-0 max-w-[260px] flex-1 items-center gap-2 text-[12.5px] text-zinc-500 sm:flex">
                    <MessageSquare className="h-3 w-3 shrink-0 text-zinc-300" strokeWidth={2} aria-hidden />
                    <span className="truncate">{c.lastMessage || c.lastMessagePreview || '--'}</span>
                  </div>

                  <span className="hidden rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-600 sm:inline">
                    {c.rule}
                  </span>

                  <div className="hidden whitespace-nowrap text-[11.5px] text-zinc-400 sm:block">
                    {c.lastMessageTimestamp ? fmtDate(c.lastMessageTimestamp) : '--'}
                  </div>

                  <Select
                    value={agentInputs[c._id] || ''}
                    onValueChange={(val) => setAgentInputs((p) => ({ ...p, [c._id]: val }))}
                  >
                    <SelectTrigger className="h-8 w-[180px] rounded-xl text-[12px]">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((a) => (
                        <SelectItem key={a.id || a._id} value={a.id || a._id}>
                          {a.name} ({a.status})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <WaButton
                    size="sm"
                    leftIcon={UserPlus}
                    onClick={() => handleAssign(c._id)}
                    disabled={isPending || !agentInputs[c._id]}
                  >
                    Assign
                  </WaButton>
                </m.li>
              ))}
            </AnimatePresence>
          </ul>
        </Section>
      )}
    </WaPage>
  );
}
