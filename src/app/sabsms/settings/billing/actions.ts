"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

/**
 * SabSMS settings — billing/credits actions.
 *
 * Real balance + spend, NO fabricated invoices. Source of truth is the
 * credit ledger (`src/lib/sabsms/credits/ledger.ts` + `./core`):
 *   - current balance lives on `users.credits.sms`
 *   - every debit/release/adjust is an append-only `sabsms_credit_ledger` row.
 *
 * SabSMS is prepaid-credit only; there is no per-invoice subscription doc to
 * read, so the UI renders the real ledger movements as the "history" and links
 * top-ups to the platform billing surface rather than inventing invoice rows.
 */

import { connectToDatabase } from "@/lib/mongodb";
import { requirePermission } from "@/lib/rbac-server";
import { SABSMS_CREDIT_COLLECTIONS } from "@/lib/sabsms/credits/core";
import { getSmsCreditBalance } from "@/lib/sabsms/credits/ledger";

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

export type BillingLedgerKind = "debit" | "release" | "adjust";

export interface BillingLedgerRow {
  id: string;
  /** ISO timestamp of the movement. */
  at: string;
  kind: BillingLedgerKind;
  /** Human label, e.g. "Message debit" / "Hold refunded". */
  description: string;
  /** Signed credit delta (negative = spent). */
  delta: number;
  balanceAfter: number | null;
  chargeType: "message" | "agent_turn";
}

export interface BillingOverview {
  /** Current spendable SMS credit balance. */
  balance: number;
  /** Credits spent (sum of negative deltas) in the last 30 days. */
  spent30d: number;
  /** Credits spent in the current calendar month. */
  spentThisMonth: number;
  /** Average credits/day over the trailing 30 days (0 if none). */
  avgPerDay: number;
  /** Estimated days of runway at the trailing burn rate, or null when idle. */
  runwayDays: number | null;
  /** Count of message sends (debit, chargeType message) in last 30 days. */
  messageSends30d: number;
  /** Count of agent turns charged in last 30 days. */
  agentTurns30d: number;
  /** Recent ledger movements (most recent first). */
  history: BillingLedgerRow[];
}

export type GetBillingResult =
  | { success: true; overview: BillingOverview }
  | { success: false; error: string };

function describe(kind: BillingLedgerKind, chargeType: "message" | "agent_turn"): string {
  if (kind === "release") return "Hold refunded";
  if (kind === "adjust") return "Charge adjustment";
  // debit
  return chargeType === "agent_turn" ? "AI agent turn" : "Message send";
}

/**
 * Read the real billing overview: live balance + the credit-ledger history.
 * RBAC-gated on `sabsms_settings:view` (same gate as the other settings cards).
 */
export async function getBillingOverviewAction(): Promise<GetBillingResult> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };
  const perm = await requirePermission("sabsms_settings", "view", workspaceId);
  if (!perm.ok) return { success: false, error: perm.error };

  const [{ db }, balance] = await Promise.all([
    connectToDatabase(),
    getSmsCreditBalance(workspaceId),
  ]);

  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const ledger = db.collection(SABSMS_CREDIT_COLLECTIONS.ledger);

  const recent = await ledger
    .find({ workspaceId, createdAt: { $gte: since } })
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray();

  let spent30d = 0;
  let spentThisMonth = 0;
  let messageSends30d = 0;
  let agentTurns30d = 0;

  for (const r of recent) {
    const delta = typeof r.delta === "number" ? r.delta : 0;
    const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    const chargeType = r.chargeType === "agent_turn" ? "agent_turn" : "message";
    if (delta < 0) {
      spent30d += -delta;
      if (created >= monthStart) spentThisMonth += -delta;
    }
    if (r.kind === "debit") {
      if (chargeType === "agent_turn") agentTurns30d += 1;
      else messageSends30d += 1;
    }
  }

  const avgPerDay = spent30d / 30;
  const runwayDays = avgPerDay > 0 ? Math.floor(balance / avgPerDay) : null;

  const history: BillingLedgerRow[] = recent.slice(0, 100).map((r) => {
    const kind: BillingLedgerKind =
      r.kind === "release" ? "release" : r.kind === "adjust" ? "adjust" : "debit";
    const chargeType = r.chargeType === "agent_turn" ? "agent_turn" : "message";
    const created = r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt);
    return {
      id: r._id ? String(r._id) : `${r.reservationToken}:${created.getTime()}`,
      at: created.toISOString(),
      kind,
      description: describe(kind, chargeType),
      delta: typeof r.delta === "number" ? r.delta : 0,
      balanceAfter: typeof r.balanceAfter === "number" ? r.balanceAfter : null,
      chargeType,
    };
  });

  return {
    success: true,
    overview: {
      balance,
      spent30d,
      spentThisMonth,
      avgPerDay,
      runwayDays,
      messageSends30d,
      agentTurns30d,
      history,
    },
  };
}
