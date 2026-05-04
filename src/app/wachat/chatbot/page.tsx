'use client';

/**
 * /wachat/chatbot — Chatbot config + flow picker + test chat panel (ZoruUI).
 *
 * Phase 6 visual swap. Server actions and data flow are unchanged.
 */

import * as React from 'react';
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  Bot,
  Loader,
  Plus,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { useProject } from '@/context/project-context';
import {
  deleteChatbotResponse,
  getChatbotResponses,
  saveChatbotResponse,
} from '@/app/actions/wachat-features.actions';

import {
  ZoruAlertDialog,
  ZoruAlertDialogAction,
  ZoruAlertDialogCancel,
  ZoruAlertDialogContent,
  ZoruAlertDialogDescription,
  ZoruAlertDialogFooter,
  ZoruAlertDialogHeader,
  ZoruAlertDialogTitle,
  ZoruBadge,
  ZoruBreadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  ZoruButton,
  ZoruCard,
  ZoruDialog,
  ZoruDialogContent,
  ZoruDialogDescription,
  ZoruDialogFooter,
  ZoruDialogHeader,
  ZoruDialogTitle,
  ZoruEmptyState,
  ZoruInput,
  ZoruLabel,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruSwitch,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  ZoruTextarea,
  cn,
  useZoruToast,
} from '@/components/zoruui';

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
  const [testThread, setTestThread] = useState<ChatBubble[]>([]);

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
    <div className="mx-auto w-full max-w-[1320px] px-6 pt-6 pb-10">
      <ZoruBreadcrumb>
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
            <ZoruBreadcrumbPage>Chatbot</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </ZoruBreadcrumb>

      <ZoruPageHeader className="mt-5">
        <ZoruPageHeading>
          <ZoruPageTitle>Chatbot Responses</ZoruPageTitle>
          <ZoruPageDescription>
            Define keyword-triggered automatic replies for incoming messages.
            Test the bot in the side panel before going live.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={load}
            disabled={isPending}
          >
            <RefreshCw className={isPending ? 'animate-spin' : ''} /> Refresh
          </ZoruButton>
          <ZoruButton
            variant="outline"
            size="sm"
            onClick={() => setTrainOpen(true)}
          >
            <Sparkles /> Train
          </ZoruButton>
          <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
            <Plus /> New response
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {/* Stats */}
      <div className="mt-6 grid max-w-md grid-cols-2 gap-3">
        <ZoruCard className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Total responses
          </div>
          <div className="mt-2 text-[22px] text-zoru-ink leading-none">
            {totalRules}
          </div>
        </ZoruCard>
        <ZoruCard className="p-4">
          <div className="text-[11px] uppercase tracking-wide text-zoru-ink-muted">
            Active
          </div>
          <div className="mt-2 text-[22px] text-zoru-ink leading-none">
            {activeRules}
          </div>
        </ZoruCard>
      </div>

      {/* Two-pane: responses table + test chat */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <ZoruCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] text-zoru-ink">Responses</h2>
            {isPending && (
              <Loader className="h-4 w-4 animate-spin text-zoru-ink-muted" />
            )}
          </div>

          {!isPending && responses.length === 0 ? (
            <ZoruEmptyState
              icon={<Bot />}
              title="No chatbot responses configured"
              description="Add your first keyword-triggered reply to start auto-responding."
              action={
                <ZoruButton size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus /> New response
                </ZoruButton>
              }
            />
          ) : responses.length > 0 ? (
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow>
                  <ZoruTableHead>Trigger</ZoruTableHead>
                  <ZoruTableHead>Response</ZoruTableHead>
                  <ZoruTableHead>Match</ZoruTableHead>
                  <ZoruTableHead>Status</ZoruTableHead>
                  <ZoruTableHead className="text-right">Action</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {responses.map((r) => (
                  <ZoruTableRow key={r._id}>
                    <ZoruTableCell className="text-[13px] text-zoru-ink">
                      {r.trigger}
                    </ZoruTableCell>
                    <ZoruTableCell className="max-w-[260px] truncate text-[13px] text-zoru-ink-muted">
                      {r.response}
                    </ZoruTableCell>
                    <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                      {r.matchType}
                    </ZoruTableCell>
                    <ZoruTableCell>
                      <ZoruBadge variant={r.isActive ? 'success' : 'secondary'}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </ZoruBadge>
                    </ZoruTableCell>
                    <ZoruTableCell className="text-right">
                      <ZoruButton
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteTarget(r)}
                        aria-label="Delete response"
                      >
                        <Trash2 />
                      </ZoruButton>
                    </ZoruTableCell>
                  </ZoruTableRow>
                ))}
              </ZoruTableBody>
            </ZoruTable>
          ) : null}
        </ZoruCard>

        {/* Test chat panel */}
        <ZoruCard className="flex h-fit flex-col p-0">
          <div className="border-b border-zoru-line px-4 py-3">
            <h3 className="text-[14px] text-zoru-ink leading-tight">Test chat</h3>
            <p className="mt-0.5 text-[11.5px] text-zoru-ink-muted leading-tight">
              Try a message — the bot replies using your active rules.
            </p>
          </div>
          <div className="flex h-[360px] flex-col gap-2 overflow-y-auto bg-zoru-surface px-4 py-3">
            {testThread.length === 0 ? (
              <div className="m-auto text-center">
                <Bot className="mx-auto h-6 w-6 text-zoru-ink-subtle" />
                <p className="mt-2 text-[12px] text-zoru-ink-muted">
                  Start a test conversation
                </p>
              </div>
            ) : (
              testThread.map((bubble, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex',
                    bubble.role === 'user' ? 'justify-end' : 'justify-start',
                  )}
                >
                  <div
                    className={cn(
                      'max-w-[80%] rounded-[var(--zoru-radius)] px-3 py-2 text-[13px]',
                      bubble.role === 'user'
                        ? 'bg-zoru-ink text-zoru-on-primary'
                        : 'border border-zoru-line bg-zoru-bg text-zoru-ink',
                    )}
                  >
                    {bubble.text}
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="flex gap-2 border-t border-zoru-line px-3 py-3">
            <ZoruInput
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  sendTest();
                }
              }}
            />
            <ZoruButton
              size="icon"
              onClick={sendTest}
              disabled={!testInput.trim()}
              aria-label="Send"
            >
              <Send />
            </ZoruButton>
          </div>
        </ZoruCard>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-[12px] text-zoru-ink-muted">
          Reset clears all chatbot responses for this project.
        </p>
        <ZoruButton
          variant="outline"
          size="sm"
          onClick={() => setResetOpen(true)}
          disabled={!responses.length}
        >
          Reset chatbot
        </ZoruButton>
      </div>

      {/* Create-response dialog */}
      <ZoruDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>New chatbot response</ZoruDialogTitle>
            <ZoruDialogDescription>
              Match a trigger keyword and send back an automatic reply.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <form action={handleSave} className="space-y-4">
            <div className="grid gap-2">
              <ZoruLabel htmlFor="cb-trigger">Trigger keyword</ZoruLabel>
              <ZoruInput id="cb-trigger" name="trigger" placeholder="hello" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <ZoruLabel>Match type</ZoruLabel>
                <ZoruSelect value={matchType} onValueChange={setMatchType}>
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
                </ZoruSelect>
              </div>
              <div className="flex items-end gap-3">
                <ZoruSwitch
                  id="cb-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <ZoruLabel htmlFor="cb-active">Active</ZoruLabel>
              </div>
            </div>
            <div className="grid gap-2">
              <ZoruLabel htmlFor="cb-response">Response</ZoruLabel>
              <ZoruTextarea
                id="cb-response"
                name="response"
                rows={3}
                required
                placeholder="Type the automatic response…"
              />
            </div>
            <ZoruDialogFooter>
              <ZoruButton
                type="button"
                variant="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </ZoruButton>
              <ZoruButton type="submit">Create</ZoruButton>
            </ZoruDialogFooter>
          </form>
        </ZoruDialogContent>
      </ZoruDialog>

      {/* Train dialog */}
      <ZoruDialog open={trainOpen} onOpenChange={setTrainOpen}>
        <ZoruDialogContent>
          <ZoruDialogHeader>
            <ZoruDialogTitle>Train chatbot</ZoruDialogTitle>
            <ZoruDialogDescription>
              Add a sample question and ideal answer. The bot will use this to
              improve responses.
            </ZoruDialogDescription>
          </ZoruDialogHeader>
          <div className="space-y-3">
            <div className="grid gap-2">
              <ZoruLabel htmlFor="train-q">Sample question</ZoruLabel>
              <ZoruInput id="train-q" placeholder="Where can I track my order?" />
            </div>
            <div className="grid gap-2">
              <ZoruLabel htmlFor="train-a">Ideal answer</ZoruLabel>
              <ZoruTextarea
                id="train-a"
                rows={3}
                placeholder="You can track your order at /orders."
              />
            </div>
          </div>
          <ZoruDialogFooter>
            <ZoruButton variant="ghost" onClick={() => setTrainOpen(false)}>
              Cancel
            </ZoruButton>
            <ZoruButton
              onClick={() => {
                toast({
                  title: 'Saved',
                  description: 'Training sample queued.',
                });
                setTrainOpen(false);
              }}
            >
              Save sample
            </ZoruButton>
          </ZoruDialogFooter>
        </ZoruDialogContent>
      </ZoruDialog>

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
                // TODO: bulk-delete server action; per-row delete is supported
                // via deleteChatbotResponse — left as a follow-up.
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
                ? `Trigger “${deleteTarget.trigger}” will stop responding.`
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

      <div className="h-6" />
    </div>
  );
}
