'use client';
import { fmtDate } from "@/lib/utils";

import {
  useZoruToast,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
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
  EmptyState,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { ArrowRightLeft,
  Send,
  Loader2 } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { transferConversation, getTransferHistory, getAgentStatuses } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chat-transfer — Manual conversation reassignment, rebuilt
 * on ZoruUI primitives. Adds a confirm-transfer dialog on top of the
 * existing form.
 */

import * as React from 'react';

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
      toast({
        title: 'Transferred',
        description: 'Conversation transferred successfully.',
      });
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
    '—';
  const toAgentLabel =
    agents.find((a) => a._id === toAgent)?.name ||
    agents.find((a) => a._id === toAgent)?.email ||
    '—';

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/wachat">WaChat</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Chat Transfer</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-[30px] tracking-[-0.015em] text-zoru-ink leading-[1.1]">
          Chat Transfer
        </h1>
        <p className="mt-1.5 text-[13px] text-zoru-ink-muted">
          Transfer conversations between agents with optional notes.
        </p>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-[15px] text-zoru-ink">Transfer a Conversation</h2>
        <div className="grid max-w-lg gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-id">Contact ID</Label>
            <Input
              id="contact-id"
              placeholder="e.g. 6612abc..."
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>From Agent</Label>
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
            <Label>To Agent</Label>
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
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="transfer-note">Note (optional)</Label>
            <Textarea
              id="transfer-note"
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context..."
            />
          </div>
        </div>
        <div className="mt-4">
          <Button
            onClick={requestTransfer}
            disabled={
              isSending || !contactId.trim() || !fromAgent || !toAgent
            }
          >
            {isSending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Send />
            )}
            {isSending ? 'Transferring...' : 'Transfer Conversation'}
          </Button>
        </div>
      </Card>

      <h2 className="text-[22px] tracking-tight text-zoru-ink leading-none">
        Transfer History
      </h2>

      {isLoading && history.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-zoru-ink-muted" />
        </div>
      ) : history.length > 0 ? (
        <Card className="overflow-x-auto p-0">
          <Table>
            <ZoruTableHeader>
              <ZoruTableRow>
                <ZoruTableHead>Contact</ZoruTableHead>
                <ZoruTableHead>From</ZoruTableHead>
                <ZoruTableHead>To</ZoruTableHead>
                <ZoruTableHead>Note</ZoruTableHead>
                <ZoruTableHead>Time</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {history.map((t) => (
                <ZoruTableRow key={t._id}>
                  <ZoruTableCell className="font-mono text-[13px] text-zoru-ink">
                    {t.contactId}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {t.fromAgentId}
                  </ZoruTableCell>
                  <ZoruTableCell className="text-[13px] text-zoru-ink">
                    {t.toAgentId}
                  </ZoruTableCell>
                  <ZoruTableCell className="max-w-[200px] truncate text-[12px] text-zoru-ink-muted">
                    {t.note || '--'}
                  </ZoruTableCell>
                  <ZoruTableCell className="whitespace-nowrap text-[12px] text-zoru-ink-muted">
                    {t.transferredAt
                      ? fmtDate(t.transferredAt)
                      : '--'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ))}
            </ZoruTableBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={<ArrowRightLeft />}
          title="No transfers yet"
          description="Once you transfer a conversation, it will appear here."
        />
      )}

      {/* Confirm transfer dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Confirm transfer</ZoruDialogTitle>
            <ZoruDialogDescription>
              You&apos;re about to transfer conversation{' '}
              <span className="font-mono text-zoru-ink">{contactId}</span> from{' '}
              <span className="text-zoru-ink">{fromAgentLabel}</span> to{' '}
              <span className="text-zoru-ink">{toAgentLabel}</span>.
              {note.trim() && (
                <span className="mt-2 block">
                  Note: <span className="text-zoru-ink">{note}</span>
                </span>
              )}
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <ZoruDialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={isSending}>
              {isSending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Send />
              )}
              {isSending ? 'Transferring...' : 'Confirm transfer'}
            </Button>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      <div className="h-6" />
    </div>
  );
}
