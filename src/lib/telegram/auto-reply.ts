import 'server-only';

import type { Db, WithId } from 'mongodb';
import type {
    TelegramAutoReplyRule,
    TelegramBot,
    TelegramMessage,
    TelegramSettings,
} from '@/lib/definitions';
import { TelegramBotApi, TelegramApiError } from './bot-api';

/**
 * Evaluate auto-reply rules against an inbound message and dispatch the
 * highest-priority matching response. Fired from the webhook processor on
 * every incoming private/group message.
 *
 * Rule evaluation order:
 *   1. `greeting`  — first-ever inbound message from a chat
 *   2. `command`   — message starts with `/<pattern>`
 *   3. `away`      — if business hours are configured and now is outside them
 *   4. `keyword`   — substring match on pattern
 *   5. `regex`     — regex match on pattern
 *
 * Within each bucket, rules are sorted by `priority` ASC (lower fires first).
 * The first matching rule wins; further rules are skipped so users don't
 * get spammed with overlapping replies.
 */

export async function runTelegramAutoReply(
    db: Db,
    bot: WithId<TelegramBot>,
    chatId: string,
    message: any,
    isFirstMessage: boolean,
): Promise<void> {
    const text: string = typeof message?.text === 'string' ? message.text : '';
    const caption: string = typeof message?.caption === 'string' ? message.caption : '';
    const body = text || caption;

    const rules = await db
        .collection<TelegramAutoReplyRule>('telegram_auto_replies')
        .find({ botId: bot._id, isActive: true })
        .sort({ priority: 1, createdAt: 1 })
        .toArray();
    if (!rules.length) return;

    const settings = await db
        .collection<TelegramSettings>('telegram_settings')
        .findOne({ projectId: bot.projectId });
    const awayNow = settings?.businessHours?.enabled ? !isWithinBusinessHours(settings) : false;

    const match = pickRule(rules, {
        body,
        isFirstMessage,
        awayNow,
    });
    if (!match) return;

    try {
        await deliverResponse(bot, chatId, match, message);
        await db.collection<TelegramAutoReplyRule>('telegram_auto_replies').updateOne(
            { _id: match._id },
            { $inc: { hits: 1 }, $set: { updatedAt: new Date() } },
        );
        // Persist the outbound message for UI parity.
        if (match.response.type === 'text' && match.response.text) {
            const outDoc: Omit<TelegramMessage, '_id'> = {
                botId: bot._id,
                projectId: bot.projectId,
                chatId,
                messageId: 0,
                direction: 'outbound',
                type: 'text',
                text: match.response.text,
                status: 'sent',
                createdAt: new Date(),
            };
            await db.collection<TelegramMessage>('telegram_messages').insertOne(outDoc as any);
        }
    } catch (err) {
        if (!(err instanceof TelegramApiError)) throw err;
        // swallow: auto-reply failures must not break the webhook
    }
}

function pickRule(
    rules: WithId<TelegramAutoReplyRule>[],
    ctx: { body: string; isFirstMessage: boolean; awayNow: boolean },
): WithId<TelegramAutoReplyRule> | null {
    const order: TelegramAutoReplyRule['trigger'][] = [
        'greeting',
        'command',
        'away',
        'keyword',
        'regex',
    ];

    for (const trigger of order) {
        const bucket = rules.filter((r) => r.trigger === trigger);
        for (const rule of bucket) {
            if (matches(rule, ctx)) return rule;
        }
    }
    return null;
}

function matches(
    rule: TelegramAutoReplyRule,
    ctx: { body: string; isFirstMessage: boolean; awayNow: boolean },
): boolean {
    if (rule.insideBusinessHoursOnly && ctx.awayNow) return false;

    switch (rule.trigger) {
        case 'greeting':
            return ctx.isFirstMessage;
        case 'away':
            return ctx.awayNow;
        case 'command': {
            if (!rule.pattern) return false;
            const first = ctx.body.trim().split(/\s+/)[0] ?? '';
            const expected = rule.pattern.startsWith('/') ? rule.pattern : `/${rule.pattern}`;
            return first === expected || first.startsWith(`${expected}@`);
        }
        case 'keyword': {
            if (!rule.pattern || !ctx.body) return false;
            const hay = rule.caseSensitive ? ctx.body : ctx.body.toLowerCase();
            const needle = rule.caseSensitive ? rule.pattern : rule.pattern.toLowerCase();
            if (rule.matchMode === 'exact') return hay.trim() === needle;
            if (rule.matchMode === 'starts_with') return hay.startsWith(needle);
            return hay.includes(needle);
        }
        case 'regex': {
            if (!rule.pattern || !ctx.body) return false;
            try {
                const re = new RegExp(rule.pattern, rule.caseSensitive ? '' : 'i');
                return re.test(ctx.body);
            } catch {
                return false;
            }
        }
    }
    return false;
}

async function deliverResponse(
    bot: WithId<TelegramBot>,
    chatId: string,
    rule: WithId<TelegramAutoReplyRule>,
    sourceMessage: any,
): Promise<void> {
    const reply = rule.response;
    const reply_markup = reply.buttons?.length
        ? {
              inline_keyboard: [
                  reply.buttons.map((b) =>
                      b.url
                          ? { text: b.text, url: b.url }
                          : { text: b.text, callback_data: b.callbackData ?? b.text },
                  ),
              ],
          }
        : undefined;
    const business_connection_id = sourceMessage?.business_connection_id;

    if (reply.type === 'text' && reply.text) {
        await TelegramBotApi.sendMessage(bot.token, {
            chat_id: chatId,
            text: reply.text,
            parse_mode: reply.parseMode,
            reply_markup,
            business_connection_id,
        });
        return;
    }
    if (reply.type === 'photo' && reply.mediaUrl) {
        await TelegramBotApi.sendPhoto(bot.token, {
            chat_id: chatId,
            photo: reply.mediaUrl,
            caption: reply.caption,
            parse_mode: reply.parseMode,
            reply_markup,
            business_connection_id,
        });
        return;
    }
    if (reply.type === 'video' && reply.mediaUrl) {
        await TelegramBotApi.sendVideo(bot.token, {
            chat_id: chatId,
            video: reply.mediaUrl,
            caption: reply.caption,
            parse_mode: reply.parseMode,
            reply_markup,
            business_connection_id,
        });
        return;
    }
    if (reply.type === 'document' && reply.mediaUrl) {
        await TelegramBotApi.sendDocument(bot.token, {
            chat_id: chatId,
            document: reply.mediaUrl,
            caption: reply.caption,
            parse_mode: reply.parseMode,
            reply_markup,
            business_connection_id,
        });
        return;
    }
    if (reply.type === 'sticker' && reply.mediaUrl) {
        await TelegramBotApi.sendSticker(bot.token, {
            chat_id: chatId,
            sticker: reply.mediaUrl,
        });
    }
}

function isWithinBusinessHours(settings: TelegramSettings): boolean {
    const hours = settings.businessHours;
    if (!hours || !hours.enabled) return true;
    const tz = hours.timezone || 'UTC';
    const now = new Date();
    // Resolve current weekday (0=Sunday) and HH:mm in the configured tz.
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekdayStr = parts.find((p) => p.type === 'weekday')?.value ?? '';
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const minute = parts.find((p) => p.type === 'minute')?.value ?? '00';
    const weekdayMap: Record<string, number> = {
        Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
    };
    const dayNum = weekdayMap[weekdayStr] ?? 0;
    const rule = hours.days.find((d) => d.day === dayNum);
    if (!rule) return false;
    const current = `${hour}:${minute}`;
    return current >= rule.open && current <= rule.close;
}
