'use client';

import { Badge, Button, Card, Checkbox, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Table, TBody, Td, Th, THead, Tr } from '@/components/sabcrm/20ui/compat';
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
import { bulkRevokePortalUsers } from '@/app/actions/crm-portal.actions';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/sabcrm/20ui/compat';

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
  if (Number.isNaN(d.getTime())) return '—';
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const min = String(d.getUTCMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min} UTC`;
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
  const router = useRouter();
  const { toast } = useToast();
  const [isRevoking, setIsRevoking] = React.useState(false);

  const runBulkRevoke = async () => {
    setIsRevoking(true);
    const res = await bulkRevokePortalUsers(Array.from(selected));
    setIsRevoking(false);
    if (res.success) {
      toast({ title: 'Access revoked for selected users.' });
      setSelected(new Set());
      router.refresh();
    } else {
      toast({ title: 'Bulk revoke failed', description: res.error, variant: 'destructive' });
    }
  };


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
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--st-text-secondary)]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, type…"
            className="h-9 pl-9 text-[13px]"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-[140px] text-[13px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {statusOptions.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-9 w-[140px] text-[13px]">
            <SelectValue placeholder="Portal type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {typeOptions.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={capabilityFilter}
          onValueChange={setCapabilityFilter}
        >
          <SelectTrigger className="h-9 w-[160px] text-[13px]">
            <SelectValue placeholder="Capability" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All capabilities</SelectItem>
            {capabilityOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters ? (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-[var(--st-radius)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] px-3 py-2 shadow-[var(--st-shadow-sm)]">
          <div className="flex items-center gap-2 text-[12.5px] text-[var(--st-text)]">
            <ListChecks className="h-4 w-4 text-[var(--st-text)]" />
            {selected.size} selected
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button size="sm" variant="destructive" onClick={runBulkRevoke} disabled={isRevoking}>
              Revoke Access
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(new Set())}
              aria-label="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <THead>
              <Tr className="border-[var(--st-border)] hover:bg-transparent">
                <Th className="w-8">
                  <Checkbox
                    checked={headChecked}
                    onCheckedChange={(c) => toggleAll(Boolean(c))}
                    aria-label="Select all"
                  />
                </Th>
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Type</Th>
                <Th>Capabilities</Th>
                <Th>Linked entity</Th>
                <Th>Status</Th>
                <Th>Last Active</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {filtered.length === 0 ? (
                <Tr>
                  <Td
                    colSpan={9}
                    className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                  >
                    {users.length === 0
                      ? 'No portal users yet. Invite customers, vendors or employees to your self-service portal.'
                      : 'No users match these filters.'}
                  </Td>
                </Tr>
              ) : (
                filtered.map((u) => {
                  const caps = u.capabilities ?? [];
                  return (
                    <Tr key={u._id}>
                      <Td>
                        <Checkbox
                          checked={selected.has(u._id)}
                          onCheckedChange={() => toggleOne(u._id)}
                          aria-label="Select"
                        />
                      </Td>
                      <Td>
                        <EntityRowLink
                          href={`/dashboard/crm/portal/${u._id}`}
                          label={u.name || 'Unnamed user'}
                          subtitle={u.email || undefined}
                        />
                      </Td>
                      <Td>{u.email || '—'}</Td>
                      <Td>
                        {u.portalType ? (
                          <Badge variant="outline">{u.portalType}</Badge>
                        ) : (
                          <span className="text-[var(--st-text-secondary)]">—</span>
                        )}
                      </Td>
                      <Td>
                        <span className="text-[12.5px] text-[var(--st-text-secondary)]">
                          {caps.length > 0 ? caps.join(', ') : '—'}
                        </span>
                      </Td>
                      <Td>
                        {u.linkedEntityLabel || u.linkedEntityId || '—'}
                      </Td>
                      <Td>
                        <StatusPill
                          label={u.status || 'pending'}
                          tone={statusToTone(u.status)}
                        />
                      </Td>
                      <Td className="text-[var(--st-text)]">
                        {fmtDateTime(u.lastLoginAt)}
                      </Td>
                      <Td className="text-right">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/dashboard/crm/portal/${u._id}/edit`}>
                            Edit
                          </Link>
                        </Button>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </TBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
