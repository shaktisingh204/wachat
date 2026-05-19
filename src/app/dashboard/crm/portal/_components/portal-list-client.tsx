'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruSelect,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
} from '@/components/zoruui';
import {
  ListChecks,
  Search,
  X } from 'lucide-react';

/**
 * Portal users list client — §1D.1 upgrade. Adds KPI strip, filter
 * chips, and client-side bulk selection (CSV export).
 */

import * as React from 'react';
import Link from 'next/link';

import { EntityRowLink } from '@/components/crm/entity-row-link';
import { StatusPill, statusToTone } from '@/components/crm/status-pill';

import {
  PortalKpiStrip,
  computePortalKpis,
  type PortalKpiKey,
} from './portal-kpi-strip';
import type { PortalUserRow } from './portal-types';

interface PortalListClientProps {
  users: PortalUserRow[];
}

function fmtDateTime(v?: string | null): string {
  if (!v) return '—';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
}

export function PortalListClient({ users }: PortalListClientProps) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | string>('all');
  const [typeFilter, setTypeFilter] = React.useState<'all' | string>('all');
  const [capabilityFilter, setCapabilityFilter] = React.useState<'all' | string>(
    'all',
  );
  const [kpiKey, setKpiKey] = React.useState<PortalKpiKey>('all');
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const typeOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.portalType) s.add(u.portalType);
    return Array.from(s).sort();
  }, [users]);

  const statusOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.status) s.add(u.status);
    return Array.from(s).sort();
  }, [users]);

  const capabilityOptions = React.useMemo(() => {
    const s = new Set<string>();
    for (const u of users) {
      if (u.capabilities) for (const c of u.capabilities) s.add(c);
    }
    return Array.from(s).sort();
  }, [users]);

  const kpis = React.useMemo(() => computePortalKpis(users), [users]);

  const filtered = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    const now = Date.now();
    const sevenDays = now - 7 * 24 * 60 * 60 * 1000;
    return users.filter((u) => {
      if (needle) {
        const hay = [u.name ?? '', u.email ?? '', u.portalType ?? '']
          .join(' ')
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (typeFilter !== 'all' && u.portalType !== typeFilter) return false;
      if (capabilityFilter !== 'all') {
        if (!u.capabilities || !u.capabilities.includes(capabilityFilter))
          return false;
      }
      switch (kpiKey) {
        case 'active':
          if ((u.status ?? '').toLowerCase() !== 'active') return false;
          break;
        case 'recent':
          {
            const t = u.lastLoginAt ? new Date(u.lastLoginAt).getTime() : NaN;
            if (!Number.isFinite(t) || t < sevenDays) return false;
          }
          break;
      }
      return true;
    });
  }, [users, search, statusFilter, typeFilter, capabilityFilter, kpiKey]);

  const hasActiveFilters =
    !!search.trim() ||
    statusFilter !== 'all' ||
    typeFilter !== 'all' ||
    capabilityFilter !== 'all' ||
    kpiKey !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setTypeFilter('all');
    setCapabilityFilter('all');
    setKpiKey('all');
  };

  const headChecked =
    filtered.length > 0 && filtered.every((u) => selected.has(u._id));

  const toggleAll = (all: boolean) =>
    setSelected(all ? new Set(filtered.map((u) => u._id)) : new Set());

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const subset =
      selected.size > 0
        ? filtered.filter((u) => selected.has(u._id))
        : filtered;
    const header = [
      'Name',
      'Email',
      'Type',
      'Capabilities',
      'Linked entity',
      'Status',
      'Last login',
    ];
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      header.join(','),
      ...subset.map((u) =>
        [
          esc(u.name),
          esc(u.email),
          esc(u.portalType),
          esc((u.capabilities ?? []).join(' | ')),
          esc(u.linkedEntityLabel ?? u.linkedEntityId),
          esc(u.status),
          esc(u.lastLoginAt),
        ].join(','),
      ),
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portal-users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4">
      <PortalKpiStrip counts={kpis} active={kpiKey} onPick={setKpiKey} />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zoru-ink-muted" />
          <ZoruInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, type…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <ZoruSelect value={statusFilter} onValueChange={setStatusFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Status" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All statuses</ZoruSelectItem>
            {statusOptions.map((s) => (
              <ZoruSelectItem key={s} value={s}>
                {s}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
        <ZoruSelect value={typeFilter} onValueChange={setTypeFilter}>
          <ZoruSelectTrigger className="h-9 w-[140px] text-[13px]">
            <ZoruSelectValue placeholder="Portal type" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All types</ZoruSelectItem>
            {typeOptions.map((t) => (
              <ZoruSelectItem key={t} value={t}>
                {t}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
        <ZoruSelect
          value={capabilityFilter}
          onValueChange={setCapabilityFilter}
        >
          <ZoruSelectTrigger className="h-9 w-[160px] text-[13px]">
            <ZoruSelectValue placeholder="Capability" />
          </ZoruSelectTrigger>
          <ZoruSelectContent>
            <ZoruSelectItem value="all">All capabilities</ZoruSelectItem>
            {capabilityOptions.map((c) => (
              <ZoruSelectItem key={c} value={c}>
                {c}
              </ZoruSelectItem>
            ))}
          </ZoruSelectContent>
        </ZoruSelect>
        {hasActiveFilters ? (
          <ZoruButton variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </ZoruButton>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--zoru-radius)] border border-zoru-line bg-zoru-surface px-3 py-2 shadow-[var(--zoru-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-zoru-ink">
            <ListChecks className="h-4 w-4 text-zoru-primary" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <ZoruButton size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </ZoruButton>
            <ZoruButton
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </ZoruButton>
          </div>
        </div>
      ) : null}

      <ZoruCard className="p-0">
        <div className="overflow-x-auto">
          <ZoruTable>
            <ZoruTableHeader>
              <ZoruTableRow className="border-zoru-line hover:bg-transparent">
                <ZoruTableHead className="w-8">
                  <ZoruCheckbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </ZoruTableHead>
                <ZoruTableHead>Name</ZoruTableHead>
                <ZoruTableHead>Email</ZoruTableHead>
                <ZoruTableHead>Type</ZoruTableHead>
                <ZoruTableHead>Capabilities</ZoruTableHead>
                <ZoruTableHead>Linked entity</ZoruTableHead>
                <ZoruTableHead>Status</ZoruTableHead>
                <ZoruTableHead>Last login</ZoruTableHead>
                <ZoruTableHead className="text-right">Actions</ZoruTableHead>
              </ZoruTableRow>
            </ZoruTableHeader>
            <ZoruTableBody>
              {filtered.length === 0 ? (
                <ZoruTableRow>
                  <ZoruTableCell
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-zoru-ink-muted"
                  >
                    {users.length === 0
                      ? 'No portal users yet. Invite customers, vendors or employees to your self-service portal.'
                      : 'No users match these filters.'}
                  </ZoruTableCell>
                </ZoruTableRow>
              ) : (
                filtered.map((u) => {
                  const caps = u.capabilities ?? [];
                  return (
                    <ZoruTableRow key={u._id}>
                      <ZoruTableCell>
                        <ZoruCheckbox
                          checked={selected.has(u._id)}
                          onCheckedChange={() => toggleOne(u._id)}
                          aria-label="Select"
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <EntityRowLink
                          href={`/dashboard/crm/portal/${u._id}`}
                          label={u.name || 'Unnamed user'}
                          subtitle={u.email || undefined}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell>{u.email || '—'}</ZoruTableCell>
                      <ZoruTableCell>
                        {u.portalType ? (
                          <ZoruBadge variant="outline">{u.portalType}</ZoruBadge>
                        ) : (
                          <span className="text-zoru-ink-muted">—</span>
                        )}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <span className="text-[12.5px] text-zoru-ink-muted">
                          {caps.length > 0 ? caps.join(', ') : '—'}
                        </span>
                      </ZoruTableCell>
                      <ZoruTableCell>
                        {u.linkedEntityLabel || u.linkedEntityId || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <StatusPill
                          label={u.status || 'pending'}
                          tone={statusToTone(u.status)}
                        />
                      </ZoruTableCell>
                      <ZoruTableCell className="text-zoru-ink">
                        {fmtDateTime(u.lastLoginAt)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-right">
                        <ZoruButton size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/portal/${u._id}/edit`}>
                            Edit
                          </Link>
                        </ZoruButton>
                      </ZoruTableCell>
                    </ZoruTableRow>
                  );
                })
              )}
            </ZoruTableBody>
          </ZoruTable>
        </div>
      </ZoruCard>
    </div>
  );
}
