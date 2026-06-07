"use client";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  IconButton,
  Input,
  ScrollArea,
  ScrollBar,
  Skeleton,
  useToast,
  cn,
} from "@/components/sabcrm/20ui";
import {
  useEffect,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  MessageSquare,
  MoreHorizontal,
  Plus,
} from "lucide-react";

import {
  getFacebookKanbanData,
  handleUpdateFacebookSubscriberStatus,
  saveFacebookKanbanStatuses,
} from "@/app/actions/facebook.actions";
import type {
  WithId,
  FacebookSubscriber,
  Project,
} from "@/lib/definitions";

/**
 * /dashboard/facebook/kanban - 20ui rebuild of `FacebookKanbanBoard`.
 *
 * Mirrors `src/app/wachat/_components/ui20-kanban-board.tsx`:
 *   - Conversations grouped by status into columns.
 *   - Each column is a Card, each conversation is a row card.
 *   - No drag-and-drop. Status changes happen via per-row dropdown.
 *
 * Server-action wiring preserved:
 *   - getFacebookKanbanData(projectId)
 *   - saveFacebookKanbanStatuses(projectId, names)
 *   - handleUpdateFacebookSubscriberStatus(subscriberId, status)
 *
 * TODO: drag-reorder. Re-introduce @dnd-kit/core (DndContext +
 * useDroppable on columns + useDraggable on cards) and call
 * handleUpdateFacebookSubscriberStatus from the drop handler. Until
 * then the dropdown menu is the only path to move a conversation
 * between lists.
 */

import * as React from "react";

type FacebookKanbanColumnData = {
  name: string;
  conversations: WithId<FacebookSubscriber>[];
};

/* skeleton */

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

/* add-list inline form */

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
    <div className="flex h-fit w-72 shrink-0 flex-col gap-2 rounded-[var(--st-radius-lg)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-3">
      <Field label="List title">
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
      </Field>
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleAdd}>
          Add list
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* card */

interface KanbanCardProps {
  subscriber: WithId<FacebookSubscriber>;
  allColumns: string[];
  currentColumn: string;
  onMove: (subscriberId: string, toColumn: string) => void;
}

