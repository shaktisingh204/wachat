import { NextResponse, type NextRequest, after } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { getCachedTelegramBot } from '@/lib/telegram/bot-cache';
import { processTelegramUpdate } from '@/lib/telegram/update-processor';

export const dynamic = 'force-dynamic';

const LOG_PREFIX = '[TELEGRAM WEBHOOK]';
const SECRET_HEADER = 'x-telegram-bot-api-secret-token';

interface RouteContext {
    params: Promise<{ botId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
    try {
        const { botId } = await params;
        const bot = await getCachedTelegramBot(botId);

        // Unknown or disabled bot — reply 200 so Telegram stops retrying.
        if (!bot || !bot.isActive) {
            console.warn(`${LOG_PREFIX} Unknown or inactive bot ${botId}`);
            return NextResponse.json({ status: 'ok' }, { status: 200 });
        }

        // Verify the secret_token Telegram echoes back in the header.
        const presented = request.headers.get(SECRET_HEADER);
        if (!presented || presented !== bot.webhookSecret) {
            return NextResponse.json({ status: 'invalid_secret' }, { status: 401 });
        }

        const payloadText = await request.text();
        if (!payloadText) return NextResponse.json({ status: 'ok' }, { status: 200 });

        let update: any;
        try {
            update = JSON.parse(payloadText);
        } catch {
            return NextResponse.json({ status: 'ok' }, { status: 200 });
        }

        const updateId = typeof update?.update_id === 'number' ? update.update_id : undefined;

        after(async () => {
            try {
                const { db } = await connectToDatabase();

                // Idempotency — skip duplicate update_ids.
                if (updateId !== undefined) {
                    const seen = await db
                        .collection('telegram_updates')
                        .findOne({ botId: bot._id, updateId }, { projection: { _id: 1 } });
                    if (seen) return;
                }

                db.collection('telegram_updates')
                    .insertOne({
                        botId: bot._id,
                        projectId: bot.projectId,
                        updateId: updateId ?? -1,
                        payload: update,
                        processed: false,
                        createdAt: new Date(),
                    })
                    .catch(() => {});

                try {
                    await processTelegramUpdate(db, bot, update);
                    if (updateId !== undefined) {
                        await db
                            .collection('telegram_updates')
                            .updateOne(
                                { botId: bot._id, updateId },
                                { $set: { processed: true } },
                            );
                    }
                } catch (err: any) {
                    console.error(`${LOG_PREFIX} Processing failed:`, err?.message || err);
                    if (updateId !== undefined) {
                        await db
                            .collection('telegram_updates')
                            .updateOne(
                                { botId: bot._id, updateId },
                                { $set: { processed: false, error: String(err?.message ?? err) } },
                            )
                            .catch(() => {});
                    }
                }
            } catch (err: any) {
                console.error(`${LOG_PREFIX} Deferred work failed:`, err?.message || err);
            }
        });

        return NextResponse.json({ status: 'ok' }, { status: 200 });
    } catch (err: any) {
        console.error(`${LOG_PREFIX} Handler crash:`, err?.message || err);
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
}

/**
 * Simple health check — Telegram itself never issues GETs against the webhook URL.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
    const { botId } = await params;
    const bot = await getCachedTelegramBot(botId);
    if (!bot) return new NextResponse('not found', { status: 404 });
    return NextResponse.json({
        ok: true,
        botId: bot.botId,
        username: bot.username,
        isActive: bot.isActive,
    });
}
