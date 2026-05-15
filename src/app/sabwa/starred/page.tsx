"use client";

/**
 * /sabwa/starred — Cross-chat starred-message view.
 *
 * Uses `listStarred(sessionId)` (via `useStarred` hook). Groups results by
 * chat; each group is a collapsible Card showing the chat name + starred
 * count + the first 3 starred messages as compact `<MessageBubble>`
 * previews. Each preview links back to the source thread with a
 * `"Jump to message"` deep-link: `/sabwa/inbox?chat=<jid>&message=<id>`.
 *
 * A search input filters across every starred body. Empty state hints at
 * how to star messages from the Inbox.
 */

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, ExternalLink, Search, Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

import { cn } from "@/lib/utils";
import { MessageBubble } from "@/app/sabwa/_components/message-bubble";
import { useStarred } from "@/lib/sabwa/use-sabwa-data";
import type { SabwaStarredEntry } from "@/app/actions/sabwa.actions";

const PREVIEW_LIMIT = 3;

// TODO: replace with real active-session id wired from SessionSwitcher.
const PLACEHOLDER_SESSION_ID = "stub-primary";

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
  const sessionId = PLACEHOLDER_SESSION_ID;
  const { data: items, loading, error, refetch } = useStarred(sessionId);
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

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

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <header className="flex items-start gap-3">
        <div
          aria-hidden
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"
        >
          <Star className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Starred Messages
            </h1>
            <Badge variant="secondary" className="text-xs">
              {totalCount} total
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Every message you’ve starred across chats, grouped by
            conversation.
          </p>
        </div>
      </header>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search starred messages"
          className="h-9 pl-8"
          aria-label="Search starred messages"
        />
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive">
              Couldn’t load starred messages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button type="button" size="sm" variant="outline" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
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
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">
                        {group.chatName || group.chatJid}
                      </CardTitle>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
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
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {visible.map((entry) => (
                      <StarredPreview key={entry.message.messageId} entry={entry} />
                    ))}
                  </CardContent>
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

function StarredPreview({ entry }: { entry: SabwaStarredEntry }) {
  const { message, chatJid } = entry;
  const jumpHref = `/sabwa/inbox?chat=${encodeURIComponent(
    chatJid,
  )}&message=${encodeURIComponent(message.messageId)}`;

  return (
    <div className="space-y-1.5">
      <div
        className={cn(
          "max-w-2xl",
          message.fromMe ? "ml-auto" : "mr-auto",
        )}
      >
        <MessageBubble message={message} fromMe={message.fromMe} />
      </div>
      <div className="flex justify-end">
        <Button asChild variant="link" size="sm" className="h-6 px-1">
          <Link href={jumpHref}>
            <ExternalLink className="mr-1 h-3 w-3" />
            Jump to message
          </Link>
        </Button>
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
            <CardHeader>
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="mt-1 h-3 w-1/4" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 2 }).map((__, j) => (
                <Skeleton key={j} className="h-12 w-full max-w-md" />
              ))}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function StarredEmptyState({ filtered }: { filtered: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
        >
          <Star className="h-6 w-6" />
        </div>
        <h2 className="text-base font-semibold">
          {filtered ? "No matches" : "No starred messages yet"}
        </h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {filtered
            ? "Try a different search term."
            : "Star messages in the Inbox by right-clicking them. They’ll all show up here, neatly grouped by chat."}
        </p>
      </CardContent>
    </Card>
  );
}
