"use client";

import {
  Badge,
  Breadcrumb,
  ZoruBreadcrumbItem,
  ZoruBreadcrumbLink,
  ZoruBreadcrumbList,
  ZoruBreadcrumbPage,
  ZoruBreadcrumbSeparator,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  EmptyState,
  Input,
  Skeleton,
  cn,
  ZoruCheckbox,
  zoruSonnerToast,
} from '@/components/zoruui';
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Search,
  Smartphone,
  Star,
  StarOff
} from "lucide-react";

/**
 * /sabwa/starred — Cross-chat starred-message view.
 *
 * Uses `listStarred(sessionId)` (via `useStarred` hook). Groups results by
 * chat; each group is a collapsible Card showing the chat name +
 * starred count + the first 3 starred messages as compact
 * `<MessageBubble>` previews. Each preview links back to the source
 * thread with a `"Jump to message"` deep-link:
 * `/sabwa/inbox?chat=<jid>&message=<id>`.
 *
 * A search input filters across every starred body. Empty state hints at
 * how to star messages from the Inbox.
 *
 * UI is rendered with ZoruUI primitives — no shadcn `/ui/*` imports here.
 */

import * as React from "react";
import Link from "next/link";

import { MessageBubble } from "@/app/sabwa/_components/message-bubble";
import { useStarred } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import { updateMessage, type SabwaStarredEntry } from "@/app/actions/sabwa.actions";

const PREVIEW_LIMIT = 3;

interface StarredGroup {
  chatJid: string;
  chatName: string;
  entries: SabwaStarredEntry[];
}

function groupByChat(items: SabwaStarredEntry[]): StarredGroup[] {
  const byJid = new Map<string, StarredGroup>();
  for (const entry of items) {
    let group = byJid.get(entry.chatJid);
    if (!group) {
      group = {
        chatJid: entry.chatJid,
        chatName: entry.chatName,
        entries: [],
      };
      byJid.set(entry.chatJid, group);
    }
    group.entries.push(entry);
  }
  // Sort entries by ts desc within each group, groups by their most-recent ts desc.
  const groups = Array.from(byJid.values());
  for (const g of groups) {
    g.entries.sort(
      (a, b) =>
        new Date(b.message.ts).getTime() - new Date(a.message.ts).getTime(),
    );
  }
  groups.sort((a, b) => {
    const aTs = a.entries[0]?.message.ts
      ? new Date(a.entries[0].message.ts).getTime()
      : 0;
    const bTs = b.entries[0]?.message.ts
      ? new Date(b.entries[0].message.ts).getTime()
      : 0;
    return bTs - aTs;
  });
  return groups;
}

