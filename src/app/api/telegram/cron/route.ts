import { NextResponse, type NextRequest } from 'next/server';
import { ObjectId, type WithId } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getCachedTelegramBot } from '@/lib/telegram/bot-cache';
import { TelegramBotApi, TelegramApiError } from '@/lib/telegram/bot-api';
import { processTelegramUpdate } from '@/lib/telegram/update-processor';
import { sendTelegramBroadcastNow } from '@/app/actions/telegram.actions';
import type {
    TelegramBot,
    TelegramBroadcast,
    TelegramScheduledPost,
} from '@/lib/definitions';

const RETRY_MIN_AGE_MS = 60_000;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BATCH_SIZE = 50;

export const dynamic = 'force-dynamic';

/**
 * Cron entry point for the Telegram module. Invoked by Vercel Cron (or any
 * trusted scheduler) on a ~1min tick.
 *
 *   1. Flush any QUEUED broadcasts whose scheduledAt <= now.
 *   2. Publish any QUEUED channel posts whose scheduledAt <= now.
 *   3. Retry unprocessed webhook updates (telegram_updates with
 *      processed=false older than RETRY_MIN_AGE_MS, capped at
 *      RETRY_MAX_ATTEMPTS, then dead-lettered).
 *
 * Guarded by CRON_SECRET via either Authorization: Bearer or ?token=.
 */

function authorized(req: NextRequest): boolean {
    const expected = process.env.CRON_SECRET;
    if (!expected) return true; // local dev — permit
    const auth = req.headers.get('authorization') ?? '';
    if (auth === `Bearer ${expected}`) return true;
    return new URL(req.url).searchParams.get('token') === expected;
}

export async function GET(req: NextRequest) {
    if (!authorized(req)) {
        return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
    }
    const [broadcasts, posts, retries] = await Promise.all([
        runBroadcasts(),
        runScheduledPosts(),
        retryFailedUpdates(),
    ]);
    return NextResponse.json({ ok: true, broadcasts, posts, retries });
}

export const POST = GET;

async function runBroadcasts(): Promise<{ dispatched: number; failed: number }> {
    const { db } = await connectToDatabase();
    // Pick up broadcasts in either of the legacy (QUEUED) or canonical
    // (scheduled) status spellings whose schedule has elapsed.
    const due = await db
        .collection<TelegramBroadcast & { projectId?: ObjectId }>(
            'telegram_broadcasts',
        )
        .find({
            status: { $in: ['QUEUED', 'scheduled', 'SCHEDULED'] } as any,
            scheduledAt: { $lte: new Date() },
        })
        .limit(20)
        .toArray();

    let dispatched = 0;
    let failed = 0;
    for (const b of due) {
        const projectId = (b as any).projectId?.toString();
        if (!projectId) {
            failed += 1;
            continue;
        }
        try {
            const res = await sendTelegramBroadcastNow(b._id.toString(), projectId);
            if (res.success) dispatched += 1;
            else failed += 1;
        } catch {
            failed += 1;
            await db.collection<TelegramBroadcast>('telegram_broadcasts').updateOne(
                { _id: b._id },
                { $set: { status: 'FAILED', updatedAt: new Date() } },
            );
        }
    }
    return { dispatched, failed };
}

async function runScheduledPosts(): Promise<{ dispatched: number; failed: number }> {
    const { db } = await connectToDatabase();
    const due = await db
        .collection<TelegramScheduledPost>('telegram_scheduled_posts')
        .find({
            status: 'QUEUED',
            scheduledAt: { $lte: new Date() },
        })
        .limit(50)
        .toArray();

    let dispatched = 0;
    let failed = 0;

    for (const post of due) {
        // Claim the row first so concurrent cron ticks don't double-send.
        const claim = await db.collection<TelegramScheduledPost>('telegram_scheduled_posts').findOneAndUpdate(
            { _id: post._id, status: 'QUEUED' },
            { $set: { status: 'SENT', updatedAt: new Date() } },
            { returnDocument: 'after' },
        );
        if (!claim) continue;

        try {
            const bot = await getCachedTelegramBot(post.botId.toString());
            if (!bot) throw new Error('Bot not found or disabled.');
            // Fetch the target channel chatId.
            const channel = await db
                .collection<{ _id: ObjectId; chatId: string }>('telegram_channels')
                .findOne({ _id: post.channelId });
            if (!channel) throw new Error('Channel not found.');

            const sentMessageId = await dispatchPost(bot, channel.chatId, post.message);
            await db.collection<TelegramScheduledPost>('telegram_scheduled_posts').updateOne(
                { _id: post._id },
                { $set: { sentMessageId, updatedAt: new Date() } },
            );
            dispatched += 1;
        } catch (err) {
            failed += 1;
            const msg = err instanceof TelegramApiError ? err.description : String(err);
            await db.collection<TelegramScheduledPost>('telegram_scheduled_posts').updateOne(
                { _id: post._id },
                { $set: { status: 'FAILED', error: msg, updatedAt: new Date() } },
            );
        }
    }
    return { dispatched, failed };
}

