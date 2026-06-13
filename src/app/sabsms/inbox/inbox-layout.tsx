"use client";

/**
 * SabSMS inbox - 3-pane client orchestrator.
 *
 * Owns the resizable layout, the active conversation selection, polling
 * for live updates, and the keyboard shortcut handler. All data loading
 * happens through the `"use server"` actions in `./actions.ts`.
 *
 * Feature map (the 20 page-unique features from B.1 page 3):
 *
 *   1. 3-pane layout                        -> `ResizablePanelGroup` below.
 *   2. Filter rail (scope facet)            -> `<SabsmsFilterBar>` toolbar.
 *   3. Conversation list w/ unread badges   -> `<ConversationList>`.
 *   4. Thread w/ delivery ticks             -> `<ThreadView>` -> `DeliveryTicks`.
 *   5. Reply composer + template insertion  -> `<ThreadView>` composer.
 *   6. Internal notes                       -> `<ThreadView>` `Internal note` tab.
 *   7. Assign-to-agent / team               -> `<ThreadView>` header dropdown.
 *   8. Auto round-robin toggle              -> `<ThreadView>` header (localStorage).
 *   9. Snooze (wake-on-reply or duration)   -> snooze dialog in `<ThreadView>`.
 *  10. Close / reopen w/ required reason    -> close dialog in `<ThreadView>`.
 *  11. Merge two conversations              -> merge dialog in `<ThreadView>`.
 *  12. Labels / tags editor                 -> labels strip in `<ThreadView>`.
 *  13. SLA timers (first response + resolve)-> `sla.ts` -> pulses in both panes.
 *  14. Canned responses dropdown            -> `<ThreadView>` composer dropdown.
 *  15. Reactions on inbound messages        -> `<MessageBubble>` reaction popover.
 *  16. Add-to-segment from thread           -> `<ThreadView>` More menu (stub).
 *  17. Add-to-suppression from thread       -> `<ThreadView>` More menu.
 *  18. Search by body / contact / date      -> `<SabsmsFilterBar>` (URL state).
 *  19. Keyboard shortcuts (j/k/e/r/n)       -> `useKeyboardShortcuts` below.
 *  20. Live updates                         -> always-on 5 s poll (wachat
 *                                             convention); SabsmsRefreshButton
 *                                             adds manual refresh on top.
 */

import * as React from "react";
import Link from "next/link";

import {
  Badge,
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  SegmentedControl,
} from "@/components/sabcrm/20ui";
import {
  SabsmsFilterBar,
  SabsmsKbdHint,
  SabsmsPageShell,
  SabsmsRefreshButton,
  useSabsmsUrlState,
  type SabsmsShortcut,
} from "@/components/sabsms/page-toolkit";

import {
  loadConversations,
  loadThread,
  markRead,
} from "./actions";
import { ConversationList } from "./conversation-list";
import { ThreadView } from "./thread-view";
import type {
  InboxAgent,
  InboxConversationView,
  InboxFilters,
  InboxTemplateView,
  InboxThreadView,
} from "./types";

const SHORTCUTS: SabsmsShortcut[] = [
  { keys: ["j"], description: "Next conversation" },
  { keys: ["k"], description: "Previous conversation" },
  { keys: ["r"], description: "Reply" },
  { keys: ["n"], description: "Add internal note" },
  { keys: ["e"], description: "Archive / close" },
];

export interface InboxLayoutProps {
  workspaceId: string;
  initialConversations: InboxConversationView[];
  initialThread: InboxThreadView | null;
  templates: InboxTemplateView[];
  agents: InboxAgent[];
}

