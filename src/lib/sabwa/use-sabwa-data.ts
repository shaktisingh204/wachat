'use client';

/**
 * SabWa — client data hooks (SWR-like, dependency-free).
 *
 * Each hook owns its own `{ data, error, isLoading, mutate }` triple plus a
 * `refetch`. The cache key is the tuple `(sessionId, ...args)`; whenever any
 * key segment changes we re-issue the underlying server action.
 *
 * Phase 1: most actions throw `SabWa Phase 1 — not implemented yet`. We
 * surface those as `error` but keep `data` as an empty list so callers can
 * always render a stable empty-state shell while the Rust engine ships.
 *
 * NOTE: a separate session-level SSE hook lives in `./use-sabwa-stream`. The
 * realtime `useSabwaStream(sessionId)` shape there is the canonical one;
 * any chat-level realtime wiring should subscribe through it.
 */

import * as React from 'react';

import {
  getChatMessages,
  listAuditEntries,
  listBulkCampaigns,
  listChats,
  listContacts,
  listGroups,
  listLabels,
  listScheduledMessages,
  listStarred,
  listTemplates,
  type ListContactsArgs,
  type SabwaAuditQueryInput,
  type SabwaChatListFilter,
  type SabwaGroupSummary,
  type SabwaLabelRow,
  type SabwaMessagePageCursor,
  type SabwaScheduledListFilter,
  type SabwaStarredEntry,
} from '@/app/actions/sabwa.actions';
import type {
  SabwaBroadcast,
  SabwaChat,
  SabwaContact,
  SabwaMessage,
  SabwaScheduled,
  SabwaTemplate,
} from './types';
import { resolveDisplayName } from './format-jid';
import {
  useSabwaStream,
  type SabwaEvent,
  type SabwaEventKind,
} from './use-sabwa-stream';

// ─── Shared async-state shape ──────────────────────────────────────────────

export interface UseSabwaDataResult<T> {
  /** Always defined — seeded with the hook's stable empty fallback. */
  data: T;
  error: string | null;
  isLoading: boolean;
  mutate: () => Promise<void>;
  /** @deprecated alias for `isLoading` — kept for older `/sabwa/*` pages. */
  loading: boolean;
  /** @deprecated alias for `mutate` — kept for older `/sabwa/*` pages. */
  refetch: () => Promise<void>;
}

interface AsyncState<T> {
  data: T;
  error: string | null;
  isLoading: boolean;
}

function pending<T>(prev: AsyncState<T>): AsyncState<T> {
  return { data: prev.data, error: null, isLoading: true };
}

function settled<T>(data: T): AsyncState<T> {
  return { data, error: null, isLoading: false };
}

function failed<T>(err: unknown, fallback: T): AsyncState<T> {
  return {
    data: fallback,
    error: err instanceof Error ? err.message : String(err),
    isLoading: false,
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    );
  } catch {
    return String(value);
  }
}

/**
 * Generic fetcher hook. Re-runs whenever `key` changes (we compare its
 * JSON-stringified form, so callers can pass nested filter objects). The
 * `fetcher` itself is read through a ref so callers don't need to memoise
 * inline closures.
 */
function useFetched<T>(
  key: unknown,
  fetcher: () => Promise<T>,
  fallback: T,
): UseSabwaDataResult<T> {
  const [state, setState] = React.useState<AsyncState<T>>({
    data: fallback,
    error: null,
    isLoading: true,
  });
  const fetcherRef = React.useRef(fetcher);
  React.useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const keyJson = React.useMemo(() => safeStringify(key), [key]);

  const run = React.useCallback(async () => {
    setState((prev) => pending(prev));
    try {
      const data = await fetcherRef.current();
      setState(settled(data));
    } catch (err) {
      setState(failed(err, fallback));
    }
    // `fallback` is a stable empty constant supplied by callers — safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    void run();
  }, [keyJson, run]);

  const mutate = React.useCallback(async () => {
    await run();
  }, [run]);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.isLoading,
    mutate,
    loading: state.isLoading,
    refetch: mutate,
  };
}

// ─── Realtime refetch wiring ───────────────────────────────────────────────

/**
 * Shared shape for hooks that opt into SSE-driven auto-refresh. Every hook
 * defaults `realtime` to `true`; pass `false` for offscreen / hidden panels
 * where you don't want a refetch to fire when new events arrive.
 *
 * `projectId` is forwarded to the SSE route for project-level auth. It's
 * always optional — the server route can also resolve project ownership
 * via the session cookie + the `sabwa_sessions` collection — but supplying
 * it short-circuits a Mongo lookup per request.
 */
