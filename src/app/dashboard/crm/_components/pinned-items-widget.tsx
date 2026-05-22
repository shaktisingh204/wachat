'use client';

import * as React from 'react';
import Link from 'next/link';
import { GripVertical, Pin, X } from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  Skeleton,
  useZoruToast,
} from '@/components/zoruui';
import {
  getMyPinnedItems,
  reorderPinned,
  unpin,
  type GroupedPinned,
  type PinnableEntityType,
  type PinnedItem,
} from '@/app/actions/pinned-items.actions';

const ENTITY_LABELS: Record<PinnableEntityType, string> = {
  task: 'Tasks',
  project: 'Projects',
  lead: 'Leads',
  deal: 'Deals',
  ticket: 'Tickets',
  invoice: 'Invoices',
  contact: 'Contacts',
  kb: 'Knowledge base',
  note: 'Notes',
};

function hrefFor(item: PinnedItem): string {
  switch (item.entityType) {
    case 'task':
      return `/dashboard/crm/tasks/${item.entityId}`;
    case 'project':
      return `/dashboard/crm/projects/${item.entityId}`;
    case 'lead':
      return `/dashboard/crm/leads/${item.entityId}`;
    case 'deal':
      return `/dashboard/crm/deals/${item.entityId}`;
    case 'ticket':
      return `/dashboard/crm/tickets/${item.entityId}`;
    case 'invoice':
      return `/dashboard/crm/accounting/invoices/${item.entityId}`;
    case 'contact':
      return `/dashboard/crm/contacts/${item.entityId}`;
    case 'kb':
      return `/dashboard/crm/kb/${item.entityId}`;
    case 'note':
      return `/dashboard/crm/notes/${item.entityId}`;
    default:
      return '/dashboard/crm';
  }
}

export interface PinnedItemsWidgetProps {
  /** Optional explicit class for the wrapping card. */
  className?: string;
}

export function PinnedItemsWidget({ className }: PinnedItemsWidgetProps) {
  const { toast } = useZoruToast();
  const [groups, setGroups] = React.useState<GroupedPinned[]>([]);
  const [loading, setLoading] = React.useState(true);
  const dragRef = React.useRef<{
    entityType: PinnableEntityType;
    id: string;
  } | null>(null);

  const refresh = React.useCallback(() => {
    setLoading(true);
    void getMyPinnedItems()
      .then((g) => setGroups(g))
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUnpin = React.useCallback(
    async (entityType: PinnableEntityType, entityId: string) => {
      // Optimistic.
      setGroups((prev) =>
        prev
          .map((g) =>
            g.entityType === entityType
              ? { ...g, items: g.items.filter((it) => it.entityId !== entityId) }
              : g,
          )
          .filter((g) => g.items.length > 0),
      );
      const res = await unpin(entityType, entityId);
      if (res.error) {
        toast({
          title: 'Unpin failed',
          description: res.error,
          variant: 'destructive',
        });
        refresh();
      }
    },
    [toast, refresh],
  );

  const onDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    entityType: PinnableEntityType,
    id: string,
  ) => {
    dragRef.current = { entityType, id };
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', id);
    } catch {
      /* some browsers refuse setData */
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = async (
    e: React.DragEvent<HTMLLIElement>,
    entityType: PinnableEntityType,
    targetId: string,
  ) => {
    e.preventDefault();
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.entityType !== entityType || drag.id === targetId) return;

    const group = groups.find((g) => g.entityType === entityType);
    if (!group) return;
    const ids = group.items.map((it) => it._id);
    const fromIdx = ids.indexOf(drag.id);
    const toIdx = ids.indexOf(targetId);
    if (fromIdx === -1 || toIdx === -1) return;

    const next = ids.slice();
    next.splice(fromIdx, 1);
    next.splice(toIdx, 0, drag.id);

    // Optimistic re-order locally.
    setGroups((prev) =>
      prev.map((g) =>
        g.entityType === entityType
          ? {
              ...g,
              items: next
                .map((id) => g.items.find((it) => it._id === id))
                .filter((x): x is PinnedItem => x !== undefined),
            }
          : g,
      ),
    );

    const res = await reorderPinned(entityType, next);
    if (res.error) {
      toast({
        title: 'Reorder failed',
        description: res.error,
        variant: 'destructive',
      });
      refresh();
    }
  };

  const totalCount = groups.reduce((acc, g) => acc + g.items.length, 0);

  return (
    <ZoruCard className={className ?? 'p-6'}>
      <div className="flex items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
            <Pin className="h-4 w-4 text-zoru-ink" strokeWidth={1.75} />
          </div>
          <h2 className="text-[15px] text-zoru-ink">Pinned items</h2>
          <ZoruBadge variant="ghost">{totalCount}</ZoruBadge>
        </div>
        <Link href="/dashboard/crm/pinned">
          <ZoruButton variant="outline" size="sm">
            Manage
          </ZoruButton>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-2">
          <ZoruSkeleton className="h-10 w-full" />
          <ZoruSkeleton className="h-10 w-full" />
          <ZoruSkeleton className="h-10 w-full" />
        </div>
      ) : groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zoru-line p-8 text-center">
          <p className="text-[13px] text-zoru-ink-muted">
            No pinned items yet — use the pin icon on any task, project, lead,
            or invoice to add it here.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => (
            <section key={g.entityType}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11.5px] uppercase tracking-wide text-zoru-ink-muted">
                  {ENTITY_LABELS[g.entityType] ?? g.entityType}
                </p>
                <ZoruBadge variant="ghost">{g.items.length}</ZoruBadge>
              </div>
              <ul className="space-y-2">
                {g.items.map((it) => (
                  <li
                    key={it._id}
                    draggable
                    onDragStart={(e) => onDragStart(e, g.entityType, it._id)}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, g.entityType, it._id)}
                    className="group flex items-center gap-2 rounded-lg border border-zoru-line bg-zoru-bg p-2 hover:border-zoru-line-strong"
                  >
                    <GripVertical
                      className="h-3.5 w-3.5 cursor-grab text-zoru-ink-muted active:cursor-grabbing"
                      strokeWidth={1.75}
                      aria-hidden
                    />
                    <Link
                      href={hrefFor(it)}
                      className="min-w-0 flex-1 truncate text-[12.5px] text-zoru-ink hover:underline"
                    >
                      {it.title || `${g.entityType} ${String(it.entityId).slice(-6)}`}
                    </Link>
                    <ZoruButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={() => handleUnpin(g.entityType, it.entityId)}
                      aria-label="Unpin"
                      title="Unpin"
                    >
                      <X className="h-3 w-3" strokeWidth={1.75} />
                    </ZoruButton>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </ZoruCard>
  );
}
