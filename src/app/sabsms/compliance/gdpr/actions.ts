"use server";

/**
 * SabSMS compliance · GDPR — REAL consent-ledger export.
 *
 * The only GDPR surface with a real backend in this build is the consent
 * ledger (`sabsms_consent_log`), which is the evidence trail GDPR/CCPA
 * asks for. We export it as CSV here. Data-subject-request (SAR/erasure)
 * intake + the PII auto-redaction engine have NO backend yet, so the page
 * shows those sections as honest "coming soon" instead of the old mock
 * inbox + alert() stubs.
 *
 * Note: the consent log stores only SHA-256 phone HASHES (so the list
 * survives an erasure request), never raw phone numbers — the export
 * reflects that.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

const COL_CONSENT = SABSMS_COLLECTIONS.consentLog;

type ActionErr = { success: false; error: string };
const unauthorized: ActionErr = { success: false, error: "Unauthorized" };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown })?._id ?? "");
  return workspaceId || null;
}

export interface GdprStats {
  consentEvents: number;
  optIns: number;
  optOuts: number;
}

export async function loadGdprStats(): Promise<
  { success: true; stats: GdprStats } | ActionErr
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();
  const col = db.collection(COL_CONSENT);

  const [consentEvents, optIns, optOuts] = await Promise.all([
    col.countDocuments({ workspaceId }),
    col.countDocuments({ workspaceId, kind: { $regex: "^opt_in" } }),
    col.countDocuments({ workspaceId, kind: { $regex: "^opt_out" } }),
  ]);

  return { success: true, stats: { consentEvents, optIns, optOuts } };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Real CSV export of the consent ledger for this workspace. */
export async function exportConsentLedgerCsv(): Promise<
  { success: true; csv: string; rows: number } | ActionErr
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();

  const docs = await db
    .collection(COL_CONSENT)
    .find({ workspaceId })
    .sort({ createdAt: -1 })
    .limit(50000)
    .toArray();

  const header = [
    "createdAt",
    "phoneHash",
    "kind",
    "captureMethod",
    "keyword",
    "source",
  ];
  const lines = [header.join(",")];
  for (const d of docs as any[]) {
    const at =
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : String(d.createdAt ?? "");
    lines.push(
      [
        csvEscape(at),
        csvEscape(d.phoneHash),
        csvEscape(d.kind),
        csvEscape(d.captureMethod),
        csvEscape(d.keyword),
        csvEscape(d.source),
      ].join(","),
    );
  }

  return { success: true, csv: lines.join("\n"), rows: docs.length };
}
