'use server';

/**
 * SabChat analytics server actions — project-scoped over the read-only
 * `sabchat-reports` Rust crate (`/v1/sabchat/reports/*`). Powers
 * `/sabchat/reports`. Each endpoint is fetched independently with a
 * graceful fallback so one failing rollup never blanks the whole dashboard.
 *
 * Separate from the legacy user-scoped `sabchat-reports.actions.ts` (deleted
 * with the old dashboard in P7).
 */

import { rustClient } from '@/lib/rust-client';
import { runWithRustTenant } from '@/lib/rust-client/fetcher';
import { getSabchatWorkspaceId } from '@/lib/sabchat/workspace';
import type {
  AgentRow,
  ChannelRow,
  CsatStats,
  InboxRow,
  LiveReport,
  ResponseTimes,
} from '@/lib/rust-client/sabchat-reports';

export interface SabchatReports {
  live: LiveReport;
  responseTimes: ResponseTimes;
  csat: CsatStats;
  byAgent: AgentRow[];
  byInbox: InboxRow[];
  byChannel: ChannelRow[];
}

const EMPTY_LIVE: LiveReport = {
  openCount: 0,
  pendingCount: 0,
  snoozedCount: 0,
  slaBreachedCount: 0,
  longestWaitMinutes: 0,
  queueByInbox: [],
};
const EMPTY_RT: ResponseTimes = { count: 0, mean: 0, p50: 0, p95: 0, p99: 0 };
const EMPTY_CSAT: CsatStats = { count: 0 };

export async function getSabchatReports(): Promise<SabchatReports | null> {
  const wsId = await getSabchatWorkspaceId();
  if (!wsId) return null;

  return runWithRustTenant(wsId, async () => {
    const [live, responseTimes, csat, byAgent, byInbox, byChannel] = await Promise.all([
      rustClient.sabchatReports.live().catch(() => EMPTY_LIVE),
      rustClient.sabchatReports.responseTimes().catch(() => EMPTY_RT),
      rustClient.sabchatReports.csat().catch(() => EMPTY_CSAT),
      rustClient.sabchatReports.byAgent().catch(() => [] as AgentRow[]),
      rustClient.sabchatReports.byInbox().catch(() => [] as InboxRow[]),
      rustClient.sabchatReports.byChannel().catch(() => [] as ChannelRow[]),
    ]);
    return { live, responseTimes, csat, byAgent, byInbox, byChannel };
  });
}
