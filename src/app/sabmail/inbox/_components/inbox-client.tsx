"use client";

import * as React from "react";
import {
  Archive,
  AtSign,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Folder,
  Forward,
  Inbox as InboxIcon,
  Mail,
  MailOpen,
  MoreHorizontal,
  Paperclip,
  Pin,
  RefreshCw,
  Reply,
  ReplyAll,
  Search,
  Send,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  SquarePen,
  Star,
  Trash2,
  X,
} from "lucide-react";

import {
  Badge,
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
  EmptyState,
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  CreatingOverlay,
  IndeterminateBar,
  ProcessingDots,
  Spinner,
} from "@/components/sabmail/motion";
import "@/components/sabmail/motion/sabmail-motion.css";
import "../../_components/sabmail-app.css";

import type { SabmailAccountRow } from "@/app/actions/sabmail-projects.actions";
import {
  aiDraftReply,
  categorizeSabmailMessages,
  getSabmailMessage,
  listSabmailFolders,
  listSabmailMessages,
  searchSabmailMessages,
  summarizeSabmailThread,
  type SabmailCategory,
  type SabmailFolderRow,
  type SabmailMessageFull,
  type SabmailMessageRow,
} from "../actions";
import { snoozeSabmailMessage } from "../snooze-actions";
import { useSabmailStream } from "./use-sabmail-stream";
import { ComposeModal, buildReplyPrefill, textToHtml, type ComposePrefill } from "./compose-modal";
import { groupThreads, type SabmailThread } from "./threading";
import { MailAvatar } from "./mail-avatar";
import { cacheMessages, getCachedMessages } from "@/lib/sabmail/offline-cache";
import { applySabmailMutation, flushSabmailMutations } from "@/lib/sabmail/optimistic";

/* ── helpers ─────────────────────────────────────────────────────────── */

function folderIcon(specialUse: string | null, path: string) {
  const key = (specialUse ?? "").toLowerCase();
  const p = path.toLowerCase();
  if (key.includes("inbox") || p === "inbox") return InboxIcon;
  if (key.includes("sent") || p.includes("sent")) return Send;
  if (key.includes("draft") || p.includes("draft")) return FileText;
  if (key.includes("junk") || p.includes("spam") || p.includes("junk")) return ShieldAlert;
  if (key.includes("trash") || p.includes("trash") || p.includes("deleted")) return Trash2;
  if (key.includes("archive") || p.includes("archive")) return Archive;
  if (key.includes("flag") || key.includes("star")) return Star;
  return Folder;
}

function senderShort(addr: string): string {
  const name = addr.match(/^\s*"?([^"<]+?)"?\s*</)?.[1]?.trim();
  if (name) return name;
  const email = addr.match(/<([^>]+)>/)?.[1] ?? addr;
  return email.trim();
}