export interface SabwaRealtimeOptions {
  realtime?: boolean;
  projectId?: string | null;
}

const REFETCH_DEBOUNCE_MS = 600;

/**
 * Internal helper: subscribe to a set of `useSabwaStream` event kinds and
 * call `refetch` on a trailing 600ms debounce whenever any of them fires.
 *
 * `filter` lets a caller (currently `useChatMessages`) drop events that
 * don't pertain to its own scope — e.g. messages in other chats.
 *
 * The hook always calls `useSabwaStream`. When `enabled` is false (i.e.
 * `realtime: false` or no `sessionId`), we still call it with `enabled:
 * false` so React's hook order stays stable.
 */
function useStreamRefetch(
  sessionId: string | undefined | null,
  kinds: readonly SabwaEventKind[],
  refetch: () => Promise<void>,
  options: { enabled?: boolean; projectId?: string | null;
    filter?: (ev: SabwaEvent) => boolean } = {},
): void {
  const { enabled = true, projectId, filter } = options;

  // Latest refetch + filter through refs so we don't tear down the
  // subscription each render.
  const refetchRef = React.useRef(refetch);
  React.useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);
  const filterRef = React.useRef(filter);
  React.useEffect(() => {
    filterRef.current = filter;
  }, [filter]);

  const stream = useSabwaStream(sessionId ?? undefined, {
    enabled: Boolean(enabled && sessionId),
    projectId: projectId ?? undefined,
  });

  // Stable kinds key so the subscription effect doesn't reattach
  // when callers spread a fresh array each render.
  const kindsKey = React.useMemo(() => kinds.slice().sort().join('|'), [kinds]);

  React.useEffect(() => {
    if (!enabled || !sessionId) return;
    const offs: Array<() => void> = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const fire = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void refetchRef.current().catch(() => {
          /* swallow — UI keeps last-good data */
        });
      }, REFETCH_DEBOUNCE_MS);
    };
    const onEvent = (ev: SabwaEvent) => {
      const f = filterRef.current;
      if (f && !f(ev)) return;
      fire();
    };
    const kindList = kindsKey.split('|').filter(Boolean) as SabwaEventKind[];
    for (const k of kindList) {
      offs.push(stream.subscribe(k, onEvent));
    }
    return () => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      for (const off of offs) off();
    };
  }, [stream, enabled, sessionId, kindsKey]);
}

// ─── Empty-result constants (stable identities) ────────────────────────────

const EMPTY_CHATS: SabwaChat[] = [];
const EMPTY_MESSAGES: SabwaMessage[] = [];
const EMPTY_GROUPS: SabwaGroupSummary[] = [];
const EMPTY_CONTACTS: SabwaContact[] = [];
const EMPTY_SCHEDULED: SabwaScheduled[] = [];

// ─── Local row shapes for endpoints not yet in the action surface ──────────

/** Minimal shape the UI needs from a bulk-campaign row. */
export interface SabwaBulkCampaignRow {
  id: string;
  name: string;
  status: string;
  progress?: { sent: number; failed: number; total: number };
  createdAt?: string | Date;
}

/** Minimal shape the UI needs from a broadcast list row. */
export interface SabwaBroadcastRow {
  id: string;
  name: string;
  recipientCount: number;
  createdAt?: string | Date;
}

/** Minimal shape the UI needs from an audit entry. */
export interface SabwaAuditRow {
  id: string;
  ts: string | Date;
  action: string;
  actorEmail?: string;
  target?: string;
}

const EMPTY_CAMPAIGNS: SabwaBulkCampaignRow[] = [];
const EMPTY_BROADCASTS: SabwaBroadcastRow[] = [];
const EMPTY_AUDIT: SabwaAuditRow[] = [];
const EMPTY_TEMPLATES: SabwaTemplate[] = [];
const EMPTY_RAW_CAMPAIGNS: SabwaBroadcast[] = [];

// ─── Hooks ─────────────────────────────────────────────────────────────────

/**
 * Chats list for a session.
 *
 * Auto-refreshes (debounced 600ms) on `chat`, `message`, `message_status`,
 * and `presence` SSE events for the session. Disable via `realtime: false`
 * for offscreen panels.
 */
