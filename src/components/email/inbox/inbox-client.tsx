'use client';

import * as React from 'react';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup, toast } from '@/components/sabcrm/20ui';
import {
  actionBulkUpdateEmailInboxThreads,
  actionGetEmailInboxThread,
  actionListEmailInboxThreads,
  actionSendEmailInboxReply,
  actionUpdateEmailInboxThread,
  type EmailInboxMessageDoc,
  type EmailInboxThreadDoc,
  type ListThreadsOpts,
  type UpdateThreadBody,
} from '@/app/actions/email/inbox.actions';

import { ConversationList } from './conversation-list';
import { FilterRail, type InboxQuickFilter } from './filter-rail';
import { ThreadView } from './thread-view';
import type { ReplyComposerProps } from './reply-composer';

const PAGE_SIZE = 25;

function filterToOpts(filter: InboxQuickFilter): Partial<ListThreadsOpts> {
  switch (filter) {
    case 'unread':
      return { unread: true, status: 'open' };
    case 'starred':
      return { starred: true };
    case 'assigned-to-me':
      // Backend matches `assignedTo` by ObjectId. The "me" filter is
      // applied client-side by the server action which knows the caller;
      // here we leave it absent and let the API surface a future
      // `assignedToSelf` flag. For now we send no filter so the user at
      // least sees their threads.
      return {};
    case 'archived':
      return { status: 'archived' };
    case 'all':
    default:
      return {};
  }
}