export default function SabWaStarredPage() {
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? '';
  const { data: items, loading, error, refetch } = useStarred(sessionId);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [isBulkUnstarring, setIsBulkUnstarring] = React.useState(false);

  const handleSelect = React.useCallback((messageId: string, sel: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (sel) next.add(messageId);
      else next.delete(messageId);
      return next;
    });
  }, []);

  const handleUnstar = React.useCallback(async (chatJid: string, messageId: string) => {
    if (!sessionId) return;
    try {
      const res = await updateMessage(sessionId, chatJid, messageId, { op: 'star', starred: false });
      if (!res.ok) throw new Error(res.error);
      zoruSonnerToast.success('Message unstarred');
      
      setSelectedIds((prev) => {
        if (prev.has(messageId)) {
          const next = new Set(prev);
          next.delete(messageId);
          return next;
        }
        return prev;
      });
      
      await refetch();
    } catch (err: any) {
      zoruSonnerToast.error(err.message || 'Failed to unstar message');
    }
  }, [sessionId, refetch]);

  const handleBulkUnstar = React.useCallback(async () => {
    if (!sessionId || selectedIds.size === 0) return;
    setIsBulkUnstarring(true);
    let successCount = 0;
    try {
      const entriesToUnstar = items.filter(entry => selectedIds.has(entry.message.messageId));
      
      await Promise.all(entriesToUnstar.map(async (entry) => {
        const res = await updateMessage(sessionId, entry.chatJid, entry.message.messageId, { op: 'star', starred: false });
        if (res.ok) successCount++;
      }));
      
      if (successCount > 0) {
         zoruSonnerToast.success(`Unstarred ${successCount} message${successCount > 1 ? 's' : ''}`);
         setSelectedIds(new Set());
         await refetch();
      } else {
         zoruSonnerToast.error('Failed to unstar messages');
      }
    } catch (err: any) {
      zoruSonnerToast.error(err.message || 'Failed to bulk unstar');
    } finally {
      setIsBulkUnstarring(false);
    }
  }, [sessionId, selectedIds, items, refetch]);

  const groups = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((e) => {
          const body = (
            e.message.body ??
            e.message.caption ??
            ""
          ).toLowerCase();
          return (
            body.includes(q) ||
            e.chatName.toLowerCase().includes(q) ||
            e.message.fromJid.toLowerCase().includes(q)
          );
        })
      : items;
    return groupByChat(filtered);
  }, [items, query]);

  const totalCount = items.length;

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-6 pt-6 pb-10">
        <EmptyState
          icon={<Smartphone />}
          title="No active WhatsApp account"
          description="Pick a connected account on the SabWa overview to start using this page."
          action={
            <Link href="/sabwa/overview">
              <Button size="md">Open accounts</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <Breadcrumb>
        <ZoruBreadcrumbList>
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/dashboard">SabNode</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbLink href="/sabwa">SabWa</ZoruBreadcrumbLink>
          </ZoruBreadcrumbItem>
          <ZoruBreadcrumbSeparator />
          <ZoruBreadcrumbItem>
            <ZoruBreadcrumbPage>Starred</ZoruBreadcrumbPage>
          </ZoruBreadcrumbItem>
        </ZoruBreadcrumbList>
      </Breadcrumb>

      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--zoru-radius)] bg-zoru-surface text-zoru-ink"
        >
          <Star className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] tracking-[-0.015em] text-zoru-ink leading-[1.2]">
              Starred Messages
            </h1>
            <Badge variant="ghost" className="text-[10.5px]">
              {totalCount} total
            </Badge>
          </div>
          <p className="mt-1 text-[13px] text-zoru-ink-muted">
            Every message you’ve starred across chats, grouped by
            conversation.
          </p>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between max-w-2xl">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search starred messages"
            className="h-9 pl-8"
            aria-label="Search starred messages"
          />
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[13px] text-zoru-ink-muted">{selectedIds.size} selected</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setSelectedIds(new Set())}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-9"
              onClick={handleBulkUnstar}
              disabled={isBulkUnstarring}
            >
              <StarOff className="mr-2 h-4 w-4" />
              {isBulkUnstarring ? "Unstarring..." : "Unstar"}
            </Button>
          </div>
        )}
      </div>

      {error ? (
        <Card className="border-zoru-danger/50">
          <ZoruCardHeader>
            <ZoruCardTitle className="text-zoru-danger">
              Couldn’t load starred messages
            </ZoruCardTitle>
          </ZoruCardHeader>
          <ZoruCardContent className="space-y-3">
            <p className="text-[13px] text-zoru-ink-muted">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </ZoruCardContent>
        </Card>
      ) : loading ? (
        <StarredSkeleton />
      ) : groups.length === 0 ? (
        <StarredEmptyState filtered={Boolean(query)} />
      ) : (
        <ul className="flex flex-col gap-4">
          {groups.map((group) => {
            const isOpen = expanded[group.chatJid] ?? true;
            const visible = isOpen
              ? group.entries
              : group.entries.slice(0, PREVIEW_LIMIT);
            const hasMore = group.entries.length > PREVIEW_LIMIT;
            return (
              <li key={group.chatJid}>
                <Card>
                  <ZoruCardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      <ZoruCardTitle className="truncate text-base">
                        {group.chatName || group.chatJid}
                      </ZoruCardTitle>
                      <p className="mt-0.5 truncate text-[11.5px] text-zoru-ink-muted">
                        {group.entries.length} starred message
                        {group.entries.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    {hasMore ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        aria-expanded={isOpen}
                        onClick={() =>
                          setExpanded((prev) => ({
                            ...prev,
                            [group.chatJid]: !isOpen,
                          }))
                        }
                      >
                        {isOpen ? (
                          <>
                            <ChevronUp className="mr-1 h-4 w-4" /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="mr-1 h-4 w-4" /> Show all (
                            {group.entries.length})
                          </>
                        )}
                      </Button>
                    ) : null}
                  </ZoruCardHeader>
                  <ZoruCardContent className="space-y-4">
                    {visible.map((entry) => (
                      <StarredPreview
                        key={entry.message.messageId}
                        entry={entry}
                        selected={selectedIds.has(entry.message.messageId)}
                        onSelect={(sel) => handleSelect(entry.message.messageId, sel)}
                        onUnstar={() => handleUnstar(entry.chatJid, entry.message.messageId)}
                      />
                    ))}
                  </ZoruCardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StarredPreview({
  entry,
  selected,
  onSelect,
  onUnstar
}: {
  entry: SabwaStarredEntry;
  selected?: boolean;
  onSelect?: (sel: boolean) => void;
  onUnstar?: () => void;
}) {
  const { message, chatJid } = entry;
  const jumpHref = `/sabwa/inbox?chat=${encodeURIComponent(
    chatJid,
  )}&message=${encodeURIComponent(message.messageId)}`;

  return (
    <div className="flex items-start gap-3 group">
      {onSelect && (
        <div className="pt-2 shrink-0">
          <ZoruCheckbox
            checked={selected}
            onCheckedChange={(checked) => onSelect(checked === true)}
            aria-label={`Select message ${message.messageId}`}
          />
        </div>
      )}
      <div className="flex-1 space-y-1.5 min-w-0">
        <div
          className={cn(
            "max-w-2xl",
            message.fromMe ? "ml-auto" : "mr-auto",
          )}
        >
          <MessageBubble message={message} fromMe={message.fromMe} />
        </div>
        <div className="flex justify-end items-center gap-1">
          {onUnstar && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-zoru-ink-muted hover:text-zoru-danger hover:bg-zoru-danger/10"
              onClick={onUnstar}
            >
              <StarOff className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-[12px] font-medium">Unstar</span>
            </Button>
          )}
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-zoru-ink-muted hover:text-zoru-ink hover:bg-zoru-surface-hover">
            <Link href={jumpHref}>
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              <span className="text-[12px] font-medium">Jump to message</span>
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function StarredSkeleton() {
  return (
    <ul className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <li key={i}>
          <Card>
            <ZoruCardHeader>
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-1 h-3 w-1/4" />
            </ZoruCardHeader>
            <ZoruCardContent className="space-y-3">
              {Array.from({ length: 2 }).map((__, j) => (
                <Skeleton key={j} className="h-12 w-full max-w-md" />
              ))}
            </ZoruCardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function StarredEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <ZoruCardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-zoru-surface text-zoru-ink"
        >
          <Star className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold text-zoru-ink">
          {filtered ? "No matches" : "No starred messages yet"}
        </h2>
        <p className="max-w-sm text-[13px] text-zoru-ink-muted">
          {filtered
            ? "Try a different search term."
            : "Star messages in the Inbox by right-clicking them. They’ll all show up here, neatly grouped by chat."}
        </p>
      </ZoruCardContent>
    </Card>
  );
}
