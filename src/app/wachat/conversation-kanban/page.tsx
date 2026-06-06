'use client';
import { fmtDate } from "@/lib/utils";

import {
  useToast,
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Dot,
  ScrollArea,
  EmptyState,
  Spinner,
  PageHeader,
  PageHeaderHeading,
  PageTitle,
  PageDescription,
  PageActions,
} from '@/components/sabcrm/20ui';
import {
  useEffect,
  useState,
  useTransition,
  useCallback } from 'react';
import {
  MessageCircle,
  User,
  RefreshCw,
  Inbox,
  } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';

import { WachatPage } from '@/app/wachat/_components/wachat-page';
import { useProject } from '@/context/project-context';
import { getContactsPageData } from '@/app/actions/contact.actions';
import { handleUpdateContactStatus } from '@/app/actions/contact.actions';

/**
 * /wachat/conversation-kanban — Real contacts grouped by status, rebuilt on the
 * 20ui design system inside the WaChat full-bleed app frame. Neutral palette
 * only — column dots use 20ui status tones, not raw greens/blues/ambers.
 *
 * Drag-moving a card between columns now PERSISTS via the existing
 * `handleUpdateContactStatus` server action (→ rustClient.wachatContacts.updateStatus),
 * the same path the Zoru kanban boards already use. The column id is the
 * canonical conversation status string. Updates are optimistic and revert on
 * error.
 */

import * as React from 'react';

function cx(...a: Array<string | false | null | undefined>): string {
  return a.filter(Boolean).join(' ');
}

type ColumnTone = 'info' | 'warning' | 'success';

type Column = {
  id: string;
  title: string;
  /** 20ui status tone for the column header dot. */
  tone: ColumnTone;
  items: any[];
};

const COLUMN_DEFS: ReadonlyArray<{ id: string; title: string; tone: ColumnTone }> = [
  { id: 'new', title: 'New', tone: 'info' },
  { id: 'active', title: 'Active', tone: 'warning' },
  { id: 'resolved', title: 'Resolved', tone: 'success' },
];

function emptyColumns(): Column[] {
  return COLUMN_DEFS.map((d) => ({ ...d, items: [] }));
}

function groupContacts(contacts: any[]): Column[] {
  const cols = emptyColumns();
  for (const c of contacts) {
    const status = c.conversationStatus || c.status || 'new';
    if (status === 'resolved' || status === 'closed') cols[2].items.push(c);
    else if (c.lastMessageTimestamp || status === 'active') cols[1].items.push(c);
    else cols[0].items.push(c);
  }
  return cols;
}

const contactId = (c: any): string => String(c?._id ?? '');

