"use client";

import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  Button,
  Card,
  CardBody,
  Checkbox,
  EmptyState,
  IconButton,
  Input,
  PageDescription,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  useToast,
} from "@/components/sabcrm/20ui";
import {
  CheckCheck,
  CheckSquare,
  EyeOff,
  Archive,
  BellOff,
  MessageSquare,
  Menu as MenuIcon,
  Search,
  Smartphone,
  Tag as TagIcon,
  X,
} from "lucide-react";

/**
 * /sabwa/chats - Individual chats view with bulk-action selection mode.
 *
 * Re-uses the inbox's `<ChatListRow>` and `useChats(sessionId, { type:
 * 'individual' })` from `@/lib/sabwa/use-sabwa-data`. Layered on top:
 *
 *  - Toolbar: search, filter (All / Unread / Read), sort (Recent / Name),
 *    bulk-select toggle.
 *  - Bulk-mode: each row prefixed with a Checkbox; sticky footer with
 *    Mark read, Mark unread, Archive, Mute (popover), Add label
 *    (popover).
 *  - Actions loop over selected jids and call `updateChatState`.
 *  - Tablet/mobile: toolbar collapses into a hamburger menu.
 *
 * The page does not re-render the SabWa rail, that comes from the
 * parent layout.
 */

import * as React from "react";
import Link from "next/link";

import { ChatListRow } from "@/app/sabwa/_components/chat-list-row";
import { useChats, useLabels } from "@/lib/sabwa/use-sabwa-data";
import { useSabwaSession } from "@/lib/sabwa/session-context";
import { updateChatState } from "@/app/actions/sabwa.actions";
import { useResolveJid } from "@/lib/sabwa/format-jid";
import type { SabwaChat } from "@/lib/sabwa/types";

type FilterMode = "all" | "unread" | "read";
type SortMode = "recent" | "name";

const MUTE_DURATIONS: { label: string; seconds: number | null }[] = [
  { label: "8 hours", seconds: 8 * 60 * 60 },
  { label: "1 week", seconds: 7 * 24 * 60 * 60 },
  { label: "Always", seconds: null },
];

function sortChats(chats: SabwaChat[], mode: SortMode): SabwaChat[] {
  const next = [...chats];
  if (mode === "name") {
    next.sort((a, b) =>
      (a.name ?? a.jid).localeCompare(b.name ?? b.jid, undefined, {
        sensitivity: "base",
      }),
    );
  } else {
    next.sort((a, b) => {
      const ta = a.lastMessage?.ts ? new Date(a.lastMessage.ts).getTime() : 0;
      const tb = b.lastMessage?.ts ? new Date(b.lastMessage.ts).getTime() : 0;
      return tb - ta;
    });
  }
  return next;
}

