/**
 * Client for `/v1/sabchat/wfm/*` — workforce management: a staffing forecast
 * aggregated from historical conversation volume by hour-of-week. Owned by the
 * `sabchat-wfm` Rust crate.
 */
import 'server-only';

import { rustFetch } from './fetcher';

function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export interface SabChatForecastSlot {
  dayOfWeek: number; // 0 = Sun … 6 = Sat
  hour: number; // 0..23
  avgVolume: number;
  recommendedAgents: number;
}

export interface SabChatForecast {
  weeks: number;
  targetPerAgentPerHour: number;
  totalConversations: number;
  slots: SabChatForecastSlot[];
  peakAgents: number;
}

export const sabchatWfmApi = {
  forecast: (q: { weeks?: number; inboxId?: string; targetPerAgentPerHour?: number } = {}) =>
    rustFetch<SabChatForecast>(`/v1/sabchat/wfm/forecast${qs(q)}`),
};