export function useChats(
  sessionId: string | undefined | null,
  filter: SabwaChatListFilter = {},
  options: SabwaRealtimeOptions = {},
): UseSabwaDataResult<SabwaChat[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_CHATS;
    const res = await listChats(sessionId, filter);
    if (!res.ok) throw new Error(res.error);
    return (res.chats as SabwaChat[]) ?? EMPTY_CHATS;
  }, [sessionId, filter]);

  const result = useFetched(['chats', sessionId, filter], fetcher, EMPTY_CHATS);

  useStreamRefetch(
    sessionId,
    CHATS_REFETCH_KINDS,
    result.refetch,
    { enabled: options.realtime ?? true, projectId: options.projectId },
  );

  return result;
}

const CHATS_REFETCH_KINDS = [
  'chat',
  'message',
  'message_status',
  'presence',
] as const satisfies readonly SabwaEventKind[];

/**
 * Extended result returned by `useChatMessages`. Beyond the standard
 * `UseSabwaDataResult<SabwaMessage[]>` triple, it also exposes the
 * inbox-specific back-pagination + optimistic-mutation surface that
 * `/sabwa/inbox/_components/conversation.tsx` relies on.
 */
export interface UseChatMessagesResult
  extends UseSabwaDataResult<SabwaMessage[]> {
  messages: SabwaMessage[];
  loadingMore: boolean;
  hasMore: boolean;
  loadOlder: () => Promise<void>;
  appendLocal: (message: SabwaMessage) => void;
  replaceLocal: (tempId: string, next: SabwaMessage) => void;
}

/**
 * Messages for a single chat. First page is cursor-paginated via the
 * `before` / `limit` args; older pages are fetched imperatively through
 * `loadOlder()` so the scroll position stays anchored.
 *
 * Auto-refreshes (debounced 600ms) on `message` / `message_status` SSE
 * events that match this chat's `chatJid`. Events for other chats are
 * ignored. Disable with `realtime: false`.
 */
export function useChatMessages(
  sessionId: string | undefined | null,
  chatJid: string | undefined | null,
  before?: Date | string | number,
  limit?: number,
  options: SabwaRealtimeOptions = {},
): UseChatMessagesResult {
  const fetcher = React.useCallback(async () => {
    if (!sessionId || !chatJid) return EMPTY_MESSAGES;
    const cursor: SabwaMessagePageCursor | undefined =
      before != null || limit != null ? { before, limit } : undefined;
    const res = await getChatMessages(sessionId, chatJid, cursor);
    if (!res.ok) throw new Error(res.error);
    return res.messages ?? EMPTY_MESSAGES;
  }, [sessionId, chatJid, before, limit]);

  const base = useFetched(
    ['chatMessages', sessionId, chatJid, before, limit],
    fetcher,
    EMPTY_MESSAGES,
  );

  // Local mirror so callers can mutate without re-fetching.
  const [local, setLocal] = React.useState<SabwaMessage[] | null>(null);
  React.useEffect(() => {
    // When the server response changes, drop the local override so the new
    // server snapshot wins. Callers can immediately reapply optimistic
    // edits via append/replace.
    setLocal(null);
  }, [base.data]);

  const messages = local ?? base.data ?? EMPTY_MESSAGES;

  const [loadingMore, setLoadingMore] = React.useState(false);
  const cursorRef = React.useRef<string | undefined>(undefined);
  const [hasMore, setHasMore] = React.useState(true);

  React.useEffect(() => {
    cursorRef.current = undefined;
    setHasMore(true);
  }, [sessionId, chatJid]);

  const appendLocal = React.useCallback((message: SabwaMessage) => {
    setLocal((prev) => {
      const cur = prev ?? base.data ?? EMPTY_MESSAGES;
      if (cur.some((m) => m.messageId === message.messageId)) return cur;
      return [...cur, message];
    });
  }, [base.data]);

  const replaceLocal = React.useCallback(
    (tempId: string, next: SabwaMessage) => {
      setLocal((prev) => {
        const cur = prev ?? base.data ?? EMPTY_MESSAGES;
        let changed = false;
        const out = cur.map((m) => {
          if (m.messageId !== tempId) return m;
          changed = true;
          return next;
        });
        return changed ? out : cur;
      });
    },
    [base.data],
  );

  const loadOlder = React.useCallback(async () => {
    if (!sessionId || !chatJid || !hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const oldest = messages[0];
      const cursor: SabwaMessagePageCursor = {
        cursor: cursorRef.current,
        before: oldest?.ts,
        limit,
      };
      const res = await getChatMessages(sessionId, chatJid, cursor);
      if (res.ok) {
        const older = res.messages ?? EMPTY_MESSAGES;
        cursorRef.current = res.nextCursor;
        setHasMore(Boolean(res.nextCursor));
        if (older.length > 0) {
          setLocal((prev) => {
            const cur = prev ?? base.data ?? EMPTY_MESSAGES;
            const seen = new Set(cur.map((m) => m.messageId));
            const dedup = older.filter((m) => !seen.has(m.messageId));
            return [...dedup, ...cur];
          });
        }
      }
    } catch {
      // Back-pagination failure shouldn't blow away the existing list.
    } finally {
      setLoadingMore(false);
    }
  }, [sessionId, chatJid, hasMore, loadingMore, messages, base.data, limit]);

  // Only refetch when an event pertains to *this* chat. Events carry
  // `chatJid`; if absent we play it safe and refetch.
  const chatFilter = React.useCallback(
    (ev: SabwaEvent) => {
      if (!chatJid) return false;
      const evJid = (ev as { chatJid?: unknown }).chatJid;
      if (typeof evJid !== 'string') return true;
      return evJid === chatJid;
    },
    [chatJid],
  );

  useStreamRefetch(
    sessionId,
    MESSAGES_REFETCH_KINDS,
    base.refetch,
    {
      enabled: options.realtime ?? true,
      projectId: options.projectId,
      filter: chatFilter,
    },
  );

  return {
    ...base,
    data: messages,
    messages,
    loadingMore,
    hasMore,
    loadOlder,
    appendLocal,
    replaceLocal,
  };
}

