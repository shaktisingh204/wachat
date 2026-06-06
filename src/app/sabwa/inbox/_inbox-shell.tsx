'use client';

import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator, Button, EmptyState } from '@/components/sabcrm/20ui';
import {
  useRouter,
  useSearchParams } from 'next/navigation';
import { MessageSquare,
  PlugZap } from 'lucide-react';

/**
 * Inbox shell — client root for `/sabwa/inbox`.
 *
 * Responsibilities:
 *   - read the active session from `useSabwaSession()`
 *   - manage URL-driven chat selection (`?chat=<jid>`) + panel state
 *     (`?panel=open`) using `next/navigation` so deep links + browser
 *     back work
 *   - decide which panes render on mobile (single-pane router-driven)
 *   - own the connection-error banner when the session is offline
 *   - pass the messages window up so `<ContactPanel>` can render media
 *
 * Heavy children live in `./_components/*`; this file is the layout
 * spine + state coordinator only.
 */

import * as React from 'react';

import { StatusBadge } from '@/app/sabwa/_components/status-badge';
import { useChats } from '@/lib/sabwa/use-sabwa-data';
import { useSabwaSession } from '@/lib/sabwa/session-context';
import { useSabwaStream } from '@/lib/sabwa/use-sabwa-stream';
import { useProject } from '@/context/project-context';
import { cn } from '@/lib/utils';
import type { SabwaMessage, SabwaSessionStatus } from '@/lib/sabwa/types';

import { ContactPanelShell } from './_components/contact-panel-shell';
import { Conversation } from './_components/conversation';
import { LeftPane } from './_components/left-pane';

const KNOWN_STATUSES: ReadonlyArray<SabwaSessionStatus> = [
  'pending',
  'connected',
  'logged_out',
  'banned',
  'error',
];

function coerceStatus(raw: string | undefined): SabwaSessionStatus {
  if (raw && (KNOWN_STATUSES as readonly string[]).includes(raw)) {
    return raw as SabwaSessionStatus;
  }
  return 'pending';
}

