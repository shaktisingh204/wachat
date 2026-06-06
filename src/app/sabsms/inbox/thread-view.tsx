"use client";

/**
 * SabSMS inbox — right pane.
 *
 * Renders the selected thread's message history plus the composer,
 * assignment dropdown, snooze / close controls, label editor, canned
 * responses, reaction picker, and the merge / suppress / segment side
 * actions. The 20 page-unique features all wire through this component
 * or the conversation list — see the README block at the top of
 * `inbox-layout.tsx`.
 */

import * as React from "react";
import {
  AtSign,
  Ban,
  CheckCheck,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Merge,
  Paperclip,
  Send,
  Smile,
  StickyNote,
  Trash2,
  UserPlus,
  X,
  Sparkles,
} from "lucide-react";

import { Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, ScrollArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator, Textarea, cn, useToast } from '@/components/sabcrm/20ui/compat';
import { SabFilePickerButton, type SabFilePick } from "@/components/sabfiles";
import { SabsmsDetailDrawer } from "@/components/sabsms/page-toolkit";

import {
  addInternalNote,
  addLabel,
  addReaction,
  addToSegment,
  addToSuppression,
  assignTo,
  closeConversation,
  loadThread,
  mergeConversations,
  removeLabel,
  reopenConversation,
  replyToThread,
  sendCannedResponse,
  snoozeUntil,
  generateAiReply,
} from "./actions";
import { computeSlaState, formatDeliveryStatusLabel } from "./sla";
import type {
  InboxAgent,
  InboxConversationView,
  InboxMessageView,
  InboxTemplateView,
  InboxThreadView,
} from "./types";

const REACTION_PALETTE = ["+1", "-1", "100", "tada", "eyes"] as const;

const CLOSE_REASONS = [
  "Resolved",
  "Duplicate",
  "Spam",
  "No response",
  "Other",
] as const;

export interface ThreadViewProps {
  workspaceId: string;
  thread: InboxThreadView | null;
  templates: InboxTemplateView[];
  agents: InboxAgent[];
  allConversations: InboxConversationView[];
  /** Re-render trigger — bumped after server actions to refetch. */
  onMutate: () => void;
  registerComposerFocus: (fn: () => void) => void;
  registerNoteFocus: (fn: () => void) => void;
}