export function InboxLayout({
  workspaceId,
  initialConversations,
  initialThread,
  templates,
  agents,
}: InboxLayoutProps) {
  const url = useSabsmsUrlState();
  const [conversations, setConversations] =
    React.useState<InboxConversationView[]>(initialConversations);
  const [thread, setThread] = React.useState<InboxThreadView | null>(
    initialThread,
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    initialThread?.conversation.id ?? null,
  );

  // Composer / note focus is owned by `<ThreadView>`. Let the layout
  // call back into it for the `r` / `n` shortcuts.
  const composerFocus = React.useRef<() => void>(() => undefined);
  const noteFocus = React.useRef<() => void>(() => undefined);

  const filters = React.useMemo<InboxFilters>(() => {
    const scope = (url.get("scope") ?? "all") as InboxFilters["scope"];
    return {
      q: url.get("q") || undefined,
      scope,
      status: url.getAll("status"),
      assignee: url.getAll("assignee"),
      labels: url.getAll("label"),
      sort: (url.get("sort") as InboxFilters["sort"]) || "newest",
      from: url.get("from") || undefined,
      to: url.get("to") || undefined,
    };
  }, [url]);

  const refresh = React.useCallback(async () => {
    const next = await loadConversations(workspaceId, filters);
    setConversations(next);
    if (selectedId) {
      const nextThread = await loadThread(workspaceId, selectedId);
      setThread(nextThread);
    }
  }, [workspaceId, filters, selectedId]);

  // Re-fetch whenever filters change.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await loadConversations(workspaceId, filters);
      if (!cancelled) setConversations(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, filters]);

  // Re-fetch thread when the selection changes, and mark it read —
  // opening a thread zeroes its unread counter (server + local badge).
  React.useEffect(() => {
    let cancelled = false;
    if (!selectedId) {
      setThread(null);
      return;
    }
    void (async () => {
      const next = await loadThread(workspaceId, selectedId);
      if (cancelled) return;
      setThread(next);
      if (next && next.conversation.unreadCount > 0) {
        void markRead(selectedId);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedId ? { ...c, unreadCount: 0 } : c,
          ),
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, selectedId]);

  const scope = filters.scope ?? "all";
  const visibleIds = React.useMemo(
    () => conversations.map((c) => c.id),
    [conversations],
  );

  // Keyboard shortcuts: j/k navigate the visible list, r/n focus the
  // composer / note, e closes the current thread.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const idx = selectedId ? visibleIds.indexOf(selectedId) : -1;
      if (e.key === "j") {
        e.preventDefault();
        const next = visibleIds[Math.min(visibleIds.length - 1, idx + 1)];
        if (next) setSelectedId(next);
      } else if (e.key === "k") {
        e.preventDefault();
        const prev = visibleIds[Math.max(0, idx - 1)];
        if (prev) setSelectedId(prev);
      } else if (e.key === "r") {
        e.preventDefault();
        composerFocus.current?.();
      } else if (e.key === "n") {
        e.preventDefault();
        noteFocus.current?.();
      } else if (e.key === "e") {
        e.preventDefault();
        // Quick-close prompt. Defer to the dialog inside ThreadView.
        const btn = document.querySelector<HTMLButtonElement>(
          'button[data-inbox-close="true"]',
        );
        btn?.click();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, visibleIds]);

  function setScope(next: InboxFilters["scope"]) {
    url.setOne("scope", next ?? null);
  }

  const onRefresh = React.useCallback(() => {
    void refresh();
  }, [refresh]);

  // Live updates: lightweight 5 s polling of the active list + thread,
  // matching the WaChat inbox convention (`ui20-chat-client.tsx` —
  // setInterval poll, no SSE/WebSocket). Skips ticks while the tab is
  // hidden and pauses while a refetch is still in flight. The events
  // worker also bumps `sabsms:inbox:poke:{workspaceId}` on inbound, so
  // a cheap "anything new?" precheck can land here later without
  // changing this shape.
  React.useEffect(() => {
    let inFlight = false;
    const handle = window.setInterval(() => {
      if (document.visibilityState === "hidden" || inFlight) return;
      inFlight = true;
      void Promise.resolve(refresh()).finally(() => {
        inFlight = false;
      });
    }, 5_000);
    return () => window.clearInterval(handle);
  }, [refresh]);

  const filterBar = (
    <div className="space-y-2">
      <SabsmsFilterBar
        searchKey="q"
        searchPlaceholder="Search body, phone, conversation id"
        facets={[
          {
            key: "status",
            label: "Status",
            multi: true,
            options: [
              { value: "open", label: "Open" },
              { value: "snoozed", label: "Snoozed" },
              { value: "closed", label: "Closed" },
            ],
          },
          {
            key: "assignee",
            label: "Assignee",
            multi: true,
            options: agents.map((a) => ({ value: a.id, label: a.name })),
          },
          {
            key: "label",
            label: "Labels",
            multi: true,
            options: [
              { value: "vip", label: "VIP" },
              { value: "billing", label: "Billing" },
              { value: "support", label: "Support" },
            ],
          },
        ]}
        sortOptions={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
          { value: "unread", label: "Unread first" },
        ]}
        defaultSort="newest"
        dateRangeKey={{ from: "from", to: "to" }}
        trailing={
          <div className="flex items-center gap-2">
            <SabsmsKbdHint shortcuts={SHORTCUTS} />
            {/* The layout owns the always-on 5 s poll above; this button
                stays for manual refresh + optional faster/slower ticks. */}
            <SabsmsRefreshButton onRefresh={onRefresh} defaultInterval="off" />
          </div>
        }
      />
      <ScopeRail current={scope} onChange={setScope} counts={countByScope(conversations)} />
    </div>
  );

  return (
    <SabsmsPageShell
      title="Inbox"
      description="Two-way SMS / MMS conversations routed by the engine. Reply, assign, snooze, and close, with SLA timers, internal notes, and keyboard shortcuts."
      breadcrumbs={[{ label: "Inbox" }]}
      primaryAction={{ label: "Compose", href: "/sabsms/send" }}
      secondaryActions={[
        { label: "Open message logs", onSelectHref: "/sabsms/logs" },
      ]}
      helpTitle="Inbox shortcuts"
      helpBody={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <code>j</code> / <code>k</code> step through conversations.
          </li>
          <li>
            <code>r</code> focuses the reply composer; <code>n</code> the note.
          </li>
          <li>
            <code>e</code> opens the close dialog for the current thread.
          </li>
          <li>
            Live updates poll every 5 s automatically.
          </li>
        </ul>
      }
      toolbar={filterBar}
    >
      <div className="h-[calc(100vh-280px)] min-h-[520px] overflow-hidden rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)]">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={32} minSize={22} maxSize={45}>
            <ConversationList
              conversations={conversations}
              agents={agents}
              scope={scope}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={68} minSize={45}>
            <ThreadView
              workspaceId={workspaceId}
              thread={thread}
              templates={templates}
              agents={agents}
              allConversations={conversations}
              onMutate={onRefresh}
              registerComposerFocus={(fn) => {
                composerFocus.current = fn;
              }}
              registerNoteFocus={(fn) => {
                noteFocus.current = fn;
              }}
            />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <p className="px-1 text-xs text-[var(--st-text-secondary)]">
        Inbound messages route through{" "}
        <Link
          className="underline"
          href="/sabsms/logs"
        >
          /sabsms/logs
        </Link>{" "}
        . The engine writes both directions; the inbox renders the
        threaded view.
      </p>
    </SabsmsPageShell>
  );
}

