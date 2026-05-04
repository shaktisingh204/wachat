"use client";

/**
 * /wachat/chat/kanban — ZoruUI rebuild of `KanbanBoard`.
 *
 * Conversations grouped by status into columns. Each column is a
 * ZoruCard, each conversation is a row card with avatar + badge.
 *
 * Server-action wiring preserved:
 *   - getKanbanData(projectId)
 *   - saveKanbanStatuses(projectId, names)
 *   - handleUpdateContactStatus(contactId, newStatus, assignedAgentId)
 *
 * Drag-and-drop is intentionally stubbed (the legacy version pulled in
 * @dnd-kit/core for cross-column reordering). Status changes happen
 * via the per-row ZoruDropdownMenu instead.
 *
 * TODO: drag-reorder — re-introduce @dnd-kit/core (DndContext +
 * useDroppable on columns + useDraggable on cards) and call
 * handleUpdateContactStatus from the drop handler. Until then the
 * dropdown menu is the only path to move a contact between lists.
 */

import * as React from "react";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, MessageSquare, MoreHorizontal, Plus } from "lucide-react";

import {
  getKanbanData,
  saveKanbanStatuses,
} from "@/app/actions/project.actions";
import { handleUpdateContactStatus } from "@/app/actions/contact.actions";
import type {
  WithId,
  Contact,
  Project,
  KanbanColumnData,
} from "@/lib/definitions";

import {
  ZoruAlert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  ZoruAvatar,
  ZoruAvatarFallback,
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruDropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  ZoruInput,
  ZoruScrollArea,
  ZoruScrollBar,
  ZoruSkeleton,
  useZoruToast,
  cn,
} from "@/components/zoruui";

/* ── skeleton ─────────────────────────────────────────────────────── */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-80 shrink-0">
          <ZoruSkeleton className="h-full w-full" />
        </div>
      ))}
    </div>
  );
}

/* ── add-list inline form ─────────────────────────────────────────── */

function AddListInline({ onAddList }: { onAddList: (name: string) => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [listName, setListName] = useState("");

  const handleAdd = () => {
    const trimmed = listName.trim();
    if (!trimmed) return;
    onAddList(trimmed);
    setListName("");
    setIsAdding(false);
  };

  if (!isAdding) {
    return (
      <ZoruButton
        variant="outline"
        className="h-12 w-72 shrink-0"
        onClick={() => setIsAdding(true)}
      >
        <Plus /> Add another list
      </ZoruButton>
    );
  }

  return (
    <div className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3">
      <ZoruInput
        autoFocus
        placeholder="Enter list title..."
        value={listName}
        onChange={(e) => setListName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleAdd();
          if (e.key === "Escape") setIsAdding(false);
        }}
      />
      <div className="flex items-center gap-2">
        <ZoruButton size="sm" onClick={handleAdd}>
          Add list
        </ZoruButton>
        <ZoruButton
          size="sm"
          variant="ghost"
          onClick={() => setIsAdding(false)}
        >
          Cancel
        </ZoruButton>
      </div>
    </div>
  );
}

/* ── card ─────────────────────────────────────────────────────────── */

interface KanbanCardProps {
  contact: WithId<Contact>;
  allColumns: string[];
  currentColumn: string;
  onMove: (contactId: string, toColumn: string) => void;
}

function ZoruKanbanCard({
  contact,
  allColumns,
  currentColumn,
  onMove,
}: KanbanCardProps) {
  const router = useRouter();
  const id = contact._id.toString();
  const initial = (contact.name || contact.waId || "?")
    .charAt(0)
    .toUpperCase();
  const unread = contact.unreadCount || 0;

  const handleGoToChat = () => {
    router.push(`/wachat/chat?contactId=${id}`);
  };

  return (
    <ZoruCard className="p-3" variant="default">
      <div className="flex items-start gap-2.5">
        <ZoruAvatar className="h-8 w-8 shrink-0">
          <ZoruAvatarFallback>{initial}</ZoruAvatarFallback>
        </ZoruAvatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] text-zoru-ink leading-tight">
              {contact.name || contact.waId}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {unread > 0 && (
                <ZoruBadge className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {unread}
                </ZoruBadge>
              )}
              <ZoruDropdownMenu>
                <ZoruDropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Card actions"
                    className="flex h-6 w-6 items-center justify-center rounded-[var(--zoru-radius-sm)] text-zoru-ink-muted transition-colors hover:bg-zoru-surface-2 hover:text-zoru-ink focus-visible:outline-none"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </button>
                </ZoruDropdownMenuTrigger>
                <ZoruDropdownMenuContent align="end" className="w-48">
                  <ZoruDropdownMenuLabel>Move to status</ZoruDropdownMenuLabel>
                  {allColumns.map((col) => (
                    <ZoruDropdownMenuItem
                      key={col}
                      disabled={col === currentColumn}
                      onSelect={() => onMove(id, col)}
                    >
                      {col.replace(/_/g, " ")}
                    </ZoruDropdownMenuItem>
                  ))}
                  <ZoruDropdownMenuSeparator />
                  <ZoruDropdownMenuItem onSelect={handleGoToChat}>
                    <MessageSquare /> Open chat
                  </ZoruDropdownMenuItem>
                </ZoruDropdownMenuContent>
              </ZoruDropdownMenu>
            </div>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-zoru-ink-muted">
            {contact.waId}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[11.5px] text-zoru-ink-muted">
            {contact.lastMessage || "No recent activity."}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <ZoruButton
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleGoToChat}
        >
          <MessageSquare /> Open chat
        </ZoruButton>
      </div>
    </ZoruCard>
  );
}

