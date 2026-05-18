'use client';

import { ZoruBadge, ZoruButton, ZoruCard, useZoruToast } from '@/components/zoruui';
import {
  PinOff,
  FolderKanban,
  CheckSquare,
  Sparkles,
  Handshake,
  LifeBuoy,
  BookOpen,
  StickyNote,
} from 'lucide-react';

import * as React from 'react';
import Link from 'next/link';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getMyPinnedItems,
  unpinItem,
} from '@/app/actions/worksuite/dashboard.actions';
import type {
  WsPinnedItem,
  WsPinnedResourceType,
} from '@/lib/worksuite/dashboard-types';

type Row = WsPinnedItem & { _id: string };

const ICONS: Record<WsPinnedResourceType, React.ElementType> = {
  project: FolderKanban,
  task: CheckSquare,
  lead: Sparkles,
  deal: Handshake,
  ticket: LifeBuoy,
  kb: BookOpen,
  note: StickyNote,
};

const HREFS: Partial<Record<WsPinnedResourceType, (id: string) => string>> = {
  project: (id) => `/dashboard/crm/projects/${id}`,
  task: (id) => `/dashboard/crm/tasks?id=${id}`,
  lead: (id) => `/dashboard/crm/sales-crm/leads/${id}`,
  deal: (id) => `/dashboard/crm/deals/${id}`,
  ticket: (id) => `/dashboard/crm/tickets/${id}`,
  kb: (id) => `/dashboard/crm/workspace/knowledge-base/${id}`,
  note: (id) => `/dashboard/crm/workspace/sticky-notes?id=${id}`,
};

const VARIANTS: Record<
  WsPinnedResourceType,
  'success' | 'warning' | 'danger' | 'ghost'
> = {
  project: 'success',
  task: 'danger',
  lead: 'warning',
  deal: 'success',
  ticket: 'danger',
  kb: 'ghost',
  note: 'danger',
};

/**
 * Pinned items page — cross-resource quick access to everything the
 * signed-in user has pinned (projects, tasks, deals, leads, tickets,
 * KB articles, sticky notes).
 */
export default function PinnedItemsPage() {
  const { toast } = useZoruToast();
  const [items, setItems] = React.useState<Row[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = (await getMyPinnedItems()) as Row[];
      setItems(Array.isArray(res) ? res : []);
    } catch (e) {
      console.error('Failed to load pinned items', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUnpin = async (id: string) => {
    const res = await unpinItem(id);
    if (res.success) {
      toast({ title: 'Unpinned', description: 'Item removed from pins.' });
      refresh();
    } else {
      toast({
        title: 'Error',
        description: res.error || 'Unpin failed',
        variant: 'destructive',
      });
    }
  };

  // Group by resource_type for a cleaner layout.
  const grouped = React.useMemo(() => {
    const map = new Map<WsPinnedResourceType, Row[]>();
    for (const it of items) {
      const t = it.resource_type;
      if (!map.has(t)) map.set(t, []);
      map.get(t)!.push(it);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  return (
    <EntityListShell
      title="Pinned"
      subtitle="Everything you've pinned across CRM modules, in one place."
    >

      {isLoading ? (
        <ZoruCard className="p-6">
          <p className="text-[13px] text-zoru-ink-muted">Loading…</p>
        </ZoruCard>
      ) : items.length === 0 ? (
        <ZoruCard className="p-6">
          <div className="text-center">
            <p className="text-[13px] text-zoru-ink-muted">
              Nothing pinned yet. Pin projects, deals, tasks or articles to
              have them show up here.
            </p>
          </div>
        </ZoruCard>
      ) : (
        grouped.map(([type, rows]) => {
          const Icon = ICONS[type];
          return (
            <ZoruCard key={type} className="p-6">
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zoru-surface-2">
                    <Icon
                      className="h-4 w-4 text-zoru-ink"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h2 className="text-[15px] font-semibold capitalize text-zoru-ink">
                    {type}s
                  </h2>
                  <ZoruBadge variant={VARIANTS[type]}>{rows.length}</ZoruBadge>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const href = HREFS[r.resource_type]?.(String(r.resource_id));
                  return (
                    <li
                      key={r._id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-zoru-line bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        {href ? (
                          <Link
                            href={href}
                            className="text-[13px] font-medium text-zoru-ink hover:underline"
                          >
                            <span className="line-clamp-2">
                              {r.title ||
                                `${r.resource_type} ${String(
                                  r.resource_id,
                                ).slice(-6)}`}
                            </span>
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-[13px] font-medium text-zoru-ink">
                            {r.title ||
                              `${r.resource_type} ${String(
                                r.resource_id,
                              ).slice(-6)}`}
                          </p>
                        )}
                        <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                          {new Date(
                            (r.pinned_at as any) || r.createdAt || Date.now(),
                          ).toLocaleString()}
                        </p>
                      </div>
                      <ZoruButton
                        variant="ghost"
                        size="sm"
                        aria-label="Unpin"
                        onClick={() => handleUnpin(r._id)}
                      >
                        <PinOff className="h-3.5 w-3.5 text-zoru-danger-ink" />
                      </ZoruButton>
                    </li>
                  );
                })}
              </ul>
            </ZoruCard>
          );
        })
      )}

      <ZoruCard className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-zoru-ink">
              Tip: pin anything
            </p>
            <p className="text-[12.5px] text-zoru-ink-muted">
              Look for the pin icon on projects, deals, tasks, tickets or KB
              articles. Pins sync across your devices.
            </p>
          </div>
          <Link href="/dashboard/crm">
            <ZoruButton variant="outline">Back to CRM</ZoruButton>
          </Link>
        </div>
      </ZoruCard>
    </EntityListShell>
  );
}