const MESSAGES_REFETCH_KINDS = [
  'message',
  'message_status',
] as const satisfies readonly SabwaEventKind[];

/**
 * Groups list, optionally filtered by category.
 *
 * Auto-refreshes (debounced 600ms) on `chat` SSE events — the engine emits
 * `chats.upsert` as `chat` and group metadata updates flow through there.
 */
export function useGroups(
  sessionId: string | undefined | null,
  category?: string | null,
  options: SabwaRealtimeOptions = {},
): UseSabwaDataResult<SabwaGroupSummary[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_GROUPS;
    const res = await listGroups({ sessionId, category });
    if (!res.ok) throw new Error(res.error);
    return (
      (res as unknown as { groups?: SabwaGroupSummary[] }).groups ??
      EMPTY_GROUPS
    );
  }, [sessionId, category]);

  const result = useFetched(
    ['groups', sessionId, category],
    fetcher,
    EMPTY_GROUPS,
  );

  useStreamRefetch(
    sessionId,
    GROUPS_REFETCH_KINDS,
    result.refetch,
    { enabled: options.realtime ?? true, projectId: options.projectId },
  );

  return result;
}

const GROUPS_REFETCH_KINDS = [
  'chat',
] as const satisfies readonly SabwaEventKind[];

/**
 * Contacts list (with optional search + tag filters).
 *
 * Auto-refreshes (debounced 600ms) on `chat` events — the engine writes
 * new contacts to Mongo as part of chat upserts when an unknown JID
 * messages in.
 */
export function useContacts(
  sessionId: string | undefined | null,
  search?: string,
  tag?: string,
  options: SabwaRealtimeOptions = {},
): UseSabwaDataResult<SabwaContact[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_CONTACTS;
    const args: ListContactsArgs = { sessionId };
    if (search) args.search = search;
    if (tag) args.tag = tag;
    const res = await listContacts(args);
    if (!res.ok) throw new Error(res.error);
    return res.contacts ?? EMPTY_CONTACTS;
  }, [sessionId, search, tag]);

  const result = useFetched(
    ['contacts', sessionId, search, tag],
    fetcher,
    EMPTY_CONTACTS,
  );

  useStreamRefetch(
    sessionId,
    CONTACTS_REFETCH_KINDS,
    result.refetch,
    { enabled: options.realtime ?? true, projectId: options.projectId },
  );

  return result;
}

const CONTACTS_REFETCH_KINDS = [
  'chat',
] as const satisfies readonly SabwaEventKind[];

/** Scheduled messages for a session. */
export function useScheduled(
  sessionId: string | undefined | null,
  filter: SabwaScheduledListFilter = {},
): UseSabwaDataResult<SabwaScheduled[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_SCHEDULED;
    const res = await listScheduledMessages(sessionId, filter);
    if (!res.ok) throw new Error(res.error);
    return res.items ?? EMPTY_SCHEDULED;
  }, [sessionId, filter]);

  return useFetched(['scheduled', sessionId, filter], fetcher, EMPTY_SCHEDULED);
}

