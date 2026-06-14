'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Card,
  CardBody,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  EmptyState,
  Field,
  Input,
  Modal,
  SelectField as Select,
  StatCard,
  Switch,
  Table,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  Textarea,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import {
  Bot,
  Loader,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  } from 'lucide-react';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { AiIntentTester } from '@/components/wachat/automation/ai-intent-tester';
import {
  deleteChatbotResponse,
  getChatbotResponses,
  saveChatbotResponse,
  } from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chatbot — Chatbot config + flow picker + test chat panel (20ui).
 *
 * Visual swap to 20ui. Server actions and data flow are unchanged.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

const MATCH_TYPES = [
  { value: 'contains', label: 'Contains' },
  { value: 'exact', label: 'Exact match' },
  { value: 'regex', label: 'Regex' },
];

type ChatbotResponse = {
  _id: string;
  trigger: string;
  response: string;
  matchType: string;
  isActive?: boolean;
};

type ChatBubble = {
  role: 'user' | 'bot';
  text: string;
};

export default function ChatbotPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [responses, setResponses] = useState<ChatbotResponse[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [matchType, setMatchType] = useState('contains');
  const [isActive, setIsActive] = useState(true);

  const [trainOpen, setTrainOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatbotResponse | null>(null);

  // Test chat panel
  const [testInput, setTestInput] = useState('');
  const [testThread, setTestThread] = useState<ChatBubble[]>([]);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatbotResponses(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      setResponses((res.responses ?? []) as ChatbotResponse[]);
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (fd: FormData) => {
    fd.set('projectId', String(activeProject?._id ?? ''));
    fd.set('matchType', matchType);
    if (isActive) fd.set('isActive', 'on');
    const res = await saveChatbotResponse(null, fd);
    if (res.error) {
      toast({ title: 'Error', description: res.error, tone: 'danger' });
      return;
    }
    toast({ title: res.message || 'Saved', tone: 'success' });
    setCreateOpen(false);
    load();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const res = await deleteChatbotResponse(target._id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, tone: 'danger' });
        return;
      }
      toast({ title: 'Response deleted', tone: 'success' });
      setDeleteTarget(null);
      load();
    });
  };

  const matchResponse = (text: string): string | null => {
    const lower = text.toLowerCase();
    for (const r of responses) {
      if (!r.isActive) continue;
      const trigger = (r.trigger || '').toLowerCase();
      if (!trigger) continue;
      if (r.matchType === 'exact' && lower === trigger) return r.response;
      if (r.matchType === 'contains' && lower.includes(trigger)) return r.response;
      if (r.matchType === 'regex') {
        try {
          if (new RegExp(r.trigger, 'i').test(text)) return r.response;
        } catch {
          /* invalid regex — skip */
        }
      }
    }
    return null;
  };

  const sendTest = () => {
    const t = testInput.trim();
    if (!t) return;
    const reply = matchResponse(t) ?? 'No matching response — train me with a new rule.';
    setTestThread((prev) => [
      ...prev,
      { role: 'user', text: t },
      { role: 'bot', text: reply },
    ]);
    setTestInput('');
  };

  const totalRules = responses.length;
  const activeRules = responses.filter((r) => r.isActive).length;

  return (
    <WachatPage
      breadcrumb={[
        { label: 'SabNode', href: '/dashboard' },
        { label: 'WaChat', href: '/wachat' },
        { label: 'Chatbot' },
      ]}
      title="Chatbot Responses"
      description="Define keyword-triggered automatic replies for incoming messages. Test the bot in the side panel before going live."
      actions={
        <>
          <Button
            variant="outline"
            size="sm"
            iconLeft={RefreshCw}
            onClick={load}
            disabled={isPending}
          >
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            iconLeft={Sparkles}
            onClick={() => setTrainOpen(true)}
          >
            Train
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            onClick={() => setCreateOpen(true)}
          >
            New response
          </Button>
        </>
      }
    >
      <AiIntentTester className="mb-4" />
      {/* Stats */}
      <div className="grid max-w-md grid-cols-2 gap-3">
        <StatCard label="Total responses" value={totalRules} />
        <StatCard label="Active" value={activeRules} />
      </div>

      {/* Two-pane: responses table + test chat */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card padding="lg">
          <CardHeader className="mb-4 flex items-center justify-between">
            <CardTitle>Responses</CardTitle>
            {isPending && (
              <Loader
                className="h-4 w-4 animate-spin text-[var(--st-text-tertiary)]"
                aria-hidden="true"
              />
            )}
          </CardHeader>

          {!isPending && responses.length === 0 ? (
            <EmptyState
              icon={Bot}
              title="No chatbot responses configured"
              description="Add your first keyword-triggered reply to start auto-responding."
              action={
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Plus}
                  onClick={() => setCreateOpen(true)}
                >
                  New response
                </Button>
              }
            />
          ) : responses.length > 0 ? (
            <Table>
              <THead>
                <Tr>
                  <Th>Trigger</Th>
                  <Th>Response</Th>
                  <Th>Match</Th>
                  <Th>Status</Th>
                  <Th align="right">Action</Th>
                </Tr>
              </THead>
              <TBody>
                {responses.map((r) => (
                  <Tr key={r._id}>
                    <Td className="text-[13px] text-[var(--st-text)]">
                      {r.trigger}
                    </Td>
                    <Td
                      truncate
                      className="max-w-[260px] text-[13px] text-[var(--st-text-secondary)]"
                    >
                      {r.response}
                    </Td>
                    <Td className="text-[13px] text-[var(--st-text-secondary)]">
                      {r.matchType}
                    </Td>
                    <Td>
                      <Badge tone={r.isActive ? 'success' : 'neutral'}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <Button
                        variant="ghost"
                        size="sm"
                        iconLeft={Trash2}
                        onClick={() => setDeleteTarget(r)}
                        aria-label="Delete response"
                      />
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          ) : null}
        </Card>

        {/* Test chat panel */}
        <Card padding="none" className="flex h-fit flex-col">
          <CardHeader>
            <CardTitle>Test chat</CardTitle>
            <CardDescription>
              Try a message. The bot replies using your active rules.
            </CardDescription>
          </CardHeader>
          <CardBody
            className="flex h-[360px] flex-col gap-2 overflow-y-auto bg-[var(--st-bg-secondary)]"
          >
            {testThread.length === 0 ? (
              <div className="m-auto text-center">
                <Bot
                  className="mx-auto h-6 w-6 text-[var(--st-text-tertiary)]"
                  aria-hidden="true"
                />
                <p className="mt-2 text-[12px] text-[var(--st-text-secondary)]">
                  Start a test conversation
                </p>
              </div>
            ) : (
              testThread.map((bubble, i) => (
                <div
                  key={i}
                  className={cx(
                    'flex',
                    bubble.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cx(
                      'max-w-[80%] rounded-[var(--st-radius)] px-3 py-2 text-[13px]',
                      bubble.role === 'user'
                        ? 'bg-[var(--st-accent)] text-[var(--st-text-inverted)]'
                        : 'border border-[var(--st-border)] bg-[var(--st-bg)] text-[var(--st-text)]',
                    )}
                  >
                    {bubble.text}
                  </div>
                </div>
              ))
            )}
          </CardBody>
          <CardFooter className="flex gap-2">
            <Input
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type a message…"
              aria-label="Test message"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendTest();
                }
              }}
            />
            <Button
              variant="primary"
              iconLeft={Send}
              onClick={sendTest}
              disabled={!testInput.trim()}
              aria-label="Send"
            />
          </CardFooter>
        </Card>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[12px] text-[var(--st-text-secondary)]">
          Reset clears all chatbot responses for this project.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
          disabled={!responses.length}
        >
          Reset chatbot
        </Button>
      </div>

      {/* Create-response dialog */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New chatbot response"
        description="Match a trigger keyword and send back an automatic reply."
      >
        <form action={handleSave} className="space-y-4">
          <Field label="Trigger keyword" id="cb-trigger">
            <Input id="cb-trigger" name="trigger" placeholder="hello" required />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Match type">
              <Select
                value={matchType}
                onChange={(v) => setMatchType(v ?? 'contains')}
                placeholder="Match type"
                options={MATCH_TYPES}
                aria-label="Match type"
              />
            </Field>
            <div className="flex items-end">
              <Switch
                id="cb-active"
                checked={isActive}
                onCheckedChange={setIsActive}
                label="Active"
              />
            </div>
          </div>
          <Field label="Response" id="cb-response">
            <Textarea
              id="cb-response"
              name="response"
              rows={3}
              required
              placeholder="Type the automatic response…"
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create
            </Button>
          </div>
        </form>
      </Modal>

      {/* Train dialog */}
      <Modal
        open={trainOpen}
        onClose={() => setTrainOpen(false)}
        title="Train chatbot"
        description="Add a sample question and ideal answer. The bot will use this to improve responses."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTrainOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                toast({
                  title: 'Saved',
                  description: 'Training sample queued.',
                  tone: 'success',
                });
                setTrainOpen(false);
              }}
            >
              Save sample
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Field label="Sample question" id="train-q">
            <Input id="train-q" placeholder="Where can I track my order?" />
          </Field>
          <Field label="Ideal answer" id="train-a">
            <Textarea
              id="train-a"
              rows={3}
              placeholder="You can track your order at /orders."
            />
          </Field>
        </div>
      </Modal>

      {/* Reset chatbot confirm */}
      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset chatbot?</AlertDialogTitle>
            <AlertDialogDescription>
              All configured responses will be removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Note: Deletes responses sequentially.
                startTransition(async () => {
                  for (const r of responses) {
                    await deleteChatbotResponse(r._id);
                  }
                  toast({ title: 'Reset', description: 'Chatbot cleared.', tone: 'success' });
                  setResetOpen(false);
                  load();
                });
              }}
            >
              Yes, reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete-response confirm */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this response?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.trigger
                ? `Trigger “${deleteTarget.trigger}” will stop responding.`
                : 'This response will be removed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete}>
              Yes, delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </WachatPage>
  );
}
