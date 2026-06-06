"use client";

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  Input,
  ScrollArea,
  ScrollBar,
  Skeleton,
  useToast,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle,
  MessageSquare,
  MoreHorizontal,
  Plus, GripVertical } from "lucide-react";

import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Data path: this WhatsApp chat-kanban is keyed on the `Contact` shape
// (`waId`, `unreadCount`, `lastMessage`, `_id` → /wachat/chat?contactId=…) and
// the move handler already runs on Rust via `handleUpdateContactStatus`
// (→ `rustClient.wachatContacts.updateStatus`).
//
// The board load + custom-status list now run on Rust too, via the
// contacts-domain kanban endpoints (`wachat-contacts` crate):
//   GET  /v1/contacts/kanban          → getChatKanbanData
//   POST /v1/contacts/kanban/statuses → saveChatKanbanStatuses
// The Rust column shape ({ id, title, contacts }) is mapped to the board's
// { name, contacts } shape inside the server action. Per-card status moves
// continue through `handleUpdateContactStatus` (PATCH /{id}/status).
import {
  getChatKanbanData,
  saveChatKanbanStatuses,
  } from "@/app/actions/wachat-kanban.actions";
import { handleUpdateContactStatus } from "@/app/actions/contact.actions";
import type {
  WithId,
  Contact,
  KanbanColumnData,
  } from "@/lib/definitions";

import * as React from "react";

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(' ');
}

/* ── skeleton ─────────────────────────────────────────────────────── */

function KanbanPageSkeleton() {
  return (
    <div className="flex h-full w-full gap-4 overflow-x-auto p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="w-80 shrink-0">
          <Skeleton className="h-full w-full" />
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
      <Button
        variant="outline"
        iconLeft={Plus}
        className="h-12 w-72 shrink-0"
        onClick={() => setIsAdding(true)}
      >
        Add another list
      </Button>
    );
  }

  return (
    <Card
      variant="outlined"
      padding="sm"
      className="flex h-fit w-72 shrink-0 flex-col gap-2"
    >
      <Input
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
        <Button size="sm" variant="primary" onClick={handleAdd}>
          Add list
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsAdding(false)}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}

/* ── card ─────────────────────────────────────────────────────────── */

interface KanbanCardProps {
  contact: WithId<Contact>;
  allColumns: string[];
  currentColumn: string;
  onMove: (contactId: string, toColumn: string) => void;
  isOverlay?: boolean;
}

function ZoruKanbanCard({
  contact,
  allColumns,
  currentColumn,
  onMove,
  isOverlay,
}: KanbanCardProps) {
  const router = useRouter();
  const id = contact._id.toString();
  const initial = (contact.name || contact.waId || "?")
    .charAt(0)
    .toUpperCase();
  const unread = contact.unreadCount || 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: contact._id.toString(), data: { type: "Contact", contact, currentColumn } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleGoToChat = () => {
    router.push(`/wachat/chat?contactId=${id}`);
  };

  return (
    <div ref={setNodeRef} style={style}>
    <Card
      className={cx("relative", isOverlay && "shadow-2xl cursor-grabbing scale-105")}
      variant="outlined"
      padding="sm"
    >
      <div className="flex items-start gap-2.5">
        <div
            {...attributes}
            {...listeners}
            className={cx("mt-1.5 cursor-grab", isOverlay && "cursor-grabbing")}
        >
            <GripVertical className="h-4 w-4 text-[var(--st-text-muted)]" />
        </div>
        <Avatar
          name={contact.name || contact.waId || "?"}
          initials={initial}
          shape="round"
          size="lg"
          className="shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] leading-tight text-[var(--st-text)]">
              {contact.name || contact.waId}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {unread > 0 && (
                <Badge tone="accent" kind="solid" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {unread}
                </Badge>
              )}
              <Menu
                align="end"
                label="Card actions"
                trigger={
                  <IconButton
                    label="Card actions"
                    icon={MoreHorizontal}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 text-[var(--st-text-muted)]"
                  />
                }
              >
                <MenuLabel>Move to status</MenuLabel>
                {allColumns.map((col) => (
                  <MenuItem
                    key={col}
                    disabled={col === currentColumn}
                    onSelect={() => onMove(id, col)}
                  >
                    {col.replace(/_/g, " ")}
                  </MenuItem>
                ))}
                <MenuSeparator />
                <MenuItem icon={MessageSquare} onSelect={handleGoToChat}>
                  Open chat
                </MenuItem>
              </Menu>
            </div>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[var(--st-text-muted)]">
            {contact.waId}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[11.5px] text-[var(--st-text-muted)]">
            {contact.lastMessage || "No recent activity."}
          </p>
        </div>
      </div>
      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          iconLeft={MessageSquare}
          block
          onClick={handleGoToChat}
        >
          Open chat
        </Button>
      </div>
    </Card>
    </div>
  );
}