export function ThreadView({
  workspaceId,
  thread,
  templates,
  agents,
  allConversations,
  onMutate,
  registerComposerFocus,
  registerNoteFocus,
}: ThreadViewProps) {
  const { toast } = useToast();
  const [tab, setTab] = React.useState<"reply" | "note">("reply");
  const [composerBody, setComposerBody] = React.useState("");
  const [noteBody, setNoteBody] = React.useState("");
  const [attachments, setAttachments] = React.useState<SabFilePick[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [closeOpen, setCloseOpen] = React.useState(false);
  const [closeReason, setCloseReason] = React.useState<string>("Resolved");
  const [snoozeOpen, setSnoozeOpen] = React.useState(false);
  const [snoozeMins, setSnoozeMins] = React.useState<string>("60");
  const [mergeOpen, setMergeOpen] = React.useState(false);
  const [mergeTarget, setMergeTarget] = React.useState<string>("");
  const [labelDraft, setLabelDraft] = React.useState("");
  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailMessage, setDetailMessage] = React.useState<InboxMessageView | null>(null);
  const [autoRoundRobin, setAutoRoundRobin] = React.useState(false);

  const composerRef = React.useRef<HTMLTextAreaElement>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  // Auto round-robin preference persists in localStorage using the same
  // key pattern as saved views.
  React.useEffect(() => {
    try {
      const raw = window.localStorage.getItem(
        "sabsms.inbox.round_robin",
      );
      if (raw === "1") setAutoRoundRobin(true);
    } catch {
      /* ignore */
    }
  }, []);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        "sabsms.inbox.round_robin",
        autoRoundRobin ? "1" : "0",
      );
    } catch {
      /* ignore */
    }
  }, [autoRoundRobin]);

  React.useEffect(() => {
    registerComposerFocus(() => composerRef.current?.focus());
    registerNoteFocus(() => {
      setTab("note");
      // defer so the textarea is mounted
      setTimeout(() => noteRef.current?.focus(), 0);
    });
  }, [registerComposerFocus, registerNoteFocus]);

  // Workspace id is forwarded for future per-action overrides
  // (e.g. impersonation). Reference it so TypeScript doesn't trim it.
  React.useEffect(() => {
    if (!workspaceId) return;
  }, [workspaceId]);

  if (!thread) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center text-sm text-[var(--st-text)]">
        Select a conversation to view the thread.
      </div>
    );
  }

  const { conversation, messages } = thread;
  const sla = computeSlaState(conversation, new Date());
  // Hide internal notes from the customer-visible message list; render
  // them inline as note cards instead.
  const visibleMessages = messages;

  async function send() {
    if (!composerBody.trim()) return;
    setBusy(true);
    const res = await replyToThread({
      conversationId: conversation.id,
      body: composerBody.trim(),
      mediaSabFileIds: attachments.map((a) => a.id),
    });
    setBusy(false);
    if (res.ok) {
      setComposerBody("");
      setAttachments([]);
      toast({ title: "Reply queued" });
      onMutate();
    } else {
      toast({ title: "Reply failed", description: res.error, variant: "destructive" });
    }
  }

  async function postNote() {
    if (!noteBody.trim()) return;
    setBusy(true);
    const res = await addInternalNote({
      conversationId: conversation.id,
      body: noteBody.trim(),
    });
    setBusy(false);
    if (res.ok) {
      setNoteBody("");
      toast({ title: "Note saved" });
      onMutate();
    } else {
      toast({ title: "Note failed", description: res.error, variant: "destructive" });
    }
  }

  async function applyCannedResponse(templateId: string) {
    setBusy(true);
    const res = await sendCannedResponse({
      conversationId: conversation.id,
      templateId,
    });
    setBusy(false);
    if (res.ok) {
      toast({ title: "Canned response sent" });
      onMutate();
    } else {
      toast({ title: "Send failed", description: res.error, variant: "destructive" });
    }
  }

  async function getAiSuggestion() {
    setBusy(true);
    const res = await generateAiReply(conversation.id);
    setBusy(false);
    if (res.ok) {
      setComposerBody(res.suggestion);
      toast({ title: "AI Suggestion applied" });
    } else {
      toast({ title: "Failed to generate AI suggestion", description: res.error, variant: "destructive" });
    }
  }

  async function pickAgent(agentId: string | null) {
    const res = await assignTo({ conversationId: conversation.id, agentId });
    if (res.ok) onMutate();
    else toast({ title: "Assignment failed", description: res.error, variant: "destructive" });
  }

  async function applySnooze() {
    const mins = parseInt(snoozeMins, 10);
    if (!mins) return;
    const until = new Date(Date.now() + mins * 60_000).toISOString();
    const res = await snoozeUntil({
      conversationId: conversation.id,
      until,
    });
    setSnoozeOpen(false);
    if (res.ok) {
      toast({ title: "Snoozed" });
      onMutate();
    } else {
      toast({ title: "Snooze failed", description: res.error, variant: "destructive" });
    }
  }

  async function applyClose() {
    const res = await closeConversation({
      conversationId: conversation.id,
      reason: closeReason,
    });
    setCloseOpen(false);
    if (res.ok) {
      toast({ title: "Conversation closed" });
      onMutate();
    } else {
      toast({ title: "Close failed", description: res.error, variant: "destructive" });
    }
  }

  async function applyReopen() {
    const res = await reopenConversation({ conversationId: conversation.id });
    if (res.ok) {
      toast({ title: "Reopened" });
      onMutate();
    }
  }

  async function applyMerge() {
    if (!mergeTarget) return;
    const res = await mergeConversations({
      intoId: mergeTarget,
      fromId: conversation.id,
    });
    setMergeOpen(false);
    if (res.ok) {
      toast({ title: "Conversations merged" });
      onMutate();
    } else {
      toast({ title: "Merge failed", description: res.error, variant: "destructive" });
    }
  }

  async function applyAddLabel() {
    const label = labelDraft.trim();
    if (!label) return;
    const res = await addLabel({ conversationId: conversation.id, label });
    setLabelDraft("");
    if (res.ok) onMutate();
  }

  async function applyRemoveLabel(label: string) {
    const res = await removeLabel({ conversationId: conversation.id, label });
    if (res.ok) onMutate();
  }

  async function applyReact(messageId: string, emoji: string) {
    const res = await addReaction({ messageId, emoji });
    if (res.ok) onMutate();
  }

  async function applySuppress() {
    // Pull the contact's last inbound phone from the thread.
    const lastInbound = [...messages]
      .reverse()
      .find((m) => m.direction === "inbound");
    if (!lastInbound) {
      toast({
        title: "Suppress failed",
        description: "No inbound number to suppress",
        variant: "destructive",
      });
      return;
    }
    const res = await addToSuppression({
      phone: lastInbound.from,
      reason: "Suppressed from inbox",
    });
    if (res.ok) toast({ title: "Sender suppressed" });
    else
      toast({
        title: "Suppress failed",
        description: res.error,
        variant: "destructive",
      });
  }

  async function applyAddToSegment() {
    // Phase 18 stub — surface the message so the user knows why nothing
    // happened.
    const res = await addToSegment({
      contactId: conversation.contactId,
      segmentId: "stub",
    });
    if (!res.ok)
      toast({
        title: "Add to segment",
        description: res.error,
        variant: "destructive",
      });
  }

  function inspectMessage(message: InboxMessageView) {
    setDetailMessage(message);
    setDetailOpen(true);
  }

  return (
    <div className="flex h-full flex-col">
      <ThreadHeader
        conversation={conversation}
        agents={agents}
        autoRoundRobin={autoRoundRobin}
        onAutoRoundRobinChange={setAutoRoundRobin}
        onPickAgent={pickAgent}
        onSnooze={() => setSnoozeOpen(true)}
        onCloseOpen={() => setCloseOpen(true)}
        onReopen={applyReopen}
        onMerge={() => setMergeOpen(true)}
        onSuppress={applySuppress}
        onAddToSegment={applyAddToSegment}
        slaBreached={sla.firstResponseBreached || sla.resolutionBreached}
      />

      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--st-border)] px-3 py-2">
        {conversation.labels.map((l) => (
          <Badge key={l} variant="secondary" className="gap-1 text-[10px]">
            {l}
            <button
              type="button"
              onClick={() => applyRemoveLabel(l)}
              aria-label={`Remove label ${l}`}
              className="text-[var(--st-text)] hover:text-[var(--st-text)]"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <div className="flex items-center gap-1">
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void applyAddLabel();
              }
            }}
            placeholder="add label"
            className="h-7 w-32 text-xs"
          />
          <Button size="sm" variant="ghost" onClick={applyAddLabel}>
            Add
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-[var(--st-bg-muted)]/50">
        <div className="space-y-3 px-4 py-4">
          {visibleMessages.length === 0 ? (
            <div className="rounded-md border border-dashed border-[var(--st-border)] bg-white p-6 text-center text-sm text-[var(--st-text)]">
              No messages in this conversation yet.
            </div>
          ) : (
            visibleMessages.map((m) => (
              <MessageBubble
                key={m.id}
                message={m}
                onReact={(emoji) => applyReact(m.id, emoji)}
                onInspect={() => inspectMessage(m)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-[var(--st-border)] bg-white">
        <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-1.5 text-xs">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={tab === "reply" ? "default" : "ghost"}
              onClick={() => setTab("reply")}
            >
              <Send className="mr-1 h-3.5 w-3.5" /> Reply
            </Button>
            <Button
              size="sm"
              variant={tab === "note" ? "default" : "ghost"}
              onClick={() => setTab("note")}
            >
              <StickyNote className="mr-1 h-3.5 w-3.5" /> Internal note
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={getAiSuggestion} disabled={busy} className="text-[var(--st-text)] hover:text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]">
              <Sparkles className="mr-1 h-3.5 w-3.5" /> AI Suggest
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="ghost">
                  Canned response
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Approved templates</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {templates.length === 0 ? (
                  <DropdownMenuItem disabled>
                    No approved templates
                  </DropdownMenuItem>
                ) : (
                  templates.map((t) => (
                    <DropdownMenuItem
                      key={t.id}
                      onSelect={() => void applyCannedResponse(t.id)}
                    >
                      {t.name}
                    </DropdownMenuItem>
                  ))
                )}
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Insert into composer</DropdownMenuLabel>
                {templates.map((t) => (
                  <DropdownMenuItem
                    key={`ins-${t.id}`}
                    onSelect={() =>
                      setComposerBody((prev) =>
                        prev ? `${prev}\n${t.body}` : t.body,
                      )
                    }
                  >
                    {t.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {tab === "reply" ? (
          <div className="space-y-2 px-3 py-2">
            <Textarea
              ref={composerRef}
              value={composerBody}
              onChange={(e) => setComposerBody(e.target.value)}
              placeholder="Type a reply…"
              rows={3}
              className="resize-none"
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {attachments.map((a) => (
                  <Badge
                    key={a.id}
                    variant="secondary"
                    className="gap-1 text-[10px]"
                  >
                    <Paperclip className="h-3 w-3" />
                    {a.name}
                    <button
                      type="button"
                      onClick={() =>
                        setAttachments((prev) =>
                          prev.filter((p) => p.id !== a.id),
                        )
                      }
                      aria-label="Remove attachment"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between">
              <SabFilePickerButton
                variant="ghost"
                onPick={(pick) =>
                  setAttachments((prev) => [...prev, pick])
                }
              >
                <Paperclip className="mr-1.5 h-3.5 w-3.5" /> Attach
              </SabFilePickerButton>
              <Button onClick={send} disabled={busy || !composerBody.trim()}>
                {busy ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                )}
                Send
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 px-3 py-2">
            <Textarea
              ref={noteRef}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Internal note — visible to your team only"
              rows={3}
              className="resize-none border-[var(--st-border)] bg-[var(--st-bg-muted)]/40"
            />
            <div className="flex items-center justify-end">
              <Button onClick={postNote} disabled={busy || !noteBody.trim()}>
                <StickyNote className="mr-1.5 h-3.5 w-3.5" /> Save note
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Snooze dialog */}
      <Dialog open={snoozeOpen} onOpenChange={setSnoozeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Snooze conversation</DialogTitle>
            <DialogDescription>
              The thread reopens after the chosen duration, or as soon as
              the contact replies.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="snooze-mins">Wake in (minutes)</Label>
            <Input
              id="snooze-mins"
              value={snoozeMins}
              onChange={(e) => setSnoozeMins(e.target.value)}
              type="number"
              min="1"
            />
            <p className="text-xs text-[var(--st-text)]">
              Tip: when set to 0 the thread waits indefinitely for a reply.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSnoozeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applySnooze}>Snooze</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog — reason is required */}
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close conversation</DialogTitle>
            <DialogDescription>
              Pick a reason. Reports group closed threads by this value.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="close-reason">Reason</Label>
            <Select value={closeReason} onValueChange={setCloseReason}>
              <SelectTrigger id="close-reason">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={applyClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Merge dialog */}
      <Dialog open={mergeOpen} onOpenChange={setMergeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Merge into another conversation</DialogTitle>
            <DialogDescription>
              Messages from this thread move into the target. The older
              conversation wins — labels are merged in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="merge-target">Target conversation</Label>
            <Select value={mergeTarget} onValueChange={setMergeTarget}>
              <SelectTrigger id="merge-target">
                <SelectValue placeholder="Pick a conversation" />
              </SelectTrigger>
              <SelectContent>
                {allConversations
                  .filter((c) => c.id !== conversation.id)
                  .map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.contactId} —{" "}
                      {(c.lastMessagePreview ?? "").slice(0, 40)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMergeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={applyMerge} disabled={!mergeTarget}>
              <Merge className="mr-1.5 h-3.5 w-3.5" /> Merge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SabsmsDetailDrawer
        open={detailOpen}
        onOpenChange={setDetailOpen}
        title="Message detail"
        description={detailMessage ? `ID ${detailMessage.id}` : undefined}
      >
        {detailMessage && (
          <dl className="space-y-2 text-sm">
            <DetailRow label="Direction" value={detailMessage.direction} />
            <DetailRow label="From" value={detailMessage.from} />
            <DetailRow label="To" value={detailMessage.to} />
            <DetailRow
              label="Status"
              value={formatDeliveryStatusLabel(detailMessage.status)}
            />
            <DetailRow label="Created" value={detailMessage.createdAt ?? "—"} />
            <DetailRow label="Sent" value={detailMessage.sentAt ?? "—"} />
            <DetailRow
              label="Delivered"
              value={detailMessage.deliveredAt ?? "—"}
            />
            {detailMessage.errorMessage && (
              <DetailRow
                label="Error"
                value={detailMessage.errorMessage}
              />
            )}
            <Separator />
            <div>
              <div className="mb-1 text-xs uppercase text-[var(--st-text)]">Body</div>
              <div className="whitespace-pre-wrap rounded-md bg-[var(--st-bg-muted)] p-3 text-sm">
                {detailMessage.body}
              </div>
            </div>
          </dl>
        )}
      </SabsmsDetailDrawer>
    </div>
  );
}

interface ThreadHeaderProps {
  conversation: InboxConversationView;
  agents: InboxAgent[];
  autoRoundRobin: boolean;
  onAutoRoundRobinChange: (next: boolean) => void;
  onPickAgent: (agentId: string | null) => Promise<void>;
  onSnooze: () => void;
  onCloseOpen: () => void;
  onReopen: () => Promise<void>;
  onMerge: () => void;
  onSuppress: () => Promise<void>;
  onAddToSegment: () => Promise<void>;
  slaBreached: boolean;
}

function ThreadHeader({
  conversation,
  agents,
  autoRoundRobin,
  onAutoRoundRobinChange,
  onPickAgent,
  onSnooze,
  onCloseOpen,
  onReopen,
  onMerge,
  onSuppress,
  onAddToSegment,
  slaBreached,
}: ThreadHeaderProps) {
  return (
    <div className="border-b border-[var(--st-border)] px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-medium text-[var(--st-text)]">
              {conversation.contactId}
            </span>
            <Badge
              variant={conversation.status === "open" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {conversation.status}
            </Badge>
            {slaBreached && (
              <Badge variant="destructive" className="animate-pulse text-[10px]">
                <Clock className="mr-1 h-3 w-3" /> SLA breached
              </Badge>
            )}
          </div>
          <div className="text-xs text-[var(--st-text)]">
            Conversation {conversation.id}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                {conversation.assignedAgentId
                  ? agents.find((a) => a.id === conversation.assignedAgentId)
                      ?.name ?? conversation.assignedAgentId
                  : "Assign"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Assign to</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {agents.map((a) => (
                <DropdownMenuItem
                  key={a.id}
                  onSelect={() => void onPickAgent(a.id)}
                >
                  {a.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void onPickAgent(null)}>
                Unassign
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => onAutoRoundRobinChange(!autoRoundRobin)}
              >
                <AtSign className="mr-2 h-3.5 w-3.5" />
                Auto round-robin {autoRoundRobin ? "on" : "off"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button size="sm" variant="outline" onClick={onSnooze}>
            <Clock className="mr-1.5 h-3.5 w-3.5" /> Snooze
          </Button>

          {conversation.status === "closed" ? (
            <Button size="sm" variant="outline" onClick={() => void onReopen()}>
              Reopen
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onCloseOpen}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Close
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                More
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onMerge}>
                <Merge className="mr-2 h-3.5 w-3.5" /> Merge conversation
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onSuppress()}>
                <Ban className="mr-2 h-3.5 w-3.5" /> Block sender
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void onAddToSegment()}>
                <UserPlus className="mr-2 h-3.5 w-3.5" /> Add to segment
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface MessageBubbleProps {
  message: InboxMessageView;
  onReact: (emoji: string) => void;
  onInspect: () => void;
}

function MessageBubble({ message, onReact, onInspect }: MessageBubbleProps) {
  const isInbound = message.direction === "inbound";
  const isNote = message.isNote;

  return (
    <div className={cn("flex", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[80%] space-y-1 rounded-lg border px-3 py-2 text-sm",
          isNote
            ? "border-[var(--st-border)] bg-[var(--st-bg-muted)] text-[var(--st-text)]"
            : isInbound
              ? "border-[var(--st-border)] bg-white text-[var(--st-text)]"
              : "border-[var(--st-border)] bg-[var(--st-text)] text-white",
        )}
      >
        {isNote && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-[var(--st-text)]">
            <StickyNote className="h-3 w-3" /> Internal note
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">{message.body}</div>
        {message.mediaIds.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {message.mediaIds.map((id) => (
              <Badge key={id} variant="secondary" className="text-[10px]">
                <Paperclip className="mr-1 h-3 w-3" /> {id.slice(0, 8)}
              </Badge>
            ))}
          </div>
        )}
        <div
          className={cn(
            "flex items-center justify-between gap-2 text-[10px]",
            isInbound || isNote ? "text-[var(--st-text-secondary)]" : "text-[var(--st-text-secondary)]",
          )}
        >
          <span>
            {message.createdAt
              ? new Date(message.createdAt).toLocaleString(undefined, {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </span>
          {!isNote && !isInbound && <DeliveryTicks status={message.status} />}
        </div>
        {message.reactions.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            {message.reactions.map((r, i) => (
              <Badge
                key={`${r}-${i}`}
                variant="secondary"
                className="text-[10px]"
              >
                {r}
              </Badge>
            ))}
          </div>
        )}
        {isInbound && !isNote && (
          <div className="flex items-center gap-1 pt-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="text-[10px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  aria-label="React"
                >
                  <Smile className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {REACTION_PALETTE.map((emoji) => (
                  <DropdownMenuItem
                    key={emoji}
                    onSelect={() => onReact(emoji)}
                  >
                    {emoji}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              onClick={onInspect}
              className="text-[10px] text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              Inspect
            </button>
          </div>
        )}
        {!isInbound && !isNote && (
          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={onInspect}
              className="text-[10px] text-[var(--st-text-secondary)] hover:text-white"
            >
              Inspect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DeliveryTicks({ status }: { status: string }) {
  if (status === "delivered") {
    return (
      <span className="flex items-center gap-0.5">
        <CheckCheck className="h-3 w-3" />
        delivered
      </span>
    );
  }
  if (status === "sent") {
    return (
      <span className="flex items-center gap-0.5">
        <CheckCheck className="h-3 w-3 opacity-60" />
        sent
      </span>
    );
  }
  if (status === "queued" || status === "sending") {
    return (
      <span className="flex items-center gap-0.5">
        <Circle className="h-3 w-3" /> queued
      </span>
    );
  }
  if (
    status === "failed" ||
    status === "rejected" ||
    status === "undelivered"
  ) {
    return (
      <span className="flex items-center gap-0.5 text-[var(--st-text-secondary)]">
        <Trash2 className="h-3 w-3" /> {status}
      </span>
    );
  }
  return <span>{status}</span>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-[var(--st-text)]">{label}</dt>
      <dd className="text-sm text-[var(--st-text)]">{value}</dd>
    </div>
  );
}

// Re-export so the page-level layout can hot-reload the thread after a
// reply / note / status change without prop drilling the action layer.
export { loadThread };
