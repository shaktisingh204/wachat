'use server';

/**
 * Server-action wrappers for the Telegram BFF crates that don't have
 * direct legacy callers. Each function is a thin pass-through to the
 * Rust client. Putting them here keeps `telegram.actions.ts` focused
 * on the original action surface.
 */

import { ObjectId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { rustClient, RustApiError } from '@/lib/rust-client';
import {
  isRustUnavailable as sharedIsRustUnavailable,
  withRustFallback,
} from '@/lib/telegram/rust-fallback';
import { TelegramBotApi, TelegramApiError } from '@/lib/telegram/bot-api';
import { getSession } from './user.actions';
import { getProjectById } from './project.actions';

/**
 * Friendly message returned when a write action targets a Rust route
 * that isn't deployed yet. Keeps the UI from flashing a raw
 * `Rust API 404 Not Found` banner — the user gets a clear "backend not
 * available" notice and the optimistic state can roll back.
 */
const RUST_WRITE_UNAVAILABLE =
  'Telegram backend is not deployed yet — change not saved.';

/**
 * Read the bot doc straight from Mongo and shape it as the `BotRow`
 * the drawer expects. Used when the Rust BFF returns 404 / 5xx for
 * `GET /v1/telegram/bots/{id}`.
 */
async function getTelegramBotFromMongoForDrawer(
  botId: string,
): Promise<GetBotResp> {
  try {
    if (!ObjectId.isValid(botId)) return { error: 'Invalid bot id.' };
    const { db } = await connectToDatabase();
    const b: any = await db
      .collection('telegram_bots')
      .findOne({ _id: new ObjectId(botId) });
    if (!b) return { error: 'Bot not found.' };
    const toIso = (v: any) =>
      v instanceof Date ? v.toISOString() : v ? String(v) : undefined;
    return {
      bot: {
        _id: b._id.toString(),
        projectId: (b.projectId as ObjectId).toString(),
        userId: (b.userId as ObjectId).toString(),
        botId: Number(b.botId ?? 0),
        username: String(b.username ?? ''),
        name: String(b.name ?? b.username ?? ''),
        isActive: Boolean(b.isActive),
        webhookUrl: b.webhookUrl,
        webhookRegisteredAt: toIso(b.webhookRegisteredAt),
        webhookInfo: undefined,
        canJoinGroups: b.canJoinGroups,
        canReadAllGroupMessages: b.canReadAllGroupMessages,
        supportsInlineQueries: b.supportsInlineQueries,
        hasMainWebApp: undefined,
        status: b.isActive ? 'active' : 'disconnected',
        lastSeenAt: undefined,
        latencyMs: undefined,
        createdAt: toIso(b.createdAt) ?? new Date().toISOString(),
        updatedAt: toIso(b.updatedAt) ?? new Date().toISOString(),
      },
    };
  } catch (e) {
    return { error: String(e) };
  }
}
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
  StoryRow,
  ListQuery as StoryListQuery,
  ListResp as StoryListResp,
  DetailResp as StoryDetailResp,
  CreateBody as StoryCreateBody,
  UpdateBody as StoryUpdateBody,
  ScheduleBody as StoryScheduleBody,
  EditBody as StoryEditBody,
  BusinessConnectionsResp as StoryBusinessConnectionsResp,
  RegisterBcBody as StoryRegisterBcBody,
  StarBalanceQuery as StoryStarBalanceQuery,
  StarBalanceResp as StoryStarBalanceResp,
  AnalyticsQuery as StoryAnalyticsQuery,
  AnalyticsResp as StoryAnalyticsResp,
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
import type {
  ListQuery as CommandsListQuery,
  ListResp as CommandsListResp,
  CreateBody as CommandsCreateBody,
  UpdateBody as CommandsUpdateBody,
  DetailResp as CommandsDetailResp,
  AckResult as CommandsAckResult,
  PushBody as CommandsPushBody,
  PushResp as CommandsPushResp,
  PullResp as CommandsPullResp,
  RunsResp as CommandsRunsResp,
  AnalyticsQuery as CommandsAnalyticsQuery,
  AnalyticsResp as CommandsAnalyticsResp,
  ImportBody as CommandsImportBody,
  ImportResp as CommandsImportResp,
} from '@/lib/rust-client/telegram-commands';
import { revalidatePath } from 'next/cache';
import { invalidateTelegramBotCache } from '@/lib/telegram/bot-cache';

// -- Analytics ---------------------------------------------------------

// Both wrappers try the Rust BFF first and fall back to the direct-Mongo
// implementations in `telegram.actions.ts` when Rust returns 404 / 5xx /
// network failure (route not deployed on this server). Auth and 4xx
// still surface as `error` so the UI can show a friendly banner.

export async function getTelegramOverviewAction(projectId: string): Promise<OverviewResp> {
  const empty: OverviewResp = { bots: 0, activeChats: 0, broadcasts: 0 };
  try {
    return await withRustFallback(
      () => rustClient.telegramAnalytics.overview({ projectId }),
      async () => {
        const { getTelegramOverview } = await import('./telegram.actions');
        const o = await getTelegramOverview(projectId);
        return { bots: o.bots, activeChats: o.activeChats, broadcasts: o.broadcasts };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getBotAnalyticsAction(
  botId: string,
  days?: number,
): Promise<BotAnalyticsResp> {
  const empty: BotAnalyticsResp = {
    totals: { messages: 0, inbound: 0, outbound: 0, chats: 0 },
    timeseries: [],
    topChats: [],
  };
  try {
    return await withRustFallback(
      () => rustClient.telegramAnalytics.bot(botId, days),
      async () => {
        const { getTelegramAnalytics } = await import('./telegram.actions');
        const a = await getTelegramAnalytics({ botId, days });
        return { totals: a.totals, timeseries: a.timeseries, topChats: a.topChats };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

// -- Payments ----------------------------------------------------------
//
// The Telegram Payments BFF is now multi-tenant and template-driven —
// these legacy wrappers preserve the action surface but route through
// the new project-scoped client.

/**
 * Map a `telegram_invoices` Mongo doc to the wire-shape `InvoiceRow`
 * the Rust BFF returns. Used by the direct-Mongo fallback when the
 * Rust payments route is unavailable.
 */
function invoiceDocToRow(d: any): InvoiceRow {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString();
  return {
    _id: d._id?.toString?.() ?? String(d._id ?? ''),
    projectId: d.projectId?.toString?.() ?? String(d.projectId ?? ''),
    botId: d.botId?.toString?.() ?? String(d.botId ?? ''),
    templateId: d.templateId ? String(d.templateId) : undefined,
    chatId: d.chatId ? String(d.chatId) : undefined,
    title: String(d.title ?? ''),
    currency: String(d.currency ?? ''),
    amount: Number(d.totalAmount ?? d.amount ?? 0),
    status: String(d.status ?? 'CREATED'),
    invoiceLink: d.invoiceLink ? String(d.invoiceLink) : undefined,
    messageId: typeof d.messageId === 'number' ? d.messageId : undefined,
    paymentId: d.telegramPaymentChargeId
      ? String(d.telegramPaymentChargeId)
      : d.paymentId
        ? String(d.paymentId)
        : undefined,
    createdAt: toIso(d.createdAt),
  };
}

export async function listTelegramInvoicesAction(projectId: string): Promise<InvoiceRow[]> {
  try {
    return await withRustFallback(
      async () => {
        const res = await rustClient.telegramPayments.listInvoices(projectId);
        return res.invoices ?? [];
      },
      async () => {
        if (!ObjectId.isValid(projectId)) return [];
        const { db } = await connectToDatabase();
        const rows = await db
          .collection('telegram_invoices')
          .find({ projectId: new ObjectId(projectId) })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();
        return rows.map(invoiceDocToRow);
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return [];
    return [];
  }
}

export async function createTelegramInvoiceAction(body: PaymentLinkBody) {
  try {
    return await rustClient.telegramPayments.createInvoiceLink(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      // Rust isn't there to call createInvoiceLink against Telegram —
      // record a CREATED invoice locally so the UI keeps working. The
      // reconciliation worker can promote it to a real link once the
      // BFF returns.
      try {
        if (!ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid project id.' };
        }
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };
        const project = await getProjectById(body.projectId);
        if (!project) return { success: false, error: 'Project not found.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection('telegram_invoices').insertOne({
          projectId: new ObjectId(body.projectId),
          botId:
            body.botId && ObjectId.isValid(body.botId)
              ? new ObjectId(body.botId)
              : null,
          templateId: body.templateId ? String(body.templateId) : undefined,
          title: body.overrides?.title ?? '',
          description: body.overrides?.description ?? '',
          payload: body.overrides?.payload ?? '',
          currency: body.overrides?.currency ?? '',
          totalAmount: (body.overrides?.prices ?? []).reduce(
            (n: number, p: any) => n + Number(p.amountCents ?? 0),
            0,
          ),
          prices: body.overrides?.prices ?? [],
          status: 'CREATED',
          createdAt: now,
          updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/payments');
        return {
          success: true,
          id: ins.insertedId.toString(),
          message:
            'Invoice recorded locally — link will be generated once the Telegram backend is reachable.',
        };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
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
    if (sharedIsRustUnavailable(e)) {
      // Without Rust we cannot call Telegram's refundStarPayment, but
      // we can mark the local invoice as REFUNDED so the UI reflects
      // the user's intent. The reconciliation worker will retry the
      // actual Telegram call once the BFF returns.
      try {
        if (!ObjectId.isValid(paymentId)) {
          return { success: false, error: 'Invalid payment id.' };
        }
        if (!ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid project id.' };
        }
        const { db } = await connectToDatabase();
        const now = new Date();
        const res = await db.collection('telegram_invoices').updateOne(
          {
            _id: new ObjectId(paymentId),
            projectId: new ObjectId(body.projectId),
          },
          {
            $set: {
              status: 'REFUNDED',
              refundedAt: now,
              updatedAt: now,
            },
          },
        );
        if (res.matchedCount === 0) {
          return { success: false, error: 'Invoice not found.' };
        }
        revalidatePath('/dashboard/telegram/payments');
        return {
          success: true,
          message:
            'Marked as refunded locally — Telegram refund will be retried when backend is reachable.',
        };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Stickers ----------------------------------------------------------

/**
 * Map a `telegram_sticker_sets` Mongo doc to the wire-shape `SetRow`
 * the Rust BFF returns. The legacy collection doesn't store the full
 * sticker list (the Rust BFF resyncs from Telegram), so we return an
 * empty `stickers[]` and rely on `stickerCount` for the badge.
 */
function stickerSetDocToRow(d: any): StickerSetRow {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString();
  return {
    _id: d._id?.toString?.() ?? String(d._id ?? ''),
    projectId: d.projectId?.toString?.() ?? String(d.projectId ?? ''),
    botId: d.botId?.toString?.() ?? String(d.botId ?? ''),
    name: String(d.name ?? ''),
    title: String(d.title ?? ''),
    stickerType: (d.stickerType ?? 'regular') as StickerSetRow['stickerType'],
    thumbnailFileId: d.thumbnailFileId ? String(d.thumbnailFileId) : undefined,
    thumbnailUrl: d.thumbnailUrl ? String(d.thumbnailUrl) : undefined,
    stickers: Array.isArray(d.stickers) ? d.stickers : [],
    stickerCount: Number(d.stickerCount ?? 0),
    archived: Boolean(d.archived),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
    lastSyncedAt: d.lastSyncedAt ? toIso(d.lastSyncedAt) : undefined,
  };
}

export async function listTelegramStickerSetsAction(botId: string): Promise<StickerSetRow[]> {
  try {
    return await withRustFallback(
      async () => {
        // Legacy callers pass a single id that is sometimes a botId and
        // sometimes a projectId. The Rust route requires both — pass the
        // value as each so `require_project_bot` rejects the call and we
        // gracefully fall through to the Mongo fallback below for the
        // legacy single-id case. The new page (`telegram-stickers.actions`)
        // calls `rustClient.telegramStickers.list(projectId, botId)`
        // directly with the right values.
        const res = await rustClient.telegramStickers.list(botId, botId);
        return res.sets ?? [];
      },
      async () => {
        // The parameter is named `botId` for legacy reasons but callers
        // pass either a botId or a projectId. Match on whichever Mongo
        // field happens to validate as an ObjectId.
        if (!ObjectId.isValid(botId)) return [];
        const { db } = await connectToDatabase();
        const id = new ObjectId(botId);
        const rows = await db
          .collection('telegram_sticker_sets')
          .find({ $or: [{ botId: id }, { projectId: id }] })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();
        return rows.map(stickerSetDocToRow);
      },
    );
  } catch {
    return [];
  }
}

export async function createTelegramStickerSetAction(body: StickerCreateBody) {
  try {
    return await rustClient.telegramStickers.create(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      // Rust isn't available — combine a direct Telegram API call with
      // a local sticker_sets row so the UI shows the new pack. Telegram
      // API errors here are real (bad emoji, name taken, etc.) and we
      // surface them verbatim instead of pretending the BFF was at
      // fault.
      try {
        if (!ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid project id.' };
        }
        if (!ObjectId.isValid(body.botId)) {
          return { success: false, error: 'Invalid bot id.' };
        }
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };
        const project = await getProjectById(body.projectId);
        if (!project) return { success: false, error: 'Project not found.' };

        const { db } = await connectToDatabase();
        const bot: any = await db
          .collection('telegram_bots')
          .findOne({ _id: new ObjectId(body.botId) });
        if (!bot || !bot.token) {
          return { success: false, error: 'Bot not found.' };
        }

        // Telegram requires the pack name to end with `_by_<botUsername>`.
        const username = String(bot.username ?? '');
        const name = body.name.endsWith(`_by_${username}`)
          ? body.name
          : `${body.name}_by_${username}`;

        // Telegram-side call. Errors here propagate as-is so the caller
        // sees the real reason (e.g. STICKERSET_NAME_INVALID).
        await TelegramBotApi.createNewStickerSet(bot.token, {
          user_id: body.userId,
          name,
          title: body.title,
          stickers: (body.stickers ?? []).map((s) => ({
            sticker: s.sabFileUrl,
            emoji_list: (s.emoji ?? '').split(/\s+/).filter(Boolean).slice(0, 20),
          })),
          sticker_type: body.stickerType ?? 'regular',
        });

        const now = new Date();
        const ins = await db.collection('telegram_sticker_sets').insertOne({
          projectId: new ObjectId(body.projectId),
          botId: new ObjectId(body.botId),
          userId: new ObjectId(session.user._id),
          name,
          title: body.title,
          stickerType: body.stickerType ?? 'regular',
          stickerCount: body.stickers?.length ?? 0,
          lastSyncedAt: now,
          createdAt: now,
          updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/stickers');
        return { success: true, setId: ins.insertedId.toString() };
      } catch (innerErr) {
        if (innerErr instanceof TelegramApiError) {
          return { success: false, error: innerErr.description };
        }
        return { success: false, error: String(innerErr) };
      }
    }
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramStickerSetAction(setId: string, botId: string) {
  try {
    // Legacy signature: callers identify the pack by an opaque setId.
    // The Rust route is `DELETE /v1/telegram/stickers/{setName}` and
    // soft-archives via `archive`, requiring both projectId and botId.
    // The legacy single-arg callsite has neither — pass the botId for
    // both so the Rust call fails out cleanly and we fall to the Mongo
    // path below for legacy compatibility. New callers use
    // `archiveStickerSetAction` in `telegram-stickers.actions.ts`.
    return await rustClient.telegramStickers.archive(setId, botId, botId);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      // Mirror the legacy `deleteTelegramStickerSet` flow: best-effort
      // Telegram-side delete, then remove the local row.
      try {
        if (!ObjectId.isValid(setId)) {
          return { success: false, error: 'Invalid set id.' };
        }
        const { db } = await connectToDatabase();
        const set: any = await db
          .collection('telegram_sticker_sets')
          .findOne({ _id: new ObjectId(setId) });
        if (!set) return { success: false, error: 'Sticker set not found.' };

        // Try to look up the bot via the set's botId so we can call
        // Telegram's deleteStickerSet. If the bot row is gone we still
        // soft-delete locally.
        let token: string | undefined;
        if (set.botId && ObjectId.isValid(set.botId)) {
          const bot: any = await db
            .collection('telegram_bots')
            .findOne({ _id: new ObjectId(set.botId) });
          token = bot?.token;
        }
        if (token && set.name) {
          try {
            await TelegramBotApi.deleteStickerSet(token, String(set.name));
          } catch {
            /* may already be gone on Telegram's side */
          }
        }

        await db
          .collection('telegram_sticker_sets')
          .deleteOne({ _id: set._id });
        revalidatePath('/dashboard/telegram/stickers');
        return { success: true };
      } catch (innerErr) {
        if (innerErr instanceof TelegramApiError) {
          return { success: false, error: innerErr.description };
        }
        return { success: false, error: String(innerErr) };
      }
    }
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

// -- Stories -----------------------------------------------------------

export async function listTelegramStoriesAction(
  q: StoryListQuery,
): Promise<StoryListResp> {
  const empty: StoryListResp = {
    stories: [],
    total: 0,
    hasMore: false,
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
  };
  try {
    return await rustClient.telegramStories.list(q);
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramStoryAction(
  storyId: string,
  projectId: string,
): Promise<StoryDetailResp> {
  try {
    return await rustClient.telegramStories.detail(storyId, projectId);
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function createTelegramStoryAction(body: StoryCreateBody) {
  try {
    return await rustClient.telegramStories.create(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function updateTelegramStoryAction(
  storyId: string,
  body: StoryUpdateBody,
) {
  try {
    return await rustClient.telegramStories.update(storyId, body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramStoryAction(
  storyId: string,
  projectId: string,
) {
  try {
    return await rustClient.telegramStories.delete(storyId, projectId);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function postTelegramStoryAction(
  storyId: string,
  projectId: string,
) {
  try {
    return await rustClient.telegramStories.post(storyId, { projectId });
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function scheduleTelegramStoryAction(
  storyId: string,
  body: StoryScheduleBody,
) {
  try {
    return await rustClient.telegramStories.schedule(storyId, body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function cancelTelegramStoryAction(
  storyId: string,
  projectId: string,
) {
  try {
    return await rustClient.telegramStories.cancel(storyId, { projectId });
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function editTelegramStoryOnTelegramAction(
  storyId: string,
  body: StoryEditBody,
) {
  try {
    return await rustClient.telegramStories.editOnTelegram(storyId, body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramStoryOnTelegramAction(
  storyId: string,
  projectId: string,
) {
  try {
    return await rustClient.telegramStories.deleteOnTelegram(storyId, {
      projectId,
    });
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function listTelegramStoryBusinessConnectionsAction(
  projectId: string,
  botId?: string,
): Promise<StoryBusinessConnectionsResp> {
  try {
    return await rustClient.telegramStories.listBusinessConnections(
      projectId,
      botId,
    );
  } catch (e) {
    if (e instanceof RustApiError)
      return { connections: [], error: e.message };
    return { connections: [], error: String(e) };
  }
}

export async function registerTelegramStoryBusinessConnectionAction(
  body: StoryRegisterBcBody,
) {
  try {
    return await rustClient.telegramStories.registerBusinessConnection(body);
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramStoryBusinessConnectionAction(
  id: string,
  projectId: string,
) {
  try {
    return await rustClient.telegramStories.deleteBusinessConnection(
      id,
      projectId,
    );
  } catch (e) {
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function getTelegramStoryStarBalanceAction(
  q: StoryStarBalanceQuery,
): Promise<StoryStarBalanceResp> {
  try {
    return await rustClient.telegramStories.starBalance(q);
  } catch (e) {
    const empty: StoryStarBalanceResp = {
      success: false,
      amount: 0,
      nanostarAmount: 0,
    };
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramStoriesAnalyticsAction(
  q: StoryAnalyticsQuery,
): Promise<StoryAnalyticsResp> {
  const empty: StoryAnalyticsResp = {
    drafts: 0,
    scheduled: 0,
    posted: 0,
    expired: 0,
    failed: 0,
    postedToday: 0,
    active: 0,
    byDay: [],
  };
  try {
    return await rustClient.telegramStories.analytics(q);
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function exportTelegramStoriesCsvAction(
  projectId: string,
): Promise<string> {
  try {
    return await rustClient.telegramStories.exportCsv(projectId);
  } catch {
    return '';
  }
}

// Re-export the row type for the page module.
type TelegramStoryRow = StoryRow;

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

/**
 * Map a `telegram_mini_apps` Mongo doc into the wire-shape `MiniAppRow`
 * returned by the Rust BFF. Used by the direct-Mongo fallback when the
 * mini-apps Rust routes aren't deployed.
 */
function miniAppDocToRow(d: any): any {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString();
  return {
    _id: d._id?.toString?.() ?? String(d._id ?? ''),
    projectId: d.projectId?.toString?.() ?? String(d.projectId ?? ''),
    botId: d.botId?.toString?.() ?? String(d.botId ?? ''),
    botUsername: d.botUsername ? String(d.botUsername) : undefined,
    name: String(d.name ?? ''),
    slug: String(d.slug ?? ''),
    webAppUrl: String(d.webAppUrl ?? d.miniAppUrl ?? ''),
    shortName: d.shortName ? String(d.shortName) : undefined,
    description: d.description ? String(d.description) : undefined,
    photoUrl: d.photoUrl ? String(d.photoUrl) : undefined,
    themeParams: d.themeParams ?? {},
    defaultButtonLabel: String(d.defaultButtonLabel ?? 'Open'),
    allowedDomains: Array.isArray(d.allowedDomains) ? d.allowedDomains : [],
    status: String(d.status ?? 'active'),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export async function listTelegramMiniAppsAction(projectId: string): Promise<MiniAppEntry[]> {
  try {
    return await withRustFallback(
      async () => {
        const res = await rustClient.telegramMiniApps.list(projectId);
        // Adapt the rich row shape to the legacy read-only entry shape so
        // existing callers keep compiling.
        return (res.miniApps ?? []).map((r: any) =>
          'webAppUrl' in r
            ? {
                botId: r.botId,
                username: r.botUsername ?? '',
                name: r.name,
                miniAppUrl: r.webAppUrl,
              }
            : (r as MiniAppEntry),
        );
      },
      async () => {
        if (!ObjectId.isValid(projectId)) return [];
        const { db } = await connectToDatabase();
        const rows = await db
          .collection('telegram_mini_apps')
          .find({ projectId: new ObjectId(projectId) })
          .sort({ createdAt: -1 })
          .limit(200)
          .toArray();
        return rows.map((d: any) => ({
          botId: d.botId?.toString?.() ?? String(d.botId ?? ''),
          username: String(d.botUsername ?? ''),
          name: String(d.name ?? ''),
          miniAppUrl: String(d.webAppUrl ?? d.miniAppUrl ?? ''),
        }));
      },
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
    return await withRustFallback(
      async () => (await rustClient.telegramMiniApps.list(q)) as MiniAppsListResp,
      async () => {
        if (!ObjectId.isValid(q.projectId)) return empty;
        const { db } = await connectToDatabase();
        const filter: any = { projectId: new ObjectId(q.projectId) };
        if (q.botId && ObjectId.isValid(q.botId)) filter.botId = new ObjectId(q.botId);
        if (q.status) filter.status = q.status;
        if (q.search) {
          const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.$or = [{ name: rx }, { slug: rx }];
        }
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;
        const col = db.collection('telegram_mini_apps');
        const [rows, total] = await Promise.all([
          col
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
          col.countDocuments(filter),
        ]);
        return {
          miniApps: rows.map(miniAppDocToRow) as any,
          total,
          page,
          pageSize,
        };
      },
    );
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
    return await withRustFallback(
      () => rustClient.telegramMiniApps.detail(appId, projectId),
      async () => {
        if (!ObjectId.isValid(appId) || !ObjectId.isValid(projectId)) {
          return { error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const d: any = await db.collection('telegram_mini_apps').findOne({
          _id: new ObjectId(appId),
          projectId: new ObjectId(projectId),
        });
        if (!d) return { error: 'Mini app not found.' };
        return { app: miniAppDocToRow(d) };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function createTelegramMiniAppAction(body: MiniAppsUpsertBody) {
  try {
    return await rustClient.telegramMiniApps.create(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid project id.' };
        }
        if (!ObjectId.isValid(body.botId)) {
          return { success: false, error: 'Invalid bot id.' };
        }
        const session = await getSession();
        if (!session?.user) return { success: false, error: 'Not authenticated.' };
        const project = await getProjectById(body.projectId);
        if (!project) return { success: false, error: 'Project not found.' };

        const { db } = await connectToDatabase();
        const now = new Date();
        const ins = await db.collection('telegram_mini_apps').insertOne({
          projectId: new ObjectId(body.projectId),
          botId: new ObjectId(body.botId),
          name: body.name,
          slug: body.slug,
          webAppUrl: body.webAppUrl,
          shortName: body.shortName,
          description: body.description,
          photoUrl: body.photoUrl,
          themeParams: body.themeParams ?? {},
          defaultButtonLabel: body.defaultButtonLabel ?? 'Open',
          allowedDomains: body.allowedDomains ?? [],
          status: body.status ?? 'active',
          createdAt: now,
          updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/mini-apps');
        return { success: true, appId: ins.insertedId.toString() };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
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
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(appId) || !ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const $set: any = {
          name: body.name,
          slug: body.slug,
          webAppUrl: body.webAppUrl,
          shortName: body.shortName,
          description: body.description,
          photoUrl: body.photoUrl,
          themeParams: body.themeParams ?? {},
          defaultButtonLabel: body.defaultButtonLabel ?? 'Open',
          allowedDomains: body.allowedDomains ?? [],
          status: body.status ?? 'active',
          updatedAt: new Date(),
        };
        if (body.botId && ObjectId.isValid(body.botId)) {
          $set.botId = new ObjectId(body.botId);
        }
        const res = await db.collection('telegram_mini_apps').updateOne(
          { _id: new ObjectId(appId), projectId: new ObjectId(body.projectId) },
          { $set },
        );
        if (res.matchedCount === 0) {
          return { success: false, error: 'Mini app not found.' };
        }
        revalidatePath('/dashboard/telegram/mini-apps');
        return { success: true, appId };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramMiniAppAction(appId: string, projectId: string) {
  try {
    return await rustClient.telegramMiniApps.delete(appId, projectId);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(appId) || !ObjectId.isValid(projectId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const res = await db.collection('telegram_mini_apps').deleteOne({
          _id: new ObjectId(appId),
          projectId: new ObjectId(projectId),
        });
        if (res.deletedCount === 0) {
          return { success: false, error: 'Mini app not found.' };
        }
        revalidatePath('/dashboard/telegram/mini-apps');
        return { success: true };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
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
    if (sharedIsRustUnavailable(e)) {
      // Sending a mini-app message goes through Telegram's Bot API; we
      // can't do that without the bot token, but Mongo has it. Look up
      // the app -> bot pair and call `sendMessage` directly with a
      // web_app keyboard button.
      try {
        if (!ObjectId.isValid(appId) || !ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const app: any = await db
          .collection('telegram_mini_apps')
          .findOne({
            _id: new ObjectId(appId),
            projectId: new ObjectId(body.projectId),
          });
        if (!app) return { success: false, error: 'Mini app not found.' };
        const botId = app.botId;
        if (!botId || !ObjectId.isValid(String(botId))) {
          return { success: false, error: 'Mini app has no linked bot.' };
        }
        const bot: any = await db
          .collection('telegram_bots')
          .findOne({ _id: new ObjectId(String(botId)) });
        if (!bot?.token) return { success: false, error: 'Bot not found.' };

        const text = body.text ?? `Open ${app.name ?? 'mini app'}`;
        const label = body.label ?? app.defaultButtonLabel ?? 'Open';
        const replyMarkup: any = {
          inline_keyboard: [
            [{ text: label, web_app: { url: String(app.webAppUrl) } }],
          ],
        };
        const sent: any = await (TelegramBotApi as any).sendMessage(bot.token, {
          chat_id: body.chatId,
          text,
          reply_markup: replyMarkup,
        });
        return { success: true, messageId: sent?.message_id };
      } catch (innerErr) {
        if (innerErr instanceof TelegramApiError) {
          return { success: false, error: innerErr.description };
        }
        return { success: false, error: String(innerErr) };
      }
    }
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
    if (sharedIsRustUnavailable(e)) {
      // Persist intent locally (we can't call Telegram's setChatMenuButton
      // without the bot token, and the API isn't critical) so the UI
      // can reflect the chosen state.
      try {
        if (!ObjectId.isValid(appId) || !ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        await db.collection('telegram_mini_apps').updateOne(
          {
            _id: new ObjectId(appId),
            projectId: new ObjectId(body.projectId),
          },
          {
            $set: {
              menuButtonChatId: body.chatId ?? null,
              menuButtonBotId: body.botId ?? null,
              updatedAt: new Date(),
            },
          },
        );
        return {
          success: true,
          message:
            'Saved locally — Telegram menu-button update will run once the backend is reachable.',
        };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
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
    if (sharedIsRustUnavailable(e)) {
      // We have a TS init-data validator in @/lib/telegram/init-data —
      // use it as the fallback so this critical path keeps working
      // without Rust.
      try {
        if (!ObjectId.isValid(body.projectId) || !ObjectId.isValid(body.appId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const app: any = await db.collection('telegram_mini_apps').findOne({
          _id: new ObjectId(body.appId),
          projectId: new ObjectId(body.projectId),
        });
        if (!app) return { success: false, error: 'Mini app not found.' };
        if (!app.botId) return { success: false, error: 'Mini app has no linked bot.' };
        const bot: any = await db
          .collection('telegram_bots')
          .findOne({ _id: new ObjectId(String(app.botId)) });
        if (!bot?.token) return { success: false, error: 'Bot not found.' };

        const mod: any = await import('@/lib/telegram/init-data');
        const validator =
          mod.validateInitData ?? mod.verifyInitData ?? mod.parseInitData;
        if (typeof validator !== 'function') {
          return { success: false, error: 'init-data validator unavailable.' };
        }
        const parsed = await validator(body.initData, bot.token);
        return { success: true, user: parsed?.user, authDate: parsed?.authDate };
      } catch (innerErr) {
        return { success: false, error: String(innerErr) };
      }
    }
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
    return await withRustFallback(
      () => rustClient.telegramMiniApps.sessions(appId, projectId, opts),
      // No legacy sessions collection — return empty so the UI shows
      // the "no sessions yet" state instead of an error banner.
      async () => ({ sessions: [] }),
    );
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
    return await withRustFallback(
      () => rustClient.telegramMiniApps.analytics(appId, q),
      async () => empty,
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

// -- Ads ---------------------------------------------------------------

/**
 * Map a `telegram_ads_campaigns` Mongo doc to the wire-shape
 * `AdsCampaignRow` the Rust BFF returns.
 */
function adsCampaignDocToRow(d: any): AdsCampaignRow {
  const toIso = (v: any) =>
    v instanceof Date ? v.toISOString() : v ? String(v) : new Date(0).toISOString();
  return {
    _id: d._id?.toString?.() ?? String(d._id ?? ''),
    projectId: d.projectId?.toString?.() ?? String(d.projectId ?? ''),
    name: String(d.name ?? ''),
    status: String(d.status ?? 'draft'),
    platformId: d.platformId ? String(d.platformId) : undefined,
    landingUrl: d.landingUrl ? String(d.landingUrl) : undefined,
    budgetCents: Number(d.budgetCents ?? 0),
    impressions: Number(d.impressions ?? 0),
    clicks: Number(d.clicks ?? 0),
    notes: String(d.notes ?? ''),
    createdAt: toIso(d.createdAt),
    updatedAt: toIso(d.updatedAt),
  };
}

export async function listTelegramAdsAction(projectId: string): Promise<AdsCampaignRow[]> {
  try {
    return await withRustFallback(
      async () => {
        const res = await rustClient.telegramAds.list({ projectId, pageSize: 100 });
        return res.campaigns ?? [];
      },
      async () => {
        if (!ObjectId.isValid(projectId)) return [];
        const { db } = await connectToDatabase();
        const rows = await db
          .collection('telegram_ads_campaigns')
          .find({ projectId: new ObjectId(projectId) })
          .sort({ createdAt: -1 })
          .limit(100)
          .toArray();
        return rows.map(adsCampaignDocToRow);
      },
    );
  } catch {
    return [];
  }
}

export async function listTelegramAdsPagedAction(q: AdsListQuery): Promise<AdsListResp> {
  const empty: AdsListResp = {
    campaigns: [],
    total: 0,
    hasMore: false,
    page: q.page ?? 1,
    pageSize: q.pageSize ?? 20,
  };
  try {
    return await withRustFallback(
      () => rustClient.telegramAds.list(q),
      async () => {
        if (!ObjectId.isValid(q.projectId)) return empty;
        const { db } = await connectToDatabase();
        const filter: any = { projectId: new ObjectId(q.projectId) };
        if (q.status) filter.status = q.status;
        if (q.search) {
          const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          filter.name = rx;
        }
        if (q.createdFrom || q.createdTo) {
          filter.createdAt = {} as any;
          if (q.createdFrom) (filter.createdAt as any).$gte = new Date(q.createdFrom);
          if (q.createdTo) (filter.createdAt as any).$lte = new Date(q.createdTo);
        }
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? 20;
        const col = db.collection('telegram_ads_campaigns');
        const [rows, total] = await Promise.all([
          col
            .find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .toArray(),
          col.countDocuments(filter),
        ]);
        return {
          campaigns: rows.map(adsCampaignDocToRow),
          total,
          hasMore: page * pageSize < total,
          page,
          pageSize,
        };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramAdAction(
  campaignId: string,
  projectId: string,
): Promise<AdsDetailResp> {
  try {
    return await withRustFallback(
      () => rustClient.telegramAds.detail(campaignId, projectId),
      async () => {
        if (!ObjectId.isValid(campaignId) || !ObjectId.isValid(projectId)) {
          return { error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const d = await db.collection('telegram_ads_campaigns').findOne({
          _id: new ObjectId(campaignId),
          projectId: new ObjectId(projectId),
        });
        if (!d) return { error: 'Campaign not found.' };
        return { campaign: adsCampaignDocToRow(d) };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function upsertTelegramAdAction(body: AdsUpsertBody) {
  try {
    return await rustClient.telegramAds.upsert(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(body.projectId)) {
          return { success: false, error: 'Invalid project id.' };
        }
        const { db } = await connectToDatabase();
        const now = new Date();
        if (body.campaignId && ObjectId.isValid(body.campaignId)) {
          // Update path.
          const $set: any = {
            name: body.name,
            status: body.status ?? 'draft',
            platformId: body.platformId,
            landingUrl: body.landingUrl,
            budgetCents: body.budgetCents ?? 0,
            impressions: body.impressions ?? 0,
            clicks: body.clicks ?? 0,
            notes: body.notes ?? '',
            updatedAt: now,
          };
          const res = await db.collection('telegram_ads_campaigns').updateOne(
            {
              _id: new ObjectId(body.campaignId),
              projectId: new ObjectId(body.projectId),
            },
            { $set },
          );
          if (res.matchedCount === 0) {
            return { success: false, error: 'Campaign not found.' };
          }
          revalidatePath('/dashboard/telegram/ads');
          return { success: true, campaignId: body.campaignId };
        }
        // Insert path.
        const ins = await db.collection('telegram_ads_campaigns').insertOne({
          projectId: new ObjectId(body.projectId),
          name: body.name,
          status: body.status ?? 'draft',
          platformId: body.platformId,
          landingUrl: body.landingUrl,
          budgetCents: body.budgetCents ?? 0,
          impressions: body.impressions ?? 0,
          clicks: body.clicks ?? 0,
          notes: body.notes ?? '',
          createdAt: now,
          updatedAt: now,
        } as any);
        revalidatePath('/dashboard/telegram/ads');
        return { success: true, campaignId: ins.insertedId.toString() };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
    if (e instanceof RustApiError)
      return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramAdAction(campaignId: string, projectId: string) {
  try {
    return await rustClient.telegramAds.delete(campaignId, projectId);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(campaignId) || !ObjectId.isValid(projectId)) {
          return { success: false, error: 'Invalid identifier.' };
        }
        const { db } = await connectToDatabase();
        const res = await db.collection('telegram_ads_campaigns').deleteOne({
          _id: new ObjectId(campaignId),
          projectId: new ObjectId(projectId),
        });
        if (res.deletedCount === 0) {
          return { success: false, error: 'Campaign not found.' };
        }
        revalidatePath('/dashboard/telegram/ads');
        return { success: true };
      } catch (mongoErr) {
        return { success: false, error: String(mongoErr) };
      }
    }
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
    return await withRustFallback(
      () => rustClient.telegramAds.analytics(q),
      // Without the Rust aggregation we return zeroed totals so the
      // dashboard renders empty state instead of an error banner.
      async () => empty,
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function importTelegramAdsCsvAction(body: AdsImportBody): Promise<AdsImportResp> {
  const empty: AdsImportResp = { success: false, inserted: 0, updated: 0, skipped: 0 };
  try {
    return await rustClient.telegramAds.importCsv(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      return {
        ...empty,
        error: 'CSV import requires the Rust backend to be online.',
      };
    }
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
  const empty: AdsBulkDeleteResp = { success: false, deleted: 0 };
  try {
    return await rustClient.telegramAds.bulkDelete(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      try {
        if (!ObjectId.isValid(body.projectId)) {
          return { ...empty, error: 'Invalid project id.' };
        }
        const validIds = (body.ids ?? [])
          .filter((id) => ObjectId.isValid(id))
          .map((id) => new ObjectId(id));
        if (!validIds.length) return { success: true, deleted: 0 };
        const { db } = await connectToDatabase();
        const res = await db.collection('telegram_ads_campaigns').deleteMany({
          _id: { $in: validIds },
          projectId: new ObjectId(body.projectId),
        });
        revalidatePath('/dashboard/telegram/ads');
        return { success: true, deleted: res.deletedCount ?? 0 };
      } catch (mongoErr) {
        return { ...empty, error: String(mongoErr) };
      }
    }
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function buildTelegramAdsUtmAction(body: AdsUtmBody): Promise<AdsUtmResp> {
  const empty: AdsUtmResp = { success: false, shortUrl: '', longUrl: '' };
  try {
    return await rustClient.telegramAds.utm(body);
  } catch (e) {
    if (sharedIsRustUnavailable(e)) {
      // Build the UTM long URL purely client-side; without Rust we
      // can't mint a short URL, so we surface the long URL and an
      // informative message.
      try {
        const u = new URL(body.landingUrl);
        const setIf = (k: string, v?: string) => {
          if (v) u.searchParams.set(k, v);
        };
        setIf('utm_source', body.source);
        setIf('utm_medium', body.medium);
        setIf('utm_campaign', body.campaign);
        setIf('utm_term', body.term);
        setIf('utm_content', body.content);
        const longUrl = u.toString();
        return {
          success: true,
          shortUrl: longUrl,
          longUrl,
          error:
            'Backend offline — short link not minted, using the long URL.',
        };
      } catch (innerErr) {
        return { ...empty, error: String(innerErr) };
      }
    }
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
    // Fall back to direct Mongo when the Rust BFF isn't responding
    // (route not deployed, server down, 5xx). The legacy collections
    // are still authoritative, so the UI stays useful.
    if (
      e instanceof RustApiError &&
      (e.status === 404 || e.status >= 500 || e.status === 0)
    ) {
      const { listTelegramBotsDirect } = await import('@/lib/telegram/direct-bots');
      const rows = await listTelegramBotsDirect(params.projectId);
      return { ...empty, bots: rows as any, total: rows.length };
    }
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramBotAction(botId: string): Promise<GetBotResp> {
  // Read-only lookup for the drawer: Mongo is the source of truth for the
  // bot row, so any failure on the Rust side (404, 5xx, auth, network, or a
  // 2xx that came back without a `bot` payload) should fall back to a direct
  // Mongo read instead of leaving the drawer stuck on its "details
  // unavailable" empty state.
  try {
    const rustRes = await rustClient.telegramBots.get(botId);
    if (rustRes?.bot) return rustRes;
    const mongoRes = await getTelegramBotFromMongoForDrawer(botId);
    if (mongoRes.bot) return mongoRes;
    return rustRes.error ? rustRes : mongoRes;
  } catch (e) {
    try {
      const mongoRes = await getTelegramBotFromMongoForDrawer(botId);
      if (mongoRes.bot) return mongoRes;
      if (e instanceof RustApiError) return { error: e.message };
      return mongoRes;
    } catch (inner) {
      console.error('[telegram] getTelegramBotAction failed', { botId, e, inner });
      if (e instanceof RustApiError) return { error: e.message };
      return { error: String(e) };
    }
  }
}

export async function getTelegramBotInfoAction(botId: string): Promise<BotInfoResp> {
  try {
    return await withRustFallback(
      async () => {
        const res = await rustClient.telegramBots.info(botId);
        if (!res.error) invalidateTelegramBotCache(botId);
        return res;
      },
      // The `info` route does a live getMe through Rust — without it,
      // just hand back what Mongo knows so the drawer doesn't flash an
      // error. The user's "Refresh from Telegram" click becomes a no-op
      // until the BFF is deployed.
      () => getTelegramBotFromMongoForDrawer(botId) as Promise<BotInfoResp>,
    );
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
    return await withRustFallback(
      () => rustClient.telegramBots.getCommands(botId, languageCode),
      // No legacy mirror for the live /getMyCommands payload — empty
      // commands so the panel shows its "no commands yet" empty state.
      async () => ({ commands: [] }),
    );
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function getTelegramBotMenuButtonAction(botId: string): Promise<MenuButtonResp> {
  try {
    return await withRustFallback(
      () => rustClient.telegramBots.getMenuButton(botId),
      // No legacy storage for the menu button — return "default" so the
      // panel renders with the default selection and no error banner.
      async () => ({ menuButton: { type: 'default' } }),
    );
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function getTelegramBotAdminRightsAction(
  botId: string,
  forChannels: boolean,
): Promise<AdminRightsResp> {
  try {
    return await withRustFallback(
      () => rustClient.telegramBots.getAdminRights(botId, forChannels),
      // No legacy storage for default admin rights — return an empty
      // shape so the toggles render in their "all off" state.
      async () => ({ forChannels, rights: undefined }),
    );
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
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
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

// =========================================================================
//  Telegram Commands registry
// =========================================================================

/**
 * Mongo fallback helpers for the Telegram Commands registry. Used when the
 * Rust BFF route is 404 / 5xx — we serve directly from Mongo so the UI
 * keeps working until the binary is redeployed. Read shapes mirror
 * `lib/rust-client/telegram-commands.ts` row types.
 */

type CommandsRowShape = {
  _id: string;
  projectId: string;
  botId?: string | null;
  command: string;
  description: string;
  scope: { kind: string; chatId?: string; userId?: string };
  languageCode?: string;
  handler: { kind: string; payload?: Record<string, unknown> | null };
  hidden: boolean;
  runCount: number;
  lastRunAt?: string;
  createdAt: string;
  updatedAt: string;
};

function toIsoCmd(v: any): string | undefined {
  if (!v) return undefined;
  return v instanceof Date ? v.toISOString() : String(v);
}

function shapeCommandRow(doc: any): CommandsRowShape {
  return {
    _id: doc._id?.toString?.() ?? String(doc._id),
    projectId:
      doc.projectId instanceof ObjectId
        ? doc.projectId.toString()
        : String(doc.projectId ?? ''),
    botId: doc.botId
      ? doc.botId instanceof ObjectId
        ? doc.botId.toString()
        : String(doc.botId)
      : null,
    command: String(doc.command ?? ''),
    description: String(doc.description ?? ''),
    scope: doc.scope && typeof doc.scope === 'object'
      ? {
          kind: String(doc.scope.kind ?? 'default'),
          chatId: doc.scope.chatId ? String(doc.scope.chatId) : undefined,
          userId: doc.scope.userId ? String(doc.scope.userId) : undefined,
        }
      : { kind: 'default' },
    languageCode: doc.languageCode ? String(doc.languageCode) : undefined,
    handler: doc.handler && typeof doc.handler === 'object'
      ? {
          kind: String(doc.handler.kind ?? 'noop'),
          payload: doc.handler.payload ?? null,
        }
      : { kind: 'noop' },
    hidden: Boolean(doc.hidden),
    runCount: Number(doc.runCount ?? 0),
    lastRunAt: toIsoCmd(doc.lastRunAt),
    createdAt: toIsoCmd(doc.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoCmd(doc.updatedAt) ?? new Date().toISOString(),
  };
}

/**
 * Ownership guard for command fallbacks. Mirrors `requireBot` in
 * `telegram.actions.ts` but is project-scoped, since most command routes
 * key off `projectId` rather than a single bot.
 */
async function requireProjectAccess(
  projectId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!projectId || !ObjectId.isValid(projectId)) {
    return { ok: false, error: 'Invalid project id.' };
  }
  const session = await getSession();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };
  const project = await getProjectById(projectId);
  if (!project) return { ok: false, error: 'Access denied.' };
  return { ok: true };
}

function buildCommandsFilter(q: {
  projectId: string;
  botId?: string;
  scope?: string;
  languageCode?: string;
  search?: string;
}): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (ObjectId.isValid(q.projectId)) {
    filter.projectId = new ObjectId(q.projectId);
  } else {
    filter.projectId = q.projectId;
  }
  if (q.botId) {
    filter.botId = ObjectId.isValid(q.botId) ? new ObjectId(q.botId) : q.botId;
  }
  if (q.scope) filter['scope.kind'] = q.scope;
  if (q.languageCode) filter.languageCode = q.languageCode;
  if (q.search) {
    const rx = new RegExp(q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ command: rx }, { description: rx }];
  }
  return filter;
}

/** Map our command-scope `kind` to Telegram Bot API `scope.type`. */
function scopeKindToType(kind: string): string {
  switch (kind) {
    case 'all_private_chats':
    case 'all_group_chats':
    case 'all_chat_administrators':
    case 'chat':
    case 'chat_administrators':
    case 'chat_member':
    case 'default':
      return kind;
    default:
      return 'default';
  }
}

/** Load a bot doc + project token for direct Telegram Bot API calls. */
async function loadBotForDirectCall(
  botId: string,
  projectId: string,
): Promise<
  | { ok: true; token: string }
  | { ok: false; error: string }
> {
  const access = await requireProjectAccess(projectId);
  if (!access.ok) return { ok: false, error: access.error };
  if (!ObjectId.isValid(botId)) return { ok: false, error: 'Invalid bot id.' };
  const { db } = await connectToDatabase();
  const bot: any = await db
    .collection('telegram_bots')
    .findOne({ _id: new ObjectId(botId) });
  if (!bot) return { ok: false, error: 'Bot not found.' };
  const token = bot.token ?? bot.accessToken ?? bot.botToken;
  if (!token) return { ok: false, error: 'Bot token missing.' };
  return { ok: true, token: String(token) };
}

export async function listTelegramCommandsAction(
  q: CommandsListQuery,
): Promise<CommandsListResp> {
  const page = q.page ?? 1;
  const pageSize = q.pageSize ?? 20;
  const empty: CommandsListResp = {
    commands: [],
    total: 0,
    hasMore: false,
    page,
    pageSize,
  };
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.list(q),
      async () => {
        const access = await requireProjectAccess(q.projectId);
        if (!access.ok) return { ...empty, error: access.error };
        const { db } = await connectToDatabase();
        const filter = buildCommandsFilter(q);
        const total = await db.collection('telegram_commands').countDocuments(filter);
        const docs = await db
          .collection('telegram_commands')
          .find(filter)
          .sort({ createdAt: -1 })
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .toArray();
        return {
          commands: docs.map(shapeCommandRow) as CommandsListResp['commands'],
          total,
          hasMore: page * pageSize < total,
          page,
          pageSize,
        };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramCommandAction(
  id: string,
  projectId: string,
): Promise<CommandsDetailResp> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.detail(id, projectId),
      async () => {
        if (!ObjectId.isValid(id)) return { error: 'Invalid command id.' };
        const access = await requireProjectAccess(projectId);
        if (!access.ok) return { error: access.error };
        const { db } = await connectToDatabase();
        const doc = await db
          .collection('telegram_commands')
          .findOne({ _id: new ObjectId(id) });
        if (!doc) return { error: 'Command not found.' };
        return { command: shapeCommandRow(doc) as CommandsDetailResp['command'] };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { error: e.message };
    return { error: String(e) };
  }
}

export async function createTelegramCommandAction(
  body: CommandsCreateBody,
): Promise<CommandsAckResult> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.create(body),
      async () => {
        const access = await requireProjectAccess(body.projectId);
        if (!access.ok) return { success: false, error: access.error };
        const { db } = await connectToDatabase();
        const now = new Date();
        const doc: Record<string, unknown> = {
          projectId: new ObjectId(body.projectId),
          botId: body.botId
            ? ObjectId.isValid(body.botId)
              ? new ObjectId(body.botId)
              : body.botId
            : null,
          command: String(body.command || '').trim(),
          description: String(body.description ?? ''),
          scope: body.scope ?? { kind: 'default' },
          languageCode: body.languageCode,
          handler: body.handler ?? { kind: 'noop', payload: null },
          hidden: Boolean(body.hidden),
          runCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        if (!doc.command) return { success: false, error: 'Command is required.' };
        const result = await db.collection('telegram_commands').insertOne(doc as any);
        revalidatePath('/dashboard/telegram/commands');
        return {
          success: true,
          commandId: result.insertedId.toString(),
          message: 'Command saved (local fallback — Rust BFF unavailable).',
        };
      },
    );
  } catch (e) {
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function updateTelegramCommandAction(
  id: string,
  body: CommandsUpdateBody,
): Promise<CommandsAckResult> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.update(id, body),
      async () => {
        if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid command id.' };
        const access = await requireProjectAccess(body.projectId);
        if (!access.ok) return { success: false, error: access.error };
        const { db } = await connectToDatabase();
        const set: Record<string, unknown> = { updatedAt: new Date() };
        const unset: Record<string, unknown> = {};
        if (body.command !== undefined) set.command = body.command;
        if (body.description !== undefined) set.description = body.description;
        if (body.scope !== undefined) set.scope = body.scope;
        if (body.languageCode !== undefined) set.languageCode = body.languageCode;
        if (body.handler !== undefined) set.handler = body.handler;
        if (body.hidden !== undefined) set.hidden = Boolean(body.hidden);
        if (body.botId !== undefined && body.botId !== null) {
          set.botId = ObjectId.isValid(body.botId) ? new ObjectId(body.botId) : body.botId;
        }
        if (body.clearBot) unset.botId = '';
        if (body.clearLanguageCode) unset.languageCode = '';
        const update: Record<string, unknown> = { $set: set };
        if (Object.keys(unset).length) update.$unset = unset;
        const res = await db
          .collection('telegram_commands')
          .updateOne({ _id: new ObjectId(id) }, update);
        if (!res.matchedCount) return { success: false, error: 'Command not found.' };
        revalidatePath('/dashboard/telegram/commands');
        return { success: true, commandId: id, message: 'Command updated (local fallback).' };
      },
    );
  } catch (e) {
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function deleteTelegramCommandAction(
  id: string,
  projectId: string,
): Promise<CommandsAckResult> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.delete(id, projectId),
      async () => {
        if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid command id.' };
        const access = await requireProjectAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };
        const { db } = await connectToDatabase();
        const res = await db
          .collection('telegram_commands')
          .deleteOne({ _id: new ObjectId(id) });
        if (!res.deletedCount) return { success: false, error: 'Command not found.' };
        revalidatePath('/dashboard/telegram/commands');
        return { success: true, commandId: id, message: 'Command deleted (local fallback).' };
      },
    );
  } catch (e) {
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function duplicateTelegramCommandAction(
  id: string,
  projectId: string,
): Promise<CommandsAckResult> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.duplicate(id, projectId),
      async () => {
        if (!ObjectId.isValid(id)) return { success: false, error: 'Invalid command id.' };
        const access = await requireProjectAccess(projectId);
        if (!access.ok) return { success: false, error: access.error };
        const { db } = await connectToDatabase();
        const src: any = await db
          .collection('telegram_commands')
          .findOne({ _id: new ObjectId(id) });
        if (!src) return { success: false, error: 'Command not found.' };
        const now = new Date();
        const { _id: _ignored, ...rest } = src;
        const copy = {
          ...rest,
          command: `${src.command}_copy`,
          runCount: 0,
          lastRunAt: undefined,
          createdAt: now,
          updatedAt: now,
        };
        const res = await db.collection('telegram_commands').insertOne(copy as any);
        revalidatePath('/dashboard/telegram/commands');
        return {
          success: true,
          commandId: res.insertedId.toString(),
          message: 'Command duplicated (local fallback).',
        };
      },
    );
  } catch (e) {
    if (sharedIsRustUnavailable(e))
      return { success: false, error: RUST_WRITE_UNAVAILABLE };
    if (e instanceof RustApiError) return { success: false, error: e.message };
    return { success: false, error: String(e) };
  }
}

export async function pushTelegramCommandsAction(
  body: CommandsPushBody,
): Promise<CommandsPushResp> {
  const empty: CommandsPushResp = { success: false, pushed: 0 };
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.push(body),
      async () => {
        const loaded = await loadBotForDirectCall(body.botId, body.projectId);
        if (!loaded.ok) return { ...empty, error: loaded.error };
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
          projectId: new ObjectId(body.projectId),
          botId: ObjectId.isValid(body.botId)
            ? new ObjectId(body.botId)
            : body.botId,
          hidden: { $ne: true },
        };
        if (body.scope?.kind) filter['scope.kind'] = body.scope.kind;
        if (body.languageCode) filter.languageCode = body.languageCode;
        const docs = await db
          .collection('telegram_commands')
          .find(filter)
          .sort({ createdAt: 1 })
          .toArray();
        const commands = docs.map((d: any) => ({
          command: String(d.command ?? ''),
          description: String(d.description ?? ''),
        }));
        try {
          await TelegramBotApi.setMyCommands(loaded.token, {
            commands,
            scope: body.scope?.kind
              ? { type: scopeKindToType(body.scope.kind) }
              : undefined,
            language_code: body.languageCode,
          });
        } catch (err) {
          if (err instanceof TelegramApiError) {
            return { ...empty, error: err.description };
          }
          throw err;
        }
        return {
          success: true,
          pushed: commands.length,
          message: 'Commands pushed to Telegram (local fallback).',
        };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function pullTelegramCommandsAction(
  body: CommandsPushBody,
): Promise<CommandsPullResp> {
  const empty: CommandsPullResp = { success: false, live: [], local: [] };
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.pull(body),
      async () => {
        const loaded = await loadBotForDirectCall(body.botId, body.projectId);
        if (!loaded.ok) return { ...empty, error: loaded.error };
        let live: Array<{ command: string; description: string }> = [];
        try {
          live = await TelegramBotApi.getMyCommands(loaded.token, {
            scope: body.scope?.kind
              ? { type: scopeKindToType(body.scope.kind) }
              : undefined,
            language_code: body.languageCode,
          });
        } catch (err) {
          if (err instanceof TelegramApiError) {
            return { ...empty, error: err.description };
          }
          throw err;
        }
        const { db } = await connectToDatabase();
        const filter: Record<string, unknown> = {
          projectId: new ObjectId(body.projectId),
          botId: ObjectId.isValid(body.botId)
            ? new ObjectId(body.botId)
            : body.botId,
        };
        if (body.scope?.kind) filter['scope.kind'] = body.scope.kind;
        if (body.languageCode) filter.languageCode = body.languageCode;
        const docs = await db
          .collection('telegram_commands')
          .find(filter)
          .sort({ createdAt: 1 })
          .toArray();
        const local = docs.map((d: any) => ({
          command: String(d.command ?? ''),
          description: String(d.description ?? ''),
        }));
        return { success: true, live, local };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function getTelegramCommandRunsAction(
  id: string,
  projectId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<CommandsRunsResp> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.runs(id, projectId, opts),
      async () => {
        if (!ObjectId.isValid(id)) return { runs: [], error: 'Invalid command id.' };
        const access = await requireProjectAccess(projectId);
        if (!access.ok) return { runs: [], error: access.error };
        const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
        const filter: Record<string, unknown> = {
          commandId: new ObjectId(id),
        };
        if (opts?.cursor) {
          const cursorDate = new Date(opts.cursor);
          if (!Number.isNaN(cursorDate.getTime())) {
            filter.createdAt = { $lt: cursorDate };
          }
        }
        const { db } = await connectToDatabase();
        const docs = await db
          .collection('telegram_command_runs')
          .find(filter)
          .sort({ createdAt: -1 })
          .limit(limit + 1)
          .toArray();
        const hasMore = docs.length > limit;
        const slice = hasMore ? docs.slice(0, limit) : docs;
        const runs = slice.map((d: any) => ({
          _id: d._id?.toString?.() ?? String(d._id),
          commandId: d.commandId?.toString?.() ?? String(d.commandId ?? ''),
          botId: d.botId?.toString?.() ?? String(d.botId ?? ''),
          chatId: d.chatId ? String(d.chatId) : undefined,
          userId: d.userId ? String(d.userId) : undefined,
          success: Boolean(d.success),
          errorMessage: d.errorMessage ? String(d.errorMessage) : undefined,
          createdAt: toIsoCmd(d.createdAt) ?? new Date().toISOString(),
        }));
        return {
          runs: runs as CommandsRunsResp['runs'],
          nextCursor: hasMore ? slice[slice.length - 1]?.createdAt?.toISOString?.() : undefined,
        };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { runs: [], error: e.message };
    return { runs: [], error: String(e) };
  }
}

export async function getTelegramCommandsAnalyticsAction(
  q: CommandsAnalyticsQuery,
): Promise<CommandsAnalyticsResp> {
  const empty: CommandsAnalyticsResp = {
    totalRuns: 0,
    totalSuccess: 0,
    totalFailures: 0,
    successRate: 0,
    perCommand: [],
    byDay: [],
  };
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.analytics(q),
      async () => {
        const access = await requireProjectAccess(q.projectId);
        if (!access.ok) return { ...empty, error: access.error };
        const { db } = await connectToDatabase();
        // Find the commands in this project (optionally bot-scoped) to
        // constrain the run aggregation to commandIds we own.
        const cmdFilter: Record<string, unknown> = {
          projectId: new ObjectId(q.projectId),
        };
        if (q.botId) {
          cmdFilter.botId = ObjectId.isValid(q.botId)
            ? new ObjectId(q.botId)
            : q.botId;
        }
        const cmds = await db
          .collection('telegram_commands')
          .find(cmdFilter)
          .project({ command: 1 })
          .toArray();
        if (!cmds.length) return empty;
        const idToCommand = new Map<string, string>();
        const ids = cmds.map((c: any) => {
          idToCommand.set(c._id.toString(), String(c.command ?? ''));
          return c._id;
        });
        const runFilter: Record<string, unknown> = { commandId: { $in: ids } };
        const dateRange: Record<string, Date> = {};
        if (q.from) {
          const d = new Date(q.from);
          if (!Number.isNaN(d.getTime())) dateRange.$gte = d;
        }
        if (q.to) {
          const d = new Date(q.to);
          if (!Number.isNaN(d.getTime())) dateRange.$lte = d;
        }
        if (Object.keys(dateRange).length) runFilter.createdAt = dateRange;

        const runs = await db
          .collection('telegram_command_runs')
          .find(runFilter)
          .project({ commandId: 1, success: 1, createdAt: 1 })
          .toArray();

        let totalSuccess = 0;
        let totalFailures = 0;
        const perCmd = new Map<
          string,
          { runs: number; success: number; failures: number }
        >();
        const byDayMap = new Map<
          string,
          { runs: number; success: number; failures: number }
        >();
        for (const r of runs as any[]) {
          const cid = r.commandId?.toString?.() ?? String(r.commandId);
          const ok = Boolean(r.success);
          if (ok) totalSuccess += 1;
          else totalFailures += 1;
          const c = perCmd.get(cid) ?? { runs: 0, success: 0, failures: 0 };
          c.runs += 1;
          if (ok) c.success += 1;
          else c.failures += 1;
          perCmd.set(cid, c);
          const day = (r.createdAt instanceof Date
            ? r.createdAt
            : new Date(r.createdAt)
          )
            .toISOString()
            .slice(0, 10);
          const d = byDayMap.get(day) ?? { runs: 0, success: 0, failures: 0 };
          d.runs += 1;
          if (ok) d.success += 1;
          else d.failures += 1;
          byDayMap.set(day, d);
        }
        const totalRuns = runs.length;
        return {
          totalRuns,
          totalSuccess,
          totalFailures,
          successRate: totalRuns ? totalSuccess / totalRuns : 0,
          perCommand: Array.from(perCmd.entries()).map(([commandId, c]) => ({
            commandId,
            command: idToCommand.get(commandId) ?? '',
            runs: c.runs,
            success: c.success,
            failures: c.failures,
            successRate: c.runs ? c.success / c.runs : 0,
          })),
          byDay: Array.from(byDayMap.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, d]) => ({
              date,
              runs: d.runs,
              success: d.success,
              failures: d.failures,
            })),
        };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function importTelegramCommandsAction(
  body: CommandsImportBody,
): Promise<CommandsImportResp> {
  const empty: CommandsImportResp = {
    success: false,
    inserted: 0,
    skipped: 0,
    errors: [],
  };
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.import(body),
      async () => {
        const access = await requireProjectAccess(body.projectId);
        if (!access.ok) return { ...empty, error: access.error };
        const { db } = await connectToDatabase();
        let inserted = 0;
        let skipped = 0;
        const errors: string[] = [];
        const now = new Date();
        const projectObjId = new ObjectId(body.projectId);
        for (const c of body.commands ?? []) {
          try {
            const cmd = String(c.command || '').trim();
            if (!cmd) {
              errors.push('Missing command name.');
              continue;
            }
            const scopeKind = c.scope?.kind ?? 'default';
            const dupFilter: Record<string, unknown> = {
              projectId: projectObjId,
              command: cmd,
              'scope.kind': scopeKind,
            };
            if (c.botId) {
              dupFilter.botId = ObjectId.isValid(c.botId)
                ? new ObjectId(c.botId)
                : c.botId;
            } else {
              dupFilter.botId = { $in: [null, undefined] };
            }
            if (c.languageCode) dupFilter.languageCode = c.languageCode;
            else dupFilter.languageCode = { $in: [null, undefined, ''] };
            const existing = await db
              .collection('telegram_commands')
              .findOne(dupFilter);
            if (existing) {
              skipped += 1;
              continue;
            }
            await db.collection('telegram_commands').insertOne({
              projectId: projectObjId,
              botId: c.botId
                ? ObjectId.isValid(c.botId)
                  ? new ObjectId(c.botId)
                  : c.botId
                : null,
              command: cmd,
              description: String(c.description ?? ''),
              scope: c.scope ?? { kind: 'default' },
              languageCode: c.languageCode,
              handler: c.handler ?? { kind: 'noop', payload: null },
              hidden: Boolean(c.hidden),
              runCount: 0,
              createdAt: now,
              updatedAt: now,
            } as any);
            inserted += 1;
          } catch (err) {
            errors.push(err instanceof Error ? err.message : String(err));
          }
        }
        revalidatePath('/dashboard/telegram/commands');
        return { success: errors.length === 0, inserted, skipped, errors };
      },
    );
  } catch (e) {
    if (e instanceof RustApiError) return { ...empty, error: e.message };
    return { ...empty, error: String(e) };
  }
}

export async function exportTelegramCommandsCsvAction(
  projectId: string,
): Promise<string> {
  try {
    return await withRustFallback(
      () => rustClient.telegramCommands.exportCsv(projectId),
      async () => {
        const access = await requireProjectAccess(projectId);
        if (!access.ok) return '';
        const { db } = await connectToDatabase();
        const docs = await db
          .collection('telegram_commands')
          .find({ projectId: new ObjectId(projectId) })
          .sort({ createdAt: -1 })
          .toArray();
        const escape = (v: string) => {
          if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
          return v;
        };
        const lines = ['command,description,scope,language'];
        for (const d of docs as any[]) {
          lines.push(
            [
              escape(String(d.command ?? '')),
              escape(String(d.description ?? '')),
              escape(String(d.scope?.kind ?? 'default')),
              escape(String(d.languageCode ?? '')),
            ].join(','),
          );
        }
        return lines.join('\n');
      },
    );
  } catch {
    return '';
  }
}

export async function bulkDeleteTelegramCommandsAction(input: {
  projectId: string;
  ids: string[];
}): Promise<{ success: boolean; deleted: number; error?: string }> {
  let deleted = 0;
  const errors: string[] = [];
  for (const id of input.ids) {
    try {
      const res = await rustClient.telegramCommands.delete(id, input.projectId);
      if (res.success) deleted += 1;
      else if (res.error) errors.push(res.error);
    } catch (e) {
      if (e instanceof RustApiError) errors.push(e.message);
      else errors.push(String(e));
    }
  }
  return {
    success: errors.length === 0,
    deleted,
    error: errors.length ? errors.join('; ') : undefined,
  };
}

export async function bulkPushTelegramCommandsAction(input: {
  projectId: string;
  botIds: string[];
  scope?: CommandsPushBody['scope'];
  languageCode?: string;
}): Promise<{ success: boolean; pushed: number; failed: number; error?: string }> {
  let pushed = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const botId of input.botIds) {
    try {
      const res = await rustClient.telegramCommands.push({
        projectId: input.projectId,
        botId,
        scope: input.scope,
        languageCode: input.languageCode,
      });
      if (res.success) pushed += res.pushed;
      else {
        failed += 1;
        if (res.error) errors.push(res.error);
      }
    } catch (e) {
      failed += 1;
      if (e instanceof RustApiError) errors.push(e.message);
      else errors.push(String(e));
    }
  }
  return {
    success: failed === 0,
    pushed,
    failed,
    error: errors.length ? errors.join('; ') : undefined,
  };
}
