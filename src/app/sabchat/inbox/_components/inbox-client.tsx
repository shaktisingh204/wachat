"use client";

import * as React from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Building2,
  CheckCheck,
  CheckCircle2,
  Clock,
  CreditCard,
  Inbox as InboxIcon,
  Link2,
  Lock,
  MessagesSquare,
  MonitorUp,
  Paperclip,
  Phone,
  Plus,
  Trash2,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Tag,
  Ticket,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";

import { Badge, Button, Input, useToast } from "@/components/sabcrm/20ui";
import { SabFilePickerButton } from "@/components/sabfiles";
import { useSabchatSocket, type SabchatWsEvent } from "@/lib/sabchat/use-sabchat-socket";
import {
  addConversationLabel,
  autoAssignConversation,
  getContact,
  listConversations,
  listMessages,
  removeConversationLabel,
  reopenConversation,
  resolveConversation,
  sendAgentMessage,
  sendAgentText,
  setConversationAssignee,
  snoozeConversation,
} from "@/app/actions/sabchat-inbox.actions";
import {
  applyDisposition,
  listDispositions,
  listMacros,
} from "@/app/actions/sabchat-config.actions";
import {
  aiConversationSentiment,
  aiDraftReply,
  aiResolveBotAnswer,
  aiSuggestActions,
  aiSummarize,
  aiWrapUp,
} from "@/app/actions/sabchat-ai.actions";
import type { CopilotSuggestedAction } from "@/lib/rust-client/sabchat-ai-copilot";
import { sendPaymentLink } from "@/app/actions/sabchat-commerce.actions";
import {
  conversationToTicket,
  linkContactToCrm,
  pullContactFromCrm,
  pushContactToCrm,
} from "@/app/actions/sabchat-crm-bridge.actions";
import { gradeConversation, listQaRubrics } from "@/app/actions/sabchat-ops.actions";
import { draftKbFromConversation } from "@/app/actions/sabchat-support.actions";
import { startCall, endCall } from "@/app/actions/sabchat-voice.actions";
import type { SabChatCall, SabChatCallKind } from "@/lib/rust-client/sabchat-voice";
import { requestCobrowse, endCobrowse } from "@/app/actions/sabchat-cobrowse.actions";
import type { SabChatCobrowseSession } from "@/lib/rust-client/sabchat-cobrowse";
import {
  appendSideMessage,
  cancelScheduledMessage,
  createSideConversation,
  deleteSideConversation,
  linkConversations,
  listConversationLinks,
  listScheduledMessages,
  listSideConversations,
  listSideMessages,
  scheduleMessage,
  unlinkConversations,
} from "@/app/actions/sabchat-collab.actions";
import type {
  SabChatConversationLink,
  SabChatScheduledMessage,
  SabChatSideConversation,
  SabChatSideMessage,
} from "@/lib/rust-client/sabchat-collab";
import type {
  ContentBlock,
  ConversationStatus,
  SabChatContact,
  SabChatConversation,
  SabChatInbox,
  SabChatMessage,
} from "@/lib/rust-client/sabchat";
import type { SabChatMacro } from "@/lib/rust-client/sabchat-macros";
import type { SabChatDisposition } from "@/lib/rust-client/sabchat-dispositions";
import type { ResolveBotSource } from "@/lib/rust-client/sabchat-ai-resolve-bot";

/* ------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------ */

const STATUS_TABS: { id: ConversationStatus; label: string }[] = [
  { id: "open", label: "Open" },
  { id: "pending", label: "Pending" },
  { id: "snoozed", label: "Snoozed" },
  { id: "resolved", label: "Resolved" },
];

const TYPING_TTL_MS = 4000;
// Viewers heartbeat every VIEWER_HEARTBEAT_MS while a conversation is open;
// a viewer is considered gone once their last beat is older than VIEWER_TTL_MS.
const VIEWER_HEARTBEAT_MS = 15_000;
const VIEWER_TTL_MS = 40_000;
const PINNED_LABEL = "pinned";

function relTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return "";
  const s = Math.floor((Date.now() - d) / 1000);
  if (s < 45) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(iso).toLocaleDateString();
}

function dayLabel(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function clockTime(iso?: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function contactLabel(c?: SabChatContact | null): string {
  if (!c) return "Visitor";
  return c.name || c.emails?.[0] || c.phones?.[0] || "Visitor";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full bg-[var(--st-bg-muted)] font-semibold text-[var(--st-text-secondary)]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials(name)}
    </span>
  );
}

function previewOf(content: ContentBlock | undefined, fallback?: string): string {
  if (!content) return fallback ?? "";
  switch (content.kind) {
    case "text":
    case "system":
      return content.text;
    case "image":
      return "📷 Photo";
    case "file":
      return `📎 ${content.attachment?.name ?? "File"}`;
    case "voice":
      return "🎤 Voice message";
    case "location":
      return "📍 Location";
    default:
      return fallback ?? "Message";
  }
}

/* ------------------------------------------------------------------------
 * Message bubble
 * ------------------------------------------------------------------------ */

function MessageContent({ content }: { content: ContentBlock }) {
  switch (content.kind) {
    case "text":
      return <span className="whitespace-pre-wrap break-words">{content.text}</span>;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={content.url}
          alt={content.alt ?? "image"}
          className="max-h-64 rounded-md"
        />
      );
    case "file":
      return (
        <a
          href={content.attachment?.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 underline underline-offset-2"
        >
          <Paperclip className="h-3.5 w-3.5" aria-hidden />
          {content.attachment?.name ?? "Download file"}
        </a>
      );
    case "voice":
      return <audio controls src={content.url} className="max-w-full" />;
    case "location":
      return (
        <span className="inline-flex items-center gap-1">
          📍 {content.label ?? `${content.lat}, ${content.lng}`}
        </span>
      );
    case "system":
      return <span className="italic opacity-70">{content.text}</span>;
    default:
      return <span className="opacity-70">[unsupported message]</span>;
  }
}

