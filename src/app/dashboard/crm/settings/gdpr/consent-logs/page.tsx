'use client';

import {
  Badge,
  Button,
  Card,
  Select,
  ZoruSelectContent,
  ZoruSelectItem,
  ZoruSelectTrigger,
  ZoruSelectValue,
  Skeleton,
  StatCard,
  Table,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
  useZoruToast,
} from '@/components/sabcrm/20ui/compat';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import * as React from 'react';
import { Download } from 'lucide-react';

import { EntityListShell } from '@/components/crm/entity-list-shell';
import {
  getPurposeConsentLeads,
  getPurposeConsentUsers,
  getPurposeConsents,
} from '@/app/actions/worksuite/gdpr.actions';
import type {
  WsPurposeConsent,
  WsPurposeConsentLead,
  WsPurposeConsentUser,
} from '@/lib/worksuite/gdpr-types';

type LeadRow = WsPurposeConsentLead & { _id: string };
type UserRow = WsPurposeConsentUser & { _id: string };
type PurposeRow = WsPurposeConsent & { _id: string };

function formatDateTime(value?: Date | string) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

type StatusFilter = 'all' | 'granted' | 'revoked';

export default function ConsentLogsPage() {
  const { toast } = useZoruToast();
  const [tab, setTab] = useState<'leads' | 'users'>('leads');
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [purposes, setPurposes] = useState<PurposeRow[]>([]);
  const [isLoading, startLoading] = useTransition();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const refresh = React.useCallback(() => {
    startLoading(async () => {
      try {
        const [leadList, userList, purposeList] = await Promise.all([
          getPurposeConsentLeads() as Promise<LeadRow[]>,
          getPurposeConsentUsers() as Promise<UserRow[]>,
          getPurposeConsents() as Promise<PurposeRow[]>,
        ]);
        setLeads(Array.isArray(leadList) ? leadList : []);
        setUsers(Array.isArray(userList) ? userList : []);
        setPurposes(Array.isArray(purposeList) ? purposeList : []);
      } catch (e) {
        console.error('Failed to load consent logs:', e);
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const purposeTitle = (id?: string) => {
    if (!id) return '—';
    const p = purposes.find((x) => x._id === id);
    return p ? p.title : id;
  };

  // KPI strip: Total · Active (granted) · Withdrawn (revoked)
  const allRows = [...leads, ...users];
  const totalEntries = allRows.length;
  const grantedEntries = allRows.filter((r) => r.granted).length;
  const revokedEntries = totalEntries - grantedEntries;

  const visibleLeads = React.useMemo(() => {
    if (statusFilter === 'granted') return leads.filter((r) => r.granted);
    if (statusFilter === 'revoked') return leads.filter((r) => !r.granted);
    return leads;
  }, [leads, statusFilter]);

  const visibleUsers = React.useMemo(() => {
    if (statusFilter === 'granted') return users.filter((r) => r.granted);
    if (statusFilter === 'revoked') return users.filter((r) => !r.granted);
    return users;
  }, [users, statusFilter]);

  const handleExportCsv = () => {
    const src = tab === 'leads' ? visibleLeads : visibleUsers;
    if (!src.length) {
      toast({ title: 'Nothing to export' });
      return;
    }
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = tab === 'leads'
      ? ['Lead ID', 'Purpose', 'State', 'Timestamp', 'IP']
      : ['User ID', 'Purpose', 'State', 'Timestamp', 'IP'];
    const csvRows = src.map((r) => [
      escape(tab === 'leads' ? (r as LeadRow).lead_id ?? '' : (r as UserRow).target_user_id ?? ''),
      escape(purposeTitle(r.purpose_consent_id)),
      escape(r.granted ? 'Granted' : 'Revoked'),
      escape(formatDateTime(r.granted_at)),
      escape(r.ip_address ?? ''),
    ].join(','));
    const csv = [header.join(','), ...csvRows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `consent-logs-${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <EntityListShell
      title="Consent Logs"
      subtitle="Audit trail of purpose consents granted or revoked by leads and users."
    >

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <button type="button" className="text-left" onClick={() => setStatusFilter('all')}>
          <StatCard
            label="Total entries"
            value={totalEntries.toLocaleString()}
            className={cn(statusFilter === 'all' && 'ring-1 ring-[var(--st-text)] rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('granted')}>
          <StatCard
            label="Active (granted)"
            value={grantedEntries.toLocaleString()}
            className={cn(statusFilter === 'granted' && 'ring-1 ring-[var(--st-text)] rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
        <button type="button" className="text-left" onClick={() => setStatusFilter('revoked')}>
          <StatCard
            label="Withdrawn (revoked)"
            value={revokedEntries.toLocaleString()}
            className={cn(statusFilter === 'revoked' && 'ring-1 ring-[var(--st-text)] rounded-[var(--zoru-radius-lg)]')}
          />
        </button>
      </div>

      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex gap-1 rounded-[var(--zoru-radius-sm)] border border-[var(--st-border)] bg-[var(--st-bg-secondary)] p-1">
          {(['leads', 'users'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                tab === id
                  ? 'bg-[var(--st-bg)] text-[var(--st-text)] shadow-[var(--zoru-shadow-sm)]'
                  : 'text-[var(--st-text-secondary)] hover:text-[var(--st-text)]',
              )}
            >
              {id === 'leads' ? `Leads (${leads.length})` : `Users (${users.length})`}
            </button>
          ))}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as StatusFilter)}
            >
              <ZoruSelectTrigger className="h-8 w-[140px] text-[12px]">
                <ZoruSelectValue />
              </ZoruSelectTrigger>
              <ZoruSelectContent>
                <ZoruSelectItem value="all">All states</ZoruSelectItem>
                <ZoruSelectItem value="granted">Granted</ZoruSelectItem>
                <ZoruSelectItem value="revoked">Revoked</ZoruSelectItem>
              </ZoruSelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={handleExportCsv}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </div>
        </div>

        {tab === 'leads' ? (
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Lead ID</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Purpose</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">State</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Timestamp</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">IP</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && leads.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : visibleLeads.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      No lead consent entries match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  visibleLeads.map((row) => (
                    <ZoruTableRow key={row._id}>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                        {row.lead_id || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                        {purposeTitle(row.purpose_consent_id)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={row.granted ? 'success' : 'danger'}>
                          {row.granted ? 'Granted' : 'Revoked'}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                        {formatDateTime(row.granted_at)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                        {row.ip_address || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </Table>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--st-border)]">
            <Table>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">User ID</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Purpose</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">State</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">Timestamp</ZoruTableHead>
                  <ZoruTableHead className="text-[var(--st-text-secondary)]">IP</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && users.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={5}>
                        <Skeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : visibleUsers.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-[var(--st-text-secondary)]"
                    >
                      No user consent entries match this filter.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  visibleUsers.map((row) => (
                    <ZoruTableRow key={row._id}>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                        {row.target_user_id || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text)]">
                        {purposeTitle(row.purpose_consent_id)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <Badge variant={row.granted ? 'success' : 'danger'}>
                          {row.granted ? 'Granted' : 'Revoked'}
                        </Badge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                        {formatDateTime(row.granted_at)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-[var(--st-text-secondary)]">
                        {row.ip_address || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </Table>
          </div>
        )}
      </Card>
    </EntityListShell>
  );
}
