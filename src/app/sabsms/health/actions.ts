"use server";
import { getSabsmsWorkspaceId } from "@/lib/sabsms/workspace";

import {
  sabsmsEngine,
  SabsmsEngineError,
  type SabsmsProviderHealthAccount,
} from "@/lib/sabsms/engine-client";

async function requireWorkspaceId(): Promise<string | null> {
  return getSabsmsWorkspaceId();
}

/**
 * Per-account rolling delivery health + circuit state from the engine
 * (`GET /v1/health/providers`). The window is the last 5–10 minutes
 * (two-bucket rotation engine-side).
 */
export async function getProviderHealthAction(): Promise<
  | { success: true; accounts: SabsmsProviderHealthAccount[] }
  | { success: false; error: string }
> {
  const workspaceId = await requireWorkspaceId();
  if (!workspaceId) return { success: false as const, error: "Unauthorized" };

  try {
    const res = await sabsmsEngine.getProviderHealth(workspaceId);
    return { success: true as const, accounts: res.accounts ?? [] };
  } catch (e) {
    if (e instanceof SabsmsEngineError) {
      return { success: false as const, error: e.message };
    }
    throw e;
  }
}
