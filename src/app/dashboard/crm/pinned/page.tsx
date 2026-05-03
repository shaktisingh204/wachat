'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Pin,
  PinOff,
  FolderKanban,
  CheckSquare,
  Sparkles,
  Handshake,
  LifeBuoy,
  BookOpen,
  StickyNote,
} from 'lucide-react';

import { ClayCard, ClayBadge, ClayButton } from '@/components/clay';
import { CrmPageHeader } from '../_components/crm-page-header';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
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

const TONES: Record<WsPinnedResourceType, Parameters<typeof ClayBadge>[0]['tone']> = {
  project: 'blue',
  task: 'rose-soft',
  lead: 'amber',
  deal: 'green',
  ticket: 'red',
  kb: 'neutral',
  note: 'rose',
};

/**
 * Pinned items page — cross-resource quick access to everything the
 * signed-in user has pinned (projects, tasks, deals, leads, tickets,
 * KB articles, sticky notes).
 */
export default function PinnedItemsPage() {
  const { toast } = useToast();
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
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Pinned"
        subtitle="Everything you've pinned across CRM modules, in one place."
        icon={Pin}
      />

      {isLoading ? (
        <ClayCard>
          <p className="text-[13px] text-muted-foreground">Loading…</p>
        </ClayCard>
      ) : items.length === 0 ? (
        <ClayCard>
          <div className="text-center">
            <p className="text-[13px] text-muted-foreground">
              Nothing pinned yet. Pin projects, deals, tasks or articles to
              have them show up here.
            </p>
          </div>
        </ClayCard>
      ) : (
        grouped.map(([type, rows]) => {
          const Icon = ICONS[type];
          return (
            <ClayCard key={type}>
              <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary">
                    <Icon
                      className="h-4 w-4 text-foreground"
                      strokeWidth={1.75}
                    />
                  </div>
                  <h2 className="text-[15px] font-semibold capitalize text-foreground">
                    {type}s
                  </h2>
                  <ClayBadge tone={TONES[type]}>{rows.length}</ClayBadge>
                </div>
              </div>
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {rows.map((r) => {
                  const href = HREFS[r.resource_type]?.(String(r.resource_id));
                  return (
                    <li
                      key={r._id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-border bg-white p-3"
                    >
                      <div className="min-w-0 flex-1">
                        {href ? (
                          <Link
                            href={href}
                            className="text-[13px] font-medium text-foreground hover:underline"
                          >
                            <span className="line-clamp-2">
                              {r.title ||
                                `${r.resource_type} ${String(
                                  r.resource_id,
                                ).slice(-6)}`}
                            </span>
                          </Link>
                        ) : (
                          <p className="line-clamp-2 text-[13px] font-medium text-foreground">
                            {r.title ||
                              `${r.resource_type} ${String(
                                r.resource_id,
                              ).slice(-6)}`}
                          </p>
                        )}
                        <p className="mt-1 text-[11.5px] text-muted-foreground">
                          {new Date(
                            (r.pinned_at as any) || r.createdAt || Date.now(),
                          ).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Unpin"
                        onClick={() => handleUnpin(r._id)}
                      >
                        <PinOff className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            </ClayCard>
          );
        })
      )}

      <ClayCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-medium text-foreground">
              Tip: pin anything
            </p>
            <p className="text-[12.5px] text-muted-foreground">
              Look for the pin icon on projects, deals, tasks, tickets or KB
              articles. Pins sync across your devices.
            </p>
          </div>
          <Link href="/dashboard/crm">
            <ClayButton variant="pill">Back to CRM</ClayButton>
          </Link>
        </div>
      </ClayCard>
    </div>
  );
}