/* ── column ───────────────────────────────────────────────────────── */

interface KanbanColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function ZoruKanbanColumn({ title, count, children }: KanbanColumnProps) {
  return (
    <ZoruCard
      className={cn(
        "flex h-full w-80 shrink-0 flex-col gap-0 p-0",
        // TODO: drag-reorder — wire useDroppable here when DnD returns.
      )}
      variant="soft"
    >
      <ZoruCardHeader className="shrink-0 border-b border-zoru-line">
        <ZoruCardTitle className="flex items-center gap-2 text-[14px] capitalize">
          <span>{title.replace(/_/g, " ")}</span>
          <ZoruBadge variant="secondary" className="h-5 px-2 text-[10px]">
            {count}
          </ZoruBadge>
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ZoruScrollArea className="flex-1">
        <ZoruCardContent className="flex flex-col gap-3 p-3">
          {children}
        </ZoruCardContent>
      </ZoruScrollArea>
    </ZoruCard>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */

export function ZoruKanbanBoard() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [boardData, setBoardData] = useState<KanbanColumnData[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useZoruToast();

  const fetchData = React.useCallback(() => {
    const storedProjectId =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    if (!storedProjectId) return;
    startLoadingTransition(async () => {
      const data = await getKanbanData(storedProjectId);
      if (data.project) setProject(data.project);
      if (data.columns) setBoardData(data.columns);
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, [fetchData]);

  const handleAddList = (name: string) => {
    if (!project) return;
    const newBoardData = [...boardData, { name, contacts: [] }];
    setBoardData(newBoardData);

    const allStatusNames = newBoardData.map((col) => col.name);
    startLoadingTransition(async () => {
      const result = await saveKanbanStatuses(
        project._id.toString(),
        allStatusNames,
      );
      if (!result.success) {
        toast({
          title: "Error",
          description: "Could not save new list.",
          variant: "destructive",
        });
        fetchData(); // revert on failure
      } else {
        toast({
          title: "List added",
          description: `"${name}" is now on the board.`,
        });
      }
    });
  };

  /**
   * Optimistic move via the dropdown menu. Mirrors the legacy DnD
   * drop-handler shape so the server-action call is identical.
   */
  const handleMove = (contactId: string, destinationColumnName: string) => {
    const sourceColumn = boardData.find((col) =>
      col.contacts.some((c) => c._id.toString() === contactId),
    );
    if (!sourceColumn) return;
    if (sourceColumn.name === destinationColumnName) return;

    const sourceColumnIndex = boardData.findIndex(
      (col) => col.name === sourceColumn.name,
    );
    const destColumnIndex = boardData.findIndex(
      (col) => col.name === destinationColumnName,
    );
    if (sourceColumnIndex === -1 || destColumnIndex === -1) return;

    const destColumn = boardData[destColumnIndex];

    const sourceContacts = Array.from(sourceColumn.contacts);
    const movedIndex = sourceContacts.findIndex(
      (c) => c._id.toString() === contactId,
    );
    if (movedIndex === -1) return;
    const [movedContact] = sourceContacts.splice(movedIndex, 1);

    const destContacts = Array.from(destColumn.contacts);
    destContacts.push(movedContact);

    const newBoardData = [...boardData];
    newBoardData[sourceColumnIndex] = {
      ...sourceColumn,
      contacts: sourceContacts,
    };
    newBoardData[destColumnIndex] = { ...destColumn, contacts: destContacts };
    setBoardData(newBoardData);

    handleUpdateContactStatus(
      contactId,
      destinationColumnName,
      movedContact?.assignedAgentId || "",
    );
  };

  if (!isClient || isLoading) {
    return <KanbanPageSkeleton />;
  }

  if (!project) {
    return (
      <div className="p-4">
        <ZoruAlert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please select a project from the main dashboard page to view the
            chat kanban board.
          </ZoruAlertDescription>
        </ZoruAlert>
      </div>
    );
  }

  const allColumnNames = boardData.map((c) => c.name);

  return (
    <div className="h-full w-full">
      <ZoruScrollArea className="h-full w-full">
        <div className="flex h-full w-max gap-4 p-4">
          {boardData.map((column) => (
            <ZoruKanbanColumn
              key={column.name}
              title={column.name}
              count={column.contacts.length}
            >
              {column.contacts.length === 0 ? (
                <p className="px-1 py-4 text-center text-[11.5px] text-zoru-ink-subtle">
                  No conversations.
                </p>
              ) : (
                column.contacts.map((contact) => (
                  <ZoruKanbanCard
                    key={contact._id.toString()}
                    contact={contact}
                    allColumns={allColumnNames}
                    currentColumn={column.name}
                    onMove={handleMove}
                  />
                ))
              )}
            </ZoruKanbanColumn>
          ))}
          <AddListInline onAddList={handleAddList} />
        </div>
        <ZoruScrollBar orientation="horizontal" />
      </ZoruScrollArea>
    </div>
  );
}