export default function SabWaChatsPage() {
  const { toast } = useToast();
  const { current: activeSession } = useSabwaSession();
  const sessionId = activeSession?.id ?? null;
  const resolve = useResolveJid(sessionId);

  const { data: chats, loading, error, refetch } = useChats(sessionId, {
    type: "individual",
  });
  const { data: labels } = useLabels(sessionId);

  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<FilterMode>("all");
  const [sort, setSort] = React.useState<SortMode>("recent");
  const [bulkMode, setBulkMode] = React.useState(false);
  const [selectedJids, setSelectedJids] = React.useState<Set<string>>(
    () => new Set(),
  );
  const [working, setWorking] = React.useState(false);
  const [mobileToolbarOpen, setMobileToolbarOpen] = React.useState(false);

  const filtered = React.useMemo<SabwaChat[]>(() => {
    const list = chats ?? [];
    const q = query.trim().toLowerCase();
    const passText = (c: SabwaChat) => {
      if (!q) return true;
      return (
        (c.name ?? "").toLowerCase().includes(q) ||
        c.jid.toLowerCase().includes(q) ||
        (c.lastMessage?.body ?? "").toLowerCase().includes(q)
      );
    };
    const passFilter = (c: SabwaChat) => {
      if (filter === "all") return true;
      const unread = (c.unreadCount ?? 0) > 0;
      return filter === "unread" ? unread : !unread;
    };
    return sortChats(list.filter((c) => passText(c) && passFilter(c)), sort);
  }, [chats, query, filter, sort]);

  const toggleSelect = React.useCallback((jid: string) => {
    setSelectedJids((prev) => {
      const next = new Set(prev);
      if (next.has(jid)) next.delete(jid);
      else next.add(jid);
      return next;
    });
  }, []);

  const clearSelection = React.useCallback(() => {
    setSelectedJids(new Set());
  }, []);

  const exitBulk = React.useCallback(() => {
    setBulkMode(false);
    clearSelection();
  }, [clearSelection]);

  const runBulk = React.useCallback(
    async (
      label: string,
      patch: Parameters<typeof updateChatState>[2],
    ) => {
      if (selectedJids.size === 0 || !sessionId) return;
      setWorking(true);
      const jids = Array.from(selectedJids);
      let ok = 0;
      let failed = 0;
      try {
        await Promise.all(
          jids.map(async (jid) => {
            try {
              const res = await updateChatState(sessionId, jid, patch);
              if (res.ok) ok += 1;
              else failed += 1;
            } catch {
              failed += 1;
            }
          }),
        );
        if (failed === 0) {
          toast({
            title: label,
            description: `Applied to ${ok} chat${ok === 1 ? "" : "s"}.`,
            tone: "success",
          });
        } else if (ok === 0) {
          toast({
            title: `Failed to ${label.toLowerCase()}`,
            description: `Couldn't reach the WhatsApp engine. 0 of ${jids.length} applied.`,
            tone: "danger",
          });
        } else {
          toast({
            title: `${label} (partial)`,
            description: `${ok} succeeded, ${failed} failed.`,
            tone: "warning",
          });
        }
      } finally {
        setWorking(false);
        clearSelection();
        refetch();
      }
    },
    [selectedJids, sessionId, toast, clearSelection, refetch],
  );

  const selectionCount = selectedJids.size;
  const allVisibleSelected =
    filtered.length > 0 && filtered.every((c) => selectedJids.has(c.jid));

  const toggleSelectAllVisible = React.useCallback(() => {
    setSelectedJids((prev) => {
      if (allVisibleSelected) {
        const next = new Set(prev);
        for (const c of filtered) next.delete(c.jid);
        return next;
      }
      const next = new Set(prev);
      for (const c of filtered) next.add(c.jid);
      return next;
    });
  }, [filtered, allVisibleSelected]);

  if (!sessionId) {
    return (
      <div className="mx-auto w-full max-w-[1180px] px-4 pt-6 pb-10 sm:px-6">
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
              <BreadcrumbPage>Chats</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <div className="mt-6">
          <EmptyState
            icon={Smartphone}
            title="No active WhatsApp account"
            description="Pick a connected account on the SabWa overview to start using this page."
            action={
              <Link href="/sabwa/overview">
                <Button variant="primary" size="md">
                  Open accounts
                </Button>
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-[60vh] flex-col bg-[var(--st-bg)]">
      {/* Breadcrumb */}
      <div className="shrink-0 border-b border-[var(--st-border)] px-4 py-2 md:px-6">
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
              <BreadcrumbPage>Chats</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      {/* Header */}
      <PageHeader className="px-4 md:px-6">
        <PageHeaderHeading className="flex flex-row items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--st-radius)] bg-[var(--st-bg-secondary)] text-[var(--st-text)]"
          >
            <MessageSquare className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <PageTitle>Chats</PageTitle>
              <Badge tone="neutral">
                {filtered.length} of {chats?.length ?? 0}
              </Badge>
            </div>
            <PageDescription>
              One-on-one conversations. Toggle bulk-select for sweeping actions.
            </PageDescription>
          </div>
        </PageHeaderHeading>
      </PageHeader>

      {/* Desktop toolbar */}
      <div className="hidden items-center gap-2 border-b border-[var(--st-border)] px-4 py-2 md:flex md:px-6">
        <Toolbar
          query={query}
          setQuery={setQuery}
          filter={filter}
          setFilter={setFilter}
          sort={sort}
          setSort={setSort}
          bulkMode={bulkMode}
          setBulkMode={setBulkMode}
          onExitBulk={exitBulk}
        />
      </div>

      {/* Mobile toolbar: hamburger collapses controls */}
      <div className="flex items-center gap-2 border-b border-[var(--st-border)] px-4 py-2 md:hidden">
        <IconButton
          label="Toggle filters"
          icon={MenuIcon}
          variant="outline"
          aria-expanded={mobileToolbarOpen}
          onClick={() => setMobileToolbarOpen((v) => !v)}
        />
        <div className="flex-1">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            inputSize="sm"
            iconLeft={Search}
            aria-label="Search chats"
          />
        </div>
      </div>
      {mobileToolbarOpen ? (
        <div className="flex flex-col gap-2 border-b border-[var(--st-border)] px-4 py-2 md:hidden">
          {/* Segmented filter, replaces Tabs UI */}
          <div
            role="group"
            aria-label="Filter chats"
            className="grid w-full grid-cols-3 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1"
          >
            {(["all", "unread", "read"] as const).map((value) => (
              <Button
                key={value}
                variant={filter === value ? "primary" : "ghost"}
                size="sm"
                className="rounded-[calc(var(--st-radius)-2px)] capitalize"
                onClick={() => setFilter(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
                <SelectTrigger aria-label="Sort chats">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recent">Recent</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={bulkMode ? "primary" : "outline"}
              size="sm"
              iconLeft={CheckSquare}
              onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
            >
              {bulkMode ? "Exit" : "Bulk"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Bulk header (visible when bulk mode is on) */}
      {bulkMode ? (
        <div className="flex items-center gap-2 border-b border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-4 py-2 md:px-6">
          <Checkbox
            checked={allVisibleSelected}
            onChange={toggleSelectAllVisible}
            aria-label="Select all visible chats"
            label={
              <span className="text-xs text-[var(--st-text-secondary)]">
                {selectionCount > 0
                  ? `${selectionCount} selected`
                  : "Select all visible"}
              </span>
            }
          />
          {selectionCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              iconLeft={X}
              onClick={clearSelection}
              className="ml-auto"
            >
              Clear
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* List */}
      <main className="flex-1 overflow-auto px-2 py-2 md:px-4">
        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <ErrorState message={error} onRetry={refetch} />
        ) : filtered.length === 0 ? (
          <ChatsEmptyState query={query} filter={filter} />
        ) : (
          <ul className="flex flex-col gap-0.5" aria-label="Chats">
            {filtered.map((chat) => {
              const checked = selectedJids.has(chat.jid);
              const displayName = chat.name?.trim() || resolve(chat.jid);
              return (
                <li key={chat.jid} className="flex items-center gap-2">
                  {bulkMode ? (
                    <Checkbox
                      checked={checked}
                      onChange={() => toggleSelect(chat.jid)}
                      aria-label={`Select ${displayName}`}
                      className="ml-2"
                    />
                  ) : null}
                  <div className="flex-1">
                    <ChatListRow
                      chat={chat}
                      selected={checked}
                      onClick={
                        bulkMode ? () => toggleSelect(chat.jid) : undefined
                      }
                      resolve={resolve}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* Sticky bulk footer */}
      {bulkMode && selectionCount > 0 ? (
        <BulkFooter
          working={working}
          onMarkRead={() => runBulk("Marked read", { read: true })}
          onMarkUnread={() => runBulk("Marked unread", { read: false })}
          onArchive={() => runBulk("Archived", { archived: true })}
          onMute={(seconds) =>
            runBulk("Muted", {
              muted: seconds !== 0,
              muteForSec: seconds === 0 ? null : seconds,
            })
          }
          labels={labels}
          onAddLabel={(labelId) => runBulk("Labelled", { labels: [labelId] })}
          selectionCount={selectionCount}
        />
      ) : null}
    </div>
  );
}

// Sub-components

interface ToolbarProps {
  query: string;
  setQuery: (v: string) => void;
  filter: FilterMode;
  setFilter: (v: FilterMode) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  bulkMode: boolean;
  setBulkMode: (v: boolean) => void;
  onExitBulk: () => void;
}

function Toolbar({
  query,
  setQuery,
  filter,
  setFilter,
  sort,
  setSort,
  bulkMode,
  setBulkMode,
  onExitBulk,
}: ToolbarProps) {
  return (
    <>
      <div className="relative max-w-md flex-1">
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chats"
          inputSize="sm"
          iconLeft={Search}
          aria-label="Search chats"
        />
      </div>

      {/* Segmented filter, replaces Tabs UI per the no-tab rule */}
      <div
        role="group"
        aria-label="Filter chats"
        className="hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg)] p-1 lg:inline-flex"
      >
        {(["all", "unread", "read"] as const).map((value) => (
          <Button
            key={value}
            variant={filter === value ? "primary" : "ghost"}
            size="sm"
            className="rounded-[calc(var(--st-radius)-2px)] capitalize"
            onClick={() => setFilter(value)}
          >
            {value}
          </Button>
        ))}
      </div>

      <div className="w-32">
        <Select value={sort} onValueChange={(v) => setSort(v as SortMode)}>
          <SelectTrigger aria-label="Sort chats">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Recent</SelectItem>
            <SelectItem value="name">Name</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant={bulkMode ? "primary" : "outline"}
        size="sm"
        iconLeft={CheckSquare}
        onClick={() => (bulkMode ? onExitBulk() : setBulkMode(true))}
      >
        {bulkMode ? "Exit bulk" : "Bulk select"}
      </Button>
    </>
  );
}

interface BulkFooterProps {
  working: boolean;
  selectionCount: number;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onArchive: () => void;
  onMute: (seconds: number) => void;
  onAddLabel: (labelId: string) => void;
  labels: { id: string; name: string; color: string }[];
}

function BulkFooter({
  working,
  selectionCount,
  onMarkRead,
  onMarkUnread,
  onArchive,
  onMute,
  onAddLabel,
  labels,
}: BulkFooterProps) {
  return (
    <footer className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border-t border-[var(--st-border)] bg-[var(--st-bg)] px-4 py-2 md:px-6">
      <span className="text-xs font-medium text-[var(--st-text-secondary)]">
        {selectionCount} selected
      </span>
      <Button
        size="sm"
        variant="outline"
        iconLeft={CheckCheck}
        onClick={onMarkRead}
        disabled={working}
      >
        Mark read
      </Button>
      <Button
        size="sm"
        variant="outline"
        iconLeft={EyeOff}
        onClick={onMarkUnread}
        disabled={working}
      >
        Mark unread
      </Button>
      <Button
        size="sm"
        variant="outline"
        iconLeft={Archive}
        onClick={onArchive}
        disabled={working}
      >
        Archive
      </Button>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            iconLeft={BellOff}
            disabled={working}
          >
            Mute
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-44 p-1">
          <ul className="flex flex-col gap-0.5">
            {MUTE_DURATIONS.map((d) => (
              <li key={d.label}>
                <Button
                  variant="ghost"
                  size="sm"
                  block
                  className="justify-start"
                  onClick={() =>
                    onMute(
                      d.seconds === null ? 100 * 365 * 24 * 3600 : d.seconds,
                    )
                  }
                >
                  {d.label}
                </Button>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            iconLeft={TagIcon}
            disabled={working}
          >
            Add label
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-1">
          {labels.length === 0 ? (
            <p className="px-2 py-2 text-xs text-[var(--st-text-secondary)]">
              No labels yet. Create one in Labels.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {labels.map((l) => (
                <li key={l.id}>
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    className="justify-start gap-2"
                    onClick={() => onAddLabel(l.id)}
                  >
                    <span
                      aria-hidden="true"
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="truncate">{l.name}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
    </footer>
  );
}

function ListSkeleton() {
  return (
    <ul className="flex flex-col gap-1 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <li
          key={i}
          className="flex items-center gap-3 rounded-[var(--st-radius)] px-3 py-2"
        >
          <Skeleton circle width={40} />
          <div className="flex-1 space-y-2">
            <Skeleton height={12} width="33%" />
            <Skeleton height={12} width="66%" />
          </div>
          <Skeleton height={12} width={40} />
        </li>
      ))}
    </ul>
  );
}

function ChatsEmptyState({
  query,
  filter,
}: {
  query: string;
  filter: FilterMode;
}) {
  const isFiltered = Boolean(query) || filter !== "all";
  return (
    <div className="m-4">
      <EmptyState
        icon={MessageSquare}
        title={isFiltered ? "No matching chats" : "No individual chats yet"}
        description={
          isFiltered
            ? "Try clearing the search box or switching the filter back to All."
            : "Once your WhatsApp session is connected and you exchange a few messages, every one-on-one conversation lands here."
        }
        action={
          isFiltered ? null : (
            <Link href="/sabwa/inbox">
              <Button variant="primary" size="md" iconLeft={MessageSquare}>
                Open inbox
              </Button>
            </Link>
          )
        }
      />
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <Card className="m-4 border-[var(--st-danger)]">
      <CardBody className="flex flex-col items-start gap-2 py-6">
        <p className="text-sm font-semibold text-[var(--st-danger)]">
          Couldn't load chats
        </p>
        <p className="text-xs text-[var(--st-text-secondary)]">{message}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          Retry
        </Button>
      </CardBody>
    </Card>
  );
}
