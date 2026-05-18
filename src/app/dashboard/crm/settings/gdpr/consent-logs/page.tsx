'use client';

import {
  ZoruBadge,
  ZoruCard,
  ZoruSkeleton,
  ZoruStatCard,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  cn,
} from '@/components/zoruui';
import {
  useEffect,
  useState,
  useTransition } from 'react';
import { ScrollText } from 'lucide-react';

import * as React from 'react';

import { CrmPageHeader } from '../../../_components/crm-page-header';
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

export default function ConsentLogsPage() {
  const [tab, setTab] = useState<'leads' | 'users'>('leads');
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [purposes, setPurposes] = useState<PurposeRow[]>([]);
  const [isLoading, startLoading] = useTransition();

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

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Consent Logs"
        subtitle="Audit trail of purpose consents granted or revoked by leads and users."
        icon={ScrollText}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ZoruStatCard label="Total entries" value={totalEntries.toLocaleString()} />
        <ZoruStatCard label="Active (granted)" value={grantedEntries.toLocaleString()} />
        <ZoruStatCard label="Withdrawn (revoked)" value={revokedEntries.toLocaleString()} />
      </div>

      <ZoruCard className="p-6">
        <div className="mb-4 inline-flex gap-1 rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-1">
          {(['leads', 'users'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                'rounded-[var(--zoru-radius-sm)] px-3 py-1.5 text-sm transition-colors',
                tab === id
                  ? 'bg-zoru-bg text-zoru-ink shadow-[var(--zoru-shadow-sm)]'
                  : 'text-zoru-ink-muted hover:text-zoru-ink',
              )}
            >
              {id === 'leads' ? `Leads (${leads.length})` : `Users (${users.length})`}
            </button>
          ))}
        </div>

        {tab === 'leads' ? (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">Lead ID</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Purpose</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">State</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Timestamp</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">IP</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && leads.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={5}>
                        <ZoruSkeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : leads.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No lead consent entries yet.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  leads.map((row) => (
                    <ZoruTableRow key={row._id}>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {row.lead_id || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {purposeTitle(row.purpose_consent_id)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={row.granted ? 'success' : 'danger'}>
                          {row.granted ? 'Granted' : 'Revoked'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {formatDateTime(row.granted_at)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {row.ip_address || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zoru-line">
            <ZoruTable>
              <ZoruTableHeader>
                <ZoruTableRow className="hover:bg-transparent">
                  <ZoruTableHead className="text-zoru-ink-muted">User ID</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Purpose</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">State</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">Timestamp</ZoruTableHead>
                  <ZoruTableHead className="text-zoru-ink-muted">IP</ZoruTableHead>
                </ZoruTableRow>
              </ZoruTableHeader>
              <ZoruTableBody>
                {isLoading && users.length === 0 ? (
                  [...Array(3)].map((_, i) => (
                    <ZoruTableRow key={i}>
                      <ZoruTableCell colSpan={5}>
                        <ZoruSkeleton className="h-8 w-full" />
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                ) : users.length === 0 ? (
                  <ZoruTableRow>
                    <ZoruTableCell
                      colSpan={5}
                      className="h-24 text-center text-[13px] text-zoru-ink-muted"
                    >
                      No user consent entries yet.
                    </ZoruTableCell>
                  </ZoruTableRow>
                ) : (
                  users.map((row) => (
                    <ZoruTableRow key={row._id}>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {row.target_user_id || '—'}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink">
                        {purposeTitle(row.purpose_consent_id)}
                      </ZoruTableCell>
                      <ZoruTableCell>
                        <ZoruBadge variant={row.granted ? 'success' : 'danger'}>
                          {row.granted ? 'Granted' : 'Revoked'}
                        </ZoruBadge>
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {formatDateTime(row.granted_at)}
                      </ZoruTableCell>
                      <ZoruTableCell className="text-[13px] text-zoru-ink-muted">
                        {row.ip_address || '—'}
                      </ZoruTableCell>
                    </ZoruTableRow>
                  ))
                )}
              </ZoruTableBody>
            </ZoruTable>
          </div>
        )}
      </ZoruCard>
    </div>
  );
}
