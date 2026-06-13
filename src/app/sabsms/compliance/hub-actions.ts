"use server";

/**
 * SabSMS compliance hub — REAL aggregate counts for the dashboard.
 *
 * Replaces the old hub's 100% fabricated metrics (89% EU coverage,
 * fake "Compliant" registry badges, a fictional compliance officer,
 * console.log exports). Everything here is counted live from the real
 * collections: consent log, suppressions, the India DLT registry, and
 * the per-provider-account 10DLC state.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

const COL_CONSENT = SABSMS_COLLECTIONS.consentLog;
const COL_SUPPRESSIONS = SABSMS_COLLECTIONS.suppressions;
const COL_ACCOUNTS = SABSMS_COLLECTIONS.providerAccounts;
const COL_DLT_ENTITIES = "sabsms_dlt_entities";
const COL_DLT_HEADERS = "sabsms_dlt_headers";
const COL_DLT_TEMPLATES = "sabsms_dlt_templates";

export interface ComplianceHubData {
  consent: {
    total: number;
    optIns: number;
    optOuts: number;
    stopKeywordOptOuts: number;
  };
  suppressions: {
    total: number;
    fromStop: number;
  };
  dlt: {
    entities: number;
    headers: number;
    templates: number;
    /** Has any DLT registry data at all. */
    configured: boolean;
  };
  tenDlc: {
    accounts: number;
    registered: number;
    pending: number;
  };
}

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown })?._id ?? "");
  return workspaceId || null;
}

export async function loadComplianceHub(): Promise<
  { success: true; data: ComplianceHubData } | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const { db } = await connectToDatabase();

  const [
    consentTotal,
    optIns,
    optOuts,
    stopKeywordOptOuts,
    suppressionsTotal,
    suppressionsFromStop,
    dltEntities,
    dltHeaders,
    dltTemplates,
    accountDocs,
  ] = await Promise.all([
    db.collection(COL_CONSENT).countDocuments({ workspaceId }),
    db.collection(COL_CONSENT).countDocuments({ workspaceId, kind: { $regex: "^opt_in" } }),
    db.collection(COL_CONSENT).countDocuments({ workspaceId, kind: { $regex: "^opt_out" } }),
    db.collection(COL_CONSENT).countDocuments({ workspaceId, kind: "opt_out_stop" }),
    db.collection(COL_SUPPRESSIONS).countDocuments({ workspaceId }),
    db.collection(COL_SUPPRESSIONS).countDocuments({ workspaceId, source: "stop" }),
    db.collection(COL_DLT_ENTITIES).countDocuments({ workspaceId }),
    db.collection(COL_DLT_HEADERS).countDocuments({ workspaceId }),
    db.collection(COL_DLT_TEMPLATES).countDocuments({ workspaceId }),
    db
      .collection(COL_ACCOUNTS)
      .find({ workspaceId })
      .project({ tenDlc: 1 })
      .limit(500)
      .toArray(),
  ]);

  let registered = 0;
  let pending = 0;
  for (const a of accountDocs as any[]) {
    const s = a.tenDlc?.status;
    if (s === "registered") registered++;
    else if (s === "pending") pending++;
  }

  return {
    success: true,
    data: {
      consent: {
        total: consentTotal,
        optIns,
        optOuts,
        stopKeywordOptOuts,
      },
      suppressions: {
        total: suppressionsTotal,
        fromStop: suppressionsFromStop,
      },
      dlt: {
        entities: dltEntities,
        headers: dltHeaders,
        templates: dltTemplates,
        configured: dltEntities + dltHeaders + dltTemplates > 0,
      },
      tenDlc: {
        accounts: accountDocs.length,
        registered,
        pending,
      },
    },
  };
}
