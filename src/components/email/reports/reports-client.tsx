'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';
import { BarChart3, DollarSign, RefreshCw, TrendingUp } from 'lucide-react';
import {
  ZoruBadge,
  ZoruButton,
  ZoruCard,
  ZoruCardContent,
  ZoruCardDescription,
  ZoruCardHeader,
  ZoruCardTitle,
  ZoruPageActions,
  ZoruPageDescription,
  ZoruPageHeader,
  ZoruPageHeading,
  ZoruPageTitle,
  ZoruSkeleton,
  zoruToast,
} from '@/components/zoruui';
import {
  actionCompareCampaigns,
  actionGetAccountReport,
  actionGetRevenueReport,
  type EmailAccountReport,
  type EmailCompareRow,
  type EmailRevenueReport,
} from '@/app/actions/email/reports.actions';
import { KpiTiles } from './kpi-tiles';
import { OpenClickChart } from './open-click-chart';
import { DeviceBreakdown } from './device-breakdown';
import { CompareTable } from './compare-table';

function formatRevenue(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function ReportsClient() {
  const [account, setAccount] = useState<EmailAccountReport | null>(null);
  const [revenue, setRevenue] = useState<EmailRevenueReport | null>(null);
  const [compareRows, setCompareRows] = useState<EmailCompareRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [comparing, startComparing] = useTransition();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [acctRes, revRes] = await Promise.all([
      actionGetAccountReport(),
      actionGetRevenueReport(),
    ]);
    if (acctRes.ok) setAccount(acctRes.data);
    else
      zoruToast({
        title: 'Failed to load account report',
        description: acctRes.error,
        variant: 'destructive',
      });
    if (revRes.ok) setRevenue(revRes.data);
    // revenue is optional — silent on failure
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // When the top campaigns load, run a comparison on the first 3 so the user
  // sees something useful without picking IDs by hand.
  useEffect(() => {
    if (!account?.topCampaigns || account.topCampaigns.length < 2) {
      setCompareRows([]);
      return;
    }
    const ids = account.topCampaigns.slice(0, 3).map((c) => c.campaignId);
    startComparing(async () => {
      const result = await actionCompareCampaigns(ids);
      if (result.ok) setCompareRows(result.data);
    });
  }, [account?.topCampaigns]);

  return (
    <div className="space-y-6">
      <ZoruPageHeader>
        <ZoruPageHeading>
          <ZoruPageTitle>
            <span className="inline-flex items-center gap-3">
              <BarChart3 className="h-6 w-6" /> Reports
            </span>
          </ZoruPageTitle>
          <ZoruPageDescription>
            Account-wide rollup of sends, engagement, devices and revenue.
          </ZoruPageDescription>
        </ZoruPageHeading>
        <ZoruPageActions>
          <ZoruButton variant="outline" onClick={() => void fetchAll()} disabled={loading}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </ZoruButton>
        </ZoruPageActions>
      </ZoruPageHeader>

      {loading ? (
        <div className="space-y-3">
          <ZoruSkeleton className="h-24 w-full" />
          <ZoruSkeleton className="h-72 w-full" />
        </div>
      ) : account ? (
        <>
          <KpiTiles totals={account.totals} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <OpenClickChart data={account.timeseries} />
            </div>
            <div className="lg:col-span-1">
              <DeviceBreakdown data={account.devices ?? []} />
            </div>
          </div>

          {revenue ? (
            <ZoruCard>
              <ZoruCardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <ZoruCardTitle className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Revenue attribution
                    </ZoruCardTitle>
                    <ZoruCardDescription>
                      Conversions and revenue tied to email sends.
                    </ZoruCardDescription>
                  </div>
                  <ZoruBadge variant="secondary">
                    <TrendingUp className="h-3 w-3" />
                    {formatRevenue(revenue.totals.revenuePerEmail, revenue.totals.currency)} / email
                  </ZoruBadge>
                </div>
              </ZoruCardHeader>
              <ZoruCardContent>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">Revenue</p>
                    <p className="text-2xl font-semibold text-zoru-ink">
                      {formatRevenue(revenue.totals.revenue, revenue.totals.currency)}
                    </p>
                  </div>
                  <div className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">Conversions</p>
                    <p className="text-2xl font-semibold text-zoru-ink">
                      {revenue.totals.conversions.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-[var(--zoru-radius-sm)] border border-zoru-line bg-zoru-surface p-3">
                    <p className="text-xs uppercase tracking-wide text-zoru-ink-muted">Sent</p>
                    <p className="text-2xl font-semibold text-zoru-ink">
                      {revenue.totals.sent.toLocaleString()}
                    </p>
                  </div>
                </div>
              </ZoruCardContent>
            </ZoruCard>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zoru-ink-muted">
              Top campaigns {comparing ? '· loading…' : null}
            </h2>
            <CompareTable rows={compareRows} />
          </section>
        </>
      ) : (
        <ZoruCard>
          <ZoruCardContent className="p-6 text-sm text-zoru-ink-muted">
            No report data available yet.
          </ZoruCardContent>
        </ZoruCard>
      )}
    </div>
  );
}