export function InboxShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionCtx = useSabwaSession();
  const session = sessionCtx.current;
  const sessionId = session?.id ?? null;
  const status = coerceStatus(session?.status);

  // ─── URL-driven state ─────────────────────────────────────────────────
  const chatJid = searchParams.get('chat');
  const panelOpenParam = searchParams.get('panel');
  const [panelOpenLocal, setPanelOpenLocal] = React.useState(
    panelOpenParam === 'open',
  );
  // Keep local state in sync with URL on back/forward.
  React.useEffect(() => {
    setPanelOpenLocal(panelOpenParam === 'open');
  }, [panelOpenParam]);

  const updateQuery = React.useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(next)) {
        if (value == null) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      router.replace(qs ? `/sabwa/inbox?${qs}` : '/sabwa/inbox', {
        scroll: false,
      });
    },
    [router, searchParams],
  );

  const selectChat = React.useCallback(
    (jid: string | null) => {
      updateQuery({ chat: jid });
    },
    [updateQuery],
  );

  const togglePanel = React.useCallback(() => {
    const next = !panelOpenLocal;
    setPanelOpenLocal(next);
    updateQuery({ panel: next ? 'open' : null });
  }, [panelOpenLocal, updateQuery]);

  // ─── Chats list ───────────────────────────────────────────────────────
  // Pull the engine's per-page cap. The default (50) made the inbox feel
  // truncated; this gives us the full sorted window in one fetch. True
  // infinite-scroll on the chats column is a follow-up.
  const chatsFilter = React.useMemo(() => ({ limit: 200 }), []);
  const { data: chats, loading: chatsLoading, refetch: refetchChats } =
    useChats(sessionId, chatsFilter);

  // ─── Realtime refresh ────────────────────────────────────────────────
  // Subscribe to the session SSE stream and refetch the chat list whenever
  // a chat/message/message_status frame arrives. Bursts of history-sync
  // frames are debounced to one call per ~800ms. When the session first
  // transitions to `isConnected` (e.g. just after a pair completes), we
  // fire one immediate refetch so the user sees history within 1–2s
  // without an F5.
  const { activeProjectId } = useProject();
  const stream = useSabwaStream(sessionId, {
    projectId: activeProjectId ?? undefined,
  });

  // Keep latest refetch in a ref so the scheduler closure doesn't capture stale.
  const refetchRef = React.useRef(refetchChats);
  React.useEffect(() => {
    refetchRef.current = refetchChats;
  }, [refetchChats]);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleRefetch = React.useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void refetchRef.current?.();
    }, 800);
  }, []);
  React.useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  React.useEffect(() => {
    if (!stream.lastEvent) return;
    const k = stream.lastEvent.kind;
    if (k === 'chat' || k === 'message' || k === 'message_status') {
      scheduleRefetch();
    }
  }, [stream.lastEvent, scheduleRefetch]);

  // Immediate refetch when the session first becomes connected.
  const prevConnectedRef = React.useRef(false);
  React.useEffect(() => {
    if (stream.isConnected && !prevConnectedRef.current) {
      // Cancel any pending debounced refetch — we're firing immediately.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void refetchRef.current?.();
    }
    prevConnectedRef.current = stream.isConnected;
  }, [stream.isConnected]);

  const activeChat = React.useMemo(() => {
    if (!chats || !chatJid) return null;
    return chats.find((c) => c.jid === chatJid) ?? null;
  }, [chats, chatJid]);

  // ─── Messages relay for ContactPanel ──────────────────────────────────
  const [conversationMessages, setConversationMessages] = React.useState<
    SabwaMessage[]
  >([]);
  // Reset when chat changes — stale messages from prior chat would mislead the panel.
  React.useEffect(() => {
    setConversationMessages([]);
  }, [chatJid]);

  // ─── Session-offline handling ─────────────────────────────────────────
  // No active session → bounce to the accounts hub where the user can
  // pick one (or connect a new number if none exist yet).
  React.useEffect(() => {
    // Wait until the session context has finished its initial pull.
    if (sessionCtx.loading) return;
    if (!session) {
      router.replace('/sabwa/overview');
    }
  }, [router, session, sessionCtx.loading]);

  const showOfflineBanner = status === 'logged_out' || status === 'error';

  // ─── Mobile vs desktop layout switches ────────────────────────────────
  const showConversationOnMobile = Boolean(chatJid);
  const showPanelOnDesktop = panelOpenLocal && activeChat;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--st-bg)]">
      <div className="shrink-0 border-b border-[var(--st-border)] px-4 py-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/dashboard">SabNode</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/sabwa">SabWa</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Inbox</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {showOfflineBanner ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-[var(--st-border)] bg-[var(--st-warn)]/10 px-3 py-2 text-xs">
          <StatusBadge status={status} size="sm" />
          <span className="text-[var(--st-warn)]">
            This session isn&apos;t connected. New messages will queue until you
            reconnect.
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            onClick={() => router.push('/sabwa/connect')}
          >
            Reconnect
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Left pane — chat list. */}
        <div
          className={cn(
            'min-h-0 w-full shrink-0 border-r md:w-[300px] md:max-w-[300px]',
            // On mobile: hide when a chat is selected.
            showConversationOnMobile ? 'hidden md:flex md:flex-col' : 'flex flex-col',
          )}
        >
          <LeftPane
            chats={chats ?? []}
            loading={chatsLoading}
            activeJid={chatJid}
            onSelectChat={selectChat}
          />
        </div>

        {/* Middle pane — conversation. */}
        <div
          className={cn(
            'min-h-0 min-w-0 flex-1',
            // On mobile: show only when a chat is selected.
            showConversationOnMobile ? 'flex' : 'hidden md:flex',
          )}
        >
          {sessionId && activeChat ? (
            <Conversation
              sessionId={sessionId}
              chat={activeChat}
              onBack={() => selectChat(null)}
              onTogglePanel={togglePanel}
              panelOpen={panelOpenLocal}
              onMessagesChange={setConversationMessages}
              className="min-w-0 flex-1"
            />
          ) : (
            <div className="hidden flex-1 items-center justify-center p-6 md:flex">
              <EmptyState
                icon={<MessageSquare />}
                title="Pick a chat"
                description="Choose a conversation from the list to start messaging."
              />
            </div>
          )}
        </div>

        {/* Right pane — contact panel (desktop only, toggleable). */}
        {showPanelOnDesktop && sessionId ? (
          <div className="hidden min-h-0 w-[320px] max-w-[320px] shrink-0 lg:flex">
            <ContactPanelShell
              sessionId={sessionId}
              chat={activeChat!}
              messages={conversationMessages}
              onClose={togglePanel}
            />
          </div>
        ) : null}
      </div>

      {/* Suppress the "PlugZap unused" warning — used for a future banner CTA. */}
      <span className="hidden" aria-hidden>
        <PlugZap />
      </span>
    </div>
  );
}

export default InboxShell;
