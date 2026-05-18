'use client';

import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCheckbox,
  ZoruInput,
  ZoruLabel,
  ZoruSkeleton,
  ZoruTable,
  ZoruTableBody,
  ZoruTableCell,
  ZoruTableHead,
  ZoruTableHeader,
  ZoruTableRow,
  useZoruToast,
} from '@/components/zoruui';
import * as React from 'react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { ShieldCheck, LoaderCircle } from 'lucide-react';

import { CrmPageHeader } from '../../_components/crm-page-header';

import {
  getPurposeConsents,
  getLeadConsents,
  grantLeadConsent,
  revokeLeadConsent,
} from '@/app/actions/worksuite/gdpr.actions';
import type {
  WsPurposeConsent,
  WsPurposeConsentLead,
} from '@/lib/worksuite/gdpr-types';

type PurposeRow = WsPurposeConsent & { _id: string };
type ConsentRow = WsPurposeConsentLead & { _id: string };

function formatDateTime(value?: Date | string) {
  if (!value) return '—';
  const d = new Date(value as any);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}

/**
 * Per-lead consent management view — enter a lead ID, load their
 * current consent state across all active purposes, and bulk-grant or
 * revoke specific purposes. Intentionally a sibling of the existing
 * all-leads pages so we don't touch lead UI.
 */
