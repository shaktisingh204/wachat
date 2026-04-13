import 'server-only';

import { ObjectId, type WithId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import type { TelegramBot } from '@/lib/definitions';

/**
 * In-memory bot cache shared by the webhook route and anywhere else
 * that needs to resolve a bot by its hex id without a DB round-trip.
 *
 * 60s TTL matches the Meta webhook's project cache.
 */

type Cached = { bot: WithId<TelegramBot>; expiresAt: number };
const cache = new Map<string, Cached>();
const TTL = 60_000;

export function invalidateTelegramBotCache(botIdHex: string): void {
    cache.delete(botIdHex);
}

export async function getCachedTelegramBot(
    botIdHex: string,
): Promise<WithId<TelegramBot> | null> {
    const hit = cache.get(botIdHex);
    if (hit && hit.expiresAt > Date.now()) return hit.bot;

    if (!ObjectId.isValid(botIdHex)) return null;
    const { db } = await connectToDatabase();
    const bot = await db
        .collection<TelegramBot>('telegram_bots')
        .findOne({ _id: new ObjectId(botIdHex) });
    if (bot) cache.set(botIdHex, { bot, expiresAt: Date.now() + TTL });
    return bot;
}
