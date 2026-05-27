'use client';

import * as React from 'react';
import { useEffect, useState, useTransition, useCallback } from 'react';
import { ArrowRightLeft, Send, Loader2 } from 'lucide-react';
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
 * /wachat/chat-transfer — Manual conversation reassignment, rebuilt
 * on wachat-ui primitives. The confirm-transfer dialog is preserved.
 */

export default function ChatTransferPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const projectId = activeProject?._id?.toString();

  const [agents, setAgents] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [contactId, setContactId] = useState('');
  const [fromAgent, setFromAgent] = useState('');
  const [toAgent, setToAgent] = useState('');
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
    const res = await transferConversation(
      contactId.trim(),
      fromAgent,
      toAgent,
      note.trim(),
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

  return (
    <WaPage>
      <PageHeader
        title="Chat transfer"
        description="Hand a conversation to a different agent with an optional handover note."
        kicker="Wachat · transfer"
        backHref="/wachat"
        eyebrowIcon={ArrowRightLeft}
      />

      <Section title="Transfer a conversation" description="The customer keeps the same thread; only ownership changes." className="mb-6">
        <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
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
        <div className="mt-5">
          <WaButton
            onClick={requestTransfer}
            leftIcon={isSending ? Loader2 : Send}
            disabled={isSending || !contactId.trim() || !fromAgent || !toAgent}
          >
            {isSending ? 'Transferring...' : 'Transfer conversation'}
          </WaButton>
        </div>
      </Section>

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
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">From</th>
                  <th className="px-5 py-3">To</th>
                  <th className="px-5 py-3">Note</th>
                  <th className="px-5 py-3">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {history.map((t, i) => (
                  <m.tr
                    key={t._id}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                    className="text-[13px] transition-colors duration-150 hover:bg-zinc-50/60"
                  >
                    <td className="px-5 py-3 font-mono text-zinc-900">{t.contactId}</td>
                    <td className="px-5 py-3 text-zinc-800">{t.fromAgentId}</td>
                    <td className="px-5 py-3 text-zinc-800">{t.toAgentId}</td>
                    <td className="max-w-[220px] truncate px-5 py-3 text-[12.5px] text-zinc-500">{t.note || '-'}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-[12px] text-zinc-500 tabular-nums">
                      {t.transferredAt ? fmtDate(t.transferredAt) : '-'}
                    </td>
                  </m.tr>
                ))}
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
              {note.trim() && (
                <span className="mt-2 block">
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
