"use client";

/**
 * SabSMS inbox — middle pane.
 *
 * Lists the workspace's conversations with unread badges + last-message
 * preview. The filter rail above is rendered by `SabsmsFilterBar` in
 * `inbox-layout.tsx`; this component is purely the result list.
 *
 * Bulk close / bulk assign is exposed via `SabsmsBulkActionsBar` when
 * any row is selected.
 */

import * as React from "react";
import { CheckCircle2, Clock3, MailWarning, Tag, UserCheck } from "lucide-react";

import { Badge, Button, Checkbox, ScrollArea, cn } from '@/components/sabcrm/20ui';
import {
  SabsmsBulkActionsBar,
  SabsmsEmpty,
} from "@/components/sabsms/page-toolkit";

import { assignToMe, closeConversation } from "./actions";
import type { InboxAgent, InboxConversationView } from "./types";
import { computeSlaState, formatRelative, scopeMatches } from "./sla";

export interface ConversationListProps {
  conversations: InboxConversationView[];
  /** Roster for assignment labels (kept for parity with the layout). */
  agents?: InboxAgent[];
  scope: "all" | "mine" | "unassigned" | "closed" | "snoozed";
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const SCOPE_FACETS: Array<{
  key: "all" | "mine" | "unassigned" | "closed" | "snoozed";
  label: string;
  icon: React.ReactNode;
}> = [
  { key: "all", label: "All", icon: <MailWarning className="h-3.5 w-3.5" /> },
  { key: "mine", label: "Mine", icon: <UserCheck className="h-3.5 w-3.5" /> },
  { key: "unassigned", label: "Unassigned", icon: <Tag className="h-3.5 w-3.5" /> },
  { key: "snoozed", label: "Snoozed", icon: <Clock3 className="h-3.5 w-3.5" /> },
  { key: "closed", label: "Closed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

export function ConversationList({
  conversations,
  scope,
  selectedId,
  onSelect,
}: ConversationListProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  // Sync selection set with the conversation list — if a row vanishes
  // (filter change, deletion), drop it from the bulk-action set.
  React.useEffect(() => {
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const c of conversations) if (prev.has(c.id)) next.add(c.id);
      return next.size === prev.size ? prev : next;
    });
  }, [conversations]);

  const visible = React.useMemo(
    () => conversations.filter((c) => scopeMatches(c, scope)),
    [conversations, scope],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedRows = visible.filter((c) => selectedIds.has(c.id));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-[var(--st-border)] px-3 py-2 text-xs text-[var(--st-text)]">
        <span>
          {visible.length} conversation{visible.length === 1 ? "" : "s"}
        </span>
        <span className="font-mono">{scope}</span>
      </div>

      {selectedRows.length > 0 && (
        <div className="border-b border-[var(--st-border)] px-2 py-2">
          <SabsmsBulkActionsBar
            selectedCount={selectedRows.length}
            totalCount={visible.length}
            rows={selectedRows}
            onClear={() => setSelectedIds(new Set())}
            actions={[
              {
                label: "Close",
                onSelect: async (rows) => {
                  for (const row of rows) {
                    await closeConversation({
                      conversationId: row.id,
                      reason: "Bulk close",
                    });
                  }
                },
                destructive: true,
              },
              {
                label: "Assign to me",
                onSelect: async (rows) => {
                  // Resolves the signed-in agent server-side.
                  for (const row of rows) {
                    await assignToMe({ conversationId: row.id });
                  }
                },
              },
            ]}
          />
        </div>
      )}

      <ScrollArea className="flex-1">
        {visible.length === 0 ? (
          <div className="p-4">
            <SabsmsEmpty
              title="No conversations"
              description="Inbound replies appear here as soon as the engine routes them."
            />
          </div>
        ) : (
          <ul className="divide-y divide-[var(--st-border)]">
            {visible.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                isActive={selectedId === c.id}
                isSelected={selectedIds.has(c.id)}
                onSelect={() => onSelect(c.id)}
                onToggleSelect={() => toggle(c.id)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="border-t border-[var(--st-border)] px-3 py-2">
        <div className="flex flex-wrap gap-1.5 text-[11px] text-[var(--st-text)]">
          {SCOPE_FACETS.map((f) => (
            <span key={f.key} className="inline-flex items-center gap-1">
              {f.icon}
              {f.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ConversationRowProps {
  conversation: InboxConversationView;
  isActive: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onToggleSelect: () => void;
}

function ConversationRow({
  conversation,
  isActive,
  isSelected,
  onSelect,
  onToggleSelect,
}: ConversationRowProps) {
  const sla = computeSlaState(conversation, new Date());
  const breaching = sla.firstResponseBreached || sla.resolutionBreached;
  return (
    <li
      className={cn(
        "flex cursor-pointer gap-2 px-3 py-3 transition-colors hover:bg-[var(--st-bg-muted)]",
        isActive && "bg-[var(--st-bg-muted)]/60",
      )}
      onClick={onSelect}
      role="button"
      aria-pressed={isActive}
    >
      <div
        className="pt-1"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <Checkbox
          checked={isSelected}
          onChange={() => onToggleSelect()}
          aria-label="Select conversation"
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-mono text-xs text-[var(--st-text)]">
            {conversation.contactId}
          </span>
          <span
            className={cn(
              "shrink-0 text-[11px] text-[var(--st-text-secondary)]",
              breaching && "animate-pulse text-[var(--st-text)]",
            )}
          >
            {formatRelative(conversation.lastMessageAt)}
          </span>
        </div>
        <div className="line-clamp-2 text-sm text-[var(--st-text)]">
          {conversation.lastMessagePreview ?? (
            <span className="italic text-[var(--st-text-secondary)]">No preview</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {conversation.unreadCount > 0 && (
            <Badge variant="default" className="text-[10px]">
              {conversation.unreadCount} unread
            </Badge>
          )}
          {conversation.status === "snoozed" && (
            <Badge variant="secondary" className="text-[10px]">
              snoozed
            </Badge>
          )}
          {conversation.status === "closed" && (
            <Badge variant="secondary" className="text-[10px]">
              closed
            </Badge>
          )}
          {conversation.assignedAgentId && (
            <Badge variant="outline" className="text-[10px]">
              {conversation.assignedAgentId}
            </Badge>
          )}
          {conversation.labels.map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px]">
              {l}
            </Badge>
          ))}
          {breaching && (
            <Badge variant="destructive" className="text-[10px]">
              SLA
            </Badge>
          )}
        </div>
      </div>
    </li>
  );
}

export function ConversationListEmpty() {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Button variant="ghost" disabled>
        Select a scope on the left to begin
      </Button>
    </div>
  );
}
