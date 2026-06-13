"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  Inbox,
  Mail,
  MessageSquarePlus,
  Plus,
  Send,
  User,
  Users,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  useToast,
} from "@/components/sabcrm/20ui";

import {
  addConversationComment,
  assignConversation,
  createTeamConversation,
  listConversationComments,
  setConversationStatus,
  type SabmailCommentRow,
  type SabmailConversationFilter,
  type SabmailConversationRow,
  type SabmailConversationStatus,
  type SabmailTeamMember,
} from "./actions";

import "@/components/sabmail/motion/sabmail-motion.css";

/* ── helpers ─────────────────────────────────────────────────────────── */

const FILTERS: Array<{ value: SabmailConversationFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "snoozed", label: "Snoozed" },
  { value: "closed", label: "Closed" },
];

const STATUS_OPTIONS: Array<{ value: SabmailConversationStatus; label: string }> = [
  { value: "open", label: "Open" },
  { value: "snoozed", label: "Snoozed" },
  { value: "closed", label: "Closed" },
];

// Sentinel for "Unassigned" — Radix Select can't take an empty string value.
const UNASSIGNED = "__unassigned__";

function statusVariant(
  status: SabmailConversationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "open":
      return "default";
    case "snoozed":
      return "secondary";
    case "closed":
      return "outline";
    default:
      return "outline";
  }
}

function statusIcon(status: SabmailConversationStatus) {
  switch (status) {
    case "open":
      return <Inbox className="h-3.5 w-3.5" aria-hidden />;
    case "snoozed":
      return <Clock className="h-3.5 w-3.5" aria-hidden />;
    case "closed":
      return <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />;
    default:
      return null;
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/[\s@.]+/).filter(Boolean);
  if (parts.length === 0) return trimmed[0]!.toUpperCase();
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
}

/* ── main client ─────────────────────────────────────────────────────── */

export function SabmailTeamClient({
  initialConversations,
  members,
}: {
  initialConversations: SabmailConversationRow[];
  members: SabmailTeamMember[];
}) {
  const { toast } = useToast();

  const [conversations, setConversations] =
    React.useState<SabmailConversationRow[]>(initialConversations);
  const [filter, setFilter] = React.useState<SabmailConversationFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConversations[0]?.id ?? null,
  );
  const [creating, setCreating] = React.useState(false);

  const visible = React.useMemo(
    () => (filter === "all" ? conversations : conversations.filter((c) => c.status === filter)),
    [conversations, filter],
  );

  const selected = React.useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  // Keep a valid selection as the visible set changes.
  React.useEffect(() => {
    if (selectedId && visible.some((c) => c.id === selectedId)) return;
    setSelectedId(visible[0]?.id ?? null);
  }, [visible, selectedId]);

  const upsertConversation = React.useCallback((next: SabmailConversationRow) => {
    setConversations((prev) => {
      const without = prev.filter((c) => c.id !== next.id);
      return [next, ...without].sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
      );
    });
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader>
        <PageHeaderHeading>
          <PageTitle>Team inbox</PageTitle>
          <PageDescription>
            Triage conversations together — assign an owner, set a status, and
            leave internal notes your customers never see.
          </PageDescription>
        </PageHeaderHeading>
        <Button
          variant="primary"
          size="sm"
          iconLeft={Plus}
          onClick={() => setCreating(true)}
        >
          New conversation
        </Button>
      </PageHeader>

      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
        <Mail className="h-3.5 w-3.5" aria-hidden />
        Collaboration layer over your workspace — conversations link to live
        mail in a later phase.
      </p>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(280px,380px)_1fr]">
        <ConversationList
          conversations={visible}
          filter={filter}
          onFilter={setFilter}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onNew={() => setCreating(true)}
        />

        <DetailPanel
          key={selected?.id ?? "empty"}
          conversation={selected}
          members={members}
          onUpdated={upsertConversation}
        />
      </div>

      <NewConversationDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(c) => {
          upsertConversation(c);
          setSelectedId(c.id);
          setFilter("all");
        }}
      />
    </div>
  );
}

/* ── conversation list (left pane) ───────────────────────────────────── */

