"use server";

/**
 * SabSMS compliance · 10DLC (US A2P) — REAL manual-entry registration.
 *
 * The engine kernel blocks US marketing unless the workspace's provider
 * account doc carries `tenDlc.status == "registered"`
 * (`services/sabsms-engine/src/compliance/mod.rs`). Nothing in the app
 * could set that field, so US marketing was permanently blocked on real
 * accounts. There is NO live TCR API integration — so rather than fake
 * success with random ids (the old mock), this is an honest MANUAL-entry
 * form: the operator types the brand/campaign ids TCR (or their provider
 * console) gave them, and we persist them onto the provider account +
 * an audit collection.
 *
 * Writes `tenDlc` onto `sabsms_provider_accounts` (field added by B0 to
 * `SabsmsProviderAccount`) and an immutable history row to
 * `sabsms_tendlc_registrations`.
 */

import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";

import { connectToDatabase } from "@/lib/mongodb";
import { getCachedSession } from "@/lib/server-cache";
import { SABSMS_COLLECTIONS } from "@/lib/sabsms/db/collections";

const COL_ACCOUNTS = SABSMS_COLLECTIONS.providerAccounts;
const COL_REGISTRATIONS = "sabsms_tendlc_registrations";
const PAGE_PATH = "/sabsms/compliance/10dlc";

type TenDlcStatus = "unregistered" | "pending" | "registered" | "rejected";
const STATUSES: TenDlcStatus[] = ["unregistered", "pending", "registered", "rejected"];

type ActionErr = { success: false; error: string };
const unauthorized: ActionErr = { success: false, error: "Unauthorized" };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown })?._id ?? "");
  return workspaceId || null;
}

// ─── View types ─────────────────────────────────────────────────────────

export interface TenDlcAccountRow {
  id: string;
  provider: string;
  region?: string;
  isDefault: boolean;
  status: TenDlcStatus;
  brandId?: string;
  campaignId?: string;
  updatedAt?: string;
}

export interface TenDlcRegistrationRow {
  id: string;
  accountId: string;
  provider: string;
  status: TenDlcStatus;
  brandId?: string;
  campaignId?: string;
  notes?: string;
  createdAt: string;
}

export interface TenDlcPageData {
  accounts: TenDlcAccountRow[];
  history: TenDlcRegistrationRow[];
  /** How many accounts are cleared (registered) for US marketing. */
  registeredCount: number;
}

// ─── Read ───────────────────────────────────────────────────────────────

export async function loadTenDlcPage(): Promise<
  { success: true; data: TenDlcPageData } | ActionErr
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;
  const { db } = await connectToDatabase();

  const [accountDocs, historyDocs] = await Promise.all([
    db
      .collection(COL_ACCOUNTS)
      .find({ workspaceId })
      .sort({ isDefault: -1, provider: 1 })
      .limit(200)
      .toArray(),
    db
      .collection(COL_REGISTRATIONS)
      .find({ workspaceId })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray(),
  ]);

  const accounts: TenDlcAccountRow[] = accountDocs.map((d: any) => {
    const tenDlc = d.tenDlc ?? {};
    return {
      id: String(d._id),
      provider: String(d.provider ?? ""),
      region: d.region ? String(d.region) : undefined,
      isDefault: Boolean(d.isDefault),
      status: STATUSES.includes(tenDlc.status) ? tenDlc.status : "unregistered",
      brandId: tenDlc.brandId ? String(tenDlc.brandId) : undefined,
      campaignId: tenDlc.campaignId ? String(tenDlc.campaignId) : undefined,
      updatedAt:
        tenDlc.updatedAt instanceof Date
          ? tenDlc.updatedAt.toISOString()
          : tenDlc.updatedAt
            ? String(tenDlc.updatedAt)
            : undefined,
    };
  });

  const history: TenDlcRegistrationRow[] = historyDocs.map((d: any) => ({
    id: String(d._id),
    accountId: String(d.accountId ?? ""),
    provider: String(d.provider ?? ""),
    status: STATUSES.includes(d.status) ? d.status : "unregistered",
    brandId: d.brandId ? String(d.brandId) : undefined,
    campaignId: d.campaignId ? String(d.campaignId) : undefined,
    notes: d.notes ? String(d.notes) : undefined,
    createdAt:
      d.createdAt instanceof Date
        ? d.createdAt.toISOString()
        : String(d.createdAt ?? new Date().toISOString()),
  }));

  return {
    success: true,
    data: {
      accounts,
      history,
      registeredCount: accounts.filter((a) => a.status === "registered").length,
    },
  };
}

// ─── Write: manual 10DLC registration entry ──────────────────────────────

export async function saveTenDlcRegistration(input: {
  accountId: string;
  status: TenDlcStatus;
  brandId?: string;
  campaignId?: string;
  notes?: string;
}): Promise<{ success: true } | ActionErr> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return unauthorized;

  if (!input.accountId) {
    return { success: false, error: "Select a provider account first." };
  }
  if (!STATUSES.includes(input.status)) {
    return { success: false, error: "Invalid status." };
  }
  if (input.status === "registered" && !input.brandId?.trim()) {
    return {
      success: false,
      error: "A Brand ID is required to mark the account as registered.",
    };
  }

  let accountObjectId: ObjectId;
  try {
    accountObjectId = new ObjectId(input.accountId);
  } catch {
    return { success: false, error: "Invalid account id." };
  }

  const { db } = await connectToDatabase();
  const account = await db
    .collection(COL_ACCOUNTS)
    .findOne({ _id: accountObjectId, workspaceId });
  if (!account) {
    return { success: false, error: "Provider account not found." };
  }

  const now = new Date();
  const brandId = input.brandId?.trim() || undefined;
  const campaignId = input.campaignId?.trim() || undefined;
  const notes = input.notes?.trim() || undefined;

  await db.collection(COL_ACCOUNTS).updateOne(
    { _id: accountObjectId, workspaceId },
    {
      $set: {
        "tenDlc.status": input.status,
        "tenDlc.brandId": brandId ?? null,
        "tenDlc.campaignId": campaignId ?? null,
        "tenDlc.updatedAt": now,
        updatedAt: now,
      },
    },
  );

  // Immutable audit row of the manual entry.
  await db.collection(COL_REGISTRATIONS).insertOne({
    workspaceId,
    accountId: input.accountId,
    provider: String((account as any).provider ?? ""),
    status: input.status,
    brandId,
    campaignId,
    notes,
    createdAt: now,
  });

  revalidatePath(PAGE_PATH);
  return { success: true };
}
