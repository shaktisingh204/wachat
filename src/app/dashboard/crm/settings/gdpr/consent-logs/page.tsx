'use client';

import * as React from 'react';
import { useEffect, useState, useTransition } from 'react';
import { ScrollText } from 'lucide-react';

import { ClayCard, ClayBadge } from '@/components/clay';
import { CrmPageHeader } from '../../../_components/crm-page-header';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
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

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Consent Logs"
        subtitle="Audit trail of purpose consents granted or revoked by leads and users."
        icon={ScrollText}
      />

      <ClayCard>
        <Tabs defaultValue="leads" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="leads">
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="users">
              Users ({users.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leads">
            <div className="overflow-x-auto rounded-clay-md border border-clay-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-clay-border hover:bg-transparent">
                    <TableHead className="text-clay-ink-muted">
                      Lead ID
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      Purpose
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      State
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && leads.length === 0 ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i} className="border-clay-border">
                        <TableCell colSpan={5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : leads.length === 0 ? (
                    <TableRow className="border-clay-border">
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-[13px] text-clay-ink-muted"
                      >
                        No lead consent entries yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    leads.map((row) => (
                      <TableRow key={row._id} className="border-clay-border">
                        <TableCell className="text-[13px] text-clay-ink">
                          {row.lead_id || '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {purposeTitle(row.purpose_consent_id)}
                        </TableCell>
                        <TableCell>
                          <ClayBadge tone={row.granted ? 'green' : 'red'}>
                            {row.granted ? 'Granted' : 'Revoked'}
                          </ClayBadge>
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink-muted">
                          {formatDateTime(row.granted_at)}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink-muted">
                          {row.ip_address || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <div className="overflow-x-auto rounded-clay-md border border-clay-border">
              <Table>
                <TableHeader>
                  <TableRow className="border-clay-border hover:bg-transparent">
                    <TableHead className="text-clay-ink-muted">
                      User ID
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      Purpose
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      State
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">
                      Timestamp
                    </TableHead>
                    <TableHead className="text-clay-ink-muted">IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading && users.length === 0 ? (
                    [...Array(3)].map((_, i) => (
                      <TableRow key={i} className="border-clay-border">
                        <TableCell colSpan={5}>
                          <Skeleton className="h-8 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : users.length === 0 ? (
                    <TableRow className="border-clay-border">
                      <TableCell
                        colSpan={5}
                        className="h-24 text-center text-[13px] text-clay-ink-muted"
                      >
                        No user consent entries yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map((row) => (
                      <TableRow key={row._id} className="border-clay-border">
                        <TableCell className="text-[13px] text-clay-ink">
                          {row.target_user_id || '—'}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink">
                          {purposeTitle(row.purpose_consent_id)}
                        </TableCell>
                        <TableCell>
                          <ClayBadge tone={row.granted ? 'green' : 'red'}>
                            {row.granted ? 'Granted' : 'Revoked'}
                          </ClayBadge>
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink-muted">
                          {formatDateTime(row.granted_at)}
                        </TableCell>
                        <TableCell className="text-[13px] text-clay-ink-muted">
                          {row.ip_address || '—'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </ClayCard>
    </div>
  );
}