/**
 * Bulk campaigns list — projected onto the compact `SabwaBulkCampaignRow`
 * shape that table consumers expect (id / name / status / progress /
 * createdAt). For the raw `SabwaBroadcast` payload use
 * `useBulkCampaignsRaw` instead.
 */
export function useBulkCampaigns(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaBulkCampaignRow[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_CAMPAIGNS;
    const res = await listBulkCampaigns(sessionId);
    if (!res.ok) throw new Error(res.error);
    const campaigns = res.campaigns ?? EMPTY_RAW_CAMPAIGNS;
    return campaigns.map<SabwaBulkCampaignRow>((c) => ({
      id: String(c._id),
      name: c.name,
      status: String(c.status),
      progress: {
        sent: c.sentCount ?? 0,
        failed: c.failedCount ?? 0,
        total: c.totalCount ?? 0,
      },
      createdAt: c.createdAt,
    }));
  }, [sessionId]);

  return useFetched(['bulkCampaigns', sessionId], fetcher, EMPTY_CAMPAIGNS);
}

/**
 * Bulk campaigns list, returning the raw `SabwaBroadcast` documents
 * (recipients, payload, timestamps). Use when the projected
 * `SabwaBulkCampaignRow` from `useBulkCampaigns` doesn't carry enough.
 */
export function useBulkCampaignsRaw(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaBroadcast[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_RAW_CAMPAIGNS;
    const res = await listBulkCampaigns(sessionId);
    if (!res.ok) throw new Error(res.error);
    return res.campaigns ?? EMPTY_RAW_CAMPAIGNS;
  }, [sessionId]);

  return useFetched(
    ['bulkCampaignsRaw', sessionId],
    fetcher,
    EMPTY_RAW_CAMPAIGNS,
  );
}

/** Message templates list for a session. */
export function useTemplates(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaTemplate[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_TEMPLATES;
    const res = await listTemplates(sessionId);
    if (!res.ok) throw new Error(res.error);
    return res.templates ?? EMPTY_TEMPLATES;
  }, [sessionId]);

  return useFetched(['templates', sessionId], fetcher, EMPTY_TEMPLATES);
}

/**
 * Broadcasts list.
 *
 * No dedicated `listBroadcasts` server action exists yet — same TODO as
 * `useBulkCampaigns`.
 */
export function useBroadcasts(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaBroadcastRow[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_BROADCASTS;
    // TODO (Phase 2): replace with `listBroadcasts(sessionId)` once added.
    return EMPTY_BROADCASTS;
  }, [sessionId]);

  return useFetched(['broadcasts', sessionId], fetcher, EMPTY_BROADCASTS);
}

const EMPTY_LABELS: SabwaLabelRow[] = [];
const EMPTY_STARRED: SabwaStarredEntry[] = [];

/** Chat labels for a session. */
export function useLabels(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaLabelRow[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_LABELS;
    const res = await listLabels(sessionId);
    if (!res.ok) throw new Error(res.error);
    return res.labels ?? EMPTY_LABELS;
  }, [sessionId]);

  return useFetched(['labels', sessionId], fetcher, EMPTY_LABELS);
}

/** Starred messages across all chats in a session. */
export function useStarred(
  sessionId: string | undefined | null,
): UseSabwaDataResult<SabwaStarredEntry[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_STARRED;
    const res = await listStarred(sessionId);
    if (!res.ok) throw new Error(res.error);
    return res.items ?? EMPTY_STARRED;
  }, [sessionId]);

  return useFetched(['starred', sessionId], fetcher, EMPTY_STARRED);
}

// ─── Composed name-resolution hook ─────────────────────────────────────────

/**
 * Returns a memoised `(jid) => string` resolver that walks the session's
 * chats + contacts (and group-typed chats) to find the best human label for
 * a JID. Falls back through `resolveDisplayName` to `formatJid`.
 *
 * Use this everywhere SabWa UI would otherwise render a raw JID — pages,
 * tables, exports, audit logs — so the displayed name stays consistent
 * across modules.
 */
