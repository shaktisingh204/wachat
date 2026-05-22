'use client';

import {
  Badge,
  Button,
  Card,
  Input,
  Label,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  StatCard,
  cn,
  useZoruToast,
} from '@/components/zoruui';
import {
  Bell,
  Check,
  CheckCheck,
  ExternalLink,
  Filter,
  Inbox,
  X,
  } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';

/**
 * Notifications Center — §1D enhanced list page.
 *
 * - KPI strip (4): Unread · Today · This week · Types count
 * - Filter row: type · read status · date range
 * - Sections: Unread first (highlighted), then Read
 * - Each card: title, body, linked entity chip, age, mark-read, dismiss, open link
 */

import * as React from 'react';
import Link from 'next/link';

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/app/actions/worksuite/chat.actions';
import type { WsNotification } from '@/lib/worksuite/chat-types';

type Row = WsNotification & { _id: string };

export interface NotificationsBrowserProps {
  initialNotifications: Row[];
}

function entityHref(kind?: string, id?: string): string | null {
  if (!kind || !id) return null;
  const map: Record<string, string> = {
    lead: `/dashboard/crm/sales-crm/all-leads/${id}`,
    deal: `/dashboard/crm/sales-crm/deals/${id}`,
    contact: `/dashboard/crm/contacts/${id}`,
    account: `/dashboard/crm/accounts/${id}`,
    invoice: `/dashboard/crm/sales/invoices/${id}`,
    task: `/dashboard/crm/tasks/${id}`,
    ticket: `/dashboard/crm/tickets/${id}`,
  };
  return map[kind] ?? null;
}

function formatRelative(value: WsNotification['createdAt']): string {
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

export function NotificationsBrowser({
  initialNotifications,
}: NotificationsBrowserProps): React.JSX.Element {
  const { toast } = useZoruToast();
  const [rows, setRows] = React.useState<Row[]>(initialNotifications);
  const [busyAll, setBusyAll] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<string>('all');
  const [readFilter, setReadFilter] = React.useState<'all' | 'unread' | 'read'>('all');
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');

  // KPIs
  const kpis = React.useMemo(() => {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const types = new Set<string>();
    let unread = 0;
    let today = 0;
    let thisWeek = 0;
    for (const r of rows) {
      types.add(r.type);
      const t = r.createdAt ? new Date(r.createdAt as string | Date).getTime() : 0;
      if (!r.read_at) unread += 1;
      if (t >= oneDayAgo) today += 1;
      if (t >= oneWeekAgo) thisWeek += 1;
    }
    return { unread, today, thisWeek, types: types.size };
  }, [rows]);

  const distinctTypes = React.useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(r.type));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = React.useMemo(() => {
    const from = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const to = dateTo ? new Date(dateTo).getTime() + 24 * 60 * 60 * 1000 : Infinity;
    return rows.filter((r) => {
      if (typeFilter !== 'all' && r.type !== typeFilter) return false;
      if (readFilter === 'unread' && r.read_at) return false;
      if (readFilter === 'read' && !r.read_at) return false;
      const t = r.createdAt ? new Date(r.createdAt as string | Date).getTime() : 0;
      if (t < from || t > to) return false;
      return true;
    });
  }, [rows, typeFilter, readFilter, dateFrom, dateTo]);

  const unreadRows = React.useMemo(() => filtered.filter((r) => !r.read_at), [filtered]);
  const readRows = React.useMemo(() => filtered.filter((r) => !!r.read_at), [filtered]);

  const refresh = React.useCallback(async () => {
    const latest = (await getMyNotifications()) as Row[];
    setRows(latest);
  }, []);

  const markAll = React.useCallback(async () => {
    if (kpis.unread === 0) return;
    setBusyAll(true);
    const res = await markAllNotificationsRead();
    setBusyAll(false);
    if (res.success) {
      toast({ title: 'All notifications marked read' });
      await refresh();
    } else {
      toast({ title: 'Error', description: res.error, variant: 'destructive' });
    }
  }, [kpis.unread, refresh, toast]);

  const markOne = React.useCallback(
    async (id: string) => {
      const res = await markNotificationRead(id);
      if (res.success) {
        setRows((prev) =>
          prev.map((r) => (r._id === id ? { ...r, read_at: new Date().toISOString() } : r)),
        );
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' });
      }
    },
    [toast],
  );

  const dismissOne = React.useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r._id !== id));
  }, []);

  const clearFilters = React.useCallback(() => {
    setTypeFilter('all');
    setReadFilter('all');
    setDateFrom('');
    setDateTo('');
  }, []);

  const hasActiveFilters =
    typeFilter !== 'all' || readFilter !== 'all' || !!dateFrom || !!dateTo;

  return (
    <EntityListShell
      title="Notifications"
      subtitle="System and teammate notifications addressed to you — mentions, assignments, SLA breaches."
      primaryAction={
        <ZoruButton
          variant="ghost"
          onClick={markAll}
          disabled={busyAll || kpis.unread === 0}
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </ZoruButton>
      }
      filters={
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-44">
            <ZoruLabel className="text-[11px]">Type</ZoruLabel>
            <ZoruSelect value={typeFilter} onValueChange={setTypeFilter}>
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All types</ZoruSelectItem>
                {distinctTypes.map((t) => (
                  <ZoruSelectItem key={t} value={t}>
                    {t}
                  </ZoruSelectItem>
                ))}
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-36">
            <ZoruLabel className="text-[11px]">Status</ZoruLabel>
            <ZoruSelect
              value={readFilter}
              onValueChange={(v) => setReadFilter(v as 'all' | 'unread' | 'read')}
            >
              <ZoruSelectTrigger>
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All</ZoruSelectItem>
                <ZoruSelectItem value="unread">Unread only</ZoruSelectItem>
                <ZoruSelectItem value="read">Read only</ZoruSelectItem>
              </ZoruSelectContent>
            </ZoruSelect>
          </div>
          <div className="w-36">
            <ZoruLabel className="text-[11px]" htmlFor="nf-from">
              From
            </ZoruLabel>
            <ZoruInput
              id="nf-from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="w-36">
            <ZoruLabel className="text-[11px]" htmlFor="nf-to">
              To
            </ZoruLabel>
            <ZoruInput
              id="nf-to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          {hasActiveFilters ? (
            <ZoruButton variant="ghost" size="sm" onClick={clearFilters} className="mb-1">
              <X className="h-3.5 w-3.5" /> Clear
            </ZoruButton>
          ) : null}
        </div>
      }
      empty={
        filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-4">
            <Inbox className="h-8 w-8 text-zoru-ink-muted" />
            <h3 className="text-base font-medium text-zoru-ink">
              {rows.length === 0 ? 'Your inbox is empty' : 'No notifications match the filters'}
            </h3>
            <p className="max-w-sm text-sm text-zoru-ink-muted">
              {rows.length === 0
                ? 'When teammates @-mention you, assign work, or an automation fires, you’ll see it here.'
                : 'Try clearing the filters above.'}
            </p>
            {hasActiveFilters ? (
              <ZoruButton variant="outline" onClick={clearFilters}>
                Clear filters
              </ZoruButton>
            ) : null}
          </div>
        ) : null
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <ZoruStatCard label="Unread" value={kpis.unread.toLocaleString()} />
          <ZoruStatCard label="Today" value={kpis.today.toLocaleString()} />
          <ZoruStatCard label="This week" value={kpis.thisWeek.toLocaleString()} />
          <ZoruStatCard label="Types" value={kpis.types.toLocaleString()} />
        </div>

        {unreadRows.length > 0 ? (
          <Section
            title="Unread"
            count={unreadRows.length}
            tone="amber"
            rows={unreadRows}
            onMarkRead={markOne}
            onDismiss={dismissOne}
          />
        ) : null}
        {readRows.length > 0 ? (
          <Section
            title="Read"
            count={readRows.length}
            tone="neutral"
            rows={readRows}
            onDismiss={dismissOne}
          />
        ) : null}
      </div>
    </EntityListShell>
  );
}

