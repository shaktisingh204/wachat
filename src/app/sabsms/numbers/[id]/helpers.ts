/**
 * Number detail — pure helpers.
 *
 * Kept free of `server-only` imports so the unit suite under
 * `./__tests__/detail.test.ts` can pull them in via `tsx --test`. The
 * data-loading + mutation surface lives in `./actions.ts`.
 */

import type {
  SabsmsMessage,
  SabsmsMessageStatus,
  SabsmsNumberType,
} from "@/lib/sabsms/types";

// ─── Domain types ─────────────────────────────────────────────────────────

export interface ThrottleConfig {
  perSecond: number;
  perMinute: number;
}

export interface QuietHoursConfig {
  enabled: boolean;
  timezone: string;
  startHour: number;
  endHour: number;
}

export interface NumberWebhooks {
  inboundUrl?: string;
  dlrUrl?: string;
  voiceUrl?: string;
}

export interface NumberHealthPoint {
  date: string;
  dlrRate: number;
  complaintRate: number;
}

export interface NumberVolumePoint {
  date: string;
  sent: number;
  delivered: number;
  failed: number;
}

export interface NumberCostPoint {
  date: string;
  cost: number; // dollars
  revenue: number; // dollars
}

export interface DestinationCountryRow {
  country: string;
  sent: number;
  delivered: number;
  deliveryRate: number;
}

export interface TemplatePerformanceRow {
  templateId: string;
  templateName: string;
  sent: number;
  delivered: number;
  replied: number;
}

export interface ComplianceStatus {
  tendlc: "registered" | "missing" | "n/a";
  dlt: "registered" | "missing" | "n/a";
  consentLog: "ok" | "missing";
}

// ─── Day bucketing ────────────────────────────────────────────────────────

export function startOfUtcDay(d: Date): Date {
  const next = new Date(d);
  next.setUTCHours(0, 0, 0, 0);
  return next;
}

export function isoDay(d: Date): string {
  return startOfUtcDay(d).toISOString().slice(0, 10);
}

/**
 * Return a list of consecutive UTC-day keys ending at `to` and going
 * back `days` days. Used so charts always render every day in the
 * window, even days with zero traffic.
 */
export function daysWindow(to: Date, days: number): string[] {
  const out: string[] = [];
  const end = startOfUtcDay(to);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setUTCDate(end.getUTCDate() - i);
    out.push(isoDay(d));
  }
  return out;
}

// ─── Aggregators (pure) ───────────────────────────────────────────────────

interface MessageLite {
  status: SabsmsMessageStatus;
  cost?: number;
  price?: number;
  to?: string;
  templateId?: string;
  createdAt?: Date | string;
  sentAt?: Date | string;
  errorCode?: string;
}

function asDate(v?: Date | string): Date | null {
  if (!v) return null;
  const d = typeof v === "string" ? new Date(v) : v;
  return Number.isNaN(d.getTime()) ? null : d;
}

