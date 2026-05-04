'use client';

/**
 * Wachat Chat Transfer -- transfer conversations between agents.
 */

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { LuArrowRightLeft, LuSend, LuLoader } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';
import {
  transferConversation,
  getTransferHistory,
  getAgentStatuses,
} from '@/app/actions/wachat-features.actions';

export default function ChatTransferPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [contactId, setContactId] = useState('');
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, startLoading] = useTransition();
  const [isSending, setIsSending] = useState(false);

  const fetchData = useCallback((pid: string) => {
    startLoading(async () => {
      const [agentRes, histRes] = await Promise.all([getAgentStatuses(pid), getTransferHistory(pid)]);
      if (!agentRes.error) setAgents(agentRes.agents || []);
      if (!histRes.error) setHistory(histRes.history || []);
    });
  }, []);

  useEffect(() => { if (projectId) fetchData(projectId); }, [projectId, fetchData]);

  const handleTransfer = async () => {
    if (!contactId.trim() || !fromAgent || !toAgent) {
      toast({ title: 'Missing fields', description: 'Fill contact ID, from, and to agent.', variant: 'destructive' });
      return;
    }
    setIsSending(true);
    const res = await transferConversation(contactId.trim(), fromAgent, toAgent, note.trim());
    setIsSending(false);
    if (res.error) {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    } else {
      toast({ title: 'Transferred', description: 'Conversation transferred successfully.' });
      setContactId(''); setFromAgent(''); setToAgent(''); setNote('');
      if (projectId) fetchData(projectId);
    }
  };

  const inputCls = 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/dashboard' },
        { label: activeProject?.name || 'Project', href: '/wachat' },
        { label: 'Chat Transfer' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-foreground leading-[1.1]">Chat Transfer</h1>
        <p className="mt-1.5 text-[13px] text-muted-foreground">Transfer conversations between agents with optional notes.</p>
      </div>

      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-foreground mb-4">Transfer a Conversation</h2>
        <div className="grid gap-3 max-w-lg">
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Contact ID</label>
            <input className={inputCls} placeholder="e.g. 6612abc..." value={contactId} onChange={(e) => setContactId(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">From Agent</label>
            <select className={inputCls} value={fromAgent} onChange={(e) => setFromAgent(e.target.value)}>
              <option value="">Select agent...</option>
              {agents.map((a) => <option key={a._id} value={a._id}>{a.name || a.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">To Agent</label>
            <select className={inputCls} value={toAgent} onChange={(e) => setToAgent(e.target.value)}>
              <option value="">Select agent...</option>
              {agents.map((a) => <option key={a._id} value={a._id}>{a.name || a.email}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-muted-foreground mb-1 block">Note (optional)</label>
            <textarea className={`${inputCls} min-h-[60px] resize-y`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context..." />
          </div>
        </div>
        <div className="mt-4">
          <ClayButton variant="obsidian" onClick={handleTransfer} disabled={isSending || !contactId.trim() || !fromAgent || !toAgent}
            leading={isSending ? <LuLoader className="h-4 w-4 animate-spin" /> : <LuSend className="h-4 w-4" />}>
            {isSending ? 'Transferring...' : 'Transfer Conversation'}
          </ClayButton>
        </div>
      </ClayCard>

      <h2 className="text-[22px] font-semibold tracking-tight text-foreground leading-none">Transfer History</h2>

      {isLoading && history.length === 0 ? (
        <div className="flex h-20 items-center justify-center"><LuLoader className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : history.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Contact</th>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t._id} className="border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-mono text-foreground">{t.contactId}</td>
                  <td className="px-5 py-3 text-[13px] text-foreground">{t.fromAgentId}</td>
                  <td className="px-5 py-3 text-[13px] text-foreground font-medium">{t.toAgentId}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground max-w-[200px] truncate">{t.note || '--'}</td>
                  <td className="px-5 py-3 text-[12px] text-muted-foreground whitespace-nowrap">
                    {t.transferredAt ? new Date(t.transferredAt).toLocaleString() : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuArrowRightLeft className="mx-auto h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">No transfers yet.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
