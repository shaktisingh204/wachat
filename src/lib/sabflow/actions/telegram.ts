
'use server';

const TELEGRAM_BASE = 'https://api.telegram.org/bot';

async function telegramPost(botToken: string, method: string, body: any, logger: any) {
    logger.log(`[Telegram] POST ${method}`);
    const res = await fetch(`${TELEGRAM_BASE}${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
        throw new Error(data.description || `Telegram API error`);
    }
    return data.result;
}

async function telegramGet(botToken: string, method: string, params: any, logger: any) {
    logger.log(`[Telegram] GET ${method}`);
    const url = new URL(`${TELEGRAM_BASE}${botToken}/${method}`);
    for (const [k, v] of Object.entries(params || {})) {
        if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    }
    const res = await fetch(url.toString());
    const data = await res.json();
    if (!data.ok) {
        throw new Error(data.description || `Telegram API error`);
    }
    return data.result;
}

export async function executeTelegramAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const botToken = String(inputs.botToken ?? '').trim();
        if (!botToken) throw new Error('botToken is required.');

        switch (actionName) {
            case 'sendMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!text) throw new Error('text is required.');
                const parseMode = String(inputs.parseMode ?? '').trim() || undefined;
                const result = await telegramPost(botToken, 'sendMessage', { chat_id: chatId, text, parse_mode: parseMode }, logger);
                return { output: { messageId: String(result.message_id), chatId: String(result.chat.id) } };
            }

            case 'sendPhoto': {
                const chatId = String(inputs.chatId ?? '').trim();
                const photo = String(inputs.photo ?? '').trim();
                const caption = String(inputs.caption ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!photo) throw new Error('photo is required.');
                const result = await telegramPost(botToken, 'sendPhoto', { chat_id: chatId, photo, caption: caption || undefined }, logger);
                return { output: { messageId: String(result.message_id) } };
            }

            case 'sendDocument': {
                const chatId = String(inputs.chatId ?? '').trim();
                const document = String(inputs.document ?? '').trim();
                const caption = String(inputs.caption ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!document) throw new Error('document is required.');
                const result = await telegramPost(botToken, 'sendDocument', { chat_id: chatId, document, caption: caption || undefined }, logger);
                return { output: { messageId: String(result.message_id) } };
            }

            case 'sendVideo': {
                const chatId = String(inputs.chatId ?? '').trim();
                const video = String(inputs.video ?? '').trim();
                const caption = String(inputs.caption ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!video) throw new Error('video is required.');
                const result = await telegramPost(botToken, 'sendVideo', { chat_id: chatId, video, caption: caption || undefined }, logger);
                return { output: { messageId: String(result.message_id) } };
            }

            case 'sendAudio': {
                const chatId = String(inputs.chatId ?? '').trim();
                const audio = String(inputs.audio ?? '').trim();
                const caption = String(inputs.caption ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!audio) throw new Error('audio is required.');
                const result = await telegramPost(botToken, 'sendAudio', { chat_id: chatId, audio, caption: caption || undefined }, logger);
                return { output: { messageId: String(result.message_id) } };
            }

            case 'editMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!chatId || !messageId) throw new Error('chatId and messageId are required.');
                if (!text) throw new Error('text is required.');
                const result = await telegramPost(botToken, 'editMessageText', { chat_id: chatId, message_id: Number(messageId), text }, logger);
                return { output: { ok: 'true' } };
            }

            case 'deleteMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!chatId || !messageId) throw new Error('chatId and messageId are required.');
                await telegramPost(botToken, 'deleteMessage', { chat_id: chatId, message_id: Number(messageId) }, logger);
                return { output: { ok: 'true' } };
            }

            case 'forwardMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const fromChatId = String(inputs.fromChatId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!chatId || !fromChatId || !messageId) throw new Error('chatId, fromChatId and messageId are required.');
                const result = await telegramPost(botToken, 'forwardMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: Number(messageId) }, logger);
                return { output: { messageId: String(result.message_id) } };
            }

            case 'pinMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!chatId || !messageId) throw new Error('chatId and messageId are required.');
                await telegramPost(botToken, 'pinChatMessage', { chat_id: chatId, message_id: Number(messageId) }, logger);
                return { output: { ok: 'true' } };
            }

            case 'unpinMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                if (!chatId || !messageId) throw new Error('chatId and messageId are required.');
                await telegramPost(botToken, 'unpinChatMessage', { chat_id: chatId, message_id: Number(messageId) }, logger);
                return { output: { ok: 'true' } };
            }

            case 'getChat': {
                const chatId = String(inputs.chatId ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                const result = await telegramGet(botToken, 'getChat', { chat_id: chatId }, logger);
                return { output: { id: String(result.id), title: result.title ?? '', type: result.type ?? '' } };
            }

            case 'getChatMember': {
                const chatId = String(inputs.chatId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!chatId || !userId) throw new Error('chatId and userId are required.');
                const result = await telegramGet(botToken, 'getChatMember', { chat_id: chatId, user_id: userId }, logger);
                return { output: { status: result.status ?? '', userId: String(result.user?.id ?? '') } };
            }

            case 'banChatMember': {
                const chatId = String(inputs.chatId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!chatId || !userId) throw new Error('chatId and userId are required.');
                await telegramPost(botToken, 'banChatMember', { chat_id: chatId, user_id: Number(userId) }, logger);
                return { output: { ok: 'true' } };
            }

            case 'sendPoll': {
                const chatId = String(inputs.chatId ?? '').trim();
                const question = String(inputs.question ?? '').trim();
                const options = inputs.options;
                if (!chatId || !question) throw new Error('chatId and question are required.');
                const parsedOptions = Array.isArray(options) ? options : (typeof options === 'string' ? JSON.parse(options) : []);
                const result = await telegramPost(botToken, 'sendPoll', { chat_id: chatId, question, options: parsedOptions }, logger);
                return { output: { messageId: String(result.message_id), pollId: result.poll?.id ?? '' } };
            }

            case 'answerCallbackQuery': {
                const callbackQueryId = String(inputs.callbackQueryId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!callbackQueryId) throw new Error('callbackQueryId is required.');
                await telegramPost(botToken, 'answerCallbackQuery', { callback_query_id: callbackQueryId, text: text || undefined }, logger);
                return { output: { ok: 'true' } };
            }

            default:
                return { error: `Telegram action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Telegram action failed.' };
    }
}
