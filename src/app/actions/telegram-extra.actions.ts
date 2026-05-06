'use server';

/**
 * Server-action wrappers for the Telegram BFF crates that don't have
 * direct legacy callers. Each function is a thin pass-through to the
 * Rust client. Putting them here keeps `telegram.actions.ts` focused
 * on the original action surface.
 */

import { rustClient, RustApiError } from '@/lib/rust-client';
import type { OverviewResp, BotAnalyticsResp } from '@/lib/rust-client/telegram-analytics';
import type {
  CreateBody as PaymentCreateBody,
  InvoiceRow,
  RefundBody,
} from '@/lib/rust-client/telegram-payments';
import type {
  CampaignRow as AdsCampaignRow,
  UpsertBody as AdsUpsertBody,
} from '@/lib/rust-client/telegram-ads';
import type {
  CreateBody as StickerCreateBody,
  SetRow as StickerSetRow,
} from '@/lib/rust-client/telegram-stickers';
import type {
  PostRow as StoryPostRow,
  ScheduleBody as StoryScheduleBody,
} from '@/lib/rust-client/telegram-stories';
import type {
  ReplyRow as FlowReplyRow,
  UpsertBody as FlowUpsertBody,
} from '@/lib/rust-client/telegram-flows';
import type { MiniAppEntry } from '@/lib/rust-client/telegram-mini-apps';

// -- Analytics ---------------------------------------------------------

export async function getTelegramOverviewAction(projectId: string): Promise<OverviewResp> {
  try {
    return await rustClient.telegramAnalytics.overview(projectId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { bots: 0, activeChats: 0, broadcasts: 0, error: e.message };
    return { bots: 0, activeChats: 0, broadcasts: 0, error: String(e) };
  }
}

export async function getBotAnalyticsAction(
  botId: string,
  days?: number,
): Promise<BotAnalyticsResp> {
  try {
    return await rustClient.telegramAnalytics.bot(botId, days);
  } catch (e) {
    const empty: BotAnalyticsResp = {
      totals: { messages: 0, inbound: 0, outbound: 0, chats: 0 },
      timeseries: [],
      topChats: [],
    };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

// -- Payments ----------------------------------------------------------

export async function listTelegramInvoicesAction(botId: string): Promise<InvoiceRow[]> {
  try {
    const res = await rustClient.telegramPayments.list(botId);
    return res.invoices ?? [];
  } catch (e) {
    if (e instanceof RustApiError) return [];
    return [];
  }
}

export async function createTelegramInvoiceAction(body: PaymentCreateBody) {
  try {
    return await rustClient.telegramPayments.create(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function refundTelegramStarAction(body: RefundBody) {
  try {
    return await rustClient.telegramPayments.refund(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Stickers ----------------------------------------------------------

export async function listTelegramStickerSetsAction(botId: string): Promise<StickerSetRow[]> {
  try {
    const res = await rustClient.telegramStickers.list(botId);
    return res.sets ?? [];
  } catch {
    return [];
  }
}

export async function createTelegramStickerSetAction(body: StickerCreateBody) {
  try {
    return await rustClient.telegramStickers.create(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramStickerSetAction(setId: string, botId: string) {
  try {
    return await rustClient.telegramStickers.delete(setId, botId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Stories -----------------------------------------------------------

export async function listTelegramStoriesAction(botId: string): Promise<StoryPostRow[]> {
  try {
    const res = await rustClient.telegramStories.list(botId);
    return res.posts ?? [];
  } catch {
    return [];
  }
}

export async function scheduleTelegramStoryAction(body: StoryScheduleBody) {
  try {
    return await rustClient.telegramStories.schedule(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function cancelTelegramStoryAction(postId: string, botId: string) {
  try {
    return await rustClient.telegramStories.cancel(postId, botId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Flows (quick replies) ---------------------------------------------

export async function listTelegramFlowsAction(projectId: string): Promise<FlowReplyRow[]> {
  try {
    const res = await rustClient.telegramFlows.list(projectId);
    return res.replies ?? [];
  } catch {
    return [];
  }
}

export async function upsertTelegramFlowAction(body: FlowUpsertBody) {
  try {
    return await rustClient.telegramFlows.upsert(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramFlowAction(replyId: string, projectId: string) {
  try {
    return await rustClient.telegramFlows.delete(replyId, projectId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Mini Apps ---------------------------------------------------------

export async function listTelegramMiniAppsAction(projectId: string): Promise<MiniAppEntry[]> {
  try {
    const res = await rustClient.telegramMiniApps.list(projectId);
    return res.miniApps ?? [];
  } catch {
    return [];
  }
}

// -- Ads ---------------------------------------------------------------

export async function listTelegramAdsAction(projectId: string): Promise<AdsCampaignRow[]> {
  try {
    const res = await rustClient.telegramAds.list(projectId);
    return res.campaigns ?? [];
  } catch {
    return [];
  }
}

export async function upsertTelegramAdAction(body: AdsUpsertBody) {
  try {
    return await rustClient.telegramAds.upsert(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramAdAction(campaignId: string, projectId: string) {
  try {
    return await rustClient.telegramAds.delete(campaignId, projectId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}