function MessageBubble({ m }: { m: SabChatMessage }) {
  const outbound = m.direction === "outbound";
  const isPrivate = !!m.private;
  if (m.content.kind === "system") {
    return (
      <div className="my-2 flex justify-center">
        <span className="rounded-full bg-[var(--st-bg-muted)] px-3 py-1 text-xs text-[var(--st-text-secondary)]">
          <MessageContent content={m.content} />
        </span>
      </div>
    );
  }
  return (
    <div
      className={`flex w-full ${outbound ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
          isPrivate
            ? "border border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            : outbound
              ? "bg-[var(--st-primary,var(--st-accent))] text-white"
              : "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
        }`}
      >
        {isPrivate ? (
          <span className="mb-0.5 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide opacity-80">
            <Lock className="h-3 w-3" aria-hidden /> Private note
          </span>
        ) : null}
        <MessageContent content={m.content} />
        <span
          className={`mt-1 block text-right text-[10px] ${
            outbound && !isPrivate ? "text-white/70" : "text-[var(--st-text-secondary)]"
          }`}
        >
          {clockTime(m.createdAt)}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Main client
 * ------------------------------------------------------------------------ */

export function InboxClient({
  currentUserId,
  initialInboxes,
  initialConversations,
  agents,
}: {
  currentUserId: string;
  initialInboxes: SabChatInbox[];
  initialConversations: SabChatConversation[];
  agents: { id: string; label: string }[];
}) {
  const { toast } = useToast();

  const [inboxes] = React.useState<SabChatInbox[]>(initialInboxes);
  const [conversations, setConversations] = React.useState<SabChatConversation[]>(
    initialConversations,
  );
  const [status, setStatus] = React.useState<ConversationStatus>("open");
  const [inboxFilter, setInboxFilter] = React.useState<string>("all");
  const [assignFilter, setAssignFilter] = React.useState<"all" | "mine" | "unassigned">(
    "all",
  );
  const [search, setSearch] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialConversations[0]?._id ?? null,
  );

  const [messages, setMessages] = React.useState<SabChatMessage[]>([]);
  const [loadingThread, setLoadingThread] = React.useState(false);
  const [contactsById, setContactsById] = React.useState<Record<string, SabChatContact>>(
    {},
  );
  const [typing, setTyping] = React.useState<Record<string, number>>({});
  // Per-conversation viewer roster (conversationId → agentId → last-seen ms).
  // Powers the collision warning; self is never recorded.
  const [viewers, setViewers] = React.useState<Record<string, Record<string, number>>>({});
  const [refreshing, startRefresh] = React.useTransition();

  const selected = React.useMemo(
    () => conversations.find((c) => c._id === selectedId) ?? null,
    [conversations, selectedId],
  );
  const selectedContact = selected ? contactsById[selected.contactId] : undefined;

  const threadRef = React.useRef<HTMLDivElement | null>(null);
  const refetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  /* -- conversation list fetch (filters) ------------------------------- */
  const refetchConversations = React.useCallback(() => {
    startRefresh(async () => {
      const res = await listConversations({
        status,
        inboxId: inboxFilter === "all" ? undefined : inboxFilter,
        // "unassigned" has no server-side sentinel — filter it client-side
        // (below) so we never send a non-ObjectId assigneeId to Rust.
        assigneeId: assignFilter === "mine" ? currentUserId : undefined,
        q: search.trim() || undefined,
        limit: 80,
      });
      setConversations(res.items);
    });
  }, [status, inboxFilter, assignFilter, search, currentUserId]);

  // Re-fetch when filters change (debounced for search).
  React.useEffect(() => {
    const t = setTimeout(refetchConversations, 250);
    return () => clearTimeout(t);
  }, [refetchConversations]);

  /* -- prefetch contact names for visible rows ------------------------- */
  React.useEffect(() => {
    const missing = conversations
      .map((c) => c.contactId)
      .filter((id) => id && !contactsById[id]);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      const uniq = Array.from(new Set(missing)).slice(0, 40);
      const fetched = await Promise.all(uniq.map((id) => getContact(id)));
      if (cancelled) return;
      setContactsById((prev) => {
        const next = { ...prev };
        uniq.forEach((id, i) => {
          const c = fetched[i];
          if (c) next[id] = c;
        });
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [conversations, contactsById]);

  /* -- load a thread when selection changes ---------------------------- */
  const openConversation = React.useCallback(async (conv: SabChatConversation) => {
    setSelectedId(conv._id);
    setLoadingThread(true);
    // Locally clear unread.
    setConversations((prev) =>
      prev.map((c) => (c._id === conv._id ? { ...c, unreadCount: 0 } : c)),
    );
    const [msgs, contact] = await Promise.all([
      listMessages(conv._id),
      getContact(conv.contactId),
    ]);
    setMessages([...msgs.items].reverse());
    if (contact) setContactsById((prev) => ({ ...prev, [conv.contactId]: contact }));
    setLoadingThread(false);
  }, []);

  // Auto-open the first conversation on first render.
  React.useEffect(() => {
    if (selectedId && messages.length === 0 && !loadingThread) {
      const conv = conversations.find((c) => c._id === selectedId);
      if (conv) void openConversation(conv);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the thread scrolled to the newest message.
  React.useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, selectedId]);

  /* -- realtime -------------------------------------------------------- */
  const onEvent = React.useCallback(
    (ev: SabchatWsEvent) => {
      const p = ev.payload ?? {};
      if (ev.type === "message.created") {
        const msg = p as SabChatMessage;
        const convId = msg.conversationId;
        // Append to the open thread (dedupe by _id).
        if (convId === selectedId) {
          setMessages((prev) =>
            prev.some((m) => m._id === msg._id) ? prev : [...prev, msg],
          );
        }
        // Patch / hoist the list row.
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c._id === convId);
          if (idx === -1) {
            scheduleRefetch();
            return prev;
          }
          const row = {
            ...prev[idx],
            lastMessageAt: msg.createdAt,
            lastMessagePreview: previewOf(msg.content, prev[idx].lastMessagePreview),
            unreadCount:
              convId === selectedId || msg.direction === "outbound"
                ? prev[idx].unreadCount ?? 0
                : (prev[idx].unreadCount ?? 0) + 1,
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [row, ...rest];
        });
      } else if (ev.type === "conversation.updated") {
        const convId = p.conversationId as string;
        setConversations((prev) => {
          const idx = prev.findIndex((c) => c._id === convId);
          if (idx === -1) {
            scheduleRefetch();
            return prev;
          }
          const row = {
            ...prev[idx],
            lastMessageAt: p.lastMessageAt ?? prev[idx].lastMessageAt,
            lastMessagePreview: p.lastMessagePreview ?? prev[idx].lastMessagePreview,
            status: (p.status as ConversationStatus) ?? prev[idx].status,
          };
          const rest = prev.filter((_, i) => i !== idx);
          return [row, ...rest];
        });
      } else if (ev.type === "typing") {
        if (p.actorId && p.actorId === currentUserId) return; // ignore self
        const convId = p.conversationId as string;
        if (convId) setTyping((prev) => ({ ...prev, [convId]: Date.now() }));
      } else if (ev.type === "viewing") {
        const convId = p.conversationId as string;
        const agentId = p.agentId as string;
        if (!convId || !agentId || agentId === currentUserId) return; // ignore self
        setViewers((prev) => {
          const conv = { ...(prev[convId] ?? {}) };
          if (p.state === "close") {
            delete conv[agentId];
          } else {
            conv[agentId] = Date.now();
          }
          return { ...prev, [convId]: conv };
        });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, currentUserId],
  );

  const scheduleRefetch = React.useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current);
    refetchTimer.current = setTimeout(refetchConversations, 600);
  }, [refetchConversations]);

  const { status: socketStatus, sendTyping, sendViewing } = useSabchatSocket({ onEvent });

  // Announce which conversation this agent is viewing (open/close + heartbeat),
  // and expire stale viewers from the roster. Together these drive the
  // collision banner so two agents don't unknowingly reply to the same person.
  React.useEffect(() => {
    if (!selectedId) return;
    sendViewing(selectedId, "open");
    const beat = setInterval(() => sendViewing(selectedId, "open"), VIEWER_HEARTBEAT_MS);
    return () => {
      clearInterval(beat);
      sendViewing(selectedId, "close");
    };
  }, [selectedId, sendViewing]);

  React.useEffect(() => {
    const t = setInterval(() => {
      setViewers((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, Record<string, number>> = {};
        for (const [conv, roster] of Object.entries(prev)) {
          const keep: Record<string, number> = {};
          for (const [agent, ts] of Object.entries(roster)) {
            if (now - ts < VIEWER_TTL_MS) keep[agent] = ts;
            else changed = true;
          }
          if (Object.keys(keep).length) next[conv] = keep;
          else if (Object.keys(roster).length) changed = true;
        }
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Expire stale typing indicators.
  React.useEffect(() => {
    const t = setInterval(() => {
      setTyping((prev) => {
        const now = Date.now();
        let changed = false;
        const next: Record<string, number> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v < TYPING_TTL_MS) next[k] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(t);
  }, []);

  /* -- macros (canned responses) + dispositions ------------------------ */
  const [macros, setMacros] = React.useState<SabChatMacro[]>([]);
  const [dispositions, setDispositions] = React.useState<SabChatDisposition[]>([]);
  const [resolveOpen, setResolveOpen] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const [m, d] = await Promise.all([listMacros(), listDispositions()]);
      if (cancelled) return;
      setMacros(m);
      setDispositions(d);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* -- composer -------------------------------------------------------- */
  const [draft, setDraft] = React.useState("");
  const [isPrivate, setIsPrivate] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // Conversational commerce — send a SabPay payment link inline.
  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [payCurrency, setPayCurrency] = React.useState("USD");
  const [payLabel, setPayLabel] = React.useState("");
  const [payBusy, setPayBusy] = React.useState(false);
  const doSendPay = async () => {
    if (!selectedId) return;
    setPayBusy(true);
    const res = await sendPaymentLink(selectedId, {
      amountMajor: Number(payAmount),
      currency: payCurrency,
      label: payLabel,
    });
    setPayBusy(false);
    if (res.ok) {
      toast({ title: "Payment link sent" });
      setPayOpen(false);
      setPayAmount("");
      setPayLabel("");
      // the payment message arrives live via the WS hub — no manual refetch
    } else {
      toast({ title: "Could not send link", description: res.error, variant: "destructive" });
    }
  };

  // `/`-triggered canned-response menu.
  const showMacros = draft.startsWith("/") && macros.length > 0;
  const macroQuery = draft.slice(1).toLowerCase();
  const filteredMacros = showMacros
    ? macros
        .filter(
          (m) =>
            m.name.toLowerCase().includes(macroQuery) ||
            m.content.toLowerCase().includes(macroQuery),
        )
        .slice(0, 6)
    : [];

  // @mention popover (composer) — agents roster filtered by the trailing @token.
  const mentionMatch = /(^|\s)@(\w*)$/.exec(draft);
  const showMentions = !!mentionMatch && agents.length > 0;
  const mentionQuery = mentionMatch ? mentionMatch[2].toLowerCase() : "";
  const filteredAgents = showMentions
    ? agents.filter((a) => a.label.toLowerCase().includes(mentionQuery)).slice(0, 6)
    : [];
  const applyMention = (label: string) => {
    const m = /(^|\s)@(\w*)$/.exec(draft);
    if (!m) return;
    const lead = m[1] ?? "";
    const start = draft.length - m[0].length + lead.length;
    setDraft(draft.slice(0, start) + "@" + label + " ");
  };

  /* -- bulk select ----------------------------------------------------- */
  const [selectMode, setSelectMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = React.useState(false);
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => {
    setSelectedIds(new Set());
    setSelectMode(false);
  };
  const runBulk = async (
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
    label: string,
  ) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setBulkBusy(true);
    let failed = 0;
    for (const id of ids) {
      const res = await fn(id);
      if (!res.ok) failed++;
    }
    setBulkBusy(false);
    clearSelection();
    refetchConversations();
    toast({
      title: failed ? `${label}: ${ids.length - failed}/${ids.length} done` : `${label} — done`,
      variant: failed ? "destructive" : undefined,
    });
  };

  /* -- command palette (⌘K) -------------------------------------------- */
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [paletteQuery, setPaletteQuery] = React.useState("");
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        setPaletteQuery("");
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const appendLocal = React.useCallback((m: SabChatMessage) => {
    setMessages((prev) => (prev.some((x) => x._id === m._id) ? prev : [...prev, m]));
  }, []);

  const doSend = React.useCallback(async () => {
    if (!selectedId || !draft.trim() || sending) return;
    setSending(true);
    const res = await sendAgentText(selectedId, draft, { private: isPrivate });
    setSending(false);
    if (res.ok) {
      appendLocal(res.data);
      setDraft("");
    } else {
      toast({ title: "Could not send", description: res.error, variant: "destructive" });
    }
  }, [selectedId, draft, isPrivate, sending, appendLocal, toast]);

  const sendAttachment = React.useCallback(
    async (pick: { id: string; url: string; name: string; mime?: string; size?: number }) => {
      if (!selectedId) return;
      const isImage = (pick.mime ?? "").startsWith("image/");
      const content: ContentBlock = isImage
        ? { kind: "image", url: pick.url, alt: pick.name }
        : {
            kind: "file",
            attachment: {
              sabfileId: pick.id,
              url: pick.url,
              name: pick.name,
              mime: pick.mime,
              size: pick.size,
            },
          };
      const res = await sendAgentMessage(selectedId, content, { private: isPrivate });
      if (res.ok) appendLocal(res.data);
      else toast({ title: "Could not attach", description: res.error, variant: "destructive" });
    },
    [selectedId, isPrivate, appendLocal, toast],
  );

  /* -- conversation actions -------------------------------------------- */
  const patchSelected = React.useCallback(
    (patch: Partial<SabChatConversation>) => {
      if (!selectedId) return;
      setConversations((prev) =>
        prev.map((c) => (c._id === selectedId ? { ...c, ...patch } : c)),
      );
    },
    [selectedId],
  );

  const act = React.useCallback(
    async (fn: () => Promise<{ ok: boolean; error?: string }>, optimistic?: () => void) => {
      optimistic?.();
      const res = await fn();
      if (!res.ok) {
        toast({ title: "Action failed", description: res.error, variant: "destructive" });
        refetchConversations();
      }
    },
    [toast, refetchConversations],
  );

  const doResolve = (code?: string) => {
    if (!selected) return;
    if (code) {
      void act(
        () => applyDisposition(selected._id, code, { alsoResolve: true }),
        () => patchSelected({ status: "resolved" }),
      );
    } else {
      void act(
        () => resolveConversation(selected._id),
        () => patchSelected({ status: "resolved" }),
      );
    }
    setResolveOpen(false);
  };

  /* -- AI copilot ------------------------------------------------------ */
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [copilotBusy, setCopilotBusy] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<string | null>(null);
  const [churnRisk, setChurnRisk] = React.useState<number | null>(null);
  // Answer inspection — provenance of the last KB-suggested reply.
  const [kbInspect, setKbInspect] = React.useState<{
    confidence: number;
    escalate: boolean;
    sources: ResolveBotSource[];
  } | null>(null);
  // CX score — quality grade for this conversation (no survey needed).
  const [cxScore, setCxScore] = React.useState<{ total: number; max: number } | null>(null);
  // AI-suggested next actions for the open conversation.
  const [suggestedActions, setSuggestedActions] = React.useState<CopilotSuggestedAction[] | null>(
    null,
  );

  const runDraft = async () => {
    if (!selectedId) return;
    setCopilotBusy("draft");
    const res = await aiDraftReply(selectedId);
    setCopilotBusy(null);
    if (res.ok) {
      setDraft(res.draft);
      setCopilotOpen(false);
    } else {
      toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
    }
  };

  const runSummary = async () => {
    if (!selectedId) return;
    setCopilotBusy("summary");
    const res = await aiSummarize(selectedId);
    setCopilotBusy(null);
    if (res.ok) setSummary(res.summary);
    else toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
  };

  const runSentiment = async () => {
    if (!selectedId) return;
    setCopilotBusy("sentiment");
    const res = await aiConversationSentiment(selectedId);
    setCopilotBusy(null);
    if (res.ok) setChurnRisk(res.churnRisk);
    else toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
  };

  const runSuggest = async () => {
    if (!selected) return;
    const lastVisitor = [...messages]
      .reverse()
      .find((m) => m.direction === "inbound" && m.content.kind === "text");
    const q =
      lastVisitor && lastVisitor.content.kind === "text" ? lastVisitor.content.text : "";
    if (!q) {
      toast({ title: "No visitor question to answer yet." });
      return;
    }
    setCopilotBusy("suggest");
    const res = await aiResolveBotAnswer(selected.inboxId, selected._id, q);
    setCopilotBusy(null);
    if (res.ok) {
      setDraft(res.answer);
      // Keep the panel open and surface provenance (answer inspection) so the
      // agent can see which KB sources produced the reply + the confidence.
      setKbInspect({
        confidence: res.confidence,
        escalate: res.escalate,
        sources: res.sources ?? [],
      });
    } else {
      toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
    }
  };

  const runSuggestActions = async () => {
    if (!selectedId) return;
    setCopilotBusy("actions");
    const res = await aiSuggestActions(selectedId);
    setCopilotBusy(null);
    if (res.ok) setSuggestedActions(res.actions);
    else toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
  };

  const runWrapUp = async () => {
    if (!selectedId) return;
    setCopilotBusy("wrapup");
    const res = await aiWrapUp(selectedId);
    setCopilotBusy(null);
    if (res.ok) {
      setDraft(res.note);
      setIsPrivate(true);
      setCopilotOpen(false);
      toast({ title: "Wrap-up note ready", description: "Added as a private note — edit and post." });
    } else {
      toast({ title: "Copilot failed", description: res.error, variant: "destructive" });
    }
  };

  const runKbDraft = async () => {
    if (!selectedId) return;
    setCopilotBusy("kbdraft");
    const res = await draftKbFromConversation(selectedId);
    setCopilotBusy(null);
    if (res.ok) {
      toast({
        title: "KB draft created",
        description: "Review and publish it under Knowledge base.",
      });
      setCopilotOpen(false);
    } else {
      toast({ title: "Couldn't draft article", description: res.error, variant: "destructive" });
    }
  };

  const runGrade = async () => {
    if (!selectedId) return;
    setCopilotBusy("grade");
    const rubrics = await listQaRubrics();
    const rubric = rubrics.find((r) => r.active) ?? rubrics[0];
    if (!rubric) {
      setCopilotBusy(null);
      toast({
        title: "No QA rubric defined",
        description: "Create one under Admin › Quality (QA) first.",
      });
      return;
    }
    const res = await gradeConversation(selectedId, rubric._id);
    setCopilotBusy(null);
    if (res.ok) {
      setCxScore({ total: res.score.total, max: res.score.max });
    } else {
      toast({ title: "Grading failed", description: res.error, variant: "destructive" });
    }
  };

  // Reset copilot output when switching conversations.
  React.useEffect(() => {
    setSummary(null);
    setChurnRisk(null);
    setKbInspect(null);
    setCxScore(null);
    setSuggestedActions(null);
    setCopilotOpen(false);
  }, [selectedId]);

  /* -- voice / video call lifecycle ----------------------------------- */
  const [activeCall, setActiveCall] = React.useState<SabChatCall | null>(null);
  const [callBusy, setCallBusy] = React.useState(false);
  const doStartCall = async (kind: SabChatCallKind) => {
    if (!selectedId || activeCall) return;
    setCallBusy(true);
    const res = await startCall(selectedId, kind);
    setCallBusy(false);
    if (res.ok) {
      setActiveCall(res.call);
      toast({ title: `${kind === "video" ? "Video" : "Voice"} call started` });
    } else {
      toast({ title: "Couldn't start call", description: res.error, variant: "destructive" });
    }
  };
  const doEndCall = async () => {
    if (!activeCall) return;
    setCallBusy(true);
    const res = await endCall(activeCall._id);
    setCallBusy(false);
    setActiveCall(null);
    if (!res.ok) toast({ title: "Couldn't end call", description: res.error, variant: "destructive" });
  };
  // Drop any active call when switching conversations.
  React.useEffect(() => {
    setActiveCall(null);
  }, [selectedId]);

  /* -- co-browse session lifecycle ------------------------------------ */
  const [cobrowse, setCobrowse] = React.useState<SabChatCobrowseSession | null>(null);
  const [cobrowseBusy, setCobrowseBusy] = React.useState(false);
  const doRequestCobrowse = async () => {
    if (!selectedId || cobrowse) return;
    setCobrowseBusy(true);
    const res = await requestCobrowse(selectedId);
    setCobrowseBusy(false);
    if (res.ok) {
      setCobrowse(res.session);
      toast({ title: "Co-browse requested", description: "Waiting for the visitor to accept." });
    } else {
      toast({ title: "Couldn't start co-browse", description: res.error, variant: "destructive" });
    }
  };
  const doEndCobrowse = async () => {
    if (!cobrowse) return;
    setCobrowseBusy(true);
    await endCobrowse(cobrowse._id);
    setCobrowseBusy(false);
    setCobrowse(null);
  };
  React.useEffect(() => {
    setCobrowse(null);
  }, [selectedId]);

  /* -- derived: pinned / all (apply client-side "unassigned" filter) --- */
  const visible =
    assignFilter === "unassigned"
      ? conversations.filter((c) => !c.assigneeId)
      : conversations;
  const pinned = visible.filter((c) => c.labels?.includes(PINNED_LABEL));
  const rest = visible.filter((c) => !c.labels?.includes(PINNED_LABEL));

  const paletteResults = (
    paletteQuery.trim()
      ? conversations.filter((c) => {
          const q = paletteQuery.toLowerCase();
          return (
            contactLabel(contactsById[c.contactId]).toLowerCase().includes(q) ||
            (c.lastMessagePreview || "").toLowerCase().includes(q)
          );
        })
      : conversations
  ).slice(0, 12);

  /* ------------------------------------------------------------------ */
  return (
    <div className="flex h-[calc(100vh-var(--st-shell-header,56px))] min-h-0 w-full">
      {/* Pane 1 — conversation list */}
      <aside className="flex w-[340px] shrink-0 flex-col border-r border-[var(--st-border)]">
        <header className="flex items-center justify-between gap-2 px-4 pt-4">
          <h1 className="text-lg font-semibold text-[var(--st-text)]">Messages</h1>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setSelectMode((m) => !m);
                setSelectedIds(new Set());
              }}
              className="text-xs text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              {selectMode ? "Cancel" : "Select"}
            </button>
            <span
              className={`inline-flex items-center gap-1 text-xs ${
                socketStatus === "open"
                  ? "text-[var(--st-status-ok)]"
                  : "text-[var(--st-text-secondary)]"
              }`}
              title={`Realtime: ${socketStatus}`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  socketStatus === "open"
                    ? "bg-[var(--st-status-ok)]"
                    : "bg-[var(--st-text-secondary)]"
                }`}
              />
              {socketStatus === "open" ? "Live" : "…"}
            </span>
          </div>
        </header>

        <div className="px-4 pt-3">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]"
              aria-hidden
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="pl-8"
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 px-3 pt-3">
          {STATUS_TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatus(t.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                status === t.id
                  ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                  : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Filters row */}
        <div className="flex items-center gap-2 px-4 pb-2 pt-3 text-xs">
          <select
            aria-label="Inbox filter"
            value={inboxFilter}
            onChange={(e) => setInboxFilter(e.target.value)}
            className="rounded-md border border-[var(--st-border)] bg-transparent px-1.5 py-1 text-[var(--st-text)]"
          >
            <option value="all">All inboxes</option>
            {inboxes.map((i) => (
              <option key={i._id} value={i._id}>
                {i.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Assignment filter"
            value={assignFilter}
            onChange={(e) => setAssignFilter(e.target.value as typeof assignFilter)}
            className="rounded-md border border-[var(--st-border)] bg-transparent px-1.5 py-1 text-[var(--st-text)]"
          >
            <option value="all">All</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </select>
          {refreshing ? (
            <span className="text-[var(--st-text-secondary)]">…</span>
          ) : null}
        </div>

        {selectMode && selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 border-y border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2 text-xs">
            <span className="font-medium text-[var(--st-text)]">{selectedIds.size} selected</span>
            <Button
              variant="outline"
              size="sm"
              loading={bulkBusy}
              onClick={() => void runBulk((id) => resolveConversation(id), "Resolved")}
            >
              Resolve
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={bulkBusy}
              onClick={() =>
                void runBulk((id) => setConversationAssignee(id, currentUserId), "Assigned")
              }
            >
              Assign me
            </Button>
            <Button
              variant="outline"
              size="sm"
              loading={bulkBusy}
              onClick={() => {
                const l = window.prompt("Label to add to selected conversations");
                if (l && l.trim()) void runBulk((id) => addConversationLabel(id, l.trim()), "Labelled");
              }}
            >
              Add label
            </Button>
            <button
              onClick={clearSelection}
              className="ml-auto text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
            >
              Clear
            </button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--st-text-secondary)]">
              No {status} conversations.
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <SectionLabel>Pinned</SectionLabel>
              )}
              {pinned.map((c) => (
                <ConversationRow
                  key={c._id}
                  conv={c}
                  contact={contactsById[c.contactId]}
                  active={c._id === selectedId}
                  typing={!!typing[c._id]}
                  hasOtherViewer={Object.keys(viewers[c._id] ?? {}).length > 0}
                  onClick={() => void openConversation(c)}
                  selectMode={selectMode}
                  checked={selectedIds.has(c._id)}
                  onToggle={() => toggleSelected(c._id)}
                />
              ))}
              {pinned.length > 0 && rest.length > 0 && (
                <SectionLabel>All conversations</SectionLabel>
              )}
              {rest.map((c) => (
                <ConversationRow
                  key={c._id}
                  conv={c}
                  contact={contactsById[c.contactId]}
                  active={c._id === selectedId}
                  typing={!!typing[c._id]}
                  hasOtherViewer={Object.keys(viewers[c._id] ?? {}).length > 0}
                  onClick={() => void openConversation(c)}
                  selectMode={selectMode}
                  checked={selectedIds.has(c._id)}
                  onToggle={() => toggleSelected(c._id)}
                />
              ))}
            </>
          )}
        </div>
      </aside>

      {/* Pane 2 — thread */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-center">
            <div className="text-[var(--st-text-secondary)]">
              <MessagesSquare className="mx-auto mb-2 h-8 w-8 opacity-60" aria-hidden />
              <p className="text-sm">Select a conversation to start replying.</p>
            </div>
          </div>
        ) : (
          <>
            {/* thread header */}
            <header className="flex items-center justify-between gap-3 border-b border-[var(--st-border)] px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={contactLabel(selectedContact)} size={38} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--st-text)]">
                    {contactLabel(selectedContact)}
                  </p>
                  <p className="truncate text-xs text-[var(--st-text-secondary)]">
                    {typing[selected._id] ? (
                      <span className="text-[var(--st-status-ok)]">typing…</span>
                    ) : (
                      <StatusBadge status={selected.status} sla={selected.sla?.breached} />
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <IconBtn
                  title="Voice call"
                  disabled={callBusy || !!activeCall}
                  onClick={() => void doStartCall("audio")}
                >
                  <Phone className="h-4 w-4" aria-hidden />
                </IconBtn>
                <IconBtn
                  title="Video call"
                  disabled={callBusy || !!activeCall}
                  onClick={() => void doStartCall("video")}
                >
                  <Video className="h-4 w-4" aria-hidden />
                </IconBtn>
                <IconBtn
                  title="Start co-browse"
                  disabled={cobrowseBusy || !!cobrowse}
                  onClick={() => void doRequestCobrowse()}
                >
                  <MonitorUp className="h-4 w-4" aria-hidden />
                </IconBtn>
                <div className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={Sparkles}
                    onClick={() => setCopilotOpen((o) => !o)}
                  >
                    Copilot
                  </Button>
                  {copilotOpen ? (
                    <div className="absolute right-0 z-30 mt-1 w-72 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-2 shadow-lg">
                      <div className="grid grid-cols-2 gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "draft"}
                          onClick={() => void runDraft()}
                        >
                          Draft reply
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "suggest"}
                          onClick={() => void runSuggest()}
                        >
                          Suggest from KB
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "summary"}
                          onClick={() => void runSummary()}
                        >
                          Summarize
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "sentiment"}
                          onClick={() => void runSentiment()}
                        >
                          Sentiment
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "grade"}
                          onClick={() => void runGrade()}
                        >
                          Grade CX
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "actions"}
                          onClick={() => void runSuggestActions()}
                        >
                          Next actions
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          loading={copilotBusy === "wrapup"}
                          onClick={() => void runWrapUp()}
                        >
                          Wrap-up note
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="col-span-2"
                          iconLeft={BookOpen}
                          loading={copilotBusy === "kbdraft"}
                          onClick={() => void runKbDraft()}
                        >
                          Save as KB draft
                        </Button>
                      </div>
                      {suggestedActions ? (
                        <div className="mt-2 rounded-md bg-[var(--st-bg-muted)] p-2 text-xs text-[var(--st-text)]">
                          <p className="mb-1 font-semibold">Suggested next actions</p>
                          {suggestedActions.length ? (
                            <ul className="space-y-1">
                              {suggestedActions.map((a, i) => (
                                <li key={i} className="flex items-start gap-1.5">
                                  <Sparkles
                                    className="mt-0.5 h-3 w-3 shrink-0 text-[var(--st-primary,var(--st-accent))]"
                                    aria-hidden
                                  />
                                  <span>{a.title}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[var(--st-text-secondary)]">
                              Nothing pressing — the conversation looks handled.
                            </p>
                          )}
                        </div>
                      ) : null}
                      {kbInspect ? (
                        <div className="mt-2 rounded-md bg-[var(--st-bg-muted)] p-2 text-xs text-[var(--st-text)]">
                          <p className="mb-1 flex items-center justify-between font-semibold">
                            <span>Answer source</span>
                            <span
                              className={
                                kbInspect.confidence >= 0.6
                                  ? "text-[var(--st-status-ok)]"
                                  : "text-amber-500"
                              }
                            >
                              {Math.round(kbInspect.confidence * 100)}% conf.
                            </span>
                          </p>
                          {kbInspect.sources.length ? (
                            <ul className="space-y-0.5">
                              {kbInspect.sources.map((s) => (
                                <li key={s.id} className="flex items-center gap-1 truncate">
                                  <BookOpen className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                                  <span className="truncate">{s.title}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-[var(--st-text-secondary)]">
                              No KB source — answer generated without a matching article.
                            </p>
                          )}
                          {kbInspect.escalate ? (
                            <p className="mt-1 font-medium text-amber-500">
                              Low confidence — consider escalating to a human.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {cxScore ? (
                        <div className="mt-2 flex items-center justify-between rounded-md bg-[var(--st-bg-muted)] p-2 text-xs">
                          <span className="font-semibold text-[var(--st-text)]">CX score</span>
                          <span className="font-semibold text-[var(--st-text)]">
                            {cxScore.total}/{cxScore.max}
                            <span className="ml-1 font-normal text-[var(--st-text-secondary)]">
                              ({cxScore.max ? Math.round((cxScore.total / cxScore.max) * 100) : 0}%)
                            </span>
                          </span>
                        </div>
                      ) : null}
                      {summary ? (
                        <div className="mt-2 rounded-md bg-[var(--st-bg-muted)] p-2 text-xs text-[var(--st-text)]">
                          <p className="mb-1 font-semibold">Summary</p>
                          {summary}
                        </div>
                      ) : null}
                      {churnRisk !== null ? (
                        <div className="mt-2 flex items-center justify-between rounded-md bg-[var(--st-bg-muted)] p-2 text-xs">
                          <span className="font-semibold text-[var(--st-text)]">
                            Churn risk
                          </span>
                          <span
                            className={
                              churnRisk > 0.6
                                ? "font-semibold text-red-500"
                                : "text-[var(--st-text)]"
                            }
                          >
                            {Math.round(churnRisk * 100)}%
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={UserPlus}
                  onClick={() =>
                    void act(
                      () => setConversationAssignee(selected._id, currentUserId),
                      () => patchSelected({ assigneeId: currentUserId }),
                    )
                  }
                >
                  Assign me
                </Button>
                {selected.status === "resolved" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    iconLeft={RotateCcw}
                    onClick={() =>
                      void act(
                        () => reopenConversation(selected._id),
                        () => patchSelected({ status: "open" }),
                      )
                    }
                  >
                    Reopen
                  </Button>
                ) : (
                  <div className="relative">
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={CheckCircle2}
                      onClick={() =>
                        dispositions.length
                          ? setResolveOpen((o) => !o)
                          : doResolve()
                      }
                    >
                      Resolve
                    </Button>
                    {resolveOpen && dispositions.length > 0 ? (
                      <div className="absolute right-0 z-20 mt-1 w-60 rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1 shadow-lg">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                          Close with reason
                        </p>
                        {dispositions.map((d) => (
                          <button
                            key={d._id}
                            onClick={() => doResolve(d.code)}
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                          >
                            <span
                              aria-hidden
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ background: d.color || "var(--st-text-secondary)" }}
                            />
                            {d.label}
                          </button>
                        ))}
                        <button
                          onClick={() => doResolve()}
                          className="mt-1 w-full rounded px-2 py-1.5 text-left text-sm text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                        >
                          Resolve without reason
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </header>

            {/* active call bar */}
            {activeCall ? (
              <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] bg-emerald-50 px-4 py-1.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                <span className="flex items-center gap-2">
                  {activeCall.kind === "video" ? (
                    <Video className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {activeCall.kind === "video" ? "Video" : "Voice"} call ·{" "}
                  <span className="capitalize">{activeCall.status}</span>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  loading={callBusy}
                  onClick={() => void doEndCall()}
                >
                  End call
                </Button>
              </div>
            ) : null}

            {/* active co-browse bar */}
            {cobrowse ? (
              <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] bg-sky-50 px-4 py-1.5 text-xs font-medium text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                <span className="flex items-center gap-2">
                  <MonitorUp className="h-3.5 w-3.5" aria-hidden />
                  Co-browse · <span className="capitalize">{cobrowse.status}</span>
                  {!cobrowse.consentGranted ? " (awaiting consent)" : ""}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  loading={cobrowseBusy}
                  onClick={() => void doEndCobrowse()}
                >
                  End
                </Button>
              </div>
            ) : null}

            {/* collision warning — another agent is on this conversation */}
            {(() => {
              const others = Object.keys(viewers[selected._id] ?? {}).length;
              if (others < 1) return null;
              const replying = !!typing[selected._id];
              return (
                <div className="flex items-center gap-2 border-b border-amber-300/60 bg-amber-50 px-4 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                  <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {others === 1 ? "Another agent is" : `${others} other agents are`} viewing this
                  conversation
                  {replying ? " — and replying now" : ""}. Heads up to avoid a double reply.
                </div>
              );
            })()}

            {/* messages */}
            <div ref={threadRef} className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-4">
              {loadingThread ? (
                <div className="py-10 text-center text-sm text-[var(--st-text-secondary)]">
                  Loading…
                </div>
              ) : (
                groupByDay(messages).map((group) => (
                  <React.Fragment key={group.day}>
                    <div className="my-3 flex justify-center">
                      <span className="rounded-full bg-[var(--st-bg-muted)] px-3 py-0.5 text-[11px] text-[var(--st-text-secondary)]">
                        {group.day}
                      </span>
                    </div>
                    {group.items.map((m) => (
                      <MessageBubble key={m._id} m={m} />
                    ))}
                  </React.Fragment>
                ))
              )}
              {typing[selected._id] ? (
                <div className="flex justify-start">
                  <span className="rounded-2xl bg-[var(--st-bg-muted)] px-3 py-2 text-sm text-[var(--st-text-secondary)]">
                    typing…
                  </span>
                </div>
              ) : null}
            </div>

            {/* composer */}
            <div className="border-t border-[var(--st-border)] px-3 py-2.5">
              {isPrivate ? (
                <div className="mb-1.5 flex items-center gap-1 text-xs text-amber-600">
                  <Lock className="h-3 w-3" aria-hidden /> Private note — visitors won&apos;t see this
                </div>
              ) : null}
              {showMacros && filteredMacros.length > 0 ? (
                <div className="mb-2 max-h-48 overflow-y-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] shadow-md">
                  <p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
                    Canned responses
                  </p>
                  {filteredMacros.map((m) => (
                    <button
                      key={m._id}
                      onClick={() => setDraft(m.content)}
                      className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-[var(--st-bg-muted)]"
                    >
                      <span className="text-xs font-semibold text-[var(--st-text)]">
                        /{m.name}
                      </span>
                      <span className="line-clamp-2 text-xs text-[var(--st-text-secondary)]">
                        {m.content}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
              {showMentions && filteredAgents.length > 0 ? (
                <div className="mb-2 max-h-40 overflow-y-auto rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] shadow-md">
                  {filteredAgents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => applyMention(a.label)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                    >
                      <Avatar name={a.label} size={24} />@{a.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <SabFilePickerButton
                  accept="all"
                  variant="ghost"
                  title="Attach a file"
                  onPick={(p) => void sendAttachment(p)}
                >
                  <Paperclip className="h-4 w-4" aria-hidden />
                </SabFilePickerButton>
                <button
                  onClick={() => setIsPrivate((v) => !v)}
                  title="Toggle private note"
                  className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
                    isPrivate
                      ? "bg-amber-100 text-amber-700"
                      : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                  }`}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setPayOpen((v) => !v)}
                    title="Send a payment link"
                    className={`grid h-9 w-9 place-items-center rounded-md transition-colors ${
                      payOpen
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                    }`}
                  >
                    <CreditCard className="h-4 w-4" aria-hidden />
                  </button>
                  {payOpen ? (
                    <div className="absolute bottom-11 left-0 z-20 w-64 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg)] p-3 shadow-lg">
                      <p className="mb-2 text-xs font-semibold text-[var(--st-text)]">
                        Send a payment link
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder="0.00"
                          className="flex-1"
                        />
                        <Input
                          value={payCurrency}
                          onChange={(e) => setPayCurrency(e.target.value.toUpperCase())}
                          placeholder="USD"
                          className="w-20"
                        />
                      </div>
                      <Input
                        value={payLabel}
                        onChange={(e) => setPayLabel(e.target.value)}
                        placeholder="What's this for? (optional)"
                        className="mt-2"
                      />
                      <Button
                        variant="primary"
                        size="sm"
                        className="mt-2 w-full"
                        loading={payBusy}
                        disabled={payBusy || !payAmount || Number(payAmount) <= 0}
                        onClick={() => void doSendPay()}
                      >
                        Send link
                      </Button>
                    </div>
                  ) : null}
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (selected) sendTyping(selected._id);
                  }}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      void doSend();
                    }
                  }}
                  rows={1}
                  placeholder={isPrivate ? "Write a private note…" : "Type a message…"}
                  className="max-h-32 min-h-[38px] flex-1 resize-none rounded-md border border-[var(--st-border)] bg-transparent px-3 py-2 text-sm text-[var(--st-text)] outline-none focus:border-[var(--st-primary,var(--st-accent))]"
                />
                <Button
                  variant="primary"
                  size="sm"
                  iconLeft={Send}
                  loading={sending}
                  disabled={!draft.trim() || sending}
                  onClick={() => void doSend()}
                >
                  Send
                </Button>
              </div>
              <p className="mt-1 pl-1 text-[10px] text-[var(--st-text-secondary)]">
                ⌘/Ctrl + Enter to send
              </p>
            </div>
          </>
        )}
      </section>

      {/* Pane 3 — context / visitor 360 */}
      {selected ? (
        <ContextPane
          conv={selected}
          contact={selectedContact}
          otherConversations={conversations
            .filter((c) => c._id !== selected._id)
            .map((c) => ({ id: c._id, label: contactLabel(contactsById[c.contactId]) }))}
          onSnooze={() =>
            void act(
              () =>
                snoozeConversation(
                  selected._id,
                  new Date(Date.now() + 3600_000).toISOString(),
                ),
              () => patchSelected({ status: "snoozed" }),
            )
          }
          onAutoAssign={() => void act(() => autoAssignConversation(selected._id))}
          onAddLabel={(label) =>
            void act(
              () => addConversationLabel(selected._id, label),
              () =>
                patchSelected({
                  labels: Array.from(new Set([...(selected.labels ?? []), label])),
                }),
            )
          }
          onRemoveLabel={(label) =>
            void act(
              () => removeConversationLabel(selected._id, label),
              () =>
                patchSelected({
                  labels: (selected.labels ?? []).filter((l) => l !== label),
                }),
            )
          }
        />
      ) : null}

      {paletteOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-24"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--st-border)] bg-[var(--st-bg)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-3">
              <Search className="h-4 w-4 text-[var(--st-text-secondary)]" aria-hidden />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Jump to a conversation…"
                className="flex-1 bg-transparent py-3 text-sm text-[var(--st-text)] outline-none"
              />
              <kbd className="text-[10px] text-[var(--st-text-secondary)]">esc</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto py-1">
              {paletteResults.map((c) => {
                const nm = contactLabel(contactsById[c.contactId]);
                return (
                  <button
                    key={c._id}
                    onClick={() => {
                      setPaletteOpen(false);
                      void openConversation(c);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[var(--st-bg-muted)]"
                  >
                    <Avatar name={nm} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-[var(--st-text)]">{nm}</p>
                      <p className="truncate text-xs text-[var(--st-text-secondary)]">
                        {c.lastMessagePreview || "No messages"}
                      </p>
                    </div>
                    <Badge variant="outline" className="capitalize">
                      {c.status}
                    </Badge>
                  </button>
                );
              })}
              {paletteResults.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-[var(--st-text-secondary)]">
                  No matches.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------
 * Sub-components
 * ------------------------------------------------------------------------ */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
      {children}
    </div>
  );
}

function IconBtn({
  children,
  title,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-md text-[var(--st-text-secondary)] transition-colors hover:bg-[var(--st-bg-muted)] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function StatusBadge({ status, sla }: { status: ConversationStatus; sla?: boolean }) {
  const variant =
    status === "open"
      ? "default"
      : status === "resolved"
        ? "secondary"
        : "outline";
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant={variant as never} className="capitalize">
        {status}
      </Badge>
      {sla ? (
        <Badge variant="destructive" className="gap-0.5">
          <Clock className="h-2.5 w-2.5" aria-hidden /> SLA
        </Badge>
      ) : null}
    </span>
  );
}

function ConversationRow({
  conv,
  contact,
  active,
  typing,
  hasOtherViewer,
  onClick,
  selectMode,
  checked,
  onToggle,
}: {
  conv: SabChatConversation;
  contact?: SabChatContact;
  active: boolean;
  typing: boolean;
  hasOtherViewer?: boolean;
  onClick: () => void;
  selectMode?: boolean;
  checked?: boolean;
  onToggle?: () => void;
}) {
  const name = contactLabel(contact);
  const unread = conv.unreadCount ?? 0;
  return (
    <button
      onClick={selectMode ? onToggle : onClick}
      className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors ${
        active ? "bg-[var(--st-bg-muted)]" : "hover:bg-[var(--st-bg-muted)]/60"
      }`}
    >
      {selectMode ? (
        <input
          type="checkbox"
          checked={!!checked}
          readOnly
          aria-label="Select conversation"
          className="pointer-events-none mt-3 h-4 w-4 shrink-0 accent-[var(--st-primary,var(--st-accent))]"
        />
      ) : null}
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1">
            <span className="truncate text-sm font-medium text-[var(--st-text)]">{name}</span>
            {hasOtherViewer ? (
              <Users
                className="h-3 w-3 shrink-0 text-amber-500"
                aria-label="Another agent is viewing"
              />
            ) : null}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
            {relTime(conv.lastMessageAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`truncate text-xs ${
              typing
                ? "text-[var(--st-status-ok)]"
                : unread > 0
                  ? "font-medium text-[var(--st-text)]"
                  : "text-[var(--st-text-secondary)]"
            }`}
          >
            {typing ? "typing…" : conv.lastMessagePreview || "No messages yet"}
          </span>
          {unread > 0 ? (
            <span className="grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-[var(--st-primary,var(--st-accent))] px-1 text-[11px] font-semibold text-white">
              {unread}
            </span>
          ) : conv.status === "resolved" ? (
            <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
          ) : null}
        </div>
      </div>
    </button>
  );
}

function ContextPane({
  conv,
  contact,
  otherConversations,
  onSnooze,
  onAutoAssign,
  onAddLabel,
  onRemoveLabel,
}: {
  conv: SabChatConversation;
  contact?: SabChatContact;
  otherConversations: { id: string; label: string }[];
  onSnooze: () => void;
  onAutoAssign: () => void;
  onAddLabel: (label: string) => void;
  onRemoveLabel: (label: string) => void;
}) {
  const [labelDraft, setLabelDraft] = React.useState("");
  const name = contactLabel(contact);
  return (
    <aside className="hidden w-[300px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-[var(--st-border)] p-4 xl:flex">
      <div className="flex flex-col items-center gap-2 pt-2 text-center">
        <Avatar name={name} size={56} />
        <div>
          <p className="text-sm font-semibold text-[var(--st-text)]">{name}</p>
          <p className="text-xs text-[var(--st-text-secondary)]">
            {contact?.emails?.[0] ?? "Anonymous visitor"}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" iconLeft={Clock} className="flex-1" onClick={onSnooze}>
          Snooze 1h
        </Button>
        <Button variant="outline" size="sm" iconLeft={UserPlus} className="flex-1" onClick={onAutoAssign}>
          Auto-assign
        </Button>
      </div>

      <Section title="Details">
        <Detail label="Status" value={conv.status} />
        <Detail label="Priority" value={conv.priority} />
        {contact?.phones?.[0] ? <Detail label="Phone" value={contact.phones[0]} /> : null}
        {conv.assigneeId ? <Detail label="Assignee" value={conv.assigneeId} /> : null}
        <Detail label="Created" value={new Date(conv.createdAt).toLocaleString()} />
      </Section>

      <Section title="Labels">
        <div className="flex flex-wrap gap-1.5">
          {(conv.labels ?? []).map((l) => (
            <span
              key={l}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-xs text-[var(--st-text)]"
            >
              <Tag className="h-3 w-3" aria-hidden /> {l}
              <button onClick={() => onRemoveLabel(l)} aria-label={`Remove ${l}`}>
                <X className="h-3 w-3 opacity-60 hover:opacity-100" aria-hidden />
              </button>
            </span>
          ))}
        </div>
        <form
          className="mt-2 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            const v = labelDraft.trim();
            if (v) {
              onAddLabel(v);
              setLabelDraft("");
            }
          }}
        >
          <Input
            value={labelDraft}
            onChange={(e) => setLabelDraft(e.target.value)}
            placeholder="Add label"
            className="h-8 text-xs"
          />
          <Button type="submit" variant="outline" size="sm" disabled={!labelDraft.trim()}>
            Add
          </Button>
        </form>
      </Section>

      {contact?.tags?.length ? (
        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-[var(--st-bg-muted)] px-2 py-0.5 text-xs text-[var(--st-text-secondary)]"
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      ) : null}

      <CrmBridgeSection conv={conv} contact={contact} />

      <CollabSection conv={conv} otherConversations={otherConversations} />
    </aside>
  );
}

function CrmBridgeSection({
  conv,
  contact,
}: {
  conv: SabChatConversation;
  contact?: SabChatContact;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = React.useState<string | null>(null);
  const contactId = contact?._id;

  const run = async (
    key: string,
    fn: () => Promise<{ ok: boolean; error?: string }>,
    okMsg: string,
  ) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    if (res.ok) toast({ title: okMsg });
    else toast({ title: "CRM sync failed", description: res.error, variant: "destructive" });
  };

  return (
    <Section title="CRM">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          iconLeft={Link2}
          loading={busy === "link"}
          disabled={!contactId || busy !== null}
          onClick={() =>
            void run("link", () => linkContactToCrm(contactId!), "Linked to CRM")
          }
        >
          Link
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={Ticket}
          loading={busy === "ticket"}
          disabled={busy !== null}
          onClick={() =>
            void run("ticket", () => conversationToTicket(conv._id), "Ticket created")
          }
        >
          Ticket
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={ArrowUpFromLine}
          loading={busy === "push"}
          disabled={!contactId || busy !== null}
          onClick={() =>
            void run("push", () => pushContactToCrm(contactId!), "Pushed to CRM")
          }
        >
          Push
        </Button>
        <Button
          variant="outline"
          size="sm"
          iconLeft={ArrowDownToLine}
          loading={busy === "pull"}
          disabled={!contactId || busy !== null}
          onClick={() =>
            void run("pull", () => pullContactFromCrm(contactId!), "Pulled from CRM")
          }
        >
          Pull
        </Button>
      </div>
      {!contactId ? (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-[var(--st-text-secondary)]">
          <Building2 className="h-3 w-3" aria-hidden /> Identify the visitor to enable contact
          sync.
        </p>
      ) : null}
    </Section>
  );
}

function CollabSection({
  conv,
  otherConversations,
}: {
  conv: SabChatConversation;
  otherConversations: { id: string; label: string }[];
}) {
  const { toast } = useToast();
  const [sides, setSides] = React.useState<SabChatSideConversation[]>([]);
  const [links, setLinks] = React.useState<SabChatConversationLink[]>([]);
  const [openSideId, setOpenSideId] = React.useState<string | null>(null);
  const [sideMsgs, setSideMsgs] = React.useState<SabChatSideMessage[]>([]);
  const [newSubject, setNewSubject] = React.useState("");
  const [reply, setReply] = React.useState("");
  const [linkTarget, setLinkTarget] = React.useState("");
  const [scheduled, setScheduled] = React.useState<SabChatScheduledMessage[]>([]);
  const [schedText, setSchedText] = React.useState("");
  const [schedAt, setSchedAt] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const labelFor = (id: string) =>
    otherConversations.find((c) => c.id === id)?.label ?? id.slice(-6);

  const load = React.useCallback(async () => {
    const [s, l, sc] = await Promise.all([
      listSideConversations(conv._id),
      listConversationLinks(conv._id),
      listScheduledMessages(conv._id),
    ]);
    setSides(s);
    setLinks(l);
    setScheduled(sc);
  }, [conv._id]);

  React.useEffect(() => {
    setOpenSideId(null);
    setSideMsgs([]);
    void load();
  }, [load]);

  const openSide = async (id: string) => {
    if (openSideId === id) {
      setOpenSideId(null);
      return;
    }
    setOpenSideId(id);
    setSideMsgs(await listSideMessages(id));
  };

  const addSide = async () => {
    if (!newSubject.trim()) return;
    setBusy(true);
    const res = await createSideConversation(conv._id, newSubject);
    setBusy(false);
    if (res.ok) {
      setNewSubject("");
      void load();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const sendReply = async (sideId: string) => {
    if (!reply.trim()) return;
    setBusy(true);
    const res = await appendSideMessage(sideId, reply);
    setBusy(false);
    if (res.ok) {
      setReply("");
      setSideMsgs(await listSideMessages(sideId));
      void load();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const removeSide = async (id: string) => {
    const res = await deleteSideConversation(id);
    if (res.ok) {
      if (openSideId === id) setOpenSideId(null);
      void load();
    }
  };

  const addLink = async () => {
    if (!linkTarget) return;
    setBusy(true);
    const res = await linkConversations(conv._id, linkTarget);
    setBusy(false);
    if (res.ok) {
      setLinkTarget("");
      void load();
    } else {
      toast({ title: "Failed", description: res.error, variant: "destructive" });
    }
  };

  const removeLink = async (id: string) => {
    const res = await unlinkConversations(id);
    if (res.ok) void load();
  };

  const addScheduled = async () => {
    if (!schedText.trim() || !schedAt) return;
    setBusy(true);
    const res = await scheduleMessage(conv._id, schedText, new Date(schedAt).toISOString());
    setBusy(false);
    if (res.ok) {
      setSchedText("");
      setSchedAt("");
      void load();
    } else {
      toast({ title: "Couldn't schedule", description: res.error, variant: "destructive" });
    }
  };

  const cancelScheduled = async (id: string) => {
    const res = await cancelScheduledMessage(id);
    if (res.ok) void load();
  };

  return (
    <Section title="Collaboration">
      {/* Side conversations */}
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Side conversations
      </p>
      <div className="space-y-1">
        {sides.length === 0 ? (
          <p className="text-xs text-[var(--st-text-secondary)]">
            None yet — start a private internal thread.
          </p>
        ) : (
          sides.map((s) => (
            <div key={s._id} className="rounded-md border border-[var(--st-border)]">
              <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                <button className="min-w-0 flex-1 text-left" onClick={() => void openSide(s._id)}>
                  <span className="block truncate text-xs font-medium text-[var(--st-text)]">
                    {s.subject}
                  </span>
                  <span className="text-[10px] text-[var(--st-text-secondary)]">
                    {s.messageCount} message{s.messageCount === 1 ? "" : "s"}
                  </span>
                </button>
                <button
                  onClick={() => void removeSide(s._id)}
                  className="text-[var(--st-text-secondary)] hover:text-red-500"
                  aria-label="Delete side conversation"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
              {openSideId === s._id ? (
                <div className="border-t border-[var(--st-border)] p-2">
                  <div className="mb-1 max-h-40 space-y-1 overflow-y-auto">
                    {sideMsgs.length === 0 ? (
                      <p className="text-[11px] text-[var(--st-text-secondary)]">No messages yet.</p>
                    ) : (
                      sideMsgs.map((m) => (
                        <div key={m._id} className="rounded bg-[var(--st-bg-muted)] px-2 py-1">
                          <p className="text-[11px] text-[var(--st-text)]">{m.body}</p>
                          <p className="text-[9px] text-[var(--st-text-secondary)]">
                            {m.authorName || "Agent"}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="flex items-end gap-1">
                    <textarea
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      rows={1}
                      placeholder="Reply privately…"
                      className="max-h-20 min-h-[30px] flex-1 resize-none rounded border border-[var(--st-border)] bg-transparent px-2 py-1 text-[11px] text-[var(--st-text)] outline-none"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      iconLeft={Send}
                      loading={busy}
                      disabled={busy || !reply.trim()}
                      onClick={() => void sendReply(s._id)}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>
      <form
        className="mt-1.5 flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          void addSide();
        }}
      >
        <Input
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="New side-thread subject"
          className="h-8 text-xs"
        />
        <Button type="submit" variant="outline" size="sm" iconLeft={Plus} disabled={!newSubject.trim() || busy} />
      </form>

      {/* Linked conversations */}
      <p className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Linked conversations
      </p>
      <div className="space-y-1">
        {links.length === 0 ? (
          <p className="text-xs text-[var(--st-text-secondary)]">No links.</p>
        ) : (
          links.map((l) => {
            const otherId = l.aId === conv._id ? l.bId : l.aId;
            return (
              <div
                key={l._id}
                className="flex items-center justify-between gap-2 rounded-md bg-[var(--st-bg-muted)] px-2 py-1"
              >
                <span className="flex min-w-0 items-center gap-1 text-xs text-[var(--st-text)]">
                  <Link2 className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                  <span className="truncate">{labelFor(otherId)}</span>
                </span>
                <button
                  onClick={() => void removeLink(l._id)}
                  className="text-[var(--st-text-secondary)] hover:text-red-500"
                  aria-label="Remove link"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </div>
      {otherConversations.length > 0 ? (
        <div className="mt-1.5 flex gap-1">
          <select
            value={linkTarget}
            onChange={(e) => setLinkTarget(e.target.value)}
            className="h-8 flex-1 rounded-md border border-[var(--st-border)] bg-transparent px-2 text-xs text-[var(--st-text)] outline-none"
          >
            <option value="">Link to…</option>
            {otherConversations.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <Button variant="outline" size="sm" iconLeft={Link2} disabled={!linkTarget || busy} onClick={() => void addLink()} />
        </div>
      ) : null}

      {/* Scheduled messages (send-later) */}
      <p className="mb-1 mt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
        Send later
      </p>
      <div className="space-y-1">
        {scheduled.length === 0 ? (
          <p className="text-xs text-[var(--st-text-secondary)]">Nothing scheduled.</p>
        ) : (
          scheduled.map((m) => (
            <div
              key={m._id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--st-border)] px-2 py-1"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs text-[var(--st-text)]">{m.text}</span>
                <span className="flex items-center gap-1 text-[10px] text-[var(--st-text-secondary)]">
                  <Clock className="h-2.5 w-2.5" aria-hidden /> {new Date(m.sendAt).toLocaleString()}
                </span>
              </span>
              <button
                onClick={() => void cancelScheduled(m._id)}
                className="text-[var(--st-text-secondary)] hover:text-red-500"
                aria-label="Cancel scheduled message"
              >
                <X className="h-3 w-3" aria-hidden />
              </button>
            </div>
          ))
        )}
      </div>
      <div className="mt-1.5 space-y-1">
        <textarea
          value={schedText}
          onChange={(e) => setSchedText(e.target.value)}
          rows={2}
          placeholder="Message to send later…"
          className="max-h-20 w-full resize-none rounded-md border border-[var(--st-border)] bg-transparent px-2 py-1 text-xs text-[var(--st-text)] outline-none"
        />
        <div className="flex gap-1">
          <input
            type="datetime-local"
            value={schedAt}
            onChange={(e) => setSchedAt(e.target.value)}
            className="h-8 flex-1 rounded-md border border-[var(--st-border)] bg-transparent px-2 text-xs text-[var(--st-text)] outline-none"
          />
          <Button
            variant="outline"
            size="sm"
            iconLeft={Clock}
            loading={busy}
            disabled={!schedText.trim() || !schedAt || busy}
            onClick={() => void addScheduled()}
          />
        </div>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-0.5 text-xs">
      <span className="text-[var(--st-text-secondary)]">{label}</span>
      <span className="max-w-[60%] truncate font-medium capitalize text-[var(--st-text)]">
        {value}
      </span>
    </div>
  );
}

/* group consecutive messages by calendar day for the date separators */
function groupByDay(messages: SabChatMessage[]): { day: string; items: SabChatMessage[] }[] {
  const groups: { day: string; items: SabChatMessage[] }[] = [];
  for (const m of messages) {
    const day = dayLabel(m.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}