function ConversationList({
  conversations,
  filter,
  onFilter,
  selectedId,
  onSelect,
  onNew,
}: {
  conversations: SabmailConversationRow[];
  filter: SabmailConversationFilter;
  onFilter: (f: SabmailConversationFilter) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <Card className="flex max-h-[calc(100vh-13rem)] flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--st-border)] p-2.5">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            variant={filter === f.value ? "primary" : "ghost"}
            size="sm"
            onClick={() => onFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className="sabmail-motion flex-1 overflow-y-auto p-2">
        {conversations.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="No conversations"
            description="New triage threads land here. Create one to get started."
            action={
              <Button variant="outline" size="sm" iconLeft={Plus} onClick={onNew}>
                New conversation
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {conversations.map((c, idx) => {
              const active = c.id === selectedId;
              return (
                <li
                  key={c.id}
                  className="sabmail-stagger-item"
                  style={{ ["--i" as string]: idx } as React.CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={[
                      "w-full rounded-md border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-[var(--st-accent)] bg-[var(--st-bg-muted)]"
                        : "border-[var(--st-border)] hover:bg-[var(--st-bg-muted)]",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-[var(--st-text)]">
                        {c.subject}
                      </span>
                      <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                        {relativeTime(c.lastMessageAt)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-[var(--st-text-secondary)]">
                      {c.fromEmail}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Badge variant={statusVariant(c.status)} className="gap-1 capitalize">
                        {statusIcon(c.status)}
                        {c.status}
                      </Badge>
                      {c.assigneeName ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--st-text-secondary)]">
                          <User className="h-3 w-3" aria-hidden />
                          {c.assigneeName}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--st-text-secondary)]">
                          Unassigned
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Card>
  );
}

/* ── detail panel (right pane) ───────────────────────────────────────── */

function DetailPanel({
  conversation,
  members,
  onUpdated,
}: {
  conversation: SabmailConversationRow | null;
  members: SabmailTeamMember[];
  onUpdated: (c: SabmailConversationRow) => void;
}) {
  const { toast } = useToast();

  const [comments, setComments] = React.useState<SabmailCommentRow[]>([]);
  const [loadingComments, setLoadingComments] = React.useState(false);
  const [note, setNote] = React.useState("");
  const [addingNote, setAddingNote] = React.useState(false);
  const [savingAssignee, setSavingAssignee] = React.useState(false);
  const [savingStatus, setSavingStatus] = React.useState(false);

  const convoId = conversation?.id ?? null;

  React.useEffect(() => {
    let cancelled = false;
    if (!convoId) {
      setComments([]);
      return;
    }
    setLoadingComments(true);
    listConversationComments(convoId)
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .finally(() => {
        if (!cancelled) setLoadingComments(false);
      });
    return () => {
      cancelled = true;
    };
  }, [convoId]);

  const onAssign = React.useCallback(
    async (value: string) => {
      if (!conversation) return;
      setSavingAssignee(true);
      const member = members.find((m) => m.id === value);
      const res = await assignConversation(conversation.id, {
        assigneeId: value === UNASSIGNED ? null : member?.id ?? null,
        assigneeName: value === UNASSIGNED ? null : member?.name ?? value,
      });
      setSavingAssignee(false);
      if (!res.ok) {
        toast({ title: "Could not assign", description: res.error, variant: "destructive" });
        return;
      }
      onUpdated(res.conversation);
      toast({
        title: res.conversation.assigneeName
          ? `Assigned to ${res.conversation.assigneeName}`
          : "Unassigned",
      });
    },
    [conversation, members, onUpdated, toast],
  );

  const onAssignFreeText = React.useCallback(
    async (name: string) => {
      if (!conversation) return;
      const trimmed = name.trim();
      setSavingAssignee(true);
      const res = await assignConversation(conversation.id, {
        assigneeName: trimmed || null,
      });
      setSavingAssignee(false);
      if (!res.ok) {
        toast({ title: "Could not assign", description: res.error, variant: "destructive" });
        return;
      }
      onUpdated(res.conversation);
    },
    [conversation, onUpdated, toast],
  );

  const onStatus = React.useCallback(
    async (value: SabmailConversationStatus) => {
      if (!conversation) return;
      setSavingStatus(true);
      const res = await setConversationStatus(conversation.id, value);
      setSavingStatus(false);
      if (!res.ok) {
        toast({ title: "Could not update status", description: res.error, variant: "destructive" });
        return;
      }
      onUpdated(res.conversation);
      toast({ title: `Marked ${res.conversation.status}` });
    },
    [conversation, onUpdated, toast],
  );

  const onAddNote = React.useCallback(async () => {
    if (!conversation) return;
    const body = note.trim();
    if (!body) return;
    setAddingNote(true);
    const res = await addConversationComment(conversation.id, body);
    setAddingNote(false);
    if (!res.ok) {
      toast({ title: "Could not add note", description: res.error, variant: "destructive" });
      return;
    }
    setComments((prev) => [...prev, res.comment]);
    setNote("");
  }, [conversation, note, toast]);

  if (!conversation) {
    return (
      <Card className="flex min-h-[420px] items-center justify-center">
        <CardBody>
          <EmptyState
            icon={Users}
            title="Pick a conversation"
            description="Select a thread on the left to assign it, set a status, and add internal notes."
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="sabmail-fade-up flex max-h-[calc(100vh-13rem)] flex-col overflow-hidden">
      {/* header */}
      <div className="border-b border-[var(--st-border)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-[var(--st-text)]">
              {conversation.subject}
            </h2>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-[var(--st-text-secondary)]">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {conversation.fromEmail}
            </p>
          </div>
          <Badge variant={statusVariant(conversation.status)} className="gap-1 capitalize">
            {statusIcon(conversation.status)}
            {conversation.status}
          </Badge>
        </div>

        {/* controls */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Assignee">
            {members.length > 0 ? (
              <Select
                value={conversation.assigneeId ?? UNASSIGNED}
                onValueChange={(v) => void onAssign(v)}
                disabled={savingAssignee}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                key={conversation.id}
                defaultValue={conversation.assigneeName ?? ""}
                placeholder="Type a name, or your own"
                disabled={savingAssignee}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next !== (conversation.assigneeName ?? "")) {
                    void onAssignFreeText(next);
                  }
                }}
              />
            )}
          </Field>

          <Field label="Status">
            <Select
              value={conversation.status}
              onValueChange={(v) => void onStatus(v as SabmailConversationStatus)}
              disabled={savingStatus}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </div>

      {/* internal comments thread */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-5 pt-4">
          <MessageSquarePlus className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
          <h3 className="text-sm font-medium text-[var(--st-text)]">Internal notes</h3>
          <span className="text-xs text-[var(--st-text-secondary)]">
            · only your team sees these
          </span>
        </div>

        <div className="sabmail-motion flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loadingComments ? (
            <p className="text-sm text-[var(--st-text-secondary)]">Loading notes…</p>
          ) : comments.length === 0 ? (
            <EmptyState
              icon={MessageSquarePlus}
              size="sm"
              title="No notes yet"
              description="Add the first internal note to share context with your team."
            />
          ) : (
            comments.map((c, idx) => (
              <div
                key={c.id}
                className="sabmail-stagger-item flex gap-3"
                style={{ ["--i" as string]: idx } as React.CSSProperties}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] text-xs font-medium text-[var(--st-text-secondary)]">
                  {initials(c.authorName)}
                </span>
                <div className="min-w-0 flex-1 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--st-text)]">
                      {c.authorName}
                    </span>
                    <span className="text-[11px] text-[var(--st-text-secondary)]">
                      {relativeTime(c.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[var(--st-text-secondary)]">
                    {c.body}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* add-note composer */}
        <div className="border-t border-[var(--st-border)] p-4">
          <Textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add an internal note… (never sent to the customer)"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void onAddNote();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-[var(--st-text-secondary)]">
              ⌘/Ctrl + Enter to post
            </span>
            <Button
              variant="primary"
              size="sm"
              iconLeft={Send}
              loading={addingNote}
              disabled={!note.trim()}
              onClick={() => void onAddNote()}
            >
              Add note
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── new-conversation dialog ─────────────────────────────────────────── */

function NewConversationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (c: SabmailConversationRow) => void;
}) {
  const { toast } = useToast();
  const [subject, setSubject] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSubject("");
      setFromEmail("");
      setSaving(false);
    }
  }, [open]);

  const submit = React.useCallback(async () => {
    setSaving(true);
    const res = await createTeamConversation({ subject, fromEmail });
    setSaving(false);
    if (!res.ok) {
      toast({ title: "Could not create", description: res.error, variant: "destructive" });
      return;
    }
    onCreated(res.conversation);
    onOpenChange(false);
    toast({ title: "Conversation created" });
  }, [subject, fromEmail, onCreated, onOpenChange, toast]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
          <DialogDescription>
            Start a triage thread. You can assign it and add internal notes once
            it&apos;s created.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <Field label="Subject">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Refund request — order #1024"
              autoFocus
            />
          </Field>
          <Field label="Customer email">
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            iconLeft={Plus}
            loading={saving}
            disabled={!subject.trim() || !fromEmail.trim()}
            onClick={() => void submit()}
          >
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
