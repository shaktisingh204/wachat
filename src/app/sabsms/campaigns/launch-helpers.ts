/**
 * SabSMS campaigns — pure launch/estimate helpers (V2.3).
 *
 * Everything here is deterministic and Mongo-free so it can be imported
 * from the `"use server"` actions, the create wizard, AND the
 * `node:test` suite. The audience-resolution branching takes its data
 * sources as injected dependencies for the same reason.
 *
 * Recipient contract (mirrors `services/sabsms-engine/src/campaigns.rs`):
 * Next pre-renders every recipient into `sabsms_campaign_recipients`
 * with a PRE-RENDERED body, a `chunk` number (1000-doc chunks), and a
 * unique `idempotencyKey` of `{campaignId}:{contactIdOrPhone}` — the
 * engine-side double-send guard.
 */

import { renderTemplate } from "@/lib/sabsms/render";
import { estimateSegments } from "@/lib/sabsms/segments";
import { countryFromE164 } from "@/lib/sabsms/phone";
import { creditCostFor } from "@/lib/sabsms/credits/rates";
import { normalisePhone } from "../lists/helpers";
import type { SabsmsCampaignAudience, SabsmsMessageCategory } from "@/lib/sabsms/types";

export const RECIPIENT_CHUNK_SIZE = 1000;

/** Hard cap on audience size resolved in one launch (matches the segment evaluator's scan cap). */
export const MAX_RECIPIENTS = 50_000;

// ─── Audience resolution ──────────────────────────────────────────────────

/** A resolved audience member before rendering. */
export interface AudienceContact {
  /** E.164 phone (already normalised). */
  to: string;
  /** Source contact id when known — preferred idempotency-key suffix. */
  contactId?: string;
  /** Template vars sourced from the contact record / CSV row. */
  vars: Record<string, string | number>;
}

/**
 * Injected data-source functions — each returns raw contacts for one
 * audience kind. The real implementations live in `actions.ts`; tests
 * stub them.
 */
export interface AudienceDeps {
  loadSegmentContacts: (segmentId: string) => Promise<AudienceContact[]>;
  loadListPhones: (listId: string) => Promise<string[]>;
  loadContactsByIds: (contactIds: string[]) => Promise<AudienceContact[]>;
  loadImportContacts: (importId: string, sabFileId?: string) => Promise<AudienceContact[]>;
}

/**
 * Resolve a campaign audience to a deduped, normalised contact list.
 * Branches on the audience kind and delegates the I/O to `deps`.
 * Invalid phones are dropped; duplicates (same E.164) keep the FIRST
 * occurrence. The result is capped at [`MAX_RECIPIENTS`].
 */
export async function resolveAudience(
  audience: SabsmsCampaignAudience,
  deps: AudienceDeps,
): Promise<AudienceContact[]> {
  let raw: AudienceContact[];
  switch (audience.kind) {
    case "segment":
      raw = await deps.loadSegmentContacts(audience.segmentId);
      break;
    case "list": {
      const phones = await deps.loadListPhones(audience.listId);
      raw = phones.map((p) => ({ to: p, vars: {} }));
      break;
    }
    case "contacts":
      raw = await deps.loadContactsByIds(audience.contactIds);
      break;
    case "phones":
      raw = audience.phones.map((p) => ({ to: p, vars: {} }));
      break;
    case "csv":
      raw = await deps.loadImportContacts(
        audience.importId ?? "",
        audience.sabFileId,
      );
      break;
  }
  return dedupeContacts(raw).slice(0, MAX_RECIPIENTS);
}

/** Normalise phones, drop invalid ones, keep first occurrence per E.164. */
export function dedupeContacts(contacts: AudienceContact[]): AudienceContact[] {
  const seen = new Set<string>();
  const out: AudienceContact[] = [];
  for (const c of contacts) {
    const to = normalisePhone(c.to);
    if (!to || seen.has(to)) continue;
    seen.add(to);
    out.push({ ...c, to, vars: { ...c.vars, phone: to } });
  }
  return out;
}

// ─── Recipient docs ───────────────────────────────────────────────────────

/** Wire shape inserted into `sabsms_campaign_recipients`. */
export interface CampaignRecipientDoc {
  campaignId: string;
  workspaceId: string;
  to: string;
  /** PRE-RENDERED body — the engine never re-renders. */
  body: string;
  from?: string;
  providerAccountId?: string;
  contactId?: string;
  category: SabsmsMessageCategory;
  chunk: number;
  status: "pending";
  idempotencyKey: string;
  createdAt: Date;
}

/** `{campaignId}:{contactIdOrPhone}` — unique per campaign × recipient. */
export function idempotencyKeyFor(
  campaignId: string,
  contact: Pick<AudienceContact, "contactId" | "to">,
): string {
  return `${campaignId}:${contact.contactId || contact.to}`;
}

/** 0-based chunk number for the i-th recipient. */
export function chunkNumberFor(index: number, chunkSize = RECIPIENT_CHUNK_SIZE): number {
  return Math.floor(index / Math.max(1, chunkSize));
}