function Section({
  title,
  count,
  tone,
  rows,
  onMarkRead,
  onDismiss,
}: {
  title: string;
  count: number;
  tone: 'amber' | 'neutral';
  rows: Row[];
  onMarkRead?: (id: string) => void;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  return (
    <ZoruCard className="p-0">
      <div className="border-b border-zoru-line p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-zoru-ink-muted" />
          <h2 className="text-[14px] font-semibold text-zoru-ink">{title}</h2>
          <ZoruBadge variant={tone === 'amber' ? 'warning' : 'secondary'}>{count}</ZoruBadge>
        </div>
      </div>
      <ul className="divide-y divide-zoru-line">
        {rows.map((n) => {
          const href = entityHref(n.resource_type, n.resource_id);
          return (
            <li
              key={n._id}
              className={cn(
                'flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between',
                !n.read_at && 'bg-zoru-warning-bg/20',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium text-zoru-ink">{n.title}</p>
                  <ZoruBadge variant="secondary">{n.type}</ZoruBadge>
                  {n.resource_type ? (
                    <ZoruBadge variant="secondary">{n.resource_type}</ZoruBadge>
                  ) : null}
                </div>
                {n.body ? (
                  <p className="mt-1 text-[12.5px] text-zoru-ink-muted">{n.body}</p>
                ) : null}
                <p className="mt-1 text-[11.5px] text-zoru-ink-muted">
                  {formatRelative(n.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {href ? (
                  <ZoruButton asChild variant="ghost" size="sm">
                    <Link href={href}>
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open
                    </Link>
                  </ZoruButton>
                ) : null}
                {onMarkRead && !n.read_at ? (
                  <ZoruButton variant="ghost" size="sm" onClick={() => onMarkRead(n._id)}>
                    <Check className="h-3.5 w-3.5" />
                    Read
                  </ZoruButton>
                ) : null}
                <ZoruButton variant="ghost" size="sm" onClick={() => onDismiss(n._id)}>
                  <X className="h-3.5 w-3.5" />
                </ZoruButton>
              </div>
            </li>
          );
        })}
      </ul>
    </ZoruCard>
  );
}
