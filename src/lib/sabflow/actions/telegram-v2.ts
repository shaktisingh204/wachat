
'use server';

async function telegramFetch(botToken: string, method: string, body?: any, logger?: any) {
    logger?.log(`[Telegram v2] ${method}`);
    const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body ?? {}),
    });
    const data = await res.json();
    if (!data.ok) {
        throw new Error(data?.description || `Telegram API error: ${data.error_code ?? res.status}`);
    }
    return data.result;
}

export async function executeTelegramV2Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const botToken = String(inputs.botToken ?? '').trim();
        if (!botToken) throw new Error('botToken is required.');
        const tg = (method: string, body?: any) => telegramFetch(botToken, method, body, logger);

        switch (actionName) {
            case 'sendMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!text) throw new Error('text is required.');
                const payload: any = { chat_id: chatId, text };
                if (inputs.parseMode) payload.parse_mode = String(inputs.parseMode);
                if (inputs.replyMarkup) payload.reply_markup = typeof inputs.replyMarkup === 'string' ? JSON.parse(inputs.replyMarkup) : inputs.replyMarkup;
                if (inputs.disableWebPagePreview !== undefined) payload.disable_web_page_preview = inputs.disableWebPagePreview === true || inputs.disableWebPagePreview === 'true';
                if (inputs.replyToMessageId) payload.reply_to_message_id = Number(inputs.replyToMessageId);
                const data = await tg('sendMessage', payload);
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId), date: String(data.date ?? '') } };
            }

            case 'sendPhoto': {
                const chatId = String(inputs.chatId ?? '').trim();
                const photo = String(inputs.photo ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!photo) throw new Error('photo (URL or file_id) is required.');
                const payload: any = { chat_id: chatId, photo };
                if (inputs.caption) payload.caption = String(inputs.caption);
                if (inputs.parseMode) payload.parse_mode = String(inputs.parseMode);
                const data = await tg('sendPhoto', payload);
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId) } };
            }

            case 'sendDocument': {
                const chatId = String(inputs.chatId ?? '').trim();
                const document = String(inputs.document ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!document) throw new Error('document (URL or file_id) is required.');
                const payload: any = { chat_id: chatId, document };
                if (inputs.caption) payload.caption = String(inputs.caption);
                if (inputs.parseMode) payload.parse_mode = String(inputs.parseMode);
                const data = await tg('sendDocument', payload);
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId) } };
            }

            case 'sendVideo': {
                const chatId = String(inputs.chatId ?? '').trim();
                const video = String(inputs.video ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!video) throw new Error('video (URL or file_id) is required.');
                const payload: any = { chat_id: chatId, video };
                if (inputs.caption) payload.caption = String(inputs.caption);
                if (inputs.parseMode) payload.parse_mode = String(inputs.parseMode);
                if (inputs.duration) payload.duration = Number(inputs.duration);
                const data = await tg('sendVideo', payload);
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId) } };
            }

            case 'createInlineKeyboard': {
                // Helper action: builds inline keyboard markup JSON
                const buttons = inputs.buttons
                    ? (typeof inputs.buttons === 'string' ? JSON.parse(inputs.buttons) : inputs.buttons)
                    : [];
                const replyMarkup = { inline_keyboard: buttons };
                return { output: { replyMarkup: JSON.stringify(replyMarkup) } };
            }

            case 'answerCallbackQuery': {
                const callbackQueryId = String(inputs.callbackQueryId ?? '').trim();
                if (!callbackQueryId) throw new Error('callbackQueryId is required.');
                const payload: any = { callback_query_id: callbackQueryId };
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.showAlert !== undefined) payload.show_alert = inputs.showAlert === true || inputs.showAlert === 'true';
                if (inputs.url) payload.url = String(inputs.url);
                const data = await tg('answerCallbackQuery', payload);
                return { output: { success: String(data ?? true) } };
            }

            case 'setWebhook': {
                const url = String(inputs.url ?? '').trim();
                if (!url) throw new Error('url is required.');
                const payload: any = { url };
                if (inputs.allowedUpdates) payload.allowed_updates = typeof inputs.allowedUpdates === 'string' ? JSON.parse(inputs.allowedUpdates) : inputs.allowedUpdates;
                if (inputs.secretToken) payload.secret_token = String(inputs.secretToken);
                const data = await tg('setWebhook', payload);
                return { output: { success: String(data ?? true) } };
            }

            case 'deleteWebhook': {
                const data = await tg('deleteWebhook', {});
                return { output: { success: String(data ?? true) } };
            }

            case 'getMe': {
                const data = await tg('getMe', {});
                return { output: { id: String(data.id ?? ''), username: data.username ?? '', firstName: data.first_name ?? '' } };
            }

            case 'sendAudio': {
                const chatId = String(inputs.chatId ?? '').trim();
                const audio = String(inputs.audio ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!audio) throw new Error('audio (URL or file_id) is required.');
                const payload: any = { chat_id: chatId, audio };
                if (inputs.caption) payload.caption = String(inputs.caption);
                if (inputs.duration) payload.duration = Number(inputs.duration);
                const data = await tg('sendAudio', payload);
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId) } };
            }

            case 'forwardMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const fromChatId = String(inputs.fromChatId ?? '').trim();
                const messageId = Number(inputs.messageId ?? 0);
                if (!chatId || !fromChatId || !messageId) throw new Error('chatId, fromChatId, and messageId are required.');
                const data = await tg('forwardMessage', { chat_id: chatId, from_chat_id: fromChatId, message_id: messageId });
                return { output: { messageId: String(data.message_id ?? ''), chatId: String(data.chat?.id ?? chatId) } };
            }

            default:
                return { error: `Telegram v2 action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Telegram v2 action failed.' };
    }
}