async function dispatchPost(
    bot: WithId<TelegramBot>,
    chatId: string,
    message: TelegramBroadcast['message'],
): Promise<number> {
    const reply_markup = message.buttons?.length
        ? {
              inline_keyboard: [
                  message.buttons.map((b) =>
                      b.url
                          ? { text: b.text, url: b.url }
                          : { text: b.text, callback_data: b.callbackData ?? b.text },
                  ),
              ],
          }
        : undefined;

    if (message.type === 'text' && message.text) {
        const sent = await TelegramBotApi.sendMessage(bot.token, {
            chat_id: chatId,
            text: message.text,
            parse_mode: message.parseMode,
            disable_notification: message.disableNotification,
            reply_markup,
        });
        return sent.message_id;
    }
    if (message.type === 'photo' && message.mediaUrl) {
        const sent = await TelegramBotApi.sendPhoto(bot.token, {
            chat_id: chatId,
            photo: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
            reply_markup,
        });
        return sent.message_id;
    }
    if (message.type === 'video' && message.mediaUrl) {
        const sent = await TelegramBotApi.sendVideo(bot.token, {
            chat_id: chatId,
            video: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
            reply_markup,
        });
        return sent.message_id;
    }
    if (message.type === 'document' && message.mediaUrl) {
        const sent = await TelegramBotApi.sendDocument(bot.token, {
            chat_id: chatId,
            document: message.mediaUrl,
            caption: message.caption,
            parse_mode: message.parseMode,
            reply_markup,
        });
        return sent.message_id;
    }
    throw new Error('Invalid post payload.');
}

/**
 * Pick up webhook updates that were persisted but failed (or never finished)
 * processing. Atomically claim a row by bumping `attempts` so concurrent
 * cron ticks can't double-run the same update. Rows exceeding
 * RETRY_MAX_ATTEMPTS are flagged with `deadLetter: true` and ignored
 * afterwards — they stay in Mongo for manual triage.
 */
async function retryFailedUpdates(): Promise<{
    attempted: number;
    succeeded: number;
    failed: number;
    deadLettered: number;
}> {
    const { db } = await connectToDatabase();
    const col = db.collection('telegram_updates');
    const cutoff = new Date(Date.now() - RETRY_MIN_AGE_MS);

    const due = await col
        .find({
            processed: false,
            deadLetter: { $ne: true },
            createdAt: { $lte: cutoff },
            $or: [
                { attempts: { $exists: false } },
                { attempts: { $lt: RETRY_MAX_ATTEMPTS } },
            ],
        })
        .sort({ createdAt: 1 })
        .limit(RETRY_BATCH_SIZE)
        .toArray();

    let succeeded = 0;
    let failed = 0;
    let deadLettered = 0;

    for (const row of due) {
        // Atomic claim — re-check the same predicate so a peer-cron can't
        // grab this row first.
        const claim = await col.findOneAndUpdate(
            {
                _id: row._id,
                processed: false,
                deadLetter: { $ne: true },
                $or: [
                    { attempts: { $exists: false } },
                    { attempts: { $lt: RETRY_MAX_ATTEMPTS } },
                ],
            },
            {
                $inc: { attempts: 1 },
                $set: { lastAttemptAt: new Date() },
            },
            { returnDocument: 'after' },
        );
        if (!claim) continue;

        const nextAttempts = (claim as any).attempts ?? 1;
        const botIdStr = (claim as any).botId?.toString?.();
        const payload = (claim as any).payload;
        if (!botIdStr || !payload) {
            failed += 1;
            continue;
        }

        try {
            const bot = await getCachedTelegramBot(botIdStr);
            if (!bot) throw new Error('Bot not found or disabled.');
            await processTelegramUpdate(db, bot, payload);
            await col.updateOne(
                { _id: row._id },
                {
                    $set: { processed: true, processedAt: new Date() },
                    $unset: { error: '' },
                },
            );
            succeeded += 1;
        } catch (err: any) {
            const msg = err?.message ? String(err.message) : String(err);
            const isDead = nextAttempts >= RETRY_MAX_ATTEMPTS;
            await col.updateOne(
                { _id: row._id },
                {
                    $set: {
                        error: msg,
                        ...(isDead ? { deadLetter: true, deadLetteredAt: new Date() } : {}),
                    },
                },
            );
            if (isDead) deadLettered += 1;
            failed += 1;
            console.error('[telegram.cron.retry] failed', botIdStr, msg);
        }
    }

    return { attempted: due.length, succeeded, failed, deadLettered };
}
