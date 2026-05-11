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
  InvoiceLinkBody as PaymentLinkBody,
  InvoiceRow,
  RefundPaymentBody,
} from '@/lib/rust-client/telegram-payments';
import type {
  CampaignRow as AdsCampaignRow,
  UpsertBody as AdsUpsertBody,
  ListQuery as AdsListQuery,
  ListResp as AdsListResp,
  AnalyticsResp as AdsAnalyticsResp,
  AnalyticsQuery as AdsAnalyticsQuery,
  ImportBody as AdsImportBody,
  ImportResp as AdsImportResp,
  BulkDeleteBody as AdsBulkDeleteBody,
  BulkDeleteResp as AdsBulkDeleteResp,
  UtmBody as AdsUtmBody,
  UtmResp as AdsUtmResp,
  DetailResp as AdsDetailResp,
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
import type {
  MiniAppEntry,
  ListQuery as MiniAppsListQuery,
  ListResp as MiniAppsListResp,
  DetailResp as MiniAppsDetailResp,
  UpsertBody as MiniAppsUpsertBody,
  SendBody as MiniAppsSendBody,
  SendResp as MiniAppsSendResp,
  SetMenuButtonBody as MiniAppsSetMenuButtonBody,
  ValidateInitDataBody as MiniAppsValidateInitDataBody,
  ValidateInitDataResp as MiniAppsValidateInitDataResp,
  SessionsResp as MiniAppsSessionsResp,
  AnalyticsQuery as MiniAppsAnalyticsQuery,
  AnalyticsResp as MiniAppsAnalyticsResp,
} from '@/lib/rust-client/telegram-mini-apps';
import type {
  ListBotsParams,
  ListBotsResp,
  GetBotResp,
  BotInfoResp,
  CommandsResp,
  MenuButtonResp,
  AdminRightsResp,
  AdminRightsDto,
  HealthResp,
  BulkDisconnectResp,
  BotCommand,
  MenuButton,
  AckResult as BotsAckResult,
} from '@/lib/rust-client/telegram-bots';
import { revalidatePath } from 'next/cache';
import { invalidateTelegramBotCache } from '@/lib/telegram/bot-cache';

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
//
// The Telegram Payments BFF is now multi-tenant and template-driven —
// these legacy wrappers preserve the action surface but route through
// the new project-scoped client.

export async function listTelegramInvoicesAction(projectId: string): Promise<InvoiceRow[]> {
  try {
    const res = await rustClient.telegramPayments.listInvoices(projectId);
    return res.invoices ?? [];
  } catch (e) {
    if (e instanceof RustApiError) return [];
    return [];
  }
}

export async function createTelegramInvoiceAction(body: PaymentLinkBody) {
  try {
    return await rustClient.telegramPayments.createInvoiceLink(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function refundTelegramStarAction(
  paymentId: string,
  body: RefundPaymentBody,
) {
  try {
    return await rustClient.telegramPayments.refundPayment(paymentId, body);
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

// -- Flows (legacy quick-reply shape) -----------------------------------
//
// These wrappers used to call the quick-reply CRUD that the
// `telegram-flows` crate originally hosted. That crate has since been
// reshaped to serve the visual-flow API (see `telegramFlowsApi` for the
// real surface); the wrappers below stay so this file keeps compiling
// for any callers still importing the legacy names. They resolve to
// empty/no-op results rather than calling the new endpoints, since the
// request/response shapes are fundamentally different.

export async function listTelegramFlowsAction(_projectId: string): Promise<FlowReplyRow[]> {
  return [];
}

export async function upsertTelegramFlowAction(_body: FlowUpsertBody) {
  return {
    success: false,
    error: 'Quick-reply upsert was removed - use the visual flow editor.',
  } as const;
}

export async function deleteTelegramFlowAction(_replyId: string, _projectId: string) {
  return {
    success: false,
    error: 'Quick-reply delete was removed - use the visual flow editor.',
  } as const;
}

// -- Mini Apps ---------------------------------------------------------

export async function listTelegramMiniAppsAction(projectId: string): Promise<MiniAppEntry[]> {
  try {
    const res = await rustClient.telegramMiniApps.list(projectId);
    // Adapt the rich row shape to the legacy read-only entry shape so
    // existing callers keep compiling.
    return (res.miniApps ?? []).map((r: any) =>
      // Legacy `MiniAppEntry` only — when the BFF returns a `MiniAppRow`
      // map it down; when it returns the old shape, pass through.
      'webAppUrl' in r
        ? {
            botId: r.botId,
            username: r.botUsername ?? '',
            name: r.name,
            miniAppUrl: r.webAppUrl,
          }
        : (r as MiniAppEntry),
    );
  } catch {
    return [];
  }
}

export async function listTelegramMiniAppsPagedAction(
  q: MiniAppsListQuery,
): Promise<MiniAppsListResp> {
  const empty: MiniAppsListResp = {
    miniApps: [],
    total: 0,
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
  };
  try {
    return (await rustClient.telegramMiniApps.list(q)) as MiniAppsListResp;
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramMiniAppAction(
  appId: string,
  projectId: string,
): Promise<MiniAppsDetailResp> {
  try {
    return await rustClient.telegramMiniApps.detail(appId, projectId);
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function createTelegramMiniAppAction(body: MiniAppsUpsertBody) {
  try {
    return await rustClient.telegramMiniApps.create(body);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function updateTelegramMiniAppAction(
  appId: string,
  body: MiniAppsUpsertBody,
) {
  try {
    return await rustClient.telegramMiniApps.update(appId, body);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramMiniAppAction(appId: string, projectId: string) {
  try {
    return await rustClient.telegramMiniApps.delete(appId, projectId);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function sendTelegramMiniAppAction(
  appId: string,
  body: MiniAppsSendBody,
): Promise<MiniAppsSendResp> {
  try {
    return await rustClient.telegramMiniApps.send(appId, body);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function setTelegramMiniAppMenuButtonAction(
  appId: string,
  body: MiniAppsSetMenuButtonBody,
) {
  try {
    return await rustClient.telegramMiniApps.setMenuButton(appId, body);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function validateTelegramMiniAppInitDataAction(
  body: MiniAppsValidateInitDataBody,
): Promise<MiniAppsValidateInitDataResp> {
  try {
    return await rustClient.telegramMiniApps.validateInitData(body);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function listTelegramMiniAppSessionsAction(
  appId: string,
  projectId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<MiniAppsSessionsResp> {
  try {
    return await rustClient.telegramMiniApps.sessions(appId, projectId, opts);
  } catch (e) {
    if (e instanceof RustApiError) return { sessions: [], error: e.message };
    return { sessions: [], error: String(e) };
  }
}

export async function getTelegramMiniAppAnalyticsAction(
  appId: string,
  q: MiniAppsAnalyticsQuery,
): Promise<MiniAppsAnalyticsResp> {
  const empty: MiniAppsAnalyticsResp = {
    opens: 0,
    uniqueUsers: 0,
    conversion: 0,
    byDay: [],
  };
  try {
    return await rustClient.telegramMiniApps.analytics(appId, q);
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}


// -- Ads ---------------------------------------------------------------

export async function listTelegramAdsAction(projectId: string): Promise<AdsCampaignRow[]> {
  try {
    const res = await rustClient.telegramAds.list({ projectId, pageSize: 100 });
    return res.campaigns ?? [];
  } catch {
    return [];
  }
}

export async function listTelegramAdsPagedAction(q: AdsListQuery): Promise<AdsListResp> {
  try {
    return await rustClient.telegramAds.list(q);
  } catch (e) {
    const empty: AdsListResp = {
      campaigns: [],
      total: 0,
      hasMore: false,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 20,
    };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramAdAction(
  campaignId: string,
  projectId: string,
): Promise<AdsDetailResp> {
  try {
    return await rustClient.telegramAds.detail(campaignId, projectId);
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
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

export async function getTelegramAdsAnalyticsAction(
  q: AdsAnalyticsQuery,
): Promise<AdsAnalyticsResp> {
  const empty: AdsAnalyticsResp = {
    totalSpendCents: 0,
    totalImpressions: 0,
    totalClicks: 0,
    ctr: 0,
    cpmCents: 0,
    cpcCents: 0,
    byDay: [],
    topCampaigns: [],
  };
  try {
    return await rustClient.telegramAds.analytics(q);
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function importTelegramAdsCsvAction(body: AdsImportBody): Promise<AdsImportResp> {
  try {
    return await rustClient.telegramAds.importCsv(body);
  } catch (e) {
    const empty: AdsImportResp = { success: false, inserted: 0, updated: 0, skipped: 0 };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function exportTelegramAdsCsvAction(projectId: string): Promise<string> {
  try {
    return await rustClient.telegramAds.exportCsv(projectId);
  } catch {
    return '';
  }
}

export async function bulkDeleteTelegramAdsAction(
  body: AdsBulkDeleteBody,
): Promise<AdsBulkDeleteResp> {
  try {
    return await rustClient.telegramAds.bulkDelete(body);
  } catch (e) {
    const empty: AdsBulkDeleteResp = { success: false, deleted: 0 };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function buildTelegramAdsUtmAction(body: AdsUtmBody): Promise<AdsUtmResp> {
  try {
    return await rustClient.telegramAds.utm(body);
  } catch (e) {
    const empty: AdsUtmResp = { success: false, shortUrl: '', longUrl: '' };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

// =========================================================================
//  Bot self-management — proxies for the `/v1/telegram/bots` slice.
// =========================================================================

export async function listTelegramBotsAction(params: ListBotsParams): Promise<ListBotsResp> {
  try {
    return await rustClient.telegramBots.list(params);
  } catch (e) {
    const empty: ListBotsResp = {
      bots: [],
      total: 0,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 50,
    };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramBotAction(botId: string): Promise<GetBotResp> {
  try {
    return await rustClient.telegramBots.get(botId);
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function getTelegramBotInfoAction(botId: string): Promise<BotInfoResp> {
  try {
    const res = await rustClient.telegramBots.info(botId);
    if (!res.error) invalidateTelegramBotCache(botId);
    return res;
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function runTelegramBotHealthAction(botId: string): Promise<HealthResp> {
  try {
    return await rustClient.telegramBots.health(botId);
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function bulkDisconnectTelegramBotsAction(
  projectId: string,
  ids: string[],
): Promise<BulkDisconnectResp> {
  try {
    const res = await rustClient.telegramBots.bulkDisconnect(projectId, ids);
    if (res.success) {
      for (const id of ids) invalidateTelegramBotCache(id);
      revalidatePath('/dashboard/telegram', 'layout');
    }
    return res;
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, disconnected: 0, failed: ids.length, error: e.message };
    return { success: false, disconnected: 0, failed: ids.length, error: String(e) };
  }
}

export async function getTelegramBotCommandsScopedAction(
  botId: string,
  languageCode?: string,
): Promise<CommandsResp> {
  try {
    return await rustClient.telegramBots.getCommands(botId, languageCode);
  } catch (e) {
    if (e instanceof RustApiError) return { commands: [], error: e.message };
    return { commands: [], error: String(e) };
  }
}

export async function setTelegramBotCommandsScopedAction(input: {
  botId: string;
  projectId: string;
  commands: BotCommand[];
  scope?: Record<string, unknown>;
  languageCode?: string;
}): Promise<BotsAckResult> {
  try {
    const res = await rustClient.telegramBots.setCommands(input.botId, {
      projectId: input.projectId,
      commands: input.commands,
      scope: input.scope,
      languageCode: input.languageCode,
    });
    if (res.success) invalidateTelegramBotCache(input.botId);
    return res;
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramBotCommandsAction(input: {
  botId: string;
  projectId: string;
  languageCode?: string;
}): Promise<BotsAckResult> {
  try {
    const res = await rustClient.telegramBots.deleteCommands(
      input.botId,
      input.projectId,
      input.languageCode,
    );
    if (res.success) invalidateTelegramBotCache(input.botId);
    return res;
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function setTelegramBotNameAction(input: {
  botId: string;
  projectId: string;
  name: string;
  languageCode?: string;
}): Promise<BotsAckResult> {
  try {
    const res = await rustClient.telegramBots.setName(input.botId, {
      projectId: input.projectId,
      name: input.name,
      languageCode: input.languageCode,
    });
    if (res.success) {
      invalidateTelegramBotCache(input.botId);
      revalidatePath('/dashboard/telegram', 'layout');
    }
    return res;
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function setTelegramBotDescriptionAction(input: {
  botId: string;
  projectId: string;
  description: string;
  languageCode?: string;
}): Promise<BotsAckResult> {
  try {
    return await rustClient.telegramBots.setDescription(input.botId, {
      projectId: input.projectId,
      description: input.description,
      languageCode: input.languageCode,
    });
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function setTelegramBotShortDescriptionAction(input: {
  botId: string;
  projectId: string;
  shortDescription: string;
  languageCode?: string;
}): Promise<BotsAckResult> {
  try {
    return await rustClient.telegramBots.setShortDescription(input.botId, {
      projectId: input.projectId,
      shortDescription: input.shortDescription,
      languageCode: input.languageCode,
    });
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function getTelegramBotMenuButtonAction(botId: string): Promise<MenuButtonResp> {
  try {
    return await rustClient.telegramBots.getMenuButton(botId);
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function setTelegramBotMenuButtonAction(input: {
  botId: string;
  projectId: string;
  menuButton: MenuButton | Record<string, unknown>;
}): Promise<BotsAckResult> {
  try {
    const res = await rustClient.telegramBots.setMenuButton(input.botId, {
      projectId: input.projectId,
      menuButton: input.menuButton,
    });
    if (res.success) invalidateTelegramBotCache(input.botId);
    return res;
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function getTelegramBotAdminRightsAction(
  botId: string,
  forChannels: boolean,
): Promise<AdminRightsResp> {
  try {
    return await rustClient.telegramBots.getAdminRights(botId, forChannels);
  } catch (e) {
    if (e instanceof RustApiError) return { forChannels, error: e.message };
    return { forChannels, error: String(e) };
  }
}

export async function setTelegramBotAdminRightsAction(input: {
  botId: string;
  projectId: string;
  forChannels: boolean;
  rights?: AdminRightsDto;
}): Promise<BotsAckResult> {
  try {
    return await rustClient.telegramBots.setAdminRights(input.botId, {
      projectId: input.projectId,
      forChannels: input.forChannels,
      rights: input.rights,
    });
  } catch (e) {
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function exportTelegramBotsCsvAction(projectId: string): Promise<string> {
  try {
    return await rustClient.telegramBots.exportCsv(projectId);
  } catch {
    return '';
  }
}
