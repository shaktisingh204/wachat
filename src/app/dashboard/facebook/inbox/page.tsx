"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { m, AnimatePresence } from "motion/react";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Inbox as InboxIcon,
  LoaderCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  UserCircle2,
} from "lucide-react";

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  EmptyState,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Textarea,
  cn,
  useToast,
} from "@/components/sabcrm/20ui";

import { useProject } from "@/context/project-context";
import {
  getFacebookConversations,
  getFacebookConversationMessages,
  getVisitorPosts,
  sendFacebookMessage,
  getFacebookPosts,
  getPostComments,
  handlePostComment,
  handleDeleteComment,
} from "@/app/actions/facebook.actions";
import { suggestInboxReply } from "@/app/actions/facebook-inbox.actions";
import type { FacebookConversation, FacebookMessage } from "@/lib/definitions";

/**
 * /dashboard/facebook/inbox — Unified Social Inbox.
 *
 * One assignable stream across Messenger conversations and visitor posts, with
 * a 3-pane layout (list · thread · details), client-side sentiment tags,
 * per-conversation assignment + saved replies (persisted locally), and an
 * AI-suggested reply (Claude via the canonical provider ladder). Messaging is
 * real (`getFacebookConversations` / `…Messages` / `sendFacebookMessage`).
 */

type Source = "all" | "messages" | "comments" | "visitor";
type Sentiment = "positive" | "negative" | "neutral";

const AGENTS = ["Unassigned", "Me", "Support", "Sales"];
const DEFAULT_SAVED = [
  "Thanks so much for reaching out! 🙏",
  "Happy to help! Could you share a few more details?",
  "Great question! Here's what I'd suggest…",
  "We've sent you a DM with the details.",
];

const POS = /\b(thank|thanks|love|great|awesome|amazing|perfect|happy|excellent|good|nice|👍|❤️|😍|🙏)\b/i;
const NEG = /\b(angry|bad|worst|terrible|hate|refund|broken|scam|disappointed|useless|never|complaint|😡|😠|👎)\b/i;

function sentimentOf(text: string | undefined): Sentiment {
  if (!text) return "neutral";
  if (NEG.test(text)) return "negative";
  if (POS.test(text)) return "positive";
  return "neutral";
}

const SENT_TONE: Record<Sentiment, string> = {
  positive: "var(--st-status-ok,#16a34a)",
  negative: "var(--st-danger,#dc2626)",
  neutral: "var(--st-text-tertiary)",
};

function fmt(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : formatDistanceToNow(d, { addSuffix: true });
}