export function useResolveJid(
  sessionId: string | null | undefined,
): (jid: string | undefined) => string {
  const { data: chats } = useChats(sessionId);
  const { data: contacts } = useContacts(sessionId);

  return React.useCallback(
    (jid: string | undefined) => {
      const chatList = chats ?? EMPTY_CHATS;
      const groupList = chatList
        .filter((c) => c.type === 'group')
        .map((g) => ({ jid: g.jid, subject: g.name }));
      return resolveDisplayName(jid, {
        chats: chatList,
        contacts: contacts ?? EMPTY_CONTACTS,
        groups: groupList,
      });
    },
    [chats, contacts],
  );
}

// ─── Legacy inbox stream surface ───────────────────────────────────────────
//
// Pages under `/sabwa/inbox/*` were built against a single-arg
// `subscribe(handler)` API where every frame is tagged with a `type`
// discriminant. The new canonical hook (`./use-sabwa-stream`) takes
// `subscribe(kind, handler)`. Until those pages migrate, we adapt the
// new shape into the old union below.

export type SabwaInboxStreamEvent =
  | { type: 'message'; payload: SabwaMessage }
  | {
      type: 'message_status';
      payload: {
        messageId: string;
        status: SabwaMessage['status'];
        tempId?: string;
      };
    }
  | { type: 'chat_updated'; payload: Partial<SabwaChat> & { jid: string } }
  | {
      type: 'presence';
      payload: {
        jid: string;
        state: 'online' | 'offline' | 'typing' | 'recording';
      };
    }
  | { type: 'session_status'; payload: { sessionId: string; status: string } };

export type SabwaInboxStreamHandler = (event: SabwaInboxStreamEvent) => void;

/**
 * Legacy adapter over `useSabwaStream` (`./use-sabwa-stream`). Returns a
 * stable `subscribe(handler)` that fans new-shape kind-keyed events into
 * the discriminated union the inbox conversation view expects.
 *
 * Prefer `useSabwaStream(sessionId).subscribe(kind, handler)` for new code.
 */
export function useSabwaInboxStream(
  sessionId: string | undefined | null,
): { subscribe: (handler: SabwaInboxStreamHandler) => () => void } {
  // Lazy import to avoid a top-level cycle; both files live in the same
  // directory so resolution is cheap.
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
  const { useSabwaStream } = require('./use-sabwa-stream') as typeof import('./use-sabwa-stream');
  const stream = useSabwaStream(sessionId ?? undefined);

  const subscribe = React.useCallback(
    (handler: SabwaInboxStreamHandler) => {
      const offs: Array<() => void> = [];

      offs.push(
        stream.subscribe('message', (ev) => {
          handler({ type: 'message', payload: ev as unknown as SabwaMessage });
        }),
      );
      offs.push(
        stream.subscribe('message_status', (ev) => {
          handler({
            type: 'message_status',
            payload: {
              messageId: String(ev.messageId ?? ''),
              status: (ev as { status?: SabwaMessage['status'] }).status ??
                'sent',
              tempId: (ev as { tempId?: string }).tempId,
            },
          });
        }),
      );
      offs.push(
        stream.subscribe('chat', (ev) => {
          handler({
            type: 'chat_updated',
            payload: ev as unknown as Partial<SabwaChat> & { jid: string },
          });
        }),
      );
      offs.push(
        stream.subscribe('presence', (ev) => {
          handler({
            type: 'presence',
            payload: {
              jid: String(ev.chatJid ?? ev.fromJid ?? ''),
              state: ((ev as { state?: 'online' | 'offline' | 'typing' | 'recording' })
                .state ?? 'offline'),
            },
          });
        }),
      );
      offs.push(
        stream.subscribe('status', (ev) => {
          handler({
            type: 'session_status',
            payload: {
              sessionId: String(ev.sessionId ?? sessionId ?? ''),
              status: String(ev.status ?? ''),
            },
          });
        }),
      );

      return () => {
        for (const off of offs) off();
      };
    },
    [stream, sessionId],
  );

  return { subscribe };
}

/** Audit log entries for a session. */
export function useAuditEntries(
  sessionId: string | undefined | null,
  opts: Omit<SabwaAuditQueryInput, 'sessionId'> = {},
): UseSabwaDataResult<SabwaAuditRow[]> {
  const fetcher = React.useCallback(async () => {
    if (!sessionId) return EMPTY_AUDIT;
    const res = await listAuditEntries({ sessionId, ...opts });
    if (!res.ok) throw new Error(res.error);
    return (res.entries as SabwaAuditRow[]) ?? EMPTY_AUDIT;
  }, [sessionId, opts]);

  return useFetched(['audit', sessionId, opts], fetcher, EMPTY_AUDIT);
}