/* ── column ───────────────────────────────────────────────────────── */

interface KanbanColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function ZoruKanbanColumn({ title, count, children }: KanbanColumnProps) {
  const { setNodeRef } = useSortable({
      id: title,
      data: { type: "Column", title },
  });

  return (
    <div ref={setNodeRef} className="h-full w-80 shrink-0">
    <Card
      className={cx(
        "flex h-full w-full flex-col gap-0",
      )}
      variant="outlined"
      padding="none"
    >
      <CardHeader className="shrink-0 border-b border-[var(--st-border)]">
        <CardTitle className="flex items-center gap-2 text-[14px] capitalize">
          <span>{title.replace(/_/g, " ")}</span>
          <Badge tone="neutral" className="h-5 px-2 text-[10px]">
            {count}
          </Badge>
        </CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1">
        <CardBody className="flex flex-col gap-3 p-3 min-h-[200px]">
          {children}
        </CardBody>
      </ScrollArea>
    </Card>
    </div>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */

export function ZoruKanbanBoard() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [boardData, setBoardData] = useState<KanbanColumnData[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasProjectId, setHasProjectId] = useState(true);
  const { toast } = useToast();
  const [activeContact, setActiveContact] = useState<WithId<Contact> | null>(null);

  const fetchData = React.useCallback(() => {
    const storedProjectId =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    if (!storedProjectId) {
      setHasProjectId(false);
      return;
    }
    setHasProjectId(true);
    setLoadError(null);
    startLoadingTransition(async () => {
      try {
        const data = await getChatKanbanData(storedProjectId);
        if (data.projectId) {
          setProjectId(data.projectId);
          setBoardData(data.columns ?? []);
        } else {
          // A real project id was stored but the load returned nothing —
          // surface it as an error rather than the "no project" empty state.
          setLoadError(
            data.error ??
              "Could not load the chat board for this project. It may have been removed, or the request failed.",
          );
        }
      } catch {
        setLoadError("Something went wrong loading the chat board.");
      }
    });
  }, []);

  useEffect(() => {
    setIsClient(true);
    fetchData();
  }, [fetchData]);

  const handleAddList = (name: string) => {
    if (!projectId) return;
    const newBoardData = [...boardData, { name, contacts: [] }];
    setBoardData(newBoardData);

    const allStatusNames = newBoardData.map((col) => col.name);
    startLoadingTransition(async () => {
      const result = await saveChatKanbanStatuses(
        projectId,
        allStatusNames,
      );
      if (!result.success) {
        toast({
          title: "Error",
          description: "Could not save new list.",
          tone: "danger",
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
   * Optimistic move via the dropdown menu or DnD
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

    // Snapshot for revert if the server rejects the move.
    const previousBoardData = boardData;

    const newBoardData = [...boardData];
    newBoardData[sourceColumnIndex] = {
      ...sourceColumn,
      contacts: sourceContacts,
    };
    newBoardData[destColumnIndex] = { ...destColumn, contacts: destContacts };
    setBoardData(newBoardData);

    // Persist via the Rust contacts path (`wachatContacts.updateStatus`).
    startLoadingTransition(async () => {
      try {
        const result = await handleUpdateContactStatus(
          contactId,
          destinationColumnName,
          movedContact?.assignedAgentId || "",
        );
        if (!result?.success) {
          setBoardData(previousBoardData);
          toast({
            title: "Couldn't move conversation",
            description: result?.error || "The status change was not saved.",
            tone: "danger",
          });
        }
      } catch {
        setBoardData(previousBoardData);
        toast({
          title: "Couldn't move conversation",
          description: "Something went wrong saving the status change.",
          tone: "danger",
        });
      }
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const onDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.type === "Contact") {
      setActiveContact(active.data.current.contact);
    }
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveContact = active.data.current?.type === "Contact";
    const isOverContact = over.data.current?.type === "Contact";
    const isOverColumn = over.data.current?.type === "Column";

    if (!isActiveContact) return;

    // Moving a contact over another contact or an empty column
    let destinationColumnName = "";
    if (isOverContact) {
      destinationColumnName = over.data.current?.currentColumn;
    } else if (isOverColumn) {
      destinationColumnName = over.data.current?.title;
    }

    if (!destinationColumnName) return;

    // If it's a different column, we optimistically update UI,
    // but the final server sync happens in DragEnd for safety,
    // or we can do it here for smoother visual if needed.
    // In many kanban setups, dragOver handles array Move within the same col.
    // For simplicity, we let the UI naturally render the preview and save onEnd.
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveContact(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveContact = active.data.current?.type === "Contact";
    const isOverContact = over.data.current?.type === "Contact";
    const isOverColumn = over.data.current?.type === "Column";

    if (isActiveContact) {
      const sourceColumn = active.data.current?.currentColumn;
      let destinationColumnName = "";

      if (isOverContact) {
        destinationColumnName = over.data.current?.currentColumn;
      } else if (isOverColumn) {
        destinationColumnName = over.data.current?.title;
      }

      if (destinationColumnName && destinationColumnName !== sourceColumn) {
        handleMove(activeId as string, destinationColumnName);
      } else if (destinationColumnName === sourceColumn) {
          // Reordering within the same column
          const colIndex = boardData.findIndex(col => col.name === sourceColumn);
          if (colIndex !== -1) {
              const contacts = [...boardData[colIndex].contacts];
              const oldIndex = contacts.findIndex(c => c._id.toString() === activeId);
              const newIndex = isOverContact
                ? contacts.findIndex(c => c._id.toString() === overId)
                : contacts.length;
              if (oldIndex !== -1 && newIndex !== -1) {
                 const newContacts = arrayMove(contacts, oldIndex, newIndex);
                 const newBoard = [...boardData];
                 newBoard[colIndex] = { ...newBoard[colIndex], contacts: newContacts };
                 setBoardData(newBoard);
              }
          }
      }
    }
  };

  if (!isClient || isLoading) {
    return <KanbanPageSkeleton />;
  }

  if (loadError) {
    return (
      <div className="p-4">
        <Alert tone="danger" icon={AlertCircle} title="Couldn't load the board">
          {loadError}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={fetchData}>
              Try again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!hasProjectId || !projectId) {
    return (
      <div className="p-4">
        <Alert tone="danger" icon={AlertCircle} title="No project selected">
          Please select a project from the main dashboard page to view the
          chat kanban board.
        </Alert>
      </div>
    );
  }

  const allColumnNames = boardData.map((c) => c.name);

  return (
    <div className="h-full w-full">
      <ScrollArea className="h-full w-full" horizontal>
        <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragEnd={onDragEnd}
        >
          <div className="flex h-full w-max gap-4 p-4">
            {boardData.map((column) => (
              <ZoruKanbanColumn
                key={column.name}
                title={column.name}
                count={column.contacts.length}
              >
                <SortableContext
                  items={column.contacts.map(c => c._id.toString())}
                  strategy={verticalListSortingStrategy}
                >
                  {column.contacts.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11.5px] text-[var(--st-text-tertiary)]">
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
                </SortableContext>
              </ZoruKanbanColumn>
            ))}
            <AddListInline onAddList={handleAddList} />
          </div>

          <DragOverlay
            dropAnimation={{
              sideEffects: defaultDropAnimationSideEffects({
                styles: { active: { opacity: "0.5" } },
              }),
            }}
          >
            {activeContact ? (
              <ZoruKanbanCard
                contact={activeContact}
                allColumns={allColumnNames}
                currentColumn={activeContact.status || 'new'}
                onMove={() => {}}
                isOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