function initials(name?: string): string {
  if (!name) return "?";
  return name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

interface VisitorPost {
  id?: string;
  message?: string;
  story?: string;
  from?: { name?: string };
  created_time?: string;
}

interface CommentItem {
  id: string;
  postId: string;
  message: string;
  fromName?: string;
  created_time?: string;
}

export default function FacebookInboxPage() {
  const { toast } = useToast();
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? "";
  const pageId = activeProject?.facebookPageId;

  const [source, setSource] = useState<Source>("all");
  const [query, setQuery] = useState("");
  const [conversations, setConversations] = useState<FacebookConversation[]>([]);
  const [visitorPosts, setVisitorPosts] = useState<VisitorPost[]>([]);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [selectedComment, setSelectedComment] = useState<CommentItem | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<FacebookMessage[]>([]);
  const [composer, setComposer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [loadingList, startList] = useTransition();
  const [loadingThread, startThread] = useTransition();
  const [sending, startSending] = useTransition();
  const [suggesting, setSuggesting] = useState(false);

  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [savedReplies, setSavedReplies] = useState<string[]>(DEFAULT_SAVED);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // Persisted assignment + saved replies (client-side).
  useEffect(() => {
    if (!projectId) return;
    try {
      const a = localStorage.getItem(`meta-inbox-assign:${projectId}`);
      if (a) setAssignments(JSON.parse(a));
      const s = localStorage.getItem(`meta-inbox-saved:${projectId}`);
      if (s) setSavedReplies(JSON.parse(s));
    } catch {
      /* ignore */
    }
  }, [projectId]);

  const loadList = useCallback(() => {
    if (!projectId) return;
    startList(async () => {
      const [convRes, visRes, postsRes] = await Promise.all([
        getFacebookConversations(projectId),
        getVisitorPosts(projectId),
        getFacebookPosts(projectId),
      ]);
      if (convRes.error && visRes.error) setError(convRes.error);
      else setError(null);
      setConversations(convRes.conversations ?? []);
      setVisitorPosts((visRes.posts ?? []) as VisitorPost[]);

      // Comments across the most recent posts (bounded to keep call count sane).
      const posts = (postsRes.posts ?? []).slice(0, 8);
      const commentResults = await Promise.all(
        posts.map((p) => getPostComments(p.id, projectId)),
      );
      const flat: CommentItem[] = [];
      commentResults.forEach((r, i) => {
        for (const c of (r.comments ?? []) as Array<{
          id?: string;
          message?: string;
          from?: { name?: string };
          created_time?: string;
        }>) {
          if (!c?.id) continue;
          flat.push({
            id: c.id,
            postId: posts[i].id,
            message: c.message ?? "",
            fromName: c.from?.name,
            created_time: c.created_time,
          });
        }
      });
      flat.sort((a, b) => (b.created_time ?? "").localeCompare(a.created_time ?? ""));
      setComments(flat);
    });
  }, [projectId]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const selectConversation = useCallback(
    (id: string) => {
      setSelectedComment(null);
      setSelectedId(id);
      setComposer("");
      if (!projectId) return;
      startThread(async () => {
        const res = await getFacebookConversationMessages(id, projectId);
        const msgs = (res.messages ?? []).slice().reverse(); // oldest → newest
        setMessages(msgs);
        setTimeout(() => threadEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
      });
    },
    [projectId],
  );

  const selectedConv = useMemo(
    () => conversations.find((c) => c.id === selectedId) ?? null,
    [conversations, selectedId],
  );

  const customer = useMemo(() => {
    const parts = selectedConv?.participants?.data ?? [];
    return parts.find((p) => p.id !== pageId) ?? parts[0] ?? null;
  }, [selectedConv, pageId]);

  const lastCustomerMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].from?.id !== pageId) return messages[i].message;
    }
    return selectedConv?.snippet;
  }, [messages, pageId, selectedConv]);

  const send = useCallback(() => {
    const text = composer.trim();
    if (!text || !projectId || !customer?.id) return;
    startSending(async () => {
      const fd = new FormData();
      fd.set("projectId", projectId);
      fd.set("recipientId", customer.id);
      fd.set("messageText", text);
      const res = await sendFacebookMessage(undefined, fd);
      if (res.error) {
        toast({ title: "Could not send", description: res.error, variant: "destructive" });
        return;
      }
      setComposer("");
      if (selectedId) selectConversation(selectedId);
    });
  }, [composer, projectId, customer, selectedId, selectConversation, toast]);

  const suggest = useCallback(async () => {
    if (!selectedConv || suggesting) return;
    setSuggesting(true);
    const transcript = messages
      .map((m2) => `${m2.from?.id === pageId ? "Page" : customer?.name ?? "Customer"}: ${m2.message}`)
      .join("\n");
    const res = await suggestInboxReply({
      pageName: activeProject?.name ?? "our Page",
      customerName: customer?.name,
      transcript: transcript || `${customer?.name ?? "Customer"}: ${selectedConv.snippet}`,
    });
    setSuggesting(false);
    if (res.error) {
      toast({ title: "AI unavailable", description: res.error, variant: "destructive" });
      return;
    }
    if (res.reply) setComposer(res.reply);
  }, [selectedConv, suggesting, messages, pageId, customer, activeProject, toast]);

  /* --------------------------------------------------------- comments --- */

  const selectComment = useCallback((c: CommentItem) => {
    setSelectedId(null);
    setMessages([]);
    setSelectedComment(c);
    setComposer("");
  }, []);

  const sendCommentReply = useCallback(() => {
    const text = composer.trim();
    if (!text || !projectId || !selectedComment) return;
    startSending(async () => {
      const fd = new FormData();
      fd.set("objectId", selectedComment.id);
      fd.set("projectId", projectId);
      fd.set("message", text);
      const res = await handlePostComment({ success: false }, fd);
      if (res.error) {
        toast({ title: "Could not reply", description: res.error, variant: "destructive" });
        return;
      }
      setComposer("");
      toast({ title: "Reply posted" });
      loadList();
    });
  }, [composer, projectId, selectedComment, toast, loadList]);

  const deleteSelectedComment = useCallback(() => {
    if (!projectId || !selectedComment) return;
    startSending(async () => {
      const res = await handleDeleteComment(selectedComment.id, projectId);
      if (res.error) {
        toast({ title: "Could not delete", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Comment deleted" });
      setSelectedComment(null);
      loadList();
    });
  }, [projectId, selectedComment, toast, loadList]);

  const suggestComment = useCallback(async () => {
    if (!selectedComment || suggesting) return;
    setSuggesting(true);
    const res = await suggestInboxReply({
      pageName: activeProject?.name ?? "our Page",
      customerName: selectedComment.fromName,
      transcript: `${selectedComment.fromName ?? "Commenter"}: ${selectedComment.message}`,
    });
    setSuggesting(false);
    if (res.error) {
      toast({ title: "AI unavailable", description: res.error, variant: "destructive" });
      return;
    }
    if (res.reply) setComposer(res.reply);
  }, [selectedComment, suggesting, activeProject, toast]);

  const assign = useCallback(
    (convId: string, agent: string) => {
      setAssignments((prev) => {
        const next = { ...prev, [convId]: agent };
        try {
          localStorage.setItem(`meta-inbox-assign:${projectId}`, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
    },
    [projectId],
  );

  const filteredConversations = useMemo(() => {
    if (source === "visitor") return [];
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (!q) return true;
      const name = c.participants?.data?.find((p) => p.id !== pageId)?.name ?? "";
      return name.toLowerCase().includes(q) || (c.snippet ?? "").toLowerCase().includes(q);
    });
  }, [conversations, source, query, pageId]);

  const showConversations = source === "all" || source === "messages";
  const showComments = source === "all" || source === "comments";
  const showVisitor = source === "all" || source === "visitor";

  const filteredComments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return comments;
    return comments.filter(
      (c) => c.message.toLowerCase().includes(q) || (c.fromName ?? "").toLowerCase().includes(q),
    );
  }, [comments, query]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={InboxIcon}
          title="No page selected"
          description="Pick a Facebook page to open the unified inbox."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-64px)] w-full max-w-[1480px] flex-col px-4 pt-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/dashboard/facebook">Meta Suite</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Inbox</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="mt-3 flex min-h-0 flex-1 gap-3">
        {/* ---------------------------------------------------- list pane -- */}
        <div className="flex w-[320px] shrink-0 flex-col rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
          <div className="flex items-center gap-2 border-b border-[var(--st-border)] p-2.5">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--st-text-tertiary)]" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search inbox…"
                aria-label="Search inbox"
                className="h-8 pl-8 text-[12.5px]"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={loadList} disabled={loadingList} aria-label="Refresh">
              <RefreshCw className={cn("h-3.5 w-3.5", loadingList && "animate-spin")} />
            </Button>
          </div>

          <div className="flex gap-1 border-b border-[var(--st-border)] p-2">
            {(["all", "messages", "comments", "visitor"] as Source[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={cn(
                  "flex-1 rounded-[var(--st-radius)] px-2 py-1 text-[11px] capitalize transition-colors",
                  source === s
                    ? "bg-[var(--st-text)] text-[var(--st-text-inverted)]"
                    : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-secondary)]",
                )}
              >
                {s === "visitor" ? "Visitor" : s}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {loadingList && conversations.length === 0 ? (
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : (
              <>
                {showConversations &&
                  filteredConversations.map((c) => {
                    const name = c.participants?.data?.find((p) => p.id !== pageId)?.name ?? "Unknown";
                    const sent = sentimentOf(c.snippet);
                    const active = c.id === selectedId;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectConversation(c.id)}
                        className={cn(
                          "flex w-full items-start gap-2.5 border-b border-[var(--st-border)] p-3 text-left transition-colors",
                          active ? "bg-[var(--st-bg-secondary)]" : "hover:bg-[var(--st-bg-secondary)]",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text)]">
                          {initials(name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] text-[var(--st-text)]">{name}</span>
                            <span className="shrink-0 text-[10.5px] text-[var(--st-text-tertiary)]">
                              {fmt(c.updated_time)}
                            </span>
                          </div>
                          <p className="mt-0.5 line-clamp-1 text-[11.5px] text-[var(--st-text-secondary)]">
                            {c.snippet}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SENT_TONE[sent] }} />
                            {c.unread_count > 0 ? <Badge variant="secondary">{c.unread_count}</Badge> : null}
                            {assignments[c.id] && assignments[c.id] !== "Unassigned" ? (
                              <span className="text-[10.5px] text-[var(--st-text-tertiary)]">
                                · {assignments[c.id]}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}

                {showComments &&
                  filteredComments.map((c) => {
                    const sent = sentimentOf(c.message);
                    const active = selectedComment?.id === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => selectComment(c)}
                        className={cn(
                          "flex w-full items-start gap-2.5 border-b border-[var(--st-border)] p-3 text-left transition-colors",
                          active ? "bg-[var(--st-bg-secondary)]" : "hover:bg-[var(--st-bg-secondary)]",
                        )}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text)]">
                          {initials(c.fromName)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[12.5px] text-[var(--st-text)]">
                              {c.fromName ?? "Commenter"}
                            </span>
                            <Badge variant="outline">comment</Badge>
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--st-text-secondary)]">
                            {c.message || "(no text)"}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ background: SENT_TONE[sent] }} />
                            <span className="text-[10.5px] text-[var(--st-text-tertiary)]">{fmt(c.created_time)}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                {showVisitor &&
                  visitorPosts.map((v, i) => (
                    <div
                      key={v.id ?? i}
                      className="flex items-start gap-2.5 border-b border-[var(--st-border)] p-3"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text)]">
                        {initials(v.from?.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-[12.5px] text-[var(--st-text)]">
                            {v.from?.name ?? "Visitor"}
                          </span>
                          <Badge variant="outline">post</Badge>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11.5px] text-[var(--st-text-secondary)]">
                          {v.message ?? v.story ?? "(no text)"}
                        </p>
                      </div>
                    </div>
                  ))}

                {!loadingList &&
                (showConversations ? filteredConversations.length : 0) +
                  (showComments ? filteredComments.length : 0) +
                  (showVisitor ? visitorPosts.length : 0) ===
                  0 ? (
                  <p className="p-6 text-center text-[12px] text-[var(--st-text-tertiary)]">
                    Nothing here yet.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* ---------------------------------------------------- thread pane -- */}
        <div className="flex min-w-0 flex-1 flex-col rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]">
          {error ? (
            <div className="p-4">
              <div className="flex items-start gap-1.5 text-[12.5px] text-[var(--st-danger,#dc2626)]">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </div>
          ) : selectedComment ? (
            <>
              <div className="flex items-center justify-between border-b border-[var(--st-border)] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text)]">
                    {initials(selectedComment.fromName)}
                  </span>
                  <div>
                    <p className="text-[13px] text-[var(--st-text)]">
                      {selectedComment.fromName ?? "Commenter"}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] text-[var(--st-text-tertiary)]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: SENT_TONE[sentimentOf(selectedComment.message)] }}
                      />
                      {sentimentOf(selectedComment.message)} · comment
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={deleteSelectedComment}
                  disabled={sending}
                  iconLeft={Trash2}
                >
                  Delete
                </Button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <div className="max-w-[80%] rounded-[var(--st-radius-lg)] bg-[var(--st-bg-secondary)] px-3 py-2 text-[12.5px] leading-snug text-[var(--st-text)]">
                  <p className="whitespace-pre-wrap">{selectedComment.message}</p>
                  <p className="mt-1 text-[10px] text-[var(--st-text-tertiary)]">
                    {fmt(selectedComment.created_time)}
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--st-border)] p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {savedReplies.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setComposer(r)}
                      className="rounded-full border border-[var(--st-border)] px-2.5 py-1 text-[11px] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]"
                    >
                      {r.length > 32 ? `${r.slice(0, 32)}…` : r}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder="Write a public reply…"
                    aria-label="Public reply"
                    rows={2}
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) sendCommentReply();
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={suggestComment}
                      disabled={suggesting}
                      iconLeft={suggesting ? undefined : Sparkles}
                    >
                      {suggesting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "AI"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={sendCommentReply}
                      disabled={sending || !composer.trim()}
                      iconLeft={sending ? undefined : Send}
                    >
                      {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Reply"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          ) : !selectedConv ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description="Pick a message or comment from the list to view it and reply."
              />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-[var(--st-border)] p-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[11px] text-[var(--st-text)]">
                    {initials(customer?.name)}
                  </span>
                  <div>
                    <p className="text-[13px] text-[var(--st-text)]">{customer?.name ?? "Unknown"}</p>
                    <p className="flex items-center gap-1 text-[11px] text-[var(--st-text-tertiary)]">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: SENT_TONE[sentimentOf(lastCustomerMsg)] }}
                      />
                      {sentimentOf(lastCustomerMsg)} sentiment
                    </p>
                  </div>
                </div>
                <Select
                  value={assignments[selectedConv.id] ?? "Unassigned"}
                  onValueChange={(v) => assign(selectedConv.id, v)}
                >
                  <SelectTrigger className="h-8 w-[140px] text-[12px]">
                    <SelectValue placeholder="Assign" />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {loadingThread && messages.length === 0 ? (
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-10 w-2/3" />
                    <Skeleton className="ml-auto h-10 w-2/3" />
                    <Skeleton className="h-10 w-1/2" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false}>
                      {messages.map((msg) => {
                        const outgoing = msg.from?.id === pageId;
                        return (
                          <m.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn("flex", outgoing ? "justify-end" : "justify-start")}
                          >
                            <div
                              className={cn(
                                "max-w-[72%] rounded-[var(--st-radius-lg)] px-3 py-2 text-[12.5px] leading-snug",
                                outgoing
                                  ? "bg-[var(--st-accent)] text-white"
                                  : "bg-[var(--st-bg-secondary)] text-[var(--st-text)]",
                              )}
                            >
                              <p className="whitespace-pre-wrap">{msg.message}</p>
                              <p
                                className={cn(
                                  "mt-1 text-[10px]",
                                  outgoing ? "text-white/70" : "text-[var(--st-text-tertiary)]",
                                )}
                              >
                                {fmt(msg.created_time)}
                              </p>
                            </div>
                          </m.div>
                        );
                      })}
                    </AnimatePresence>
                    <div ref={threadEndRef} />
                  </div>
                )}
              </div>

              {/* composer */}
              <div className="border-t border-[var(--st-border)] p-3">
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {savedReplies.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setComposer(r)}
                      className="rounded-full border border-[var(--st-border)] px-2.5 py-1 text-[11px] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]"
                    >
                      {r.length > 32 ? `${r.slice(0, 32)}…` : r}
                    </button>
                  ))}
                </div>
                <div className="flex items-end gap-2">
                  <Textarea
                    value={composer}
                    onChange={(e) => setComposer(e.target.value)}
                    placeholder={selectedConv.can_reply ? "Write a reply…" : "This conversation can't be replied to."}
                    aria-label="Reply"
                    rows={2}
                    disabled={!selectedConv.can_reply}
                    className="resize-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
                    }}
                  />
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={suggest}
                      disabled={suggesting || !selectedConv.can_reply}
                      iconLeft={suggesting ? undefined : Sparkles}
                    >
                      {suggesting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "AI"}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={send}
                      disabled={sending || !composer.trim() || !selectedConv.can_reply}
                      iconLeft={sending ? undefined : Send}
                    >
                      {sending ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Send"}
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ---------------------------------------------------- detail pane -- */}
        <div className="hidden w-[260px] shrink-0 flex-col rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)] p-4 lg:flex">
          {selectedConv && customer ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--st-bg-muted)] text-[16px] text-[var(--st-text)]">
                  {initials(customer.name)}
                </span>
                <p className="text-[13px] text-[var(--st-text)]">{customer.name}</p>
                <Badge variant="outline" className="gap-1">
                  <UserCircle2 className="h-3 w-3" /> Messenger
                </Badge>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Sentiment
                </p>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px]"
                  style={{
                    color: SENT_TONE[sentimentOf(lastCustomerMsg)],
                    background: "var(--st-bg-secondary)",
                  }}
                >
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: SENT_TONE[sentimentOf(lastCustomerMsg)] }} />
                  {sentimentOf(lastCustomerMsg)}
                </span>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-[var(--st-text-tertiary)]">
                  Saved replies
                </p>
                <div className="flex flex-col gap-1.5">
                  {savedReplies.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setComposer(r)}
                      className="rounded-[var(--st-radius)] border border-[var(--st-border)] p-2 text-left text-[11.5px] text-[var(--st-text-secondary)] transition-colors hover:border-[var(--st-border-strong)] hover:text-[var(--st-text)]"
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-[var(--st-text-tertiary)]">
              Select a conversation to see contact details, sentiment and saved replies.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
