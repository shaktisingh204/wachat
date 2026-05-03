'use client';

import * as React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Search, XCircle } from 'lucide-react';

import { ClayCard, ClayButton, ClayBadge } from '@/components/clay';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { WsUserActivity } from '@/lib/worksuite/chat-types';

export interface ActivityBrowserProps {
  activities: (WsUserActivity & { _id: string })[];
  initialFilters: {
    actor: string;
    action: string;
    resourceType: string;
    from: string;
    to: string;
  };
}

function formatStamp(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ActivityBrowser({ activities, initialFilters }: ActivityBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [filters, setFilters] = React.useState(initialFilters);

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault();
    const sp = new URLSearchParams();
    if (filters.actor) sp.set('actor', filters.actor);
    if (filters.action) sp.set('action', filters.action);
    if (filters.resourceType) sp.set('resourceType', filters.resourceType);
    if (filters.from) sp.set('from', filters.from);
    if (filters.to) sp.set('to', filters.to);
    const qs = sp.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const clearFilters = () => {
    setFilters({ actor: '', action: '', resourceType: '', from: '', to: '' });
    router.push(pathname);
  };

  const hasFilters = Object.values(filters).some((v) => Boolean(v));

  return (
    <div className="flex flex-col gap-4">
      <ClayCard>
        <form
          onSubmit={applyFilters}
          className="grid gap-3 md:grid-cols-5"
          aria-label="Filter activity"
        >
          <div>
            <Label className="text-[11.5px] text-muted-foreground">Actor</Label>
            <Input
              value={filters.actor}
              onChange={(e) => setFilters((f) => ({ ...f, actor: e.target.value }))}
              placeholder="User id"
              className="mt-1 h-9 rounded-lg border-border bg-card text-[12.5px]"
            />
          </div>
          <div>
            <Label className="text-[11.5px] text-muted-foreground">Action</Label>
            <Input
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              placeholder="e.g. created"
              className="mt-1 h-9 rounded-lg border-border bg-card text-[12.5px]"
            />
          </div>
          <div>
            <Label className="text-[11.5px] text-muted-foreground">Resource type</Label>
            <Input
              value={filters.resourceType}
              onChange={(e) =>
                setFilters((f) => ({ ...f, resourceType: e.target.value }))
              }
              placeholder="task / lead / deal"
              className="mt-1 h-9 rounded-lg border-border bg-card text-[12.5px]"
            />
          </div>
          <div>
            <Label className="text-[11.5px] text-muted-foreground">From</Label>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              className="mt-1 h-9 rounded-lg border-border bg-card text-[12.5px]"
            />
          </div>
          <div>
            <Label className="text-[11.5px] text-muted-foreground">To</Label>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              className="mt-1 h-9 rounded-lg border-border bg-card text-[12.5px]"
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-5">
            <ClayButton
              type="submit"
              variant="obsidian"
              size="sm"
              leading={<Search className="h-3.5 w-3.5" />}
            >
              Apply
            </ClayButton>
            {hasFilters ? (
              <ClayButton
                type="button"
                variant="pill"
                size="sm"
                onClick={clearFilters}
                leading={<XCircle className="h-3.5 w-3.5" />}
              >
                Clear
              </ClayButton>
            ) : null}
          </div>
        </form>
      </ClayCard>

      {activities.length === 0 ? (
        <ClayCard className="flex items-center justify-center py-12">
          <p className="text-[13px] text-muted-foreground">No activity in this window.</p>
        </ClayCard>
      ) : (
        <ClayCard padded={false}>
          <ul className="divide-y divide-border">
            {activities.map((a) => (
              <li key={a._id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-medium text-foreground">
                    {a.actor_user_id}
                  </span>
                  <ClayBadge tone="neutral">{a.action}</ClayBadge>
                  {a.resource_type ? (
                    <ClayBadge tone="rose-soft">{a.resource_type}</ClayBadge>
                  ) : null}
                  <span className="ml-auto text-[11.5px] text-muted-foreground">
                    {formatStamp(a.occurred_at)}
                  </span>
                </div>
                {a.description ? (
                  <p className="mt-1 text-[13px] text-foreground">{a.description}</p>
                ) : null}
                {a.ip_address ? (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    IP {a.ip_address}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </ClayCard>
      )}
    </div>
  );
}
