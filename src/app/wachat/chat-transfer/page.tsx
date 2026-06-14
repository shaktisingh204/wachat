'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  Field,
  Input,
  Textarea,
  SelectField as Select,
  Modal,
  EmptyState,
  Spinner,
  Table,
  THead,
  TBody,
  Th,
  Tr,
  Td,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import { ArrowRightLeft,
  Send } from 'lucide-react';

import { useProject } from '@/context/project-context';
import { transferConversation, getTransferHistory, getAgentStatuses } from '@/app/actions/wachat-features.actions';

import { WachatPage } from '@/app/wachat/_components/wachat-page';

/**
 * /wachat/chat-transfer — Manual conversation reassignment, rebuilt
 * on 20ui primitives. Adds a confirm-transfer dialog on top of the
 * existing form.
 */

import * as React from 'react';

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
        tone: 'danger',
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
      toast({ title: 'Error', description: res.error, tone: 'danger' });
    } else {
      toast({
        title: 'Transferred',
        description: 'Conversation transferred successfully.',
        tone: 'success',
      });
      setContactId('');
      setFromAgent('');
      setToAgent('');
      setNote('');
      if (projectId) fetchData(projectId);
    }
  };

  const agentOptions = agents.map((a) => ({
    value: a._id as string,
    label: (a.name || a.email) as string,
  }));

  const fromAgentLabel =
    agents.find((a) => a._id === fromAgent)?.name ||
    agents.find((a) => a._id === fromAgent)?.email ||
    '—';
  const toAgentLabel =
    agents.find((a) => a._id === toAgent)?.name ||
    agents.find((a) => a._id === toAgent)?.email ||
    '—';

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Chat Transfer' },
      ]}
      title="Chat Transfer"
      description="Transfer conversations between agents with optional notes."
      width="narrow"
    >
      <Card padding="none">
        <CardHeader>
          <CardTitle>Transfer a Conversation</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid max-w-lg gap-3">
            <Field label="Contact ID">
              <Input
                id="contact-id"
                placeholder="e.g. 6612abc..."
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
              />
            </Field>
            <Field label="From Agent">
              <Select
                value={fromAgent || null}
                onChange={(v) => setFromAgent(v ?? '')}
                options={agentOptions}
                placeholder="Select agent..."
                aria-label="From Agent"
              />
            </Field>
            <Field label="To Agent">
              <Select
                value={toAgent || null}
                onChange={(v) => setToAgent(v ?? '')}
                options={agentOptions}
                placeholder="Select agent..."
                aria-label="To Agent"
              />
            </Field>
            <Field label="Note (optional)">
              <Textarea
                id="transfer-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context..."
              />
            </Field>
          </div>
          <div className="mt-4">
            <Button
              variant="primary"
              iconLeft={Send}
              loading={isSending}
              onClick={requestTransfer}
              disabled={
                isSending || !contactId.trim() || !fromAgent || !toAgent
              }
            >
              {isSending ? 'Transferring...' : 'Transfer Conversation'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <h2 className="text-[22px] tracking-tight leading-none text-[var(--st-text)]">
        Transfer History
      </h2>

      {isLoading && history.length === 0 ? (
        <div className="flex h-20 items-center justify-center">
          <Spinner label="Loading transfer history" />
        </div>
      ) : history.length > 0 ? (
        <Card padding="none" className="overflow-x-auto">
          <Table>
            <THead>
              <Tr>
                <Th>Contact</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Note</Th>
                <Th>Time</Th>
              </Tr>
            </THead>
            <TBody>
              {history.map((t) => (
                <Tr key={t._id}>
                  <Td className="font-mono text-[13px] text-[var(--st-text)]">
                    {t.contactId}
                  </Td>
                  <Td className="text-[13px] text-[var(--st-text)]">
                    {t.fromAgentId}
                  </Td>
                  <Td className="text-[13px] text-[var(--st-text)]">
                    {t.toAgentId}
                  </Td>
                  <Td
                    truncate
                    className="max-w-[200px] text-[12px] text-[var(--st-text-secondary)]"
                  >
                    {t.note || '--'}
                  </Td>
                  <Td className="whitespace-nowrap text-[12px] text-[var(--st-text-secondary)]">
                    {t.transferredAt
                      ? fmtDate(t.transferredAt)
                      : '--'}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </Card>
      ) : (
        <EmptyState
          icon={ArrowRightLeft}
          title="No transfers yet"
          description="Once you transfer a conversation, it will appear here."
        />
      )}

      {/* Confirm transfer dialog */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm transfer"
        description={
          <>
            You&apos;re about to transfer conversation{' '}
            <span className="font-mono text-[var(--st-text)]">{contactId}</span> from{' '}
            <span className="text-[var(--st-text)]">{fromAgentLabel}</span> to{' '}
            <span className="text-[var(--st-text)]">{toAgentLabel}</span>.
            {note.trim() && (
              <span className="mt-2 block">
                Note: <span className="text-[var(--st-text)]">{note}</span>
              </span>
            )}
          </>
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={isSending}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              iconLeft={Send}
              loading={isSending}
              onClick={handleTransfer}
              disabled={isSending}
            >
              {isSending ? 'Transferring...' : 'Confirm transfer'}
            </Button>
          </>
        }
      />
    </WachatPage>
  );
}
