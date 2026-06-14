'use server';

/**
 * SabChat WFM server actions — project-scoped over the `sabchat-wfm` Rust crate
 * (`/v1/sabchat/wfm/*`). A staffing forecast aggregated from historical
 * conversation volume by hour-of-week.
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import type { SabChatForecast } from '@/lib/rust-client/sabchat-wfm';

async function scoped<T>(fn: () => Promise<T>): Promise<T> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) throw new Error('No active SabChat project selected.');
  return runWithRustTenant(wsId, fn);
}

export async function getForecast(
  input: { weeks?: number; targetPerAgentPerHour?: number } = {},
): Promise<SabChatForecast | null> {
  try {
    return await scoped(() =>
      rustClient.sabchatWfm.forecast({
        weeks: input.weeks ?? 4,
        targetPerAgentPerHour: input.targetPerAgentPerHour ?? 6,
      }),
    );
  } catch {
    return null;
  }
}
