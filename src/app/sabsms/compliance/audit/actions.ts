"use server";

/**
 * SabSMS compliance · Audit ledger — REAL append-only compliance events.
 *
 * There is no separate hash-chained audit collection in this build, so
 * the old page's "tamper-evident hash chain" + SHA-256 verify chip were
 * pure fiction. The genuine append-only compliance ledger is
 * `sabsms_consent_log` (opt-ins, STOP keyword captures, manual opt-outs,
 * complaints, carrier blocks) written by BOTH the engine interceptor and
 * every Next consent writer. We also surface outbound messages the engine
 * BLOCKED (status `blocked`) as send-block audit rows.
 *
 * Rows are returned honestly: each carries its real source collection and
 * timestamp. No hashes are fabricated.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

const COL_CONSENT = SABSMS_COLLECTIONS.consentLog;
const COL_MESSAGES = SABSMS_COLLECTIONS.messages;

type ActionErr = { success: false; error: string };
const unauthorized: ActionErr = { success: false, error: "Unauthorized" };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown })?._id ?? "");
  return workspaceId || null;
}

export type AuditKind = "consent" | "send-block";

export interface AuditRow {
  id: string;
  /** ISO timestamp. */
  at: string;
  kind: AuditKind;
  /** Human-readable action, e.g. "STOP keyword opt-out". */
  action: string;
  /** Subject: a phone hash (consent) or a destination (send-block). */
  subject: string;
  /** Source collection — shown so the row is honest about provenance. */
  source: string;
  /** Extra detail (capture method, block reason, etc.). */
  detail?: string;
  /** Severity for the badge. */
  severity: "info" | "warning";
  /** Raw payload for the drawer. */
  payload: Record<string, unknown>;
}

export interface AuditPageData {
  rows: AuditRow[];
  totals: {
    consentEvents: number;
    sendBlocks: number;
  };
}

const CONSENT_ACTION_LABEL: Record<string, string> = {
  opt_in_single: "Single opt-in",
  opt_in_double: "Double opt-in",
  opt_in_restart: "Opt-in (START/UNSTOP)",
  opt_out_stop: "STOP keyword opt-out",
  opt_out_manual: "Manual opt-out",
  opt_out_complaint: "Complaint opt-out",
  opt_out_carrier_block: "Carrier block",
};

export async function loadAuditPage(input?: {
  kind?: AuditKind | "all";
  limit?: number;
}): Promise<{ success: true; data: AuditPageData } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();

  const kind = input?.kind ?? "all";
  const limit = Math.min(Math.max(input?.limit ?? 200, 1), 1000);

  const wantConsent = kind === "all" || kind === "consent";
  const wantBlocks = kind === "all" || kind === "send-block";

  const [consentDocs, blockDocs, consentEvents, sendBlocks] = await Promise.all([
    wantConsent
      ? db
          .collection(COL_CONSENT)
          .find({ workspaceId })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
      : Promise.resolve([] as any[]),
    wantBlocks
      ? db
          .collection(COL_MESSAGES)
          .find({ workspaceId, status: "blocked" })
          .sort({ createdAt: -1 })
          .limit(limit)
          .toArray()
      : Promise.resolve([] as any[]),
    db.collection(COL_CONSENT).countDocuments({ workspaceId }),
    db.collection(COL_MESSAGES).countDocuments({ workspaceId, status: "blocked" }),
  ]);

  const consentRows: AuditRow[] = consentDocs.map((d: any) => {
    const k = String(d.kind ?? "");
    const isOptOut = k.startsWith("opt_out");
    return {
      id: `consent:${String(d._id)}`,
      at: toIso(d.createdAt),
      kind: "consent",
      action: CONSENT_ACTION_LABEL[k] ?? k ?? "Consent event",
      subject: d.phoneHash ? `${String(d.phoneHash).slice(0, 12)}…` : "—",
      source: COL_CONSENT,
      detail: [d.captureMethod, d.keyword ? `keyword:${d.keyword}` : null, d.source]
        .filter(Boolean)
        .join(" · "),
      severity: isOptOut ? "warning" : "info",
      payload: {
        kind: d.kind,
        captureMethod: d.captureMethod,
        keyword: d.keyword,
        source: d.source,
        phoneHash: d.phoneHash,
      },
    };
  });

  const blockRows: AuditRow[] = blockDocs.map((d: any) => ({
    id: `block:${String(d._id)}`,
    at: toIso(d.createdAt),
    kind: "send-block",
    action: "Send blocked",
    subject: maskDestination(String(d.to ?? "—")),
    source: COL_MESSAGES,
    detail:
      d.errorMessage ||
      d.normalizedCode ||
      d.errorCode ||
      "Blocked by compliance kernel",
    severity: "warning",
    payload: {
      category: d.category,
      normalizedCode: d.normalizedCode,
      errorCode: d.errorCode,
      errorMessage: d.errorMessage,
      complianceTrace: d.complianceTrace,
      provider: d.provider,
    },
  }));

  const rows = [...consentRows, ...blockRows]
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .slice(0, limit);

  return {
    success: true,
    data: {
      rows,
      totals: { consentEvents, sendBlocks },
    },
  };
}

function toIso(d: unknown): string {
  if (d instanceof Date) return d.toISOString();
  if (typeof d === "string") return d;
  return new Date().toISOString();
}

/** Mask the middle of a destination so the ledger doesn't leak full PII. */
function maskDestination(to: string): string {
  if (to.length <= 5) return to;
  return `${to.slice(0, 4)}…${to.slice(-2)}`;
}
