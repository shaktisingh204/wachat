'use client';

import { Avatar, AvatarFallback, Badge, Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, StatCard, useToast } from '@/components/sabcrm/20ui/compat';
import {
  useRouter,
  usePathname } from 'next/navigation';
import {
  Activity,
  Filter,
  Settings,
  User as UserIcon,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * Activity Feed — §1D chronological feed view.
 *
 * - KPI strip (4): Events today · Events this week · Unique actors today · Top entity this week
 * - Filters (5): actor · entity kind · action · date range · involving-me toggle
 * - Cards grouped by date bucket: Today / Yesterday / This week / Earlier
 * - Each card: actor avatar + actor + action + entity chip + relative time
 * - Subscribe button (gear icon) — defers to a toast for now since the
 *   subscription store hasn't shipped yet.
 */

import * as React from 'react';

import type { WsUserActivity } from '@/lib/worksuite/chat-types';
import { ENTITY_KEYS } from '@/lib/lookup-registry';

type Row = WsUserActivity & { _id: string };

export interface ActivityFeedProps {
  activities: Row[];
  currentUserId?: string;
  initialFilters: {
    actor: string;
    action: string;
    resourceType: string;
    from: string;
    to: string;
  };
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function formatRelative(value: WsUserActivity['occurred_at']): string {
  if (!value) return '';
  const d = new Date(value as string | Date);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function bucket(ts: number): 'Today' | 'Yesterday' | 'This week' | 'Earlier' {
  const today = startOfDay(new Date());
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekStart = today - 6 * 24 * 60 * 60 * 1000;
  if (ts >= today) return 'Today';
  if (ts >= yesterday) return 'Yesterday';
  if (ts >= weekStart) return 'This week';
  return 'Earlier';
}

const BUCKETS_ORDER: Array<'Today' | 'Yesterday' | 'This week' | 'Earlier'> = [
  'Today',
  'Yesterday',
  'This week',
  'Earlier',
];

export function ActivityFeed({
  activities,
  currentUserId,
  initialFilters,
}: ActivityFeedProps): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [filters, setFilters] = React.useState(initialFilters);
  const [involvingMe, setInvolvingMe] = React.useState(false);

  const applyFilters = React.useCallback(() => {
    const sp = new URLSearchParams();
    if (filters.actor) sp.set('actor', filters.actor);
    if (filters.action) sp.set('action', filters.action);
    if (filters.resourceType) sp.set('resourceType', filters.resourceType);
    if (filters.from) sp.set('from', filters.from);
    if (filters.to) sp.set('to', filters.to);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [filters, pathname, router]);

  const clearFilters = React.useCallback(() => {
    setFilters({ actor: '', action: '', resourceType: '', from: '', to: '' });
    setInvolvingMe(false);
    router.push(pathname);
  }, [pathname, router]);

  const hasFilters =
    Object.values(filters).some((v) => Boolean(v)) || involvingMe;

  // Client-side involvingMe filter
  const filtered = React.useMemo(() => {
    if (!involvingMe || !currentUserId) return activities;
    return activities.filter(
      (a) => a.actor_user_id === currentUserId || a.resource_id === currentUserId,
    );
  }, [activities, involvingMe, currentUserId]);

  // KPI calculation
  const kpis = React.useMemo(() => {
    const todayStart = startOfDay(new Date());
    const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
    const actorsToday = new Set<string>();
    const entityCountWeek = new Map<string, number>();
    let today = 0;
    let week = 0;
    for (const a of filtered) {
      const t = a.occurred_at ? new Date(a.occurred_at as string | Date).getTime() : 0;
      if (t >= todayStart) {
        today += 1;
        actorsToday.add(a.actor_user_id);
      }
      if (t >= weekStart) {
        week += 1;
        if (a.resource_type) {
          entityCountWeek.set(
            a.resource_type,
            (entityCountWeek.get(a.resource_type) ?? 0) + 1,
          );
        }
      }
    }
    const topEntity = [...entityCountWeek.entries()].sort((a, b) => b[1] - a[1])[0];
    return {
      today,
      week,
      uniqueActors: actorsToday.size,
      topEntity: topEntity ? `${topEntity[0]} (${topEntity[1]})` : '—',
    };
  }, [filtered]);

  // Bucketize
  const bucketed = React.useMemo(() => {
    const groups: Record<string, Row[]> = {
      Today: [],
      Yesterday: [],
      'This week': [],
      Earlier: [],
    };
    for (const a of filtered) {
      const t = a.occurred_at ? new Date(a.occurred_at as string | Date).getTime() : 0;
      groups[bucket(t)].push(a);
    }
    return groups;
  }, [filtered]);

  const handleSubscribe = React.useCallback(() => {
    toast({
      title: 'Subscriptions coming soon',
      description:
        'You will be able to subscribe to specific entities here once the activity subscription store ships.',
    });
  }, [toast]);

  return (
    <EntityListShell
      title="User Activity"
      subtitle="A chronological feed of everything your teammates do across the CRM."
      primaryAction={
        <Button variant="ghost" onClick={handleSubscribe}>
          <Settings className="h-4 w-4" />
          Subscriptions
        </Button>
      }
      filters={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40">
            <Label className="text-[11px]" htmlFor="act-actor">
              Actor
            </Label>
            <Input
              id="act-actor"
              value={filters.actor}
              onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              placeholder="User id"
            />
          </div>
          <div className="w-40">
            <Label className="text-[11px]">Entity kind</Label>
            <Select
              value={filters.resourceType || 'all'}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, resourceType: v === 'all' ? '' : v }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All entities</SelectItem>
                {ENTITY_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {k}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-36">
            <Label className="text-[11px]" htmlFor="act-action">
              Action
            </Label>
            <Input
              id="act-action"
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              placeholder="create/update…"
            />
          </div>
          <div className="w-36">
            <Label className="text-[11px]" htmlFor="act-from">
              From
            </Label>
            <Input
              id="act-from"
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            />
          </div>
          <div className="w-36">
            <Label className="text-[11px]" htmlFor="act-to">
              To
            </Label>
            <Input
              id="act-to"
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-[12px] text-[var(--st-text-secondary)]">
            <input
              type="checkbox"
              checked={involvingMe}
              onChange={(e) => setInvolvingMe(e.target.checked)}
            />
            Involving me
          </label>
          <Button size="sm" onClick={applyFilters} className="mb-1">
            <Filter className="h-3.5 w-3.5" /> Apply
          </Button>
          {hasFilters ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="mb-1">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          ) : null}
        </div>
      }
      empty={
        filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <Activity className="h-8 w-8 text-[var(--st-text-secondary)]" />
            <h3 className="text-base font-medium text-[var(--st-text)]">No activity</h3>
            <p className="max-w-sm text-sm text-[var(--st-text-secondary)]">
              {activities.length === 0
                ? 'Activity rows are written whenever your team takes action across the CRM.'
                : 'No events match the current filters.'}
            </p>
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Events today" value={kpis.today.toLocaleString()} />
          <StatCard label="Events this week" value={kpis.week.toLocaleString()} />
          <StatCard
            label="Unique actors today"
            value={kpis.uniqueActors.toLocaleString()}
          />
          <StatCard label="Top entity (week)" value={kpis.topEntity} />
        </div>
        {BUCKETS_ORDER.map((b) =>
          bucketed[b].length === 0 ? null : (
            <BucketCard key={b} title={b} rows={bucketed[b]} />
          ),
        )}
      </div>
    </EntityListShell>
  );
}

function BucketCard({ title, rows }: { title: string; rows: Row[] }): React.JSX.Element {
  return (
    <Card className="p-0">
      <div className="border-b border-[var(--st-border)] p-4">
        <div className="flex items-center gap-2">
          <h2 className="text-[14px] font-semibold text-[var(--st-text)]">{title}</h2>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
      </div>
      <ul className="divide-y divide-[var(--st-border)]">
        {rows.map((a) => (
          <li key={a._id} className="flex items-start gap-3 p-4">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                <UserIcon className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-[var(--st-text)]">
                <span className="font-medium">{a.actor_user_id}</span>
                <Badge variant="secondary">{a.action}</Badge>
                {a.resource_type ? (
                  <Badge variant="secondary">{a.resource_type}</Badge>
                ) : null}
                {a.resource_id ? (
                  <span className="font-mono text-[11.5px] text-[var(--st-text-secondary)]">
                    {a.resource_id}
                  </span>
                ) : null}
              </div>
                {a.description ? (
                  <p className="mt-1 text-[12.5px] text-[var(--st-text-secondary)]">{a.description}</p>
                ) : null}
                <TimeDisplay occurredAt={a.occurred_at} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    );
  }
  
  function TimeDisplay({ occurredAt }: { occurredAt: WsUserActivity['occurred_at'] }) {
    const [mounted, setMounted] = React.useState(false);
    React.useEffect(() => setMounted(true), []);
    
    if (!occurredAt) return null;
    
    return (
      <p className="mt-1 text-[11.5px] text-[var(--st-text-secondary)]" title={String(occurredAt)}>
        {mounted ? formatRelative(occurredAt) : String(occurredAt).slice(0, 10)}
      </p>
    );
  }