/** Split a doc array into insertMany batches of `chunkSize`. */
export function chunkArray<T>(items: T[], chunkSize = RECIPIENT_CHUNK_SIZE): T[][] {
  const size = Math.max(1, chunkSize);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

export interface BuildRecipientsInput {
  campaignId: string;
  workspaceId: string;
  templateBody: string;
  category: SabsmsMessageCategory;
  from?: string;
  providerAccountId?: string;
  /** Extra vars applied to every recipient (campaign-level overrides). */
  baseVars?: Record<string, string | number>;
  now?: Date;
}

/**
 * Render the template per contact and produce the full recipient-doc
 * list with chunk numbers + idempotency keys. Missing vars keep their
 * literal placeholder (render.ts contract) — launch proceeds; the
 * estimate step surfaces them as a warning instead.
 */
export function buildRecipientDocs(
  contacts: AudienceContact[],
  input: BuildRecipientsInput,
): CampaignRecipientDoc[] {
  const now = input.now ?? new Date();
  return contacts.map((contact, i) => {
    const { text } = renderTemplate(input.templateBody, {
      ...input.baseVars,
      ...contact.vars,
    });
    return {
      campaignId: input.campaignId,
      workspaceId: input.workspaceId,
      to: contact.to,
      body: text,
      ...(input.from ? { from: input.from } : {}),
      ...(input.providerAccountId
        ? { providerAccountId: input.providerAccountId }
        : {}),
      ...(contact.contactId ? { contactId: contact.contactId } : {}),
      category: input.category,
      chunk: chunkNumberFor(i),
      status: "pending" as const,
      idempotencyKey: idempotencyKeyFor(input.campaignId, contact),
      createdAt: now,
    };
  });
}

// ─── Estimates ────────────────────────────────────────────────────────────

export interface CampaignEstimate {
  recipients: number;
  /** Total billable segments across all rendered bodies. */
  segmentsTotal: number;
  /** Total integer credits (per-recipient country-aware rate). */
  credits: number;
  /** Recipient counts by resolved ISO country ('' = unknown). */
  byCountry: Record<string, number>;
  /** Non-blocking launch warnings (quiet hours, unresolved vars). */
  warnings: string[];
}

/**
 * Pure estimate over already-resolved contacts: renders each body,
 * counts engine-parity segments, prices with the credit rate card, and
 * attaches the marketing quiet-hours warning for IN/US destinations
 * (the engine reschedules those at send time — V2.4 track A).
 */
export function estimateForContacts(
  contacts: AudienceContact[],
  templateBody: string,
  category: SabsmsMessageCategory,
  baseVars?: Record<string, string | number>,
): CampaignEstimate {
  let segmentsTotal = 0;
  let credits = 0;
  const byCountry: Record<string, number> = {};
  const missingVars = new Set<string>();

  for (const contact of contacts) {
    const { text, missing } = renderTemplate(templateBody, {
      ...baseVars,
      ...contact.vars,
    });
    for (const m of missing) missingVars.add(m);
    const segments = estimateSegments(text);
    const country = countryFromE164(contact.to);
    segmentsTotal += segments;
    credits += creditCostFor({
      segments,
      destinationCountry: country,
      channel: "sms",
      category,
    });
    byCountry[country] = (byCountry[country] ?? 0) + 1;
  }

  const warnings: string[] = [];
  if (category === "marketing") {
    const inCount = byCountry.IN ?? 0;
    const usCount = byCountry.US ?? 0;
    if (inCount > 0 || usCount > 0) {
      warnings.push(
        quietHoursWarning({ in: inCount, us: usCount }),
      );
    }
  }
  if (missingVars.size > 0) {
    warnings.push(
      `Unresolved template variables for some recipients: ${[...missingVars].join(", ")} (placeholders will be sent literally).`,
    );
  }

  return {
    recipients: contacts.length,
    segmentsTotal,
    credits,
    byCountry,
    warnings,
  };
}

/** Human quiet-hours warning for marketing sends into IN / US. */
export function quietHoursWarning(counts: { in: number; us: number }): string {
  const parts: string[] = [];
  if (counts.in > 0) {
    parts.push(`${counts.in} India recipient${counts.in === 1 ? "" : "s"} (promo window 10:00–21:00 IST)`);
  }
  if (counts.us > 0) {
    parts.push(`${counts.us} US recipient${counts.us === 1 ? "" : "s"} (TCPA window 8am–9pm local)`);
  }
  return `Marketing quiet hours apply to ${parts.join(" and ")} — out-of-window messages are automatically rescheduled by the engine.`;
}

// ─── CSV parsing (import audiences) ───────────────────────────────────────

/**
 * Minimal RFC-4180-ish CSV parser — handles quoted fields with embedded
 * commas and doubled quotes; good enough for phone-list imports. Not a
 * streaming parser: import audiences are capped at MAX_RECIPIENTS.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.length > 1 || row[0] !== "") rows.push(row);
  return rows;
}

/**
 * Map parsed CSV rows to audience contacts using the import doc's
 * column mapping ({ phone, name?, email?, tags? } → header names).
 * The first row is the header.
 */
export function csvRowsToContacts(
  rows: string[][],
  mapping: { phone?: string; name?: string; email?: string; tags?: string },
): AudienceContact[] {
  if (rows.length === 0 || !mapping.phone) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (name?: string) =>
    name ? header.indexOf(name.trim().toLowerCase()) : -1;
  const phoneIdx = col(mapping.phone);
  if (phoneIdx === -1) return [];
  const nameIdx = col(mapping.name);
  const emailIdx = col(mapping.email);

  const out: AudienceContact[] = [];
  for (const row of rows.slice(1)) {
    const to = (row[phoneIdx] ?? "").trim();
    if (!to) continue;
    const vars: Record<string, string | number> = {};
    if (nameIdx !== -1 && row[nameIdx]) {
      vars.name = row[nameIdx].trim();
      vars.first_name = row[nameIdx].trim().split(/\s+/)[0];
    }
    if (emailIdx !== -1 && row[emailIdx]) vars.email = row[emailIdx].trim();
    out.push({ to, vars });
  }
  return out;
}
