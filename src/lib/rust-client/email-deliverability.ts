/**
 * Email Suite — Deliverability Rust client.
 *
 * Thin typed wrappers around `/v1/email/deliverability/*` exposed by the
 * `email-deliverability` Rust crate. All calls go through `rustFetch`,
 * which attaches the authenticated user's JWT.
 */
import 'server-only';

import { rustFetch } from './fetcher';

export type DnsRecordStatus = 'valid' | 'invalid' | 'pending' | 'missing';

export interface DnsRecord {
  type: 'SPF' | 'DKIM' | 'DMARC' | 'MX' | string;
  host: string;
  value: string;
  status: DnsRecordStatus;
  expectedValue?: string;
  lastCheckedAt?: string;
  error?: string;
}

export interface EmailDomainDoc {
  _id: string;
  userId: string;
  domain: string;
  spf: DnsRecord;
  dkim: DnsRecord;
  dmarc: DnsRecord;
  mx: DnsRecord;
  verified: boolean;
  dkimSelector?: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DkimGenerateResult {
  selector: string;
  dnsRecord: DnsRecord;
}

export interface WarmupDayPlan {
  day: number;
  cap: number;
}

export type WarmupStatus = 'active' | 'paused' | 'completed' | 'cancelled';

export interface WarmupRunDoc {
  _id: string;
  userId: string;
  domain: string;
  schedule: WarmupDayPlan[];
  currentDay: number;
  status: WarmupStatus;
  startedAt: string;
  pausedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PlacementProvider = 'gmail' | 'outlook' | 'yahoo' | 'apple' | string;
export type PlacementFolder = 'inbox' | 'promotions' | 'spam' | 'unknown';

export interface PlacementProviderResult {
  provider: PlacementProvider;
  folder: PlacementFolder;
}

export interface PlacementTestDoc {
  _id: string;
  userId: string;
  runAt: string;
  results: PlacementProviderResult[];
  inboxRate: number;
  spamRate: number;
}

export interface DeliverabilityScore {
  score: number;
  grade?: string;
  computedAt: string;
  factors?: Array<{ key: string; weight: number; value: number; note?: string }>;
}

// -----------------------------------------------------------------------------
// Domains
// -----------------------------------------------------------------------------

export function listEmailDomains() {
  return rustFetch<{ items: EmailDomainDoc[] }>('/v1/email/deliverability/domains');
}

export function checkEmailDomain(domain: string) {
  return rustFetch<EmailDomainDoc>(
    `/v1/email/deliverability/domains/${encodeURIComponent(domain)}/check`,
    { method: 'POST' },
  );
}

export function generateDkim(domain: string) {
  return rustFetch<DkimGenerateResult>(
    `/v1/email/deliverability/domains/${encodeURIComponent(domain)}/dkim/generate`,
    { method: 'POST' },
  );
}

export function rotateDkim(domain: string) {
  return rustFetch<DkimGenerateResult>(
    `/v1/email/deliverability/domains/${encodeURIComponent(domain)}/dkim/rotate`,
    { method: 'POST' },
  );
}

// -----------------------------------------------------------------------------
// Warmup
// -----------------------------------------------------------------------------

export function listWarmupRuns() {
  return rustFetch<{ items: WarmupRunDoc[] }>('/v1/email/deliverability/warmup');
}

export function startWarmupRun(body: { domain: string; schedule: WarmupDayPlan[] }) {
  return rustFetch<WarmupRunDoc>('/v1/email/deliverability/warmup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateWarmupRun(
  id: string,
  body: { action: 'pause' | 'resume' | 'cancel' },
) {
  return rustFetch<WarmupRunDoc>(`/v1/email/deliverability/warmup/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

// -----------------------------------------------------------------------------
// Placement
// -----------------------------------------------------------------------------

export function getLatestPlacementTest() {
  return rustFetch<PlacementTestDoc | null>('/v1/email/deliverability/placement');
}

export function runPlacementTest() {
  return rustFetch<PlacementTestDoc>('/v1/email/deliverability/placement/run', {
    method: 'POST',
  });
}

// -----------------------------------------------------------------------------
// Score
// -----------------------------------------------------------------------------

export function getDeliverabilityScore() {
  return rustFetch<DeliverabilityScore>('/v1/email/deliverability/score');
}
