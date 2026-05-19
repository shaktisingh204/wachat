/**
 * Email Suite — Reports Rust client.
 *
 * Thin typed wrappers around `/v1/email/reports/*` exposed by the
 * `email-reports` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export interface EmailMetricsTotals {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  /** Pre-computed rates, 0..1. */
  deliveryRate?: number;
  openRate?: number;
  clickRate?: number;
  bounceRate?: number;
  unsubscribeRate?: number;
}

export interface EmailTimeseriesPoint {
  /** ISO timestamp (date for daily, ISO for finer-grain). */
  t: string;
  sent?: number;
  delivered?: number;
  opened?: number;
  clicked?: number;
  bounced?: number;
  unsubscribed?: number;
}

export interface EmailDeviceBreakdown {
  device: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  count: number;
}

export interface EmailClientBreakdown {
  client: string;
  count: number;
}

export interface EmailCampaignReport {
  campaignId: string;
  campaignName: string;
  totals: EmailMetricsTotals;
  timeseries: EmailTimeseriesPoint[];
  devices?: EmailDeviceBreakdown[];
  clients?: EmailClientBreakdown[];
  topLinks?: Array<{ url: string; clicks: number; uniqueClicks?: number }>;
}

export interface EmailJourneyStepReport {
  stepId: string;
  stepLabel?: string;
  entered: number;
  completed: number;
  dropped: number;
}

export interface EmailJourneyReport {
  journeyId: string;
  journeyName: string;
  totals: EmailMetricsTotals;
  steps: EmailJourneyStepReport[];
  timeseries: EmailTimeseriesPoint[];
}

export interface EmailAccountReport {
  totals: EmailMetricsTotals;
  timeseries: EmailTimeseriesPoint[];
  devices?: EmailDeviceBreakdown[];
  topCampaigns?: Array<{ campaignId: string; campaignName: string; sent: number; openRate: number; clickRate: number }>;
}

export interface EmailCompareRow {
  campaignId: string;
  campaignName: string;
  totals: EmailMetricsTotals;
}

export interface EmailRevenueReport {
  totals: {
    sent: number;
    conversions: number;
    revenue: number;
    revenuePerEmail: number;
    currency: string;
  };
  timeseries: Array<{ t: string; revenue: number; conversions: number }>;
  topCampaigns?: Array<{ campaignId: string; campaignName: string; revenue: number; conversions: number }>;
}

export function getCampaignReport(id: string) {
  return rustFetch<EmailCampaignReport>(`/v1/email/reports/campaigns/${id}`);
}

export function getJourneyReport(id: string) {
  return rustFetch<EmailJourneyReport>(`/v1/email/reports/journeys/${id}`);
}

export function getAccountReport() {
  return rustFetch<EmailAccountReport>('/v1/email/reports/account');
}

export function compareCampaigns(campaignIds: string[]) {
  return rustFetch<{ rows: EmailCompareRow[] }>('/v1/email/reports/compare', {
    method: 'POST',
    body: JSON.stringify({ campaignIds }),
  });
}

export function getRevenueReport() {
  return rustFetch<EmailRevenueReport>('/v1/email/reports/revenue');
}
