'use client';

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  EmptyState,
  Skeleton,
  cn,
} from '@/components/sabcrm/20ui/compat';
import {
  useCallback,
  useEffect,
  useState,
  useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertCircle,
  MessageCircle,
  RefreshCw,
  User,
  } from 'lucide-react';

import {
  getInstagramConversationMessages,
  getInstagramConversations,
  } from '@/app/actions/instagram.actions';
import { useProject } from '@/context/project-context';

/**
 * /dashboard/instagram/messages — Instagram DM inbox.
 *
 * Two-pane layout: conversations list on the left, selected thread
 * messages on the right. Backed by the IG Messaging Platform conversations
 * + thread endpoints, exposed via two server actions in
 * `instagram.actions.ts`.
 */

import * as React from 'react';

interface IgParticipant {
  id?: string;
  username?: string;
  name?: string;
}

interface IgConversation {
  id: string;
  updated_time?: string;
  snippet?: string;
  unread_count?: number;
  participants?: { data?: IgParticipant[] };
}

interface IgMessage {
  id: string;
  from?: IgParticipant;
  to?: { data?: IgParticipant[] };
  message?: string;
  created_time?: string;
}

function safeRelative(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return formatDistanceToNow(d, { addSuffix: true });
}

function pickCounterparty(c: IgConversation): IgParticipant | undefined {
  const list = c.participants?.data ?? [];
  // The IG account itself is always one participant; pick the first that
  // isn't us. Without knowing our id at runtime, just pick the first
  // participant — Meta orders the counterparty first in most responses.
  return list[0];
}

export default function InstagramMessagesPage(): React.JSX.Element {
  const { activeProject } = useProject();
  const projectId = activeProject?._id?.toString() ?? '';

  const [conversations, setConversations] = useState<IgConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<IgMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);

  const [loading, startLoading] = useTransition();
  const [threadLoading, startThreadLoading] = useTransition();

  const loadConversations = useCallback(() => {
    if (!projectId) return;
    startLoading(async () => {
      const res = await getInstagramConversations(projectId);
      if (res.error) {
        setError(res.error);
        setConversations([]);
        return;
      }
      setError(null);
      const list = (res.conversations as IgConversation[]) ?? [];
      setConversations(list);
      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    });
    // selectedId intentionally excluded — we only auto-select on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (!projectId || !selectedId) {
      setMessages([]);
      return;
    }
    startThreadLoading(async () => {
      const res = await getInstagramConversationMessages(projectId, selectedId);
      if (res.error) {
        setThreadError(res.error);
        setMessages([]);
        return;
      }
      setThreadError(null);
      setMessages(((res.messages as IgMessage[]) ?? []).slice().reverse());
    });
  }, [projectId, selectedId]);

  if (!projectId) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<MessageCircle />}
          title="No project selected"
          description="Pick a project with a connected Instagram account to view its DMs."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-6 pt-6 pb-10">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard/instagram">Instagram</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Messages</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl text-zoru-ink">Instagram messages</h1>
          <p className="mt-1 text-sm text-zoru-ink-muted">
            View DM conversations for the connected Instagram Business account.
          </p>
        </div>
        <Button variant="ghost" onClick={loadConversations} disabled={loading}>
          <RefreshCw className={loading ? 'mr-2 h-4 w-4 animate-spin' : 'mr-2 h-4 w-4'} />
          Refresh
        </Button>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>Could not load conversations</ZoruAlertTitle>
          <ZoruAlertDescription>{error}</ZoruAlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[320px_1fr]">
        {/* Conversations pane */}
        <Card className="flex h-[640px] flex-col p-0">
          <div className="border-b border-zoru-line p-3 text-sm text-zoru-ink">
            Conversations
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && conversations.length === 0 ? (
              <div className="flex flex-col gap-2 p-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={<MessageCircle />}
                  title="No conversations"
                  description="Once people DM your IG account, threads will appear here."
                />
              </div>
            ) : (
              <ul className="flex flex-col">
                {conversations.map((c) => {
                  const cp = pickCounterparty(c);
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(c.id)}
                        className={cn(
                          'flex w-full items-start gap-3 border-b border-zoru-line p-3 text-left transition-colors',
                          active
                            ? 'bg-zoru-surface'
                            : 'hover:bg-zoru-surface',
                        )}
                      >
                        <Avatar className="h-9 w-9 shrink-0">
                          <ZoruAvatarFallback>
                            <User className="h-4 w-4" />
                          </ZoruAvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate text-sm text-zoru-ink">
                              {cp?.username ?? cp?.name ?? cp?.id ?? '(unknown)'}
                            </p>
                            {typeof c.unread_count === 'number' && c.unread_count > 0 ? (
                              <Badge variant="info">{c.unread_count}</Badge>
                            ) : null}
                          </div>
                          {c.snippet ? (
                            <p className="mt-0.5 line-clamp-1 text-xs text-zoru-ink-muted">
                              {c.snippet}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-[10.5px] text-zoru-ink-subtle">
                            {safeRelative(c.updated_time)}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Thread pane */}
        <Card className="flex h-[640px] flex-col p-0">
          <div className="border-b border-zoru-line p-3 text-sm text-zoru-ink">
            Thread
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {!selectedId ? (
              <EmptyState
                icon={<MessageCircle />}
                title="Select a conversation"
                description="Pick a thread on the left to read its messages."
              />
            ) : threadError ? (
              <Alert variant="destructive">
                <AlertCircle />
                <ZoruAlertTitle>Could not load messages</ZoruAlertTitle>
                <ZoruAlertDescription>{threadError}</ZoruAlertDescription>
              </Alert>
            ) : threadLoading && messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-12 w-2/3" />
                <Skeleton className="ml-auto h-12 w-1/2" />
                <Skeleton className="h-12 w-3/4" />
              </div>
            ) : messages.length === 0 ? (
              <EmptyState
                icon={<MessageCircle />}
                title="No messages"
                description="This thread has no readable messages."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {messages.map((m) => (
                  <li key={m.id} className="flex flex-col">
                    <div className="flex items-center gap-2 text-[11px] text-zoru-ink-muted">
                      <span>{m.from?.username ?? m.from?.name ?? m.from?.id ?? '(unknown)'}</span>
                      <span>·</span>
                      <span>{safeRelative(m.created_time)}</span>
                    </div>
                    <div className="mt-1 max-w-prose rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface p-2 text-sm text-zoru-ink">
                      {m.message || <span className="italic text-zoru-ink-muted">(no text)</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