function senderEmail(addr: string): string {
  return (addr.match(/<([^>]+)>/)?.[1] ?? addr).trim();
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function buildSrcDoc(html: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><base target="_blank"><style>
    html,body{margin:0;padding:16px;font:14px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#111;background:#fff;word-break:break-word;overflow-wrap:anywhere}
    img{max-width:100%;height:auto}a{color:#2563eb}table{max-width:100%}
    blockquote{margin:0 0 0 8px;padding-left:12px;border-left:3px solid #e5e7eb;color:#6b7280}
    pre{white-space:pre-wrap;word-break:break-word}
  </style></head><body>${html}</body></html>`;
}

/* ── snooze presets (computed client-side, in the user's local time) ───── */

interface SnoozePreset {
  label: string;
  /** Returns the resurface time as an ISO string, relative to "now". */
  at: () => string;
}

const SNOOZE_PRESETS: SnoozePreset[] = [
  {
    label: "Later today",
    at: () => new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    label: "Tomorrow 9am",
    at: () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
  {
    label: "This weekend",
    at: () => {
      const d = new Date();
      const day = d.getDay();
      let add = (6 - day + 7) % 7;
      if (add === 0) add = 7;
      d.setDate(d.getDate() + add);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
  {
    label: "Next week",
    at: () => {
      const d = new Date();
      const day = d.getDay();
      let add = (1 - day + 7) % 7;
      if (add === 0) add = 7;
      d.setDate(d.getDate() + add);
      d.setHours(9, 0, 0, 0);
      return d.toISOString();
    },
  },
];

/* ── component ───────────────────────────────────────────────────────── */

const CATEGORY_META: Record<SabmailCategory, { label: string; dot: string }> = {
  urgent: { label: "Urgent", dot: "bg-rose-500" },
  action: { label: "Action", dot: "bg-amber-500" },
  fyi: { label: "FYI", dot: "bg-sky-500" },
  newsletter: { label: "News", dot: "bg-violet-500" },
  other: { label: "Other", dot: "bg-[var(--st-text-secondary)]" },
};
const CATEGORY_PRIORITY: SabmailCategory[] = ["urgent", "action", "fyi", "newsletter", "other"];

function threadCategory(
  uids: number[],
  cats: Record<number, SabmailCategory>,
): SabmailCategory | null {
  let best: SabmailCategory | null = null;
  let bestIdx = 99;
  for (const u of uids) {
    const c = cats[u];
    if (c) {
      const idx = CATEGORY_PRIORITY.indexOf(c);
      if (idx >= 0 && idx < bestIdx) {
        bestIdx = idx;
        best = c;
      }
    }
  }
  return best;
}

export function SabmailInboxClient({ accounts }: { accounts: SabmailAccountRow[] }) {
  const { toast } = useToast();

  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [folders, setFolders] = React.useState<SabmailFolderRow[] | null>(null);
  const [folderPath, setFolderPath] = React.useState("INBOX");
  const [loadingFolders, setLoadingFolders] = React.useState(true);

  const [messages, setMessages] = React.useState<SabmailMessageRow[]>([]);
  const [loadingMessages, setLoadingMessages] = React.useState(true);
  const [listError, setListError] = React.useState<string | null>(null);

  const [selectedUid, setSelectedUid] = React.useState<number | null>(null);
  const [full, setFull] = React.useState<SabmailMessageFull | null>(null);
  const [loadingBody, setLoadingBody] = React.useState(false);
  const [showRemoteImages, setShowRemoteImages] = React.useState(false);

  const [compose, setCompose] = React.useState<{ title: string; prefill?: ComposePrefill } | null>(
    null,
  );
  const composeNonce = React.useRef(0);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  const [summary, setSummary] = React.useState<string | null>(null);
  const [summarizing, setSummarizing] = React.useState(false);
  const [aiReplyBusy, setAiReplyBusy] = React.useState(false);

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searching, setSearching] = React.useState(false);
  const [searchActive, setSearchActive] = React.useState(false);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  const [categories, setCategories] = React.useState<Record<number, SabmailCategory>>({});
  const [triaging, setTriaging] = React.useState(false);
  const [categoryFilter, setCategoryFilter] = React.useState<SabmailCategory | null>(null);

  const bodyReq = React.useRef(0);
  const listReq = React.useRef(0);

  const activeAccount = accounts.find((a) => a.id === accountId) ?? accounts[0];

  const threads = React.useMemo(() => groupThreads(messages), [messages]);
  const activeThread =
    selectedUid == null ? null : threads.find((t) => t.uids.includes(selectedUid)) ?? null;
  const visibleThreads = React.useMemo(() => {
    if (!categoryFilter) return threads;
    return threads.filter((t) => threadCategory(t.uids, categories) === categoryFilter);
  }, [threads, categoryFilter, categories]);

  const loadMessages = React.useCallback(
    async (acct: string, path: string) => {
      const token = ++listReq.current;
      setLoadingMessages(true);
      setListError(null);
      try {
        const cached = await getCachedMessages(acct, path);
        if (token === listReq.current && cached && cached.length) {
          setMessages(cached as SabmailMessageRow[]);
        }
      } catch {
        /* cache miss — ignore */
      }
      const res = await listSabmailMessages(acct, path, 0, 40);
      if (token !== listReq.current) return; // stale
      if (!res.ok) {
        setMessages([]);
        setListError(res.error);
        setLoadingMessages(false);
        return;
      }
      setMessages(res.messages);
      setLoadingMessages(false);
      void cacheMessages(acct, path, res.messages);
    },
    [],
  );

  // On mount, drain any writes left queued from a prior session.
  React.useEffect(() => {
    void flushSabmailMutations();
  }, []);

  // Load folders when the account changes.
  React.useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setLoadingFolders(true);
    setFolders(null);
    setSelectedUid(null);
    setFull(null);
    setCategories({});
    setCategoryFilter(null);
    void (async () => {
      const res = await listSabmailFolders(accountId);
      if (cancelled) return;
      if (!res.ok) {
        setFolders([]);
        setLoadingFolders(false);
        toast({ title: "Could not load folders", description: res.error, variant: "destructive" });
        return;
      }
      const sorted = [...res.folders].sort((a, b) => {
        const ai = a.path.toLowerCase() === "inbox" ? 0 : 1;
        const bi = b.path.toLowerCase() === "inbox" ? 0 : 1;
        if (ai !== bi) return ai - bi;
        return a.name.localeCompare(b.name);
      });
      setFolders(sorted);
      setLoadingFolders(false);
      setFolderPath("INBOX");
      void loadMessages(accountId, "INBOX");
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, loadMessages, toast]);

  const openFolder = React.useCallback(
    (path: string) => {
      setFolderPath(path);
      setSelectedUid(null);
      setFull(null);
      setCategories({});
      setCategoryFilter(null);
      setSearchActive(false);
      setSearchQuery("");
      void loadMessages(accountId, path);
    },
    [accountId, loadMessages],
  );

  const openMessage = React.useCallback(
    async (uid: number, withImages = false) => {
      const token = ++bodyReq.current;
      setSelectedUid(uid);
      setLoadingBody(true);
      if (!withImages) setShowRemoteImages(false);
      if (!withImages) setSummary(null);
      setFull(null);
      const res = await getSabmailMessage(accountId, folderPath, uid, {
        showRemoteImages: withImages,
      });
      if (token !== bodyReq.current) return; // stale
      if (!res.ok) {
        setLoadingBody(false);
        toast({ title: "Could not open message", description: res.error, variant: "destructive" });
        return;
      }
      setFull(res.message);
      setLoadingBody(false);
      const wasUnread = messages.find((m) => m.uid === uid)?.seen === false;
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: true } : m)));
      if (wasUnread) {
        const { ok } = await applySabmailMutation({
          type: "markSeen",
          accountId,
          folder: folderPath,
          uid,
        });
        if (!ok) {
          setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, seen: false } : m)));
        }
      }
    },
    [accountId, folderPath, messages, toast],
  );

  const refreshList = React.useCallback(() => {
    void loadMessages(accountId, folderPath);
  }, [accountId, folderPath, loadMessages]);

  const { connected: liveConnected } = useSabmailStream({
    enabled: !!accountId,
    onNewMail: React.useCallback(
      (payload: { accountId?: string; path?: string; count?: number }) => {
        if (payload.accountId && payload.accountId !== accountId) return;
        if (searchActive) return;
        void loadMessages(accountId, folderPath);
      },
      [accountId, folderPath, loadMessages, searchActive],
    ),
  });

  const startCompose = React.useCallback((title: string, prefill?: ComposePrefill) => {
    composeNonce.current += 1;
    setCompose({ title, prefill });
  }, []);

  const openCompose = React.useCallback(() => startCompose("New Message"), [startCompose]);

  const doReply = React.useCallback(
    (mode: "reply" | "replyAll" | "forward") => {
      if (!full || !activeAccount) return;
      const title = mode === "forward" ? "Forward" : mode === "replyAll" ? "Reply all" : "Reply";
      startCompose(title, buildReplyPrefill(full, mode, activeAccount.email));
    },
    [full, activeAccount, startCompose],
  );

  const doSummarize = React.useCallback(async () => {
    if (!activeThread) return;
    setSummarizing(true);
    setSummary(null);
    const res = await summarizeSabmailThread(accountId, folderPath, activeThread.uids);
    setSummarizing(false);
    if (!res.ok) {
      toast({ title: "Couldn't summarize", description: res.error, variant: "destructive" });
      return;
    }
    setSummary(res.summary);
  }, [activeThread, accountId, folderPath, toast]);

  const doAiReply = React.useCallback(async () => {
    if (!full || !activeAccount) return;
    setAiReplyBusy(true);
    const res = await aiDraftReply(accountId, folderPath, full.uid);
    setAiReplyBusy(false);
    if (!res.ok) {
      toast({ title: "AI unavailable", description: res.error, variant: "destructive" });
      return;
    }
    const base = buildReplyPrefill(full, "reply", activeAccount.email);
    startCompose("Reply", { ...base, bodyHtml: textToHtml(res.draft) + (base.bodyHtml ?? "") });
  }, [full, activeAccount, accountId, folderPath, toast, startCompose]);

  const runSearch = React.useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSelectedUid(null);
    setFull(null);
    const res = await searchSabmailMessages(accountId, folderPath, q);
    setSearching(false);
    if (!res.ok) {
      toast({ title: "Search failed", description: res.error, variant: "destructive" });
      return;
    }
    setSearchActive(true);
    setMessages(res.messages);
  }, [searchQuery, accountId, folderPath, toast]);

  const clearSearch = React.useCallback(() => {
    setSearchQuery("");
    if (searchActive) {
      setSearchActive(false);
      void loadMessages(accountId, folderPath);
    }
  }, [searchActive, accountId, folderPath, loadMessages]);

  const doTriage = React.useCallback(async () => {
    if (messages.length === 0) return;
    setTriaging(true);
    const res = await categorizeSabmailMessages(
      messages.map((m) => ({ uid: m.uid, subject: m.subject, from: m.fromName || m.fromEmail })),
    );
    setTriaging(false);
    if (!res.ok) {
      toast({ title: "Triage failed", description: res.error, variant: "destructive" });
      return;
    }
    setCategories((prev) => {
      const next = { ...prev };
      for (const c of res.categories) next[c.uid] = c.category;
      return next;
    });
  }, [messages, toast]);

  // Optimistically remove a row but remember its slot for restore-on-failure.
  const removeWithRestore = React.useCallback(
    (uid: number): (() => void) => {
      let snapshot: SabmailMessageRow | undefined;
      let index = -1;
      setMessages((prev) => {
        index = prev.findIndex((m) => m.uid === uid);
        snapshot = index >= 0 ? prev[index] : undefined;
        return prev.filter((m) => m.uid !== uid);
      });
      setSelectedUid((cur) => (cur === uid ? null : cur));
      setFull((cur) => (cur?.uid === uid ? null : cur));
      return () => {
        if (!snapshot) return;
        setMessages((prev) => {
          if (prev.some((m) => m.uid === uid)) return prev;
          const next = [...prev];
          next.splice(index >= 0 ? Math.min(index, next.length) : next.length, 0, snapshot!);
          return next;
        });
      };
    },
    [],
  );

  const doArchive = React.useCallback(
    async (uid: number) => {
      const restore = removeWithRestore(uid);
      const { ok } = await applySabmailMutation({ type: "archive", accountId, folder: folderPath, uid });
      if (!ok) {
        restore();
        toast({ title: "Couldn't archive", variant: "destructive" });
        return;
      }
      toast({ title: "Archived" });
    },
    [accountId, folderPath, removeWithRestore, toast],
  );

  const doTrash = React.useCallback(
    async (uid: number) => {
      const restore = removeWithRestore(uid);
      const { ok } = await applySabmailMutation({ type: "delete", accountId, folder: folderPath, uid });
      if (!ok) {
        restore();
        toast({ title: "Couldn't move to Trash", variant: "destructive" });
        return;
      }
      toast({ title: "Moved to Trash" });
    },
    [accountId, folderPath, removeWithRestore, toast],
  );

  const doToggleFlag = React.useCallback(
    async (uid: number) => {
      const cur = messages.find((m) => m.uid === uid)?.flagged ?? false;
      const next = !cur;
      setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, flagged: next } : m)));
      const { ok } = await applySabmailMutation({
        type: next ? "flag" : "unflag",
        accountId,
        folder: folderPath,
        uid,
      });
      if (!ok) {
        setMessages((prev) => prev.map((m) => (m.uid === uid ? { ...m, flagged: cur } : m)));
        toast({ title: "Couldn't update", variant: "destructive" });
      }
    },
    [accountId, folderPath, messages, toast],
  );

  const doSnooze = React.useCallback(
    async (uid: number, preset: SnoozePreset) => {
      const subject =
        messages.find((m) => m.uid === uid)?.subject ??
        (full?.uid === uid ? full.subject : undefined);
      const untilISO = preset.at();
      const restore = removeWithRestore(uid);
      const res = await snoozeSabmailMessage({
        accountId,
        folder: folderPath,
        uid,
        untilISO,
        ...(subject ? { subject } : {}),
      });
      if (!res.ok) {
        restore();
        toast({ title: "Couldn't snooze", description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: "Snoozed", description: `Back ${preset.label.toLowerCase()}.` });
    },
    [accountId, folderPath, messages, full, removeWithRestore, toast],
  );

  const moveSelection = React.useCallback(
    (delta: number) => {
      if (visibleThreads.length === 0) return;
      const idx = visibleThreads.findIndex((t) => t.uids.includes(selectedUid ?? -1));
      const nextIdx =
        idx < 0
          ? delta > 0
            ? 0
            : visibleThreads.length - 1
          : Math.min(visibleThreads.length - 1, Math.max(0, idx + delta));
      const next = visibleThreads[nextIdx];
      if (next) void openMessage(next.latest.uid);
    },
    [visibleThreads, selectedUid, openMessage],
  );

  const closeReading = React.useCallback(() => {
    setSelectedUid(null);
    setFull(null);
    setSummary(null);
  }, []);

  // Global keyboard shortcuts (Superhuman-style), suspended while typing.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (compose || paletteOpen) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case "/":
          e.preventDefault();
          searchInputRef.current?.focus();
          break;
        case "c":
          e.preventDefault();
          openCompose();
          break;
        case "j":
          e.preventDefault();
          moveSelection(1);
          break;
        case "k":
          e.preventDefault();
          moveSelection(-1);
          break;
        case "r":
          if (full) {
            e.preventDefault();
            doReply("reply");
          }
          break;
        case "e":
          if (selectedUid != null) {
            e.preventDefault();
            void doArchive(selectedUid);
          }
          break;
        case "Escape":
          if (full) {
            e.preventDefault();
            closeReading();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose, paletteOpen, full, selectedUid, openCompose, moveSelection, doReply, doArchive, closeReading]);

  const selectedRow = messages.find((m) => m.uid === selectedUid) ?? null;
  const activeFolderName = folders?.find((f) => f.path === folderPath)?.name ?? folderPath;

  const pinnedThreads = React.useMemo(
    () => visibleThreads.filter((t) => t.flagged),
    [visibleThreads],
  );
  const primaryThreads = React.useMemo(
    () => visibleThreads.filter((t) => !t.flagged),
    [visibleThreads],
  );
  const selIndex = activeThread ? visibleThreads.findIndex((t) => t === activeThread) : -1;

  /* ── a single message-list row (shared by Pinned + Primary) ──────────── */
  const renderThreadRow = (th: SabmailThread, i: number) => {
    const m = th.latest;
    const active = selectedUid != null && th.uids.includes(selectedUid);
    const unread = th.unread;
    const cat = threadCategory(th.uids, categories);
    return (
      <div
        key={th.key}
        className="sabmail-stagger-item group relative"
        style={{ ["--i" as string]: Math.min(i, 20) } as React.CSSProperties}
      >
        <button
          type="button"
          onClick={() => void openMessage(m.uid)}
          data-selected={active}
          className="sabmail-listrow flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-[var(--st-bg-muted)]"
        >
          <MailAvatar
            name={m.fromName}
            email={m.fromEmail}
            size={40}
            status={unread ? "online" : null}
          />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5">
                <span
                  className={`truncate text-[13px] ${
                    unread ? "font-semibold text-[var(--st-text)]" : "font-medium text-[var(--st-text)]"
                  }`}
                >
                  {m.fromName || m.fromEmail || "(unknown sender)"}
                </span>
                {th.count > 1 ? (
                  <span className="inline-flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)] px-1 text-[10px] font-semibold text-[var(--st-text-secondary)]">
                    {th.count}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-[11px] text-[var(--st-text-secondary)]">
                {formatDate(m.date)}
              </span>
            </span>
            <span
              className={`truncate text-[13px] ${
                unread ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"
              }`}
            >
              {m.subject || "(no subject)"}
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-[var(--st-text-tertiary)]">
              {cat ? (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${CATEGORY_META[cat].dot}`}
                  title={CATEGORY_META[cat].label}
                  aria-hidden
                />
              ) : null}
              {th.flagged ? (
                <Star className="h-3 w-3 shrink-0 fill-current text-amber-500" aria-hidden />
              ) : null}
              <span className="truncate">{senderEmail(m.fromEmail)}</span>
              {th.hasAttachments ? (
                <Paperclip className="ml-auto h-3 w-3 shrink-0" aria-hidden />
              ) : null}
            </span>
          </span>
        </button>
        {/* Hover action: snooze the latest message in this thread. */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Snooze"
              title="Snooze"
              onClick={(e) => e.stopPropagation()}
              className="absolute right-2 top-2 hidden rounded-md border border-[var(--st-border)] bg-[var(--st-bg)] p-1 text-[var(--st-text-secondary)] shadow-sm hover:text-[var(--st-text)] group-hover:block data-[state=open]:block"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-52 p-1.5">
            <div className="mb-1 px-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
              Snooze until
            </div>
            <div className="flex flex-col">
              {SNOOZE_PRESETS.map((p) => (
                <PopoverClose key={p.label} asChild>
                  <button
                    type="button"
                    onClick={() => void doSnooze(m.uid, p)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                    {p.label}
                  </button>
                </PopoverClose>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  };

  const sectionHeader = (icon: React.ReactNode, label: string) => (
    <div className="flex items-center gap-1.5 px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--st-text-secondary)]">
      {icon}
      {label}
    </div>
  );

  return (
    <div className="sabmail-app sabmail-canvas h-[calc(100vh-7rem)] p-3">
      <ResizablePanelGroup orientation="horizontal" className="h-full gap-3">
        {/* ── Message list ──────────────────────────────────────────── */}
        <ResizablePanel defaultSize="38%" minSize="28%" maxSize="50%">
          <div className="sabmail-pane relative flex h-full flex-col overflow-hidden">
            {/* Compose */}
            <div className="px-3 pt-3">
              <button
                type="button"
                onClick={openCompose}
                className="sabmail-compose-btn flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold shadow-sm"
              >
                <SquarePen className="h-4 w-4" aria-hidden />
                Compose
              </button>
            </div>

            {/* Header: folder dropdown + count + actions */}
            <div className="flex items-start justify-between gap-2 px-3 pt-3">
              <div className="min-w-0">
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="flex items-center gap-1.5 text-[15px] font-semibold text-[var(--st-text)] hover:text-[var(--st-accent)]"
                    >
                      <span className="truncate">
                        {searchActive ? "Search" : activeFolderName}
                      </span>
                      <ChevronDown className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-60 p-1.5">
                    {accounts.length > 1 ? (
                      <>
                        <div className="px-1.5 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                          Account
                        </div>
                        {accounts.map((a) => (
                          <PopoverClose key={a.id} asChild>
                            <button
                              type="button"
                              onClick={() => setAccountId(a.id)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--st-bg-muted)] ${
                                a.id === accountId ? "text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"
                              }`}
                            >
                              <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden />
                              <span className="truncate">{a.email}</span>
                            </button>
                          </PopoverClose>
                        ))}
                        <div className="my-1 h-px bg-[var(--st-border)]" />
                      </>
                    ) : null}
                    <div className="px-1.5 pb-1 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                      Folders
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {(folders ?? []).map((f) => {
                        const Icon = folderIcon(f.specialUse, f.path);
                        const active = f.path === folderPath;
                        return (
                          <PopoverClose key={f.path} asChild>
                            <button
                              type="button"
                              onClick={() => openFolder(f.path)}
                              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-[var(--st-bg-muted)] ${
                                active ? "bg-[var(--st-bg-muted)] font-medium text-[var(--st-text)]" : "text-[var(--st-text-secondary)]"
                              }`}
                            >
                              <Icon className="h-4 w-4 shrink-0" aria-hidden />
                              <span className="truncate">{f.name}</span>
                            </button>
                          </PopoverClose>
                        );
                      })}
                    </div>
                  </PopoverContent>
                </Popover>
                <div className="mt-0.5 flex items-center gap-2 text-xs text-[var(--st-text-secondary)]">
                  <span>{messages.length} Messages</span>
                  {liveConnected ? (
                    <span
                      className="inline-flex h-1.5 w-1.5 rounded-full bg-[var(--st-accent)]"
                      title="Live — new mail appears automatically"
                      aria-label="Live updates connected"
                    />
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void doTriage()}
                  disabled={triaging || messages.length === 0}
                  aria-label="Triage with AI"
                  title="Triage with AI"
                >
                  {triaging ? (
                    <Spinner size={14} className="text-[var(--st-accent)]" />
                  ) : (
                    <SlidersHorizontal className="h-4 w-4" aria-hidden />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshList}
                  disabled={loadingMessages}
                  aria-label="Refresh"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingMessages ? "animate-spin" : ""}`} aria-hidden />
                </Button>
              </div>
            </div>

            {/* Search */}
            <div className="px-3 pb-2 pt-3">
              <div className="flex items-center gap-2 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-3 py-2">
                <Search className="h-4 w-4 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    if (!e.target.value.trim() && searchActive) clearSearch();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runSearch();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      clearSearch();
                    }
                  }}
                  placeholder="Search"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--st-text)] outline-none placeholder:text-[var(--st-text-secondary)]"
                />
                {searchQuery ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={clearSearch}
                    className="text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                ) : (
                  <kbd className="hidden shrink-0 rounded border border-[var(--st-border)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--st-text-secondary)] sm:inline">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* refreshing-with-content indicator */}
            {(loadingMessages || searching) && messages.length > 0 ? (
              <IndeterminateBar className="absolute left-0 right-0 top-0 z-10" />
            ) : null}

            {/* category filter chips */}
            {Object.keys(categories).length > 0 ? (
              <div className="flex flex-wrap items-center gap-1 px-3 pb-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter(null)}
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    categoryFilter === null
                      ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                      : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                  }`}
                >
                  All
                </button>
                {CATEGORY_PRIORITY.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategoryFilter(categoryFilter === c ? null : c)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                      categoryFilter === c
                        ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                        : "text-[var(--st-text-secondary)] hover:text-[var(--st-text)]"
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${CATEGORY_META[c].dot}`} aria-hidden />
                    {CATEGORY_META[c].label}
                  </button>
                ))}
              </div>
            ) : null}

            {/* list body */}
            <div className="sabmail-motion flex-1 overflow-y-auto px-1.5 pb-2">
              {loadingMessages && messages.length === 0 ? (
                <CreatingOverlay show variant="process" title="Loading messages…" />
              ) : listError ? (
                <div className="p-6">
                  <EmptyState
                    icon={<Mail aria-hidden />}
                    title="Couldn't load this folder"
                    description={listError}
                    action={
                      <Button variant="outline" size="sm" onClick={refreshList}>
                        Try again
                      </Button>
                    }
                  />
                </div>
              ) : visibleThreads.length === 0 ? (
                <div className="p-6">
                  <EmptyState icon={<MailOpen aria-hidden />} title="Nothing here" description="This folder is empty." />
                </div>
              ) : (
                <>
                  {pinnedThreads.length > 0 ? (
                    <>
                      {sectionHeader(<Pin className="h-3 w-3" aria-hidden />, "Pinned")}
                      {pinnedThreads.map((th, i) => renderThreadRow(th, i))}
                    </>
                  ) : null}
                  {sectionHeader(
                    <Mail className="h-3 w-3" aria-hidden />,
                    searchActive ? "Results" : "Primary",
                  )}
                  {primaryThreads.map((th, i) => renderThreadRow(th, i + pinnedThreads.length))}
                </>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Reading pane ──────────────────────────────────────────── */}
        <ResizablePanel defaultSize="62%" minSize="35%">
          <div className="sabmail-pane relative flex h-full flex-col overflow-hidden">
            {selectedUid == null ? (
              <div className="grid h-full place-items-center p-6">
                <EmptyState
                  icon={<MailOpen aria-hidden />}
                  title="Select a message"
                  description="Choose a message from the list to read it here."
                />
              </div>
            ) : loadingBody ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                <Spinner size={22} className="text-[var(--st-accent)]" />
                <p className="text-sm text-[var(--st-text-secondary)]">Loading message…</p>
              </div>
            ) : full ? (
              <div key={full.uid} className="sabmail-fade-up flex h-full flex-col">
                {/* top toolbar */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--st-border)] px-3 py-2">
                  <div className="flex items-center gap-0.5">
                    <Button variant="ghost" size="sm" onClick={() => doReply("reply")} aria-label="Reply" title="Reply">
                      <Reply className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => doReply("replyAll")} aria-label="Reply all" title="Reply all">
                      <ReplyAll className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => doReply("forward")} aria-label="Forward" title="Forward">
                      <Forward className="h-4 w-4" aria-hidden />
                    </Button>
                    {/* AI menu */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="AI actions" title="AI actions">
                          {summarizing || aiReplyBusy ? (
                            <Spinner size={14} className="text-[var(--st-accent)]" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-[var(--st-accent)]" aria-hidden />
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-48 p-1.5">
                        <PopoverClose asChild>
                          <button
                            type="button"
                            onClick={() => void doSummarize()}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                          >
                            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--st-accent)]" aria-hidden />
                            Summarize thread
                          </button>
                        </PopoverClose>
                        <PopoverClose asChild>
                          <button
                            type="button"
                            onClick={() => void doAiReply()}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                          >
                            <Reply className="h-3.5 w-3.5 shrink-0 text-[var(--st-accent)]" aria-hidden />
                            Draft AI reply
                          </button>
                        </PopoverClose>
                      </PopoverContent>
                    </Popover>
                    <span className="mx-1 h-5 w-px bg-[var(--st-border)]" aria-hidden />
                    <Button variant="ghost" size="sm" onClick={() => void doToggleFlag(full.uid)} aria-label="Star" title="Star">
                      <Star
                        className={`h-4 w-4 ${selectedRow?.flagged ? "fill-current text-amber-500" : ""}`}
                        aria-hidden
                      />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void doArchive(full.uid)} aria-label="Archive" title="Archive">
                      <Archive className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => void doTrash(full.uid)} aria-label="Delete" title="Delete">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </Button>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="sm" aria-label="Snooze" title="Snooze">
                          <Clock className="h-4 w-4" aria-hidden />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="start" className="w-52 p-1.5">
                        <div className="mb-1 px-1.5 pt-0.5 text-[11px] font-medium uppercase tracking-wide text-[var(--st-text-secondary)]">
                          Snooze until
                        </div>
                        <div className="flex flex-col">
                          {SNOOZE_PRESETS.map((p) => (
                            <PopoverClose key={p.label} asChild>
                              <button
                                type="button"
                                onClick={() => void doSnooze(full.uid, p)}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--st-text)] hover:bg-[var(--st-bg-muted)]"
                              >
                                <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--st-text-secondary)]" aria-hidden />
                                {p.label}
                              </button>
                            </PopoverClose>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-[var(--st-text-secondary)]">
                    {selIndex >= 0 ? (
                      <span className="tabular-nums">
                        {selIndex + 1} of {visibleThreads.length}
                      </span>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => moveSelection(-1)} aria-label="Previous" title="Previous">
                      <ChevronLeft className="h-4 w-4" aria-hidden />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => moveSelection(1)} aria-label="Next" title="Next">
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Button>
                    <span className="mx-0.5 h-5 w-px bg-[var(--st-border)]" aria-hidden />
                    <Button variant="ghost" size="sm" onClick={closeReading} aria-label="Close" title="Close">
                      <X className="h-4 w-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                {/* date + subject */}
                <div className="px-5 pt-4">
                  <div className="text-xs text-[var(--st-text-secondary)]">
                    {full.date
                      ? new Date(full.date).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : ""}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <h1 className="min-w-0 truncate text-xl font-semibold text-[var(--st-text)]">
                      {full.subject || "(no subject)"}
                    </h1>
                    {activeThread && activeThread.count > 1 ? (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-md bg-[var(--st-bg-muted)] px-1.5 text-[11px] font-semibold text-[var(--st-text-secondary)]">
                        {activeThread.count}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* AI summary card */}
                {summarizing || summary ? (
                  <div className="px-5 pt-3">
                    <div className="sabmail-tint-card sabmail-fade-up rounded-xl px-4 py-3">
                      <div className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--st-accent)]">
                        <Sparkles className="h-4 w-4" aria-hidden /> Summary
                      </div>
                      {summarizing ? (
                        <ProcessingDots className="text-[var(--st-accent)]" />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--st-text)]">
                          {summary}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="px-5 pt-3">
                    <button
                      type="button"
                      onClick={() => void doSummarize()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--sabmail-tint-border)] px-3 py-1.5 text-xs font-medium text-[var(--st-accent)] hover:bg-[var(--sabmail-tint)]"
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden /> Summarize this thread
                    </button>
                  </div>
                )}

                {/* sender + recipients */}
                <div className="px-5 pt-4">
                  <div className="flex items-start gap-3">
                    <MailAvatar name={full.from.name} email={full.from.email} size={40} ring />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold text-[var(--st-text)]">
                          {full.from.name || full.from.email}
                        </span>
                        {full.from.name ? (
                          <span className="text-xs text-[var(--st-text-secondary)]">
                            {full.from.email}
                          </span>
                        ) : null}
                      </div>
                      {full.to.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                          <span>To</span>
                          {full.to.slice(0, 6).map((addr, i) => (
                            <span
                              key={`to-${i}`}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-muted)] py-0.5 pl-0.5 pr-2"
                            >
                              <MailAvatar name={senderShort(addr)} email={senderEmail(addr)} size={16} />
                              <span className="max-w-[140px] truncate text-[var(--st-text)]">
                                {senderShort(addr)}
                              </span>
                            </span>
                          ))}
                          {full.to.length > 6 ? <span>+{full.to.length - 6}</span> : null}
                        </div>
                      ) : null}
                      {full.cc.length > 0 ? (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[var(--st-text-secondary)]">
                          <span>Cc</span>
                          {full.cc.slice(0, 6).map((addr, i) => (
                            <span
                              key={`cc-${i}`}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--st-bg-muted)] py-0.5 pl-0.5 pr-2"
                            >
                              <MailAvatar name={senderShort(addr)} email={senderEmail(addr)} size={16} />
                              <span className="max-w-[140px] truncate text-[var(--st-text)]">
                                {senderShort(addr)}
                              </span>
                            </span>
                          ))}
                          {full.cc.length > 6 ? <span>+{full.cc.length - 6}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {full.hadRemoteImages && !showRemoteImages ? (
                  <div className="mx-5 mt-3 flex items-center justify-between gap-2 rounded-lg bg-[var(--st-bg-muted)] px-3 py-2">
                    <span className="text-xs text-[var(--st-text-secondary)]">
                      Remote images are blocked to protect your privacy.
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setShowRemoteImages(true);
                        void openMessage(full.uid, true);
                      }}
                    >
                      Show images
                    </Button>
                  </div>
                ) : null}

                {/* conversation strip */}
                {activeThread && activeThread.count > 1 ? (
                  <div className="mx-5 mt-3 rounded-lg border border-[var(--st-border)] p-1">
                    <div className="flex flex-col">
                      {activeThread.rows.map((r) => (
                        <button
                          key={r.uid}
                          type="button"
                          onClick={() => void openMessage(r.uid)}
                          className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-xs ${
                            r.uid === full.uid
                              ? "bg-[var(--st-bg-muted)] text-[var(--st-text)]"
                              : "text-[var(--st-text-secondary)] hover:bg-[var(--st-bg-muted)]"
                          }`}
                        >
                          <span className="truncate">{r.fromName || r.fromEmail}</span>
                          <span className="shrink-0">{formatDate(r.date)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {/* body */}
                <div className="mt-3 min-h-0 flex-1 overflow-hidden">
                  {full.html ? (
                    <iframe
                      key={`${full.uid}-${showRemoteImages ? "img" : "noimg"}`}
                      title="Message body"
                      sandbox="allow-popups allow-popups-to-escape-sandbox"
                      srcDoc={buildSrcDoc(full.html)}
                      className="h-full w-full border-0"
                    />
                  ) : (
                    <div className="h-full overflow-y-auto whitespace-pre-wrap break-words px-5 py-3 text-sm text-[var(--st-text)]">
                      {full.text || "(empty message)"}
                    </div>
                  )}
                </div>

                {/* attachments */}
                {full.attachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-t border-[var(--st-border)] p-3">
                    {full.attachments.map((att, i) => (
                      <span
                        key={`${att.filename}-${i}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--st-border)] bg-[var(--st-bg-muted)] px-2.5 py-1.5 text-xs text-[var(--st-text-secondary)]"
                      >
                        <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--st-bg)] text-[var(--st-accent)]">
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                        </span>
                        <span className="max-w-[180px] truncate text-[var(--st-text)]">{att.filename}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="grid h-full place-items-center p-6">
                <EmptyState icon={<Mail aria-hidden />} title="Couldn't load this message" />
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {compose ? (
        <ComposeModal
          key={composeNonce.current}
          open
          accountId={accountId}
          accountEmail={activeAccount?.email ?? ""}
          title={compose.title}
          prefill={compose.prefill}
          onClose={() => setCompose(null)}
          onSent={refreshList}
        />
      ) : null}

      <CommandDialog open={paletteOpen} onOpenChange={setPaletteOpen} label="SabMail commands">
        <CommandInput placeholder="Type a command or search…" />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          <CommandGroup heading="Actions">
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                openCompose();
              }}
            >
              <SquarePen className="mr-2 h-4 w-4" aria-hidden /> Compose
              <CommandShortcut>C</CommandShortcut>
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                refreshList();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" aria-hidden /> Refresh folder
            </CommandItem>
            <CommandItem
              onSelect={() => {
                setPaletteOpen(false);
                void doTriage();
              }}
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden /> Triage with AI
            </CommandItem>
          </CommandGroup>
          {accounts.length > 1 ? (
            <CommandGroup heading="Accounts">
              {accounts.map((a) => (
                <CommandItem
                  key={a.id}
                  onSelect={() => {
                    setPaletteOpen(false);
                    setAccountId(a.id);
                  }}
                >
                  <AtSign className="mr-2 h-4 w-4" aria-hidden /> {a.email}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {folders && folders.length > 0 ? (
            <CommandGroup heading="Folders">
              {folders.map((f) => {
                const Icon = folderIcon(f.specialUse, f.path);
                return (
                  <CommandItem
                    key={f.path}
                    onSelect={() => {
                      setPaletteOpen(false);
                      openFolder(f.path);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" aria-hidden /> {f.name}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          ) : null}
        </CommandList>
      </CommandDialog>
    </div>
  );
}