interface ScopeRailProps {
  current: InboxFilters["scope"];
  onChange: (next: InboxFilters["scope"]) => void;
  counts: Record<NonNullable<InboxFilters["scope"]>, number>;
}

function ScopeRail({ current, onChange, counts }: ScopeRailProps) {
  type ScopeKey = NonNullable<InboxFilters["scope"]>;
  const labels: Array<{ key: ScopeKey; label: string }> = [
    { key: "all", label: "All" },
    { key: "mine", label: "Mine" },
    { key: "unassigned", label: "Unassigned" },
    { key: "snoozed", label: "Snoozed" },
    { key: "closed", label: "Closed" },
  ];
  return (
    <SegmentedControl<ScopeKey>
      aria-label="Conversation scope"
      value={(current ?? "all") as ScopeKey}
      onChange={(next) => onChange(next)}
      items={labels.map((i) => ({
        value: i.key,
        label: (
          <span className="inline-flex items-center gap-1.5">
            {i.label}
            <Badge tone="neutral" kind="soft">
              {counts[i.key]}
            </Badge>
          </span>
        ),
      }))}
    />
  );
}

function countByScope(
  conversations: InboxConversationView[],
): Record<NonNullable<InboxFilters["scope"]>, number> {
  return {
    all: conversations.filter((c) => c.status !== "closed").length,
    mine: conversations.filter(
      (c) => c.status === "open" && Boolean(c.assignedAgentId),
    ).length,
    unassigned: conversations.filter(
      (c) => c.status === "open" && !c.assignedAgentId,
    ).length,
    snoozed: conversations.filter((c) => c.status === "snoozed").length,
    closed: conversations.filter((c) => c.status === "closed").length,
  };
}
