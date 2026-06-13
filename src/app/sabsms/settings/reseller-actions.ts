"use server";

import { getCachedSession } from "@/lib/server-cache";
import type { SabsmsRateCardRate } from "@/lib/sabsms/ratecards/resolve";
import {
  deleteRateCard,
  listRateCards,
  marginReport,
  upsertRateCard,
  type MarginReportRow,
} from "@/lib/sabsms/ratecards/store";

/**
 * /sabsms/settings — reseller rate-card actions (V2.13).
 *
 * The signed-in workspace acts as the RESELLER: its cards price the
 * child workspaces listed on each card, and the margin report compares
 * what children were charged (ledger debits) against wholesale cost
 * (analytics rollups).
 */

export interface RateCardRow {
  id: string;
  name: string;
  rates: SabsmsRateCardRate[];
  childWorkspaceIds: string[];
  marginNote: string;
  effectiveFrom: string;
  createdAt: string;
}

type ActionResult<T> = ({ success: true } & T) | { success: false; error: string };

async function requireWorkspaceId(): Promise<string | null> {
  const session = await getCachedSession();
  const workspaceId = String((session?.user as { _id?: unknown } | undefined)?._id ?? "");
  return workspaceId || null;
}

export async function listRateCardsAction(): Promise<ActionResult<{ cards: RateCardRow[] }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const docs = await listRateCards(workspaceId);
  return {
    success: true,
    cards: docs.map((d) => ({
      id: d._id ? d._id.toHexString() : "",
      name: d.name,
      rates: d.rates ?? [],
      childWorkspaceIds: d.childWorkspaceIds ?? [],
      marginNote: d.marginNote ?? "",
      effectiveFrom: d.effectiveFrom.toISOString(),
      createdAt: d.createdAt.toISOString(),
    })),
  };
}

export async function saveRateCardAction(input: {
  id?: string;
  name: string;
  rates: SabsmsRateCardRate[];
  childWorkspaceIds: string[];
  marginNote?: string;
  effectiveFrom?: string;
}): Promise<ActionResult<{ id: string }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const effectiveFrom = input.effectiveFrom ? new Date(input.effectiveFrom) : new Date();
  const res = await upsertRateCard({
    resellerWorkspaceId: workspaceId,
    id: input.id,
    name: input.name,
    rates: input.rates,
    childWorkspaceIds: input.childWorkspaceIds,
    marginNote: input.marginNote,
    effectiveFrom,
  });
  if (!res.ok) return { success: false, error: res.error };
  return { success: true, id: res.id };
}

export async function deleteRateCardAction(
  id: string,
): Promise<ActionResult<{ deleted: boolean }>> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const deleted = await deleteRateCard(workspaceId, id);
  if (!deleted) return { success: false, error: "Rate card not found" };
  return { success: true, deleted };
}

export async function marginReportAction(): Promise<
  ActionResult<{ rows: MarginReportRow[] }>
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false, error: "Unauthorized" };

  const rows = await marginReport(workspaceId);
  return { success: true, rows };
}