export function aggregateVolume(
  messages: MessageLite[],
  to: Date,
  days = 30,
): NumberVolumePoint[] {
  const buckets = new Map<string, NumberVolumePoint>();
  for (const day of daysWindow(to, days)) {
    buckets.set(day, { date: day, sent: 0, delivered: 0, failed: 0 });
  }
  for (const m of messages) {
    const dt = asDate(m.createdAt);
    if (!dt) continue;
    const key = isoDay(dt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    if (m.status === "delivered") {
      bucket.delivered += 1;
      bucket.sent += 1;
    } else if (
      m.status === "failed" ||
      m.status === "undelivered" ||
      m.status === "rejected"
    ) {
      bucket.failed += 1;
      bucket.sent += 1;
    } else if (m.status === "sent" || m.status === "sending") {
      bucket.sent += 1;
    }
  }
  return Array.from(buckets.values());
}

export function aggregateHealth(
  messages: MessageLite[],
  to: Date,
  days = 30,
): NumberHealthPoint[] {
  return aggregateVolume(messages, to, days).map((v) => {
    const total = v.sent;
    const dlrRate = total > 0 ? (v.delivered / total) * 100 : 0;
    const complaintRate = total > 0 ? (v.failed / total) * 100 : 0;
    return {
      date: v.date,
      dlrRate: Math.round(dlrRate * 10) / 10,
      complaintRate: Math.round(complaintRate * 10) / 10,
    };
  });
}

export function aggregateCost(
  messages: MessageLite[],
  to: Date,
  days = 30,
): NumberCostPoint[] {
  const buckets = new Map<string, NumberCostPoint>();
  for (const day of daysWindow(to, days)) {
    buckets.set(day, { date: day, cost: 0, revenue: 0 });
  }
  for (const m of messages) {
    const dt = asDate(m.createdAt);
    if (!dt) continue;
    const key = isoDay(dt);
    const bucket = buckets.get(key);
    if (!bucket) continue;
    bucket.cost += (m.cost ?? 0) / 100;
    bucket.revenue += (m.price ?? 0) / 100;
  }
  return Array.from(buckets.values()).map((b) => ({
    date: b.date,
    cost: Math.round(b.cost * 100) / 100,
    revenue: Math.round(b.revenue * 100) / 100,
  }));
}

export function aggregateByCountry(
  messages: MessageLite[],
): DestinationCountryRow[] {
  const map = new Map<string, { sent: number; delivered: number }>();
  for (const m of messages) {
    const cc = countryFromE164(m.to);
    if (!cc) continue;
    const row = map.get(cc) ?? { sent: 0, delivered: 0 };
    row.sent += 1;
    if (m.status === "delivered") row.delivered += 1;
    map.set(cc, row);
  }
  return Array.from(map.entries())
    .map(([country, row]) => ({
      country,
      sent: row.sent,
      delivered: row.delivered,
      deliveryRate:
        row.sent > 0 ? Math.round((row.delivered / row.sent) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.sent - a.sent);
}

export function aggregateByTemplate(
  messages: MessageLite[],
  templateNames: Map<string, string>,
): TemplatePerformanceRow[] {
  const map = new Map<
    string,
    { sent: number; delivered: number; replied: number }
  >();
  for (const m of messages) {
    if (!m.templateId) continue;
    const row =
      map.get(m.templateId) ?? { sent: 0, delivered: 0, replied: 0 };
    row.sent += 1;
    if (m.status === "delivered") row.delivered += 1;
    map.set(m.templateId, row);
  }
  return Array.from(map.entries())
    .map(([templateId, row]) => ({
      templateId,
      templateName: templateNames.get(templateId) ?? templateId,
      sent: row.sent,
      delivered: row.delivered,
      replied: row.replied,
    }))
    .sort((a, b) => b.sent - a.sent);
}

/**
 * Heuristic E.164 → ISO-3166 alpha-2 mapper. Covers the carrier codes
 * Phase 1 actually uses; everything else falls back to `XX`.
 */
export function countryFromE164(e164?: string): string | null {
  if (!e164 || !e164.startsWith("+")) return null;
  const digits = e164.slice(1);
  if (digits.startsWith("1")) return "US";
  if (digits.startsWith("91")) return "IN";
  if (digits.startsWith("44")) return "GB";
  if (digits.startsWith("49")) return "DE";
  if (digits.startsWith("33")) return "FR";
  if (digits.startsWith("61")) return "AU";
  if (digits.startsWith("65")) return "SG";
  if (digits.startsWith("971")) return "AE";
  return "XX";
}

// ─── Compliance ───────────────────────────────────────────────────────────

export function deriveComplianceStatus(input: {
  country: string;
  type: SabsmsNumberType;
  tendlcRegistered: boolean;
  dltRegistered: boolean;
  hasConsentLog: boolean;
}): ComplianceStatus {
  const needsTendlc = input.country === "US" && input.type === "longcode";
  const needsDlt = input.country === "IN" && input.type === "longcode";
  return {
    tendlc: !needsTendlc
      ? "n/a"
      : input.tendlcRegistered
        ? "registered"
        : "missing",
    dlt: !needsDlt ? "n/a" : input.dltRegistered ? "registered" : "missing",
    consentLog: input.hasConsentLog ? "ok" : "missing",
  };
}

// ─── Send-history flattener ───────────────────────────────────────────────

export interface SendHistoryRow {
  id: string;
  to: string;
  body: string;
  status: SabsmsMessageStatus;
  createdAt: string;
  cost: number;
  segments?: number;
}

export function projectSendHistory(
  msg: SabsmsMessage & { _id?: { toString(): string } },
): SendHistoryRow {
  return {
    id: msg._id ? msg._id.toString() : "",
    to: msg.to,
    body: msg.body,
    status: msg.status,
    createdAt: (msg.createdAt instanceof Date
      ? msg.createdAt
      : new Date(msg.createdAt as never)
    ).toISOString(),
    cost: (msg.cost ?? 0) / 100,
    segments: msg.segmentsCount,
  };
}
