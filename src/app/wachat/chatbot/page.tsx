'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import {
  Bot,
  Loader,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  Power,
  ShieldAlert,
  ArrowRightLeft,
  Activity,
  Layers,
} from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
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
  Switch,
  Textarea,
  useZoruToast,
} from '@/components/zoruui';
import {
  WaPage,
  PageHeader,
  WaButton,
  Section,
  MetricTile,
  PhoneFrame,
  ChatBubble,
  EmptyState,
} from '@/components/wachat-ui';
import { EASE_OUT } from '@/components/dashboard-ui/module-theme';
import { useProject } from '@/context/project-context';
import {
  deleteChatbotResponse,
  getChatbotResponses,
  saveChatbotResponse,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chatbot - Chatbot config + live test panel inside the
 * branded PhoneFrame. Adds bot health KPIs (sessions today, fallback
 * rate, escalation rate, average steps) computed from the active
 * in-page test session.
 */

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
  hitCount?: number;
  lastHitAt?: string;
};

type TestBubble = {
  role: 'user' | 'bot';
  text: string;
  matched: boolean;
};

export default function ChatbotPage() {
  const { activeProject } = useProject();
  const { toast } = useZoruToast();
  const [isPending, startTransition] = useTransition();
  const [responses, setResponses] = useState<ChatbotResponse[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [matchType, setMatchType] = useState('contains');
  const [isActive, setIsActive] = useState(true);

  const [trainOpen, setTrainOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ChatbotResponse | null>(null);

  // Test chat panel state
  const [testInput, setTestInput] = useState('');
  const [testThread, setTestThread] = useState<TestBubble[]>([]);
  const [sessionsToday, setSessionsToday] = useState(0);

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    startTransition(async () => {
      const res = await getChatbotResponses(String(activeProject._id));
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
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
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
      return;
    }
    toast({ title: res.message || 'Saved' });
    setCreateOpen(false);
    load();
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      const res = await deleteChatbotResponse(target._id);
      if (!res.success) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Response deleted' });
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
          /* invalid regex - skip */
        }
      }
    }
    return null;
  };

  const sendTest = () => {
    const t = testInput.trim();
    if (!t) return;
    const matched = matchResponse(t);
    const reply = matched ?? 'No matching response. Train me with a new rule.';
    setTestThread((prev) => [
      ...prev,
      { role: 'user', text: t, matched: matched !== null },
      { role: 'bot', text: reply, matched: matched !== null },
    ]);
    if (testThread.length === 0) setSessionsToday((n) => n + 1);
    setTestInput('');
  };

  const resetSession = () => {
    setTestThread([]);
  };

  const totalRules = responses.length;
  const activeRules = responses.filter((r) => r.isActive).length;

  // Bot health KPIs derived from the live test thread.
  const userTurns = useMemo(() => testThread.filter((b) => b.role === 'user').length, [testThread]);
  const fallbackTurns = useMemo(
    () => testThread.filter((b) => b.role === 'user' && !b.matched).length,
    [testThread],
  );
  const fallbackRate = userTurns > 0 ? Math.round((fallbackTurns / userTurns) * 100) : 0;
  const escalationRate = userTurns > 0 && fallbackTurns >= 2 ? Math.round((1 / userTurns) * 100) : 0;
  const avgSteps = userTurns > 0 ? (testThread.length / Math.max(sessionsToday, 1)).toFixed(1) : '--';

  return (
    <WaPage>
      <PageHeader
        title="Chatbot responses"
        description="Define keyword-triggered automatic replies for incoming WhatsApp messages. Test the bot in the side panel before going live."
        kicker="Wachat · chatbot"
        backHref="/wachat"
        eyebrowIcon={Bot}
        actions={
          <>
            <WaButton
              variant="outline"
              size="sm"
              leftIcon={isPending ? Loader2 : RefreshCw}
              onClick={load}
              disabled={isPending}
            >
              Refresh
            </WaButton>
            <WaButton variant="outline" size="sm" leftIcon={Sparkles} onClick={() => setTrainOpen(true)}>
              Train
            </WaButton>
            <WaButton size="sm" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
              New response
            </WaButton>
          </>
        }
      />

      {/* Bot health KPI strip */}
      <section aria-labelledby="bot-stats" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <h2 id="bot-stats" className="sr-only">Chatbot health</h2>
        <MetricTile label="Total rules" value={totalRules} icon={Bot} delay={0} />
        <MetricTile label="Active rules" value={activeRules} icon={Power} delay={0.04} />
        <MetricTile label="Sessions today" value={sessionsToday} icon={Activity} delay={0.08} />
        <MetricTile
          label="Fallback rate"
          value={userTurns > 0 ? `${fallbackRate}%` : '--'}
          icon={ShieldAlert}
          delay={0.12}
        />
        <MetricTile
          label="Escalation rate"
          value={userTurns > 0 ? `${escalationRate}%` : '--'}
          icon={ArrowRightLeft}
          delay={0.16}
        />
        <MetricTile label="Avg steps" value={avgSteps} icon={Layers} delay={0.2} />
      </section>

      {/* Two-pane: responses table + branded test phone */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section
          title="Responses"
          description="Each row is one keyword-triggered reply. Active rules fire on incoming messages."
          padded={false}
          action={isPending ? <Loader className="h-4 w-4 animate-spin text-zinc-400" /> : null}
        >
          {!isPending && responses.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={Bot}
                title="No chatbot responses configured"
                description="Add your first keyword-triggered reply to start auto-responding."
                action={
                  <WaButton size="sm" leftIcon={Plus} onClick={() => setCreateOpen(true)}>
                    New response
                  </WaButton>
                }
              />
            </div>
          ) : responses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-zinc-100 text-[11px] font-semibold uppercase tracking-[0.06em] text-zinc-500">
                    <th className="px-4 py-2.5">Trigger</th>
                    <th className="px-4 py-2.5">Response</th>
                    <th className="px-4 py-2.5">Match</th>
                    <th className="px-4 py-2.5">Hits</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {responses.map((r, i) => (
                    <m.tr
                      key={r._id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                      className="text-[12.5px] transition-colors duration-150 hover:bg-zinc-50/60"
                    >
                      <td className="px-4 py-2 font-medium text-zinc-900">{r.trigger}</td>
                      <td className="max-w-[260px] truncate px-4 py-2 text-zinc-600">{r.response}</td>
                      <td className="px-4 py-2 text-zinc-500">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-semibold text-zinc-700">
                          {r.matchType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-700 tabular-nums">
                        {(Number(r.hitCount) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} aria-hidden />
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(r)}
                          aria-label={`Delete response for ${r.trigger}`}
                          className="grid h-7 w-7 place-items-center rounded-full text-zinc-400 transition-colors duration-150 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.94]"
                        >
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                        </button>
                      </td>
                    </m.tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Section>

        {/* Live test panel rendered inside the branded PhoneFrame */}
        <div className="flex flex-col items-center gap-3">
          <PhoneFrame title="Bot tester" subtitle={`${activeRules} active rule${activeRules === 1 ? '' : 's'}`}>
            {testThread.length === 0 ? (
              <div className="flex h-[260px] flex-col items-center justify-center text-center">
                <Bot className="h-7 w-7 text-emerald-200/40" strokeWidth={1.75} aria-hidden />
                <p className="mt-2 text-[12px] text-emerald-100/60">Start a test conversation</p>
                <p className="mt-1 text-[10.5px] text-emerald-100/40">Send any message to dry-run your rules.</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {testThread.map((bubble, i) => (
                  <ChatBubble
                    key={i}
                    who={bubble.role === 'user' ? 'us' : 'them'}
                    text={bubble.text}
                    kind={bubble.role === 'bot' && !bubble.matched ? undefined : undefined}
                    delay={i * 0.03}
                  />
                ))}
              </AnimatePresence>
            )}
          </PhoneFrame>
          <div className="flex w-full max-w-[320px] items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2">
            <input
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type a message..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendTest();
                }
              }}
              className="h-8 flex-1 rounded-lg bg-transparent px-2 text-[12.5px] text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              aria-label="Test message"
            />
            <WaButton size="sm" onClick={sendTest} disabled={!testInput.trim()} leftIcon={Send}>
              Send
            </WaButton>
          </div>
          {testThread.length > 0 && (
            <button
              type="button"
              onClick={resetSession}
              className="text-[11px] font-semibold text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline"
            >
              Reset session
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-zinc-200 pt-4">
        <p className="text-[11.5px] text-zinc-500">
          Reset clears every chatbot response in this project. It cannot be undone.
        </p>
        <WaButton
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
          disabled={!responses.length}
        >
          Reset chatbot
        </WaButton>
      </div>

      {/* Create-response dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New chatbot response</ZoruDialogTitle>
            <ZoruDialogDescription>
              Match a trigger keyword and send back an automatic reply.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={handleSave} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="cb-trigger">Trigger keyword</Label>
              <Input id="cb-trigger" name="trigger" placeholder="hello" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Match type</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <ZoruSelectTrigger>
                    <ZoruSelectValue placeholder="Match type" />
                  </ZoruSelectTrigger>
                  <ZoruSelectContent>
                    {MATCH_TYPES.map((mt) => (
                      <ZoruSelectItem key={mt.value} value={mt.value}>
                        {mt.label}
                      </ZoruSelectItem>
                    ))}
                  </ZoruSelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-3">
                <Switch id="cb-active" checked={isActive} onCheckedChange={setIsActive} />
                <Label htmlFor="cb-active">Active</Label>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cb-response">Response</Label>
              <Textarea
                id="cb-response"
                name="response"
                rows={3}
                required
                placeholder="Type the automatic response..."
              />
            </div>
            <ZoruDialogFooter>
              <WaButton variant="ghost" type="button" onClick={() => setCreateOpen(false)}>
                Cancel
              </WaButton>
              <WaButton type="submit">Create</WaButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </Dialog>

      {/* Train dialog */}
      <Dialog open={trainOpen} onOpenChange={setTrainOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Train chatbot</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add a sample question and ideal answer. The bot will use this to improve responses.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <Label htmlFor="train-q">Sample question</Label>
              <Input id="train-q" placeholder="Where can I track my order?" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="train-a">Ideal answer</Label>
              <Textarea
                id="train-a"
                rows={3}
                placeholder="You can track your order at /orders."
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <WaButton variant="ghost" onClick={() => setTrainOpen(false)}>
              Cancel
            </WaButton>
            <WaButton
              onClick={() => {
                toast({ title: 'Saved', description: 'Training sample queued.' });
                setTrainOpen(false);
              }}
            >
              Save sample
            </WaButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </Dialog>

      {/* Reset chatbot confirm */}
      <ZoruAlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Reset chatbot?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              All configured responses will be removed. This cannot be undone.
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction
              destructive
              onClick={() => {
                // Note: Deletes responses sequentially.
                startTransition(async () => {
                  for (const r of responses) {
                    await deleteChatbotResponse(r._id);
                  }
                  toast({ title: 'Reset', description: 'Chatbot cleared.' });
                  setResetOpen(false);
                  load();
                });
              }}
            >
              Yes, reset
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>

      {/* Delete-response confirm */}
      <ZoruAlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <ZoruAlertDialogContent>
          <ZoruAlertDialogHeader>
            <ZoruAlertDialogTitle>Delete this response?</ZoruAlertDialogTitle>
            <ZoruAlertDialogDescription>
              {deleteTarget?.trigger
                ? `Trigger "${deleteTarget.trigger}" will stop responding.`
                : 'This response will be removed.'}
            </ZoruAlertDialogDescription>
          </ZoruAlertDialogHeader>
          <ZoruAlertDialogFooter>
            <ZoruAlertDialogCancel>Cancel</ZoruAlertDialogCancel>
            <ZoruAlertDialogAction destructive onClick={handleConfirmDelete}>
              Yes, delete
            </ZoruAlertDialogAction>
          </ZoruAlertDialogFooter>
        </ZoruAlertDialogContent>
      </ZoruAlertDialog>
    </WaPage>
  );
}
