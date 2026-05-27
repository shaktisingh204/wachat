'use client';

import * as React from 'react';
import { useEffect, useMemo, useState, useTransition, useCallback } from 'react';
import {
  ArrowRightLeft,
  Send,
  Loader2,
  Clock,
  Users,
  Inbox,
  Timer,
} from 'lucide-react';
import { m } from 'motion/react';

import {
  useZoruToast,
  Input,
  Textarea,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Dialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { fmtDate } from '@/lib/utils';
import { useProject } from '@/context/project-context';
import {
  transferConversation,
  getTransferHistory,
  getAgentStatuses,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-transfer - Manual conversation reassignment. Adds an
 * SLA strip with median transfer time, agents online, and queue depth,
 * plus a transfer-reason breakdown.
 */

const REASON_PRESETS = [
  { value: 'specialist', label: 'Specialist needed' },
  { value: 'shift', label: 'Shift change' },
  { value: 'escalation', label: 'Escalation' },
  { value: 'language', label: 'Language' },
  { value: 'workload', label: 'Workload balancing' },
  { value: 'other', label: 'Other' },
];

function classifyReason(note: string): string {
  const n = (note || '').toLowerCase();
  if (!n) return 'other';
  if (/(specialist|expert|senior)/.test(n)) return 'specialist';
  if (/(shift|handover|eod|out of office)/.test(n)) return 'shift';
  if (/(escalat|priority|urgent)/.test(n)) return 'escalation';
  if (/(language|hindi|spanish|translate)/.test(n)) return 'language';
  if (/(load|busy|overflow|workload)/.test(n)) return 'workload';
  return 'other';
}

function fmtDuration(ms?: number) {
  if (!ms || !Number.isFinite(ms)) return '--';
  const s = ms / 1000;
  if (s < 60) return `${Math.round(s)}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

export default function ChatTransferPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [contactId, setContactId] = useState('');
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [reason, setReason] = useState<string>('specialist');
  const [note, setNote] = useState('');
  const [isLoading, startLoading] = useTransition();
  const [isSending, setIsSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchData = useCallback((pid: string) => {
    startLoading(async () => {
      const [agentRes, histRes] = await Promise.all([
        getAgentStatuses(pid),
        getTransferHistory(pid),
      ]);
      if (!agentRes.error) setAgents(agentRes.agents || []);
      if (!histRes.error) setHistory(histRes.history || []);
    });
  }, []);

  useEffect(() => {
    if (projectId) fetchData(projectId);
  }, [projectId, fetchData]);

  const requestTransfer = () => {
    if (!contactId.trim() || !fromAgent || !toAgent) {
      toast({
        title: 'Missing fields',
        description: 'Fill contact ID, from, and to agent.',
        variant: 'destructive',
      });
      return;
    }
    setConfirmOpen(true);
  };

  const handleTransfer = async () => {
    setIsSending(true);
    const combinedNote = reason
      ? `[${REASON_PRESETS.find((r) => r.value === reason)?.label || reason}] ${note.trim()}`.trim()
      : note.trim();
    const res = await transferConversation(
      contactId.trim(),
      fromAgent,
      toAgent,
      combinedNote,
    );
    setIsSending(false);
    setConfirmOpen(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Transferred', description: 'Conversation transferred successfully.' });
      setContactId('');
      setFromAgent('');
      setToAgent('');
      setNote('');
      setReason('specialist');
      if (projectId) fetchData(projectId);
    }
  };

  const fromAgentLabel =
    agents.find((a) => a._id === fromAgent)?.name ||
    agents.find((a) => a._id === fromAgent)?.email ||
    '-';
  const toAgentLabel =
    agents.find((a) => a._id === toAgent)?.name ||
    agents.find((a) => a._id === toAgent)?.email ||
    '-';

  // Derived KPIs
  const agentsOnline = useMemo(
    () =>
      agents.filter(
        (a) => a.status === 'online' || a.online === true || a.status === 'available',
      ).length,
    [agents],
  );
  const queueDepth = useMemo(
    () => agents.reduce((s, a) => s + (Number(a.openCount) || Number(a.queueDepth) || 0), 0),
    [agents],
  );
  const medianTransferMs = useMemo(() => {
    const durations: number[] = [];
    for (const t of history) {
      const a = Number(t.durationMs);
      if (Number.isFinite(a)) durations.push(a);
      else if (t.startedAt && t.transferredAt) {
        const ms = new Date(t.transferredAt).getTime() - new Date(t.startedAt).getTime();
        if (Number.isFinite(ms) && ms > 0) durations.push(ms);
      }
    }
    if (durations.length === 0) return null;
    durations.sort((a, b) => a - b);
    return durations[Math.floor(durations.length / 2)];
  }, [history]);

  const reasonBreakdown = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of history) {
      const r = t.reason || classifyReason(t.note || '');
      counts.set(r, (counts.get(r) ?? 0) + 1);
    }
    const total = history.length || 1;
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        label: REASON_PRESETS.find((p) => p.value === id)?.label || id,
        count,
        pct: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }, [history]);

  return (
    <WaPage>
      <PageHeader
        title="Chat transfer"
        description="Hand a conversation to a different agent with an optional handover note."
        kicker="Wachat · transfer"
        backHref="/wachat"
        eyebrowIcon={ArrowRightLeft}
      />

      {/* SLA strip */}
      <section aria-labelledby="transfer-sla" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <h2 id="transfer-sla" className="sr-only">Transfer SLA</h2>
        <MetricTile
          label="Transfers logged"
          value={history.length.toLocaleString('en-IN')}
          icon={ArrowRightLeft}
          delay={0}
        />
        <MetricTile
          label="Median transfer time"
          value={fmtDuration(medianTransferMs ?? undefined)}
          icon={Timer}
          delay={0.04}
        />
        <MetricTile
          label="Agents online"
          value={`${agentsOnline.toLocaleString('en-IN')} / ${agents.length.toLocaleString('en-IN')}`}
          icon={Users}
          delay={0.08}
        />
        <MetricTile
          label="Queue depth"
          value={queueDepth.toLocaleString('en-IN')}
          icon={Inbox}
          delay={0.12}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)] mb-4">
        <Section title="Transfer a conversation" description="The customer keeps the same thread; only ownership changes.">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="contact-id">Contact ID</Label>
              <Input
                id="contact-id"
                placeholder="e.g. 6612abc..."
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>From agent</Label>
              <Select value={fromAgent} onValueChange={setFromAgent}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select agent..." />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {agents.map((a) => (
                    <ZoruSelectItem key={a._id} value={a._id}>
                      {a.name || a.email}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>To agent</Label>
              <Select value={toAgent} onValueChange={setToAgent}>
                <ZoruSelectTrigger>
                  <ZoruSelectValue placeholder="Select agent..." />
                </ZoruSelectTrigger>
                <ZoruSelectContent>
                  {agents.map((a) => (
                    <ZoruSelectItem key={a._id} value={a._id}>
                      {a.name || a.email}
                    </ZoruSelectItem>
                  ))}
                </ZoruSelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label>Transfer reason</Label>
              <div className="flex flex-wrap gap-1.5">
                {REASON_PRESETS.map((r) => {
                  const active = reason === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setReason(r.value)}
                      className={`rounded-full border px-3 py-1 text-[11.5px] font-semibold transition-colors duration-150 active:scale-[0.97] ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-900'
                      }`}
                      style={active ? { background: 'var(--mt-accent)' } : undefined}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="transfer-note">Handover note (optional)</Label>
              <Textarea
                id="transfer-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context for the receiving agent..."
              />
            </div>
          </div>
          <div className="mt-4">
            <WaButton
              onClick={requestTransfer}
              leftIcon={isSending ? Loader2 : Send}
              disabled={isSending || !contactId.trim() || !fromAgent || !toAgent}
            >
              {isSending ? 'Transferring...' : 'Transfer conversation'}
            </WaButton>
          </div>
        </Section>

        <Section title="Reason breakdown" description={`${history.length.toLocaleString('en-IN')} transfers classified.`}>
          {reasonBreakdown.length === 0 ? (
            <EmptyState
              icon={ArrowRightLeft}
              title="No transfers yet"
              description="Reason breakdown populates after the first transfer."
            />
          ) : (
            <ul className="space-y-2.5">
              {reasonBreakdown.map((r, i) => (
                <m.li
                  key={r.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04, ease: EASE_OUT }}
                  className="grid grid-cols-[1fr_auto] items-center gap-2"
                >
                  <span className="truncate text-[12px] text-zinc-700">{r.label}</span>
                  <span className="text-[11px] font-semibold tabular-nums text-zinc-900">
                    {r.count} <span className="text-zinc-400">· {r.pct}%</span>
                  </span>
                  <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                    <m.div
                      initial={{ width: 0 }}
                      animate={{ width: `${r.pct}%` }}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.04, ease: EASE_OUT }}
                      className="h-full rounded-full"
                      style={{ background: 'var(--mt-accent)' }}
                    />
                  </div>
                </m.li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section
        title="Transfer history"
        description={`${history.length.toLocaleString('en-IN')} recorded transfer${history.length === 1 ? '' : 's'}.`}
        padded={false}
      >
        {isLoading && history.length === 0 ? (
          <div className="flex h-24 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
          </div>
        ) : history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                  <th className="px-4 py-2.5">Contact</th>
                  <th className="px-4 py-2.5">From</th>
                  <th className="px-4 py-2.5">To</th>
                  <th className="px-4 py-2.5">Reason</th>
                  <th className="px-4 py-2.5">Note</th>
                  <th className="px-4 py-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.map((t, i) => {
                  const r = t.reason || classifyReason(t.note || '');
                  const reasonLabel = REASON_PRESETS.find((p) => p.value === r)?.label || r;
                  return (
                    <m.tr
                      key={t._id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                      className="text-[12.5px] transition-colors duration-150 hover:bg-zinc-50/60"
                    >
                      <td className="px-4 py-2 font-mono text-zinc-900">{t.contactId}</td>
                      <td className="px-4 py-2 text-zinc-800">{t.fromAgentId}</td>
                      <td className="px-4 py-2 text-zinc-800">{t.toAgentId}</td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-700">
                          {reasonLabel}
                        </span>
                      </td>
                      <td className="max-w-[220px] truncate px-4 py-2 text-[12px] text-zinc-500">{t.note || '-'}</td>
                      <td className="whitespace-nowrap px-4 py-2 text-[11.5px] text-zinc-500 tabular-nums">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" strokeWidth={2} aria-hidden />
                          {t.transferredAt ? fmtDate(t.transferredAt) : '-'}
                        </span>
                      </td>
                    </m.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              icon={ArrowRightLeft}
              title="No transfers yet"
              description="Once you transfer a conversation, it will appear here."
            />
          </div>
        )}
      </Section>

      {/* Confirm transfer dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Confirm transfer</ZoruDialogTitle>
            <ZoruDialogDescription>
              You&apos;re about to transfer conversation{' '}
              <span className="font-mono text-zinc-900">{contactId}</span> from{' '}
              <span className="text-zinc-900">{fromAgentLabel}</span> to{' '}
              <span className="text-zinc-900">{toAgentLabel}</span>.
              <span className="mt-2 block">
                Reason: <span className="text-zinc-900">{REASON_PRESETS.find((p) => p.value === reason)?.label || reason}</span>
              </span>
              {note.trim() && (
                <span className="mt-1 block">
                  Note: <span className="text-zinc-900">{note}</span>
                </span>
              )}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <WaButton variant="outline" onClick={() => setConfirmOpen(false)} disabled={isSending}>
              Cancel
            </WaButton>
            <WaButton onClick={handleTransfer} leftIcon={isSending ? Loader2 : Send} disabled={isSending}>
              {isSending ? 'Transferring...' : 'Confirm transfer'}
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>
    </WaPage>
  );
}