export default function LeadConsentPage() {
  const { toast } = useZoruToast();
  const [leadId, setLeadId] = useState('');
  const [activeLeadId, setActiveLeadId] = useState('');
  const [purposes, setPurposes] = useState<PurposeRow[]>([]);
  const [history, setHistory] = useState<ConsentRow[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [isLoading, startLoading] = useTransition();
  const [pending, startPending] = useTransition();

  const loadPurposes = React.useCallback(() => {
    startLoading(async () => {
      try {
        const list = (await getPurposeConsents()) as PurposeRow[];
        const filtered = (Array.isArray(list) ? list : []).filter(
          (p) =>
            p.is_active !== false &&
            (p.applies_to === 'lead' ||
              p.applies_to === 'both' ||
              p.applies_to === undefined),
        );
        setPurposes(filtered);
      } catch (e) {
        console.error('Failed to load purposes:', e);
      }
    });
  }, []);

  useEffect(() => {
    loadPurposes();
  }, [loadPurposes]);

  const loadHistory = React.useCallback(async (id: string) => {
    if (!id) {
      setHistory([]);
      return;
    }
    try {
      const list = (await getLeadConsents(id)) as ConsentRow[];
      setHistory(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Failed to load lead consents:', e);
      setHistory([]);
    }
  }, []);

  const onLookup = () => {
    const trimmed = leadId.trim();
    if (!trimmed) {
      toast({
        title: 'Lead ID required',
        description: 'Enter a lead ID to manage its consents.',
        variant: 'destructive',
      });
      return;
    }
    setActiveLeadId(trimmed);
    setSelected({});
    loadHistory(trimmed);
  };

  const latestByPurpose = useMemo(() => {
    const map = new Map<string, ConsentRow>();
    for (const row of history) {
      const existing = map.get(row.purpose_consent_id);
      const rowTime = row.granted_at
        ? new Date(row.granted_at as any).getTime()
        : 0;
      const prevTime =
        existing && existing.granted_at
          ? new Date(existing.granted_at as any).getTime()
          : -1;
      if (!existing || rowTime >= prevTime) {
        map.set(row.purpose_consent_id, row);
      }
    }
    return map;
  }, [history]);

  const togglePurpose = (pid: string, value: boolean) => {
    setSelected((prev) => ({ ...prev, [pid]: value }));
  };

  const onGrant = () => {
    if (!activeLeadId) return;
    const ids = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (ids.length === 0) {
      toast({
        title: 'Nothing selected',
        description: 'Tick one or more purposes to grant consent.',
        variant: 'destructive',
      });
      return;
    }
    startPending(async () => {
      const res = await grantLeadConsent(activeLeadId, ids);
      if (res.success) {
        toast({
          title: 'Consent granted',
          description: `${res.count ?? ids.length} purpose(s) recorded.`,
        });
        setSelected({});
        loadHistory(activeLeadId);
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to grant',
          variant: 'destructive',
        });
      }
    });
  };

  const onRevoke = (pid: string) => {
    if (!activeLeadId) return;
    startPending(async () => {
      const res = await revokeLeadConsent(activeLeadId, pid);
      if (res.success) {
        toast({ title: 'Revoked', description: 'Consent revoked.' });
        loadHistory(activeLeadId);
      } else {
        toast({
          title: 'Error',
          description: res.error || 'Failed to revoke',
          variant: 'destructive',
        });
      }
    });
  };

  return (
    <div className="flex w-full flex-col gap-6">
      <CrmPageHeader
        title="Lead Consent"
        subtitle="Record purpose consents and revocations per lead with IP/UA capture."
        icon={ShieldCheck}
      />

      <ZoruCard>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <ZoruLabel htmlFor="lead-id" className="text-foreground">
              Lead ID
            </ZoruLabel>
            <div className="mt-1.5">
              <ZoruInput
                id="lead-id"
                value={leadId}
                onChange={(e) => setLeadId(e.target.value)}
                placeholder="Paste a lead _id"
                className="h-10 rounded-lg border-border bg-card text-[13px]"
              />
            </div>
          </div>
          <ZoruButton onClick={onLookup}>
            Load
          </ZoruButton>
        </div>
      </ZoruCard>

      {activeLeadId ? (
        <>
          <ZoruCard>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[14px] font-semibold text-foreground">
                Active purposes
              </h2>
              <ZoruButton
               
                disabled={pending}
                onClick={onGrant}
               
              >
                Grant selected
              </ZoruButton>
            </div>
            {isLoading && purposes.length === 0 ? (
              <div className="space-y-2">
                <ZoruSkeleton className="h-8 w-full" />
                <ZoruSkeleton className="h-8 w-full" />
              </div>
            ) : purposes.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No active purposes configured yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-border hover:bg-transparent">
                      <ZoruTableHead className="w-[40px]" />
                      <ZoruTableHead className="text-muted-foreground">
                        Purpose
                      </ZoruTableHead>
                      <ZoruTableHead className="text-muted-foreground">
                        State
                      </ZoruTableHead>
                      <ZoruTableHead className="text-muted-foreground">
                        Last updated
                      </ZoruTableHead>
                      <ZoruTableHead className="w-[120px] text-right text-muted-foreground">
                        Actions
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {purposes.map((p) => {
                      const latest = latestByPurpose.get(p._id);
                      const isGranted = latest?.granted === true;
                      return (
                        <ZoruTableRow
                          key={p._id}
                          className="border-border"
                        >
                          <ZoruTableCell>
                            <ZoruCheckbox
                              checked={!!selected[p._id]}
                              onCheckedChange={(v) =>
                                togglePurpose(p._id, !!v)
                              }
                              aria-label={`Select ${p.title}`}
                            />
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-foreground">
                            <div className="font-medium">{p.title}</div>
                            {p.description ? (
                              <div className="text-[11.5px] text-muted-foreground">
                                {p.description}
                              </div>
                            ) : null}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            {latest ? (
                              <ZoruBadge
                                variant={(isGranted ? 'green' : 'red') as any}
                              >
                                {isGranted ? 'Granted' : 'Revoked'}
                              </ZoruBadge>
                            ) : (
                              <ZoruBadge variant="ghost">No record</ZoruBadge>
                            )}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-muted-foreground">
                            {formatDateTime(latest?.granted_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-right">
                            {isGranted ? (
                              <ZoruButton
                                type="button"
                                variant="outline"
                                disabled={pending}
                                onClick={() => onRevoke(p._id)}
                              >
                                Revoke
                              </ZoruButton>
                            ) : null}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            )}
          </ZoruCard>

          <ZoruCard>
            <h2 className="mb-3 text-[14px] font-semibold text-foreground">
              History
            </h2>
            {history.length === 0 ? (
              <p className="text-[13px] text-muted-foreground">
                No consent events recorded for this lead yet.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <ZoruTable>
                  <ZoruTableHeader>
                    <ZoruTableRow className="border-border hover:bg-transparent">
                      <ZoruTableHead className="text-muted-foreground">
                        Purpose
                      </ZoruTableHead>
                      <ZoruTableHead className="text-muted-foreground">
                        State
                      </ZoruTableHead>
                      <ZoruTableHead className="text-muted-foreground">
                        Timestamp
                      </ZoruTableHead>
                      <ZoruTableHead className="text-muted-foreground">
                        IP
                      </ZoruTableHead>
                    </ZoruTableRow>
                  </ZoruTableHeader>
                  <ZoruTableBody>
                    {history.map((row) => {
                      const p = purposes.find(
                        (x) => x._id === row.purpose_consent_id,
                      );
                      return (
                        <ZoruTableRow
                          key={row._id}
                          className="border-border"
                        >
                          <ZoruTableCell className="text-[13px] text-foreground">
                            {p ? p.title : row.purpose_consent_id}
                          </ZoruTableCell>
                          <ZoruTableCell>
                            <ZoruBadge
                              variant={(row.granted ? 'green' : 'red') as any}
                            >
                              {row.granted ? 'Granted' : 'Revoked'}
                            </ZoruBadge>
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-muted-foreground">
                            {formatDateTime(row.granted_at)}
                          </ZoruTableCell>
                          <ZoruTableCell className="text-[13px] text-muted-foreground">
                            {row.ip_address || '—'}
                          </ZoruTableCell>
                        </ZoruTableRow>
                      );
                    })}
                  </ZoruTableBody>
                </ZoruTable>
              </div>
            )}
          </ZoruCard>
        </>
      ) : null}
    </div>
  );
}
