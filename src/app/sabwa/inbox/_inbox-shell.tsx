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

'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, PlugZap } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/app/sabwa/_components/empty-state';
import { StatusBadge } from '@/app/sabwa/_components/status-badge';
import { useChats } from '@/lib/sabwa/use-sabwa-data';
import { useSabwaSession } from '@/lib/sabwa/session-context';
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
  const { data: chats, loading: chatsLoading } = useChats(sessionId);

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
  // No session at all → redirect to Connect. We use a client-side push so
  // the user lands in the pairing flow without a layout flicker.
  React.useEffect(() => {
    // Wait until the session context has finished its initial pull.
    if (sessionCtx.loading) return;
    if (!session) {
      router.replace('/sabwa/connect');
    }
  }, [router, session, sessionCtx.loading]);

  const showOfflineBanner = status === 'logged_out' || status === 'error';

  // ─── Mobile vs desktop layout switches ────────────────────────────────
  const showConversationOnMobile = Boolean(chatJid);
  const showPanelOnDesktop = panelOpenLocal && activeChat;

  return (
    <div className="flex h-[calc(100vh-3.5rem)] w-full flex-col bg-background">
      {showOfflineBanner ? (
        <div className="flex shrink-0 items-center gap-3 border-b bg-amber-500/10 px-3 py-2 text-xs">
          <StatusBadge status={status} size="sm" />
          <span className="text-amber-700 dark:text-amber-300">
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
            <div className="hidden flex-1 items-center justify-center md:flex">
              <EmptyState
                icon={MessageSquare}
                title="Pick a chat"
                description="Select a conversation from the list to start messaging."
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
