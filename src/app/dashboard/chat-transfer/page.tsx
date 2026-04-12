'use client';

/**
 * Wachat Chat Transfer — transfer conversations between agents.
 */

import * as React from 'react';
import { useState } from 'react';
import { LuArrowRightLeft, LuSend, LuUser } from 'react-icons/lu';
import { useProject } from '@/context/project-context';
import { useToast } from '@/hooks/use-toast';
import { ClayBreadcrumbs, ClayButton, ClayCard, ClayBadge } from '@/components/clay';

const AGENTS = [
  { id: 'a1', name: 'Priya Sharma' },
  { id: 'a2', name: 'Alex Johnson' },
  { id: 'a3', name: 'Maria Garcia' },
  { id: 'a4', name: 'Sam Wilson' },
  { id: 'a5', name: 'Raj Patel' },
];

interface Transfer {
  id: string;
  conversationId: string;
  fromAgent: string;
  toAgent: string;
  note: string;
  timestamp: string;
}

export default function ChatTransferPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();

  const [currentAgent] = useState('You');
  const [conversationId, setConversationId] = useState('');
  const [toAgent, setToAgent] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState<Transfer[]>([
    { id: '1', conversationId: 'conv_001', fromAgent: 'You', toAgent: 'Priya Sharma', note: 'Customer needs billing help', timestamp: '2026-04-12 13:45' },
    { id: '2', conversationId: 'conv_015', fromAgent: 'Alex Johnson', toAgent: 'You', note: 'Escalated technical issue', timestamp: '2026-04-12 11:20' },
    { id: '3', conversationId: 'conv_022', fromAgent: 'You', toAgent: 'Maria Garcia', note: '', timestamp: '2026-04-11 16:30' },
  ]);

  const handleTransfer = () => {
    if (!conversationId.trim() || !toAgent) {
      toast({ title: 'Missing fields', description: 'Select a conversation and target agent.', variant: 'destructive' });
      return;
    }
    const agentName = AGENTS.find((a) => a.id === toAgent)?.name || toAgent;
    const newTransfer: Transfer = {
      id: Date.now().toString(),
      conversationId: conversationId.trim(),
      fromAgent: currentAgent,
      toAgent: agentName,
      note: note.trim(),
      timestamp: new Date().toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }),
    };
    setHistory((prev) => [newTransfer, ...prev]);
    toast({ title: 'Transferred', description: `Conversation transferred to ${agentName}.` });
    setConversationId('');
    setToAgent('');
    setNote('');
  };

  const inputCls = 'rounded-lg border border-clay-border bg-clay-bg px-3 py-2 text-sm text-clay-ink placeholder:text-clay-ink-muted focus:border-clay-accent focus:outline-none w-full';

  return (
    <div className="clay-enter flex min-h-full flex-col gap-6">
      <ClayBreadcrumbs items={[
        { label: 'Wachat', href: '/home' },
        { label: activeProject?.name || 'Project', href: '/dashboard' },
        { label: 'Chat Transfer' },
      ]} />

      <div>
        <h1 className="text-[30px] font-semibold tracking-[-0.015em] text-clay-ink leading-[1.1]">Chat Transfer</h1>
        <p className="mt-1.5 text-[13px] text-clay-ink-muted">Transfer conversations between agents with optional notes.</p>
      </div>

      {/* Transfer form */}
      <ClayCard padded={false} className="p-5">
        <h2 className="text-[15px] font-semibold text-clay-ink mb-4">Transfer a Conversation</h2>

        <div className="flex items-center gap-2 mb-4 rounded-clay-md border border-clay-border bg-clay-bg p-3">
          <LuUser className="h-4 w-4 text-clay-ink-muted" />
          <span className="text-[13px] text-clay-ink-muted">Current Agent:</span>
          <span className="text-[13px] font-medium text-clay-ink">{currentAgent}</span>
        </div>

        <div className="grid gap-3 max-w-lg">
          <div>
            <label className="text-[12px] font-medium text-clay-ink-muted mb-1 block">Conversation ID</label>
            <input className={inputCls} placeholder="e.g. conv_001" value={conversationId} onChange={(e) => setConversationId(e.target.value)} />
          </div>
          <div>
            <label className="text-[12px] font-medium text-clay-ink-muted mb-1 block">Transfer To</label>
            <select className={inputCls} value={toAgent} onChange={(e) => setToAgent(e.target.value)}>
              <option value="">Select agent...</option>
              {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[12px] font-medium text-clay-ink-muted mb-1 block">Transfer Note (optional)</label>
            <textarea className="clay-input min-h-[72px] resize-y py-2.5 w-full" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add context for the receiving agent..." />
          </div>
        </div>
        <div className="mt-4">
          <ClayButton variant="obsidian" onClick={handleTransfer} disabled={!conversationId.trim() || !toAgent}
            leading={<LuSend className="h-4 w-4" />}>
            Transfer Conversation
          </ClayButton>
        </div>
      </ClayCard>

      {/* Transfer history */}
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight text-clay-ink leading-none">Transfer History</h2>
        <p className="mt-1.5 text-[12.5px] text-clay-ink-muted">Recent conversation transfers.</p>
      </div>

      {history.length > 0 ? (
        <ClayCard padded={false} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-clay-border text-[11px] font-semibold uppercase tracking-wide text-clay-ink-muted">
                <th className="px-5 py-3">Conversation</th>
                <th className="px-5 py-3">From</th>
                <th className="px-5 py-3" />
                <th className="px-5 py-3">To</th>
                <th className="px-5 py-3">Note</th>
                <th className="px-5 py-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {history.map((t) => (
                <tr key={t.id} className="border-b border-clay-border last:border-0">
                  <td className="px-5 py-3 text-[13px] font-mono text-clay-ink">{t.conversationId}</td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink">{t.fromAgent}</td>
                  <td className="px-5 py-3"><LuArrowRightLeft className="h-3.5 w-3.5 text-clay-ink-muted" /></td>
                  <td className="px-5 py-3 text-[13px] text-clay-ink font-medium">{t.toAgent}</td>
                  <td className="px-5 py-3 text-[12px] text-clay-ink-muted max-w-[200px] truncate">{t.note || '--'}</td>
                  <td className="px-5 py-3 text-[12px] text-clay-ink-muted whitespace-nowrap">{t.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ClayCard>
      ) : (
        <ClayCard className="p-12 text-center">
          <LuArrowRightLeft className="mx-auto h-12 w-12 text-clay-ink-muted/30 mb-4" />
          <p className="text-sm text-clay-ink-muted">No transfers yet.</p>
        </ClayCard>
      )}
      <div className="h-6" />
    </div>
  );
}