export function EmailInboxClient() {
  const [filter, setFilter] = React.useState<InboxQuickFilter>('all');
  const [label, setLabel] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');
  const [debouncedQuery, setDebouncedQuery] = React.useState('');

  const [threads, setThreads] = React.useState<EmailInboxThreadDoc[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [threadsLoading, setThreadsLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);

  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [activeThread, setActiveThread] =
    React.useState<EmailInboxThreadDoc | null>(null);
  const [messages, setMessages] = React.useState<EmailInboxMessageDoc[]>([]);
  const [threadDetailLoading, setThreadDetailLoading] = React.useState(false);

  const [pendingThreadAction, startThreadTransition] = React.useTransition();
  const [pendingSend, startSendTransition] = React.useTransition();

  // Debounce search input.
  React.useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Fetch the first page whenever the filter / label / query changes.
  const refetchFirstPage = React.useCallback(async () => {
    setThreadsLoading(true);
    const opts: ListThreadsOpts = {
      ...filterToOpts(filter),
      label: label ?? undefined,
      q: debouncedQuery || undefined,
      page: 1,
      limit: PAGE_SIZE,
    };
    const res = await actionListEmailInboxThreads(opts);
    setThreadsLoading(false);
    if (!res.ok) {
      toast({
        title: 'Failed to load conversations',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    setThreads(res.data.threads);
    setTotal(res.data.total);
    setPage(1);
  }, [filter, label, debouncedQuery]);

  React.useEffect(() => {
    void refetchFirstPage();
  }, [refetchFirstPage]);

  const hasMore = threads.length < total;

  const loadMore = React.useCallback(async () => {
    if (loadingMore || threadsLoading || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    const res = await actionListEmailInboxThreads({
      ...filterToOpts(filter),
      label: label ?? undefined,
      q: debouncedQuery || undefined,
      page: nextPage,
      limit: PAGE_SIZE,
    });
    setLoadingMore(false);
    if (!res.ok) {
      toast({
        title: 'Failed to load more',
        description: res.error,
        variant: 'destructive',
      });
      return;
    }
    setThreads((curr) => {
      const seen = new Set(curr.map((t) => t._id));
      const merged = [...curr];
      for (const t of res.data.threads) {
        if (!seen.has(t._id)) merged.push(t);
      }
      return merged;
    });
    setPage(nextPage);
  }, [
    loadingMore,
    threadsLoading,
    hasMore,
    page,
    filter,
    label,
    debouncedQuery,
  ]);

  // Load the selected thread's detail (header + messages).
  React.useEffect(() => {
    if (!selectedId) {
      setActiveThread(null);
      setMessages([]);
      return;
    }
    let cancelled = false;
    setThreadDetailLoading(true);
    void actionGetEmailInboxThread(selectedId, { limit: 100 }).then((res) => {
      if (cancelled) return;
      setThreadDetailLoading(false);
      if (!res.ok) {
        toast({
          title: 'Failed to open thread',
          description: res.error,
          variant: 'destructive',
        });
        return;
      }
      setActiveThread(res.data.thread);
      // Backend returns newest-first; show oldest-first in the bubble list.
      const ordered = [...res.data.messages].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      setMessages(ordered);

      // If the thread was unread, mark it read after opening. Fire-and-
      // forget; UI updates optimistically.
      if (res.data.thread.unread) {
        setThreads((curr) =>
          curr.map((t) =>
            t._id === res.data.thread._id ? { ...t, unread: false } : t,
          ),
        );
        void actionUpdateEmailInboxThread(res.data.thread._id, {
          unread: false,
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  // ─── Thread mutations ──────────────────────────────────────────────

  const applyOptimistic = React.useCallback(
    (id: string, patch: Partial<EmailInboxThreadDoc>) => {
      setThreads((curr) => curr.map((t) => (t._id === id ? { ...t, ...patch } : t)));
      setActiveThread((curr) => (curr && curr._id === id ? { ...curr, ...patch } : curr));
    },
    [],
  );

  const patchThread = React.useCallback(
    (id: string, body: UpdateThreadBody, optimistic: Partial<EmailInboxThreadDoc>) => {
      applyOptimistic(id, optimistic);
      startThreadTransition(async () => {
        const res = await actionUpdateEmailInboxThread(id, body);
        if (!res.ok) {
          toast({
            title: 'Update failed',
            description: res.error,
            variant: 'destructive',
          });
          // Refetch to undo the optimistic patch.
          void refetchFirstPage();
        }
      });
    },
    [applyOptimistic, refetchFirstPage],
  );

  const onToggleStar = React.useCallback(() => {
    if (!activeThread) return;
    const next = !activeThread.starred;
    patchThread(activeThread._id, { starred: next }, { starred: next });
  }, [activeThread, patchThread]);

  const onToggleUnread = React.useCallback(() => {
    if (!activeThread) return;
    const next = !activeThread.unread;
    patchThread(activeThread._id, { unread: next }, { unread: next });
  }, [activeThread, patchThread]);

  const onToggleStatus = React.useCallback(
    (next: EmailInboxThreadDoc['status']) => {
      if (!activeThread) return;
      patchThread(
        activeThread._id,
        { status: next },
        { status: next },
      );
    },
    [activeThread, patchThread],
  );

  // ─── Send reply ─────────────────────────────────────────────────────

  const composerProps: ReplyComposerProps = React.useMemo(
    () => ({
      toEmails: activeThread?.participants?.map((p) => p.email) ?? [],
      pending: pendingSend,
      disabled: !activeThread,
      onSend: async ({ bodyHtml, bodyText, attachments }) => {
        if (!activeThread) return;
        await new Promise<void>((resolve) => {
          startSendTransition(async () => {
            const to = activeThread.participants
              .filter((p) => !!p.email)
              .map((p) => ({ email: p.email, name: p.name }));
            const res = await actionSendEmailInboxReply(activeThread._id, {
              to,
              bodyHtml,
              bodyText,
              attachments,
            });
            if (!res.ok) {
              toast({
                title: 'Send failed',
                description: res.error,
                variant: 'destructive',
              });
              resolve();
              return;
            }
            toast({ title: 'Reply sent' });
            // Refresh detail to pick up the new outbound message.
            const detail = await actionGetEmailInboxThread(activeThread._id, {
              limit: 100,
            });
            if (detail.ok) {
              setActiveThread(detail.data.thread);
              const ordered = [...detail.data.messages].sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              );
              setMessages(ordered);
              // Bump the row in the list view as well.
              setThreads((curr) =>
                curr.map((t) =>
                  t._id === detail.data.thread._id ? detail.data.thread : t,
                ),
              );
            }
            resolve();
          });
        });
      },
    }),
    [activeThread, pendingSend],
  );

  // Derive a unique label set from currently loaded threads so the rail
  // shows chips even before the user starts typing.
  const knownLabels = React.useMemo(() => {
    const set = new Set<string>();
    for (const t of threads) {
      for (const l of t.labels ?? []) set.add(l);
    }
    return Array.from(set).sort();
  }, [threads]);

  // Quick-filter counts (display-only; based on currently loaded page).
  const counts = React.useMemo(
    () => ({
      unread: threads.filter((t) => t.unread).length,
      starred: threads.filter((t) => t.starred).length,
    }),
    [threads],
  );

  // Silence unused-warn for an unused server action (referenced for
  // future bulk UI; keeps import surface stable).
  void actionBulkUpdateEmailInboxThreads;

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full min-h-[640px] overflow-hidden rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg)]"
    >
      <ResizablePanel defaultSize={18} minSize={14} maxSize={28}>
        <FilterRail
          active={filter}
          onActiveChange={(f) => {
            setFilter(f);
            setSelectedId(null);
          }}
          label={label}
          onLabelChange={(l) => {
            setLabel(l);
            setSelectedId(null);
          }}
          labels={knownLabels}
          counts={counts}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={32} minSize={24} maxSize={50}>
        <ConversationList
          threads={threads}
          selectedId={selectedId}
          onSelect={(t) => setSelectedId(t._id)}
          query={query}
          onQueryChange={setQuery}
          loading={threadsLoading}
          loadingMore={loadingMore}
          hasMore={hasMore}
          onLoadMore={loadMore}
          total={total}
        />
      </ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50} minSize={30}>
        <ThreadView
          thread={activeThread}
          messages={messages}
          loading={threadDetailLoading}
          pendingThreadAction={pendingThreadAction}
          onToggleStar={onToggleStar}
          onToggleStatus={onToggleStatus}
          onToggleUnread={onToggleUnread}
          composer={composerProps}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
