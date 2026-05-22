"use client";

import {
  Alert,
  ZoruAlertDescription,
  ZoruAlertTitle,
  Avatar,
  ZoruAvatarFallback,
  Badge,
  Button,
  Card,
  ZoruCardContent,
  ZoruCardHeader,
  ZoruCardTitle,
  DropdownMenu,
  ZoruDropdownMenuContent,
  ZoruDropdownMenuItem,
  ZoruDropdownMenuLabel,
  ZoruDropdownMenuSeparator,
  ZoruDropdownMenuTrigger,
  Input,
  ScrollArea,
  ZoruScrollBar,
  Skeleton,
  useZoruToast,
  cn,
} from '@/components/zoruui';
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

import * as React from "react";

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
        className="h-12 w-72 shrink-0"
        onClick={() => setIsAdding(true)}
      >
        <Plus /> Add another list
      </Button>
    );
  }

  return (
    <div className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-[var(--zoru-radius-lg)] border border-zoru-line bg-zoru-surface p-3">
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
        <Button size="sm" onClick={handleAdd}>
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
    </div>
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
    <Card
      ref={setNodeRef}
      style={style}
      className={cn("p-3 relative", isOverlay && "shadow-2xl cursor-grabbing scale-105")}
      variant="default"
    >
      <div className="flex items-start gap-2.5">
        <div
            {...attributes}
            {...listeners}
            className={cn("mt-1.5 cursor-grab", isOverlay && "cursor-grabbing")}
        >
            <GripVertical className="h-4 w-4 text-zoru-ink-muted" />
        </div>
        <Avatar className="h-8 w-8 shrink-0">
          <ZoruAvatarFallback>{initial}</ZoruAvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] text-zoru-ink leading-tight">
              {contact.name || contact.waId}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {unread > 0 && (
                <Badge className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {unread}
                </Badge>
              )}
              <DropdownMenu>
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
              </DropdownMenu>
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
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={handleGoToChat}
        >
          <MessageSquare /> Open chat
        </Button>
      </div>
    </Card>
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
    <Card
      ref={setNodeRef}
      className={cn(
        "flex h-full w-80 shrink-0 flex-col gap-0 p-0",
      )}
      variant="soft"
    >
      <ZoruCardHeader className="shrink-0 border-b border-zoru-line">
        <ZoruCardTitle className="flex items-center gap-2 text-[14px] capitalize">
          <span>{title.replace(/_/g, " ")}</span>
          <Badge variant="secondary" className="h-5 px-2 text-[10px]">
            {count}
          </Badge>
        </ZoruCardTitle>
      </ZoruCardHeader>
      <ScrollArea className="flex-1">
        <ZoruCardContent className="flex flex-col gap-3 p-3 min-h-[200px]">
          {children}
        </ZoruCardContent>
      </ScrollArea>
    </Card>
  );
}

/* ── main ─────────────────────────────────────────────────────────── */

export function ZoruKanbanBoard() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [boardData, setBoardData] = useState<KanbanColumnData[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useZoruToast();
  const [activeContact, setActiveContact] = useState<WithId<Contact> | null>(null);

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

  if (!project) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle />
          <ZoruAlertTitle>No project selected</ZoruAlertTitle>
          <ZoruAlertDescription>
            Please select a project from the main dashboard page to view the
            chat kanban board.
          </ZoruAlertDescription>
        </Alert>
      </div>
    );
  }

  const allColumnNames = boardData.map((c) => c.name);

  return (
    <div className="h-full w-full">
      <ScrollArea className="h-full w-full">
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
        <ZoruScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