function Ui20FacebookKanbanCard({
  subscriber,
  allColumns,
  currentColumn,
  onMove,
}: KanbanCardProps) {
  const router = useRouter();
  const id = subscriber._id.toString();
  const initial = (subscriber.name || subscriber.psid || "?")
    .charAt(0)
    .toUpperCase();
  const unread = subscriber.unread_count || 0;

  const handleGoToChat = () => {
    router.push(`/dashboard/facebook/messages?psid=${subscriber.psid}`);
  };

  return (
    <Card padding="sm" variant="outlined">
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] leading-tight text-[var(--st-text)]">
              {subscriber.name || subscriber.psid}
            </p>
            <div className="flex shrink-0 items-center gap-1">
              {unread > 0 && (
                <Badge tone="accent" className="h-5 min-w-[1.25rem] justify-center px-1.5 text-[10px]">
                  {unread}
                </Badge>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton
                    label="Card actions"
                    icon={MoreHorizontal}
                    variant="ghost"
                    size="sm"
                  />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>Move to status</DropdownMenuLabel>
                  {allColumns.map((col) => (
                    <DropdownMenuItem
                      key={col}
                      disabled={col === currentColumn}
                      onSelect={() => onMove(id, col)}
                      className="capitalize"
                    >
                      {col.replace(/_/g, " ")}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem iconLeft={MessageSquare} onSelect={handleGoToChat}>
                    Open thread
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--st-text-secondary)]">
            {subscriber.psid}
          </p>
          <p className="mt-1.5 line-clamp-2 text-[11.5px] text-[var(--st-text-secondary)]">
            {subscriber.snippet || "No recent activity."}
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
          Open thread
        </Button>
      </div>
    </Card>
  );
}

/* column */

interface KanbanColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
}

function Ui20FacebookKanbanColumn({ title, count, children }: KanbanColumnProps) {
  return (
    <Card
      className={cn(
        "flex h-full w-80 shrink-0 flex-col gap-0",
        // TODO: drag-reorder. Wire useDroppable here when DnD returns.
      )}
      padding="none"
      variant="elevated"
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
        <CardBody className="flex flex-col gap-3 p-3">{children}</CardBody>
      </ScrollArea>
    </Card>
  );
}

/* main */

export function Ui20FacebookKanbanBoard() {
  const [project, setProject] = useState<WithId<Project> | null>(null);
  const [boardData, setBoardData] = useState<FacebookKanbanColumnData[]>([]);
  const [isLoading, startLoadingTransition] = useTransition();
  const [isClient, setIsClient] = useState(false);
  const { toast } = useToast();

  const fetchData = React.useCallback(() => {
    const storedProjectId =
      typeof window !== "undefined"
        ? localStorage.getItem("activeProjectId")
        : null;
    if (!storedProjectId) return;
    startLoadingTransition(async () => {
      const data = await getFacebookKanbanData(storedProjectId);
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
    const newBoardData = [...boardData, { name, conversations: [] }];
    setBoardData(newBoardData);

    const allStatusNames = newBoardData.map((col) => col.name);
    startLoadingTransition(async () => {
      const result = await saveFacebookKanbanStatuses(
        project._id.toString(),
        allStatusNames,
      );
      if (!result.success) {
        toast.error({
          title: "Could not save new list",
          description: "Please try again.",
        });
        fetchData(); // revert on failure
      } else {
        toast.success({
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
  const handleMove = (subscriberId: string, destinationColumnName: string) => {
    const sourceColumn = boardData.find((col) =>
      col.conversations.some((c) => c._id.toString() === subscriberId),
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

    const sourceConversations = Array.from(sourceColumn.conversations);
    const movedIndex = sourceConversations.findIndex(
      (c) => c._id.toString() === subscriberId,
    );
    if (movedIndex === -1) return;
    const [movedSubscriber] = sourceConversations.splice(movedIndex, 1);

    const destConversations = Array.from(destColumn.conversations);
    destConversations.push(movedSubscriber);

    const newBoardData = [...boardData];
    newBoardData[sourceColumnIndex] = {
      ...sourceColumn,
      conversations: sourceConversations,
    };
    newBoardData[destColumnIndex] = {
      ...destColumn,
      conversations: destConversations,
    };
    setBoardData(newBoardData);

    handleUpdateFacebookSubscriberStatus(subscriberId, destinationColumnName);
  };

  if (!isClient || isLoading) {
    return <KanbanPageSkeleton />;
  }

  if (!project) {
    return (
      <div className="p-4">
        <Alert tone="danger" icon={AlertCircle}>
          <AlertTitle>No project selected</AlertTitle>
          <AlertDescription>
            Please select a project from the main dashboard page to view the
            chat kanban board.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const allColumnNames = boardData.map((c) => c.name);

  return (
    <div className="h-full w-full">
      <ScrollArea className="h-full w-full">
        <div className="flex h-full w-max gap-4 p-4">
          {boardData.map((column) => (
            <Ui20FacebookKanbanColumn
              key={column.name}
              title={column.name}
              count={column.conversations.length}
            >
              {column.conversations.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={MessageSquare}
                  title="No conversations"
                  description="Move a thread here to get started."
                />
              ) : (
                column.conversations.map((subscriber) => (
                  <Ui20FacebookKanbanCard
                    key={subscriber._id.toString()}
                    subscriber={subscriber}
                    allColumns={allColumnNames}
                    currentColumn={column.name}
                    onMove={handleMove}
                  />
                ))
              )}
            </Ui20FacebookKanbanColumn>
          ))}
          <AddListInline onAddList={handleAddList} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