/** Draggable contact card. Wraps the existing 20ui Card so visuals are unchanged. */
function KanbanCard({
  item,
  saving,
}: {
  item: any;
  saving: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: contactId(item), data: { item } });

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0)`
      : undefined,
    opacity: isDragging ? 0.5 : undefined,
    touchAction: 'none',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cx('relative', saving && 'pointer-events-none opacity-60')}
      {...attributes}
      {...listeners}
    >
      <Card variant="interactive" padding="md" aria-busy={saving || undefined}>
        <CardHeader>
          <CardTitle className="truncate text-[14px]">
            {item.name || item.waId || 'Unknown'}
          </CardTitle>
          {item.lastMessageTimestamp && (
            <span className="whitespace-nowrap text-[11px] u-card__desc shrink-0">
              {fmtDate(item.lastMessageTimestamp)}
            </span>
          )}
        </CardHeader>
        <CardDescription className="flex items-center gap-1 truncate text-[12.5px]">
          <MessageCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
          {item.waId || 'No phone'}
        </CardDescription>
        {item.tagIds?.length > 0 && (
          <div className="mt-2 flex items-center gap-1 text-[11px] u-card__desc">
            <User className="h-3 w-3" aria-hidden="true" />
            {item.tagIds.length} tag(s)
          </div>
        )}
      </Card>
      {saving && (
        <div className="absolute right-2 top-2">
          <Spinner size="sm" label="Saving" />
        </div>
      )}
    </div>
  );
}

/** Droppable column body. Highlights when a card hovers over it. */
function KanbanColumn({
  col,
  savingIds,
}: {
  col: Column;
  savingIds: Set<string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div key={col.id} className="w-80 flex-shrink-0">
      <div className="mb-3 flex items-center gap-2">
        <Dot tone={col.tone} aria-hidden="true" />
        <h2 className="text-[15px] u-card__title">{col.title}</h2>
        <Badge tone="neutral" className="ml-auto">
          {col.items.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cx(
          'flex flex-col gap-3 rounded-lg p-1 transition-colors',
          isOver && 'u-droppable--over',
        )}
        style={
          isOver
            ? { outline: '2px dashed var(--ui20-border-strong, currentColor)', outlineOffset: '2px' }
            : undefined
        }
        aria-label={`${col.title} conversations`}
      >
        {col.items.map((item: any) => (
          <KanbanCard
            key={contactId(item)}
            item={item}
            saving={savingIds.has(contactId(item))}
          />
        ))}
        {col.items.length === 0 && (
          <EmptyState icon={Inbox} size="sm" title="No conversations" />
        )}
      </div>
    </div>
  );
}

export default function ConversationKanbanPage() {
  const { activeProject } = useProject();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const load = useCallback(() => {
    if (!activeProject?._id) return;
    setLoadError(null);
    startTransition(async () => {
      const res = await getContactsPageData(
        String(activeProject._id),
        undefined,
        1,
        '',
      );
      if (!res.contacts) {
        const msg = (res as any)?.error || 'Could not load contacts.';
        setLoadError(msg);
        toast({ title: 'Error', description: msg, tone: 'danger' });
        return;
      }
      setColumns(groupContacts(res.contacts));
    });
  }, [activeProject?._id, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const markSaving = useCallback((id: string, on: boolean) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const id = String(active.id);
      const destId = String(over.id);

      // Capture a snapshot for revert before any optimistic mutation.
      const prevColumns = columns;

      const sourceIndex = prevColumns.findIndex((c) =>
        c.items.some((it) => contactId(it) === id),
      );
      const destIndex = prevColumns.findIndex((c) => c.id === destId);
      if (sourceIndex === -1 || destIndex === -1) return;
      if (sourceIndex === destIndex) return; // dropped on same column — no-op

      const movedContact = prevColumns[sourceIndex].items.find(
        (it) => contactId(it) === id,
      );
      if (!movedContact) return;

      // Optimistic move: remove from source, append to destination with new status.
      const optimistic = prevColumns.map((col, i) => {
        if (i === sourceIndex) {
          return {
            ...col,
            items: col.items.filter((it) => contactId(it) !== id),
          };
        }
        if (i === destIndex) {
          return {
            ...col,
            items: [
              ...col.items,
              { ...movedContact, conversationStatus: destId, status: destId },
            ],
          };
        }
        return col;
      });
      setColumns(optimistic);

      markSaving(id, true);
      void (async () => {
        try {
          const result = await handleUpdateContactStatus(
            id,
            destId,
            movedContact?.assignedAgentId || undefined,
          );
          if (!result?.success) {
            setColumns(prevColumns); // revert
            toast({
              title: 'Move failed',
              description:
                result?.error || 'Could not move this conversation.',
              tone: 'danger',
            });
          }
        } catch (e: any) {
          setColumns(prevColumns); // revert
          toast({
            title: 'Move failed',
            description: e?.message || 'Could not move this conversation.',
            tone: 'danger',
          });
        } finally {
          markSaving(id, false);
        }
      })();
    },
    [columns, markSaving, toast],
  );

  const totalCards = columns.reduce((s, c) => s + c.items.length, 0);

  return (
    <WachatPage variant="app">
      <div className="flex h-full min-h-0 flex-col gap-6 px-6 pt-6 pb-10">
        <PageHeader bordered={false} compact>
          <PageHeaderHeading>
            <PageTitle>Conversation Kanban</PageTitle>
            <PageDescription>
              View conversations organized by status ({totalCards} contacts).
              Drag a card to move it between columns.
            </PageDescription>
          </PageHeaderHeading>
          <PageActions>
            <Button
              variant="outline"
              size="sm"
              iconLeft={RefreshCw}
              loading={isPending}
              onClick={load}
            >
              Refresh
            </Button>
          </PageActions>
        </PageHeader>

        {isPending && columns.length === 0 ? (
          <div className="flex h-40 items-center justify-center gap-3">
            <Spinner size="sm" label="Loading contacts" />
            <span className="text-[13px] u-pagehead__desc">
              Loading contacts...
            </span>
          </div>
        ) : loadError && columns.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={Inbox}
              size="md"
              title="Couldn't load conversations"
              description={loadError}
              action={
                <Button
                  variant="outline"
                  size="sm"
                  iconLeft={RefreshCw}
                  loading={isPending}
                  onClick={load}
                >
                  Try again
                </Button>
              }
            />
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <ScrollArea horizontal className="min-h-0 flex-1 pb-4">
              <div className="flex gap-4">
                {columns.map((col) => (
                  <KanbanColumn key={col.id} col={col} savingIds={savingIds} />
                ))}
              </div>
            </ScrollArea>
          </DndContext>
        )}
      </div>
    </WachatPage>
  );
}
