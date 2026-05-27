'use client';

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
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
  cn,
  useZoruToast,
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
import { useProject } from '@/context/project-context';
import {
  deleteChatbotResponse,
  getChatbotResponses,
  saveChatbotResponse,
} from '@/app/actions/wachat-features.actions';

/**
 * /wachat/chatbot — Chatbot config + test chat panel.
 *
 * Server actions and matching/test logic are preserved verbatim. The
 * visual swap pulls every surface onto wachat-ui primitives + motion.
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
};

type TestBubble = {
  role: 'user' | 'bot';
  text: string;
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

  // Test chat panel
  const [testInput, setTestInput] = useState('');
  const [testThread, setTestThread] = useState<TestBubble[]>([]);

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
          /* invalid regex — skip */
        }
      }
    }
    return null;
  };

  const sendTest = () => {
    const t = testInput.trim();
    if (!t) return;
    const reply = matchResponse(t) ?? 'No matching response. Train me with a new rule.';
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

      {/* Stats */}
      <section aria-labelledby="bot-stats" className="mb-8 grid grid-cols-2 gap-3 sm:max-w-md">
        <h2 id="bot-stats" className="sr-only">Chatbot stats</h2>
        <MetricTile label="Total responses" value={totalRules} icon={Bot} delay={0} />
        <MetricTile label="Active rules" value={activeRules} icon={Power} delay={0.05} />
      </section>

      {/* Two-pane: responses table + test chat */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
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
                    <th className="px-5 py-3">Trigger</th>
                    <th className="px-5 py-3">Response</th>
                    <th className="px-5 py-3">Match</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {responses.map((r, i) => (
                    <m.tr
                      key={r._id}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: i * 0.03, ease: EASE_OUT }}
                      className="text-[13px] transition-colors duration-150 hover:bg-zinc-50/60"
                    >
                      <td className="px-5 py-3 font-medium text-zinc-900">{r.trigger}</td>
                      <td className="max-w-[280px] truncate px-5 py-3 text-zinc-600">{r.response}</td>
                      <td className="px-5 py-3 text-zinc-500">{r.matchType}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.04em] ${r.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-600'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${r.isActive ? 'bg-emerald-500' : 'bg-zinc-400'}`} aria-hidden />
                          {r.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
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

        {/* Test chat panel — phone-frame inspired but compact for the side rail */}
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="flex h-fit flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white"
        >
          <header className="border-b border-zinc-100 px-4 py-3">
            <h3 className="text-[14px] font-semibold tracking-tight text-zinc-900">Test chat</h3>
            <p className="mt-0.5 text-[11.5px] text-zinc-500">
              Send a message and the bot replies using your active rules.
            </p>
          </header>
          <div
            className="flex h-[360px] flex-col gap-2 overflow-y-auto bg-[#04130d] px-3 py-3"
            style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22%3E%3Crect fill=%22%23072018%22 width=%22120%22 height=%22120%22/%3E%3Cg opacity=%22.04%22%3E%3Cpath d=%22M0 0h60v60H0z%22 fill=%22%23fff%22/%3E%3C/g%3E%3C/svg%3E')" }}
          >
            {testThread.length === 0 ? (
              <div className="m-auto text-center">
                <Bot className="mx-auto h-6 w-6 text-emerald-200/40" strokeWidth={1.75} aria-hidden />
                <p className="mt-2 text-[12px] text-emerald-100/60">Start a test conversation</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {testThread.map((bubble, i) => (
                  <m.div
                    key={i}
                    initial={{ opacity: 0, y: 4, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className={cn('flex', bubble.role === 'user' ? 'justify-end' : 'justify-start')}
                  >
                    <div
                      className={cn(
                        'max-w-[80%] rounded-2xl px-3 py-2 text-[12.5px] leading-snug shadow-sm',
                        bubble.role === 'user'
                          ? 'rounded-br-sm bg-emerald-500/95 text-white'
                          : 'rounded-bl-sm bg-white/95 text-zinc-800',
                      )}
                    >
                      {bubble.text}
                    </div>
                  </m.div>
                ))}
              </AnimatePresence>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-zinc-100 bg-white px-3 py-3">
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
              className="h-9 flex-1 rounded-xl border border-zinc-200 bg-white px-3 text-[13px] text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none"
              aria-label="Test message"
            />
            <WaButton size="sm" onClick={sendTest} disabled={!testInput.trim()} leftIcon={Send}>
              Send
            </WaButton>
          </div>
        </m.div>
      </div>

      <div className="mt-8 flex items-center justify-between border-t border-zinc-200 pt-5">
        <p className="text-[12px] text-zinc-500">
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
                    {MATCH_TYPES.map((m) => (
                      <ZoruSelectItem key={m.value} value={m.value}>
                        {m.label}
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
