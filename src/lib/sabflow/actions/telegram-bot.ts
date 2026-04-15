'use server';

export async function executeTelegramBotAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const botToken = String(inputs.botToken ?? '').trim();
        if (!botToken) throw new Error('botToken is required.');
        const baseUrl = `https://api.telegram.org/bot${botToken}`;

        const tgFetch = async (method: string, body?: any) => {
            logger?.log(`[TelegramBot] ${method}`);
            const res = await fetch(`${baseUrl}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok || (data && data.ok === false)) {
                throw new Error(data?.description || `Telegram API error: ${res.status}`);
            }
            return data?.result ?? data;
        };

        switch (actionName) {
            case 'sendMessage': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                const body: any = { chat_id: chatId, text: inputs.text };
                if (inputs.parseMode) body.parse_mode = inputs.parseMode;
                if (inputs.replyToMessageId) body.reply_to_message_id = inputs.replyToMessageId;
                if (inputs.disableNotification) body.disable_notification = inputs.disableNotification;
                const data = await tgFetch('sendMessage', body);
                return { output: data };
            }

            case 'sendPhoto': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.photo) throw new Error('photo is required.');
                const body: any = { chat_id: chatId, photo: inputs.photo };
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.parseMode) body.parse_mode = inputs.parseMode;
                const data = await tgFetch('sendPhoto', body);
                return { output: data };
            }

            case 'sendDocument': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.document) throw new Error('document is required.');
                const body: any = { chat_id: chatId, document: inputs.document };
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.parseMode) body.parse_mode = inputs.parseMode;
                const data = await tgFetch('sendDocument', body);
                return { output: data };
            }

            case 'sendVideo': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.video) throw new Error('video is required.');
                const body: any = { chat_id: chatId, video: inputs.video };
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.duration) body.duration = inputs.duration;
                const data = await tgFetch('sendVideo', body);
                return { output: data };
            }

            case 'sendAudio': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.audio) throw new Error('audio is required.');
                const body: any = { chat_id: chatId, audio: inputs.audio };
                if (inputs.caption) body.caption = inputs.caption;
                if (inputs.duration) body.duration = inputs.duration;
                if (inputs.performer) body.performer = inputs.performer;
                if (inputs.title) body.title = inputs.title;
                const data = await tgFetch('sendAudio', body);
                return { output: data };
            }

            case 'sendLocation': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (inputs.latitude === undefined) throw new Error('latitude is required.');
                if (inputs.longitude === undefined) throw new Error('longitude is required.');
                const body: any = {
                    chat_id: chatId,
                    latitude: inputs.latitude,
                    longitude: inputs.longitude,
                };
                if (inputs.livePeriod) body.live_period = inputs.livePeriod;
                const data = await tgFetch('sendLocation', body);
                return { output: data };
            }

            case 'sendContact': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.phoneNumber) throw new Error('phoneNumber is required.');
                if (!inputs.firstName) throw new Error('firstName is required.');
                const body: any = {
                    chat_id: chatId,
                    phone_number: inputs.phoneNumber,
                    first_name: inputs.firstName,
                };
                if (inputs.lastName) body.last_name = inputs.lastName;
                const data = await tgFetch('sendContact', body);
                return { output: data };
            }

            case 'sendPoll': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                if (!inputs.question) throw new Error('question is required.');
                if (!inputs.options || !Array.isArray(inputs.options)) throw new Error('options (array) is required.');
                const body: any = {
                    chat_id: chatId,
                    question: inputs.question,
                    options: inputs.options,
                };
                if (inputs.isAnonymous !== undefined) body.is_anonymous = inputs.isAnonymous;
                if (inputs.type) body.type = inputs.type;
                if (inputs.allowsMultipleAnswers) body.allows_multiple_answers = inputs.allowsMultipleAnswers;
                const data = await tgFetch('sendPoll', body);
                return { output: data };
            }

            case 'editMessage': {
                const chatId = inputs.chatId;
                const messageId = inputs.messageId;
                if (!chatId) throw new Error('chatId is required.');
                if (!messageId) throw new Error('messageId is required.');
                if (!inputs.text) throw new Error('text is required.');
                const body: any = { chat_id: chatId, message_id: messageId, text: inputs.text };
                if (inputs.parseMode) body.parse_mode = inputs.parseMode;
                const data = await tgFetch('editMessageText', body);
                return { output: data };
            }

            case 'deleteMessage': {
                const chatId = inputs.chatId;
                const messageId = inputs.messageId;
                if (!chatId) throw new Error('chatId is required.');
                if (!messageId) throw new Error('messageId is required.');
                const data = await tgFetch('deleteMessage', { chat_id: chatId, message_id: messageId });
                return { output: data };
            }

            case 'forwardMessage': {
                const chatId = inputs.chatId;
                const fromChatId = inputs.fromChatId;
                const messageId = inputs.messageId;
                if (!chatId) throw new Error('chatId is required.');
                if (!fromChatId) throw new Error('fromChatId is required.');
                if (!messageId) throw new Error('messageId is required.');
                const data = await tgFetch('forwardMessage', {
                    chat_id: chatId,
                    from_chat_id: fromChatId,
                    message_id: messageId,
                });
                return { output: data };
            }

            case 'pinMessage': {
                const chatId = inputs.chatId;
                const messageId = inputs.messageId;
                if (!chatId) throw new Error('chatId is required.');
                if (!messageId) throw new Error('messageId is required.');
                const body: any = { chat_id: chatId, message_id: messageId };
                if (inputs.disableNotification) body.disable_notification = inputs.disableNotification;
                const data = await tgFetch('pinChatMessage', body);
                return { output: data };
            }

            case 'getChatInfo': {
                const chatId = inputs.chatId;
                if (!chatId) throw new Error('chatId is required.');
                const data = await tgFetch('getChat', { chat_id: chatId });
                return { output: data };
            }

            case 'kickChatMember': {
                const chatId = inputs.chatId;
                const userId = inputs.userId;
                if (!chatId) throw new Error('chatId is required.');
                if (!userId) throw new Error('userId is required.');
                const data = await tgFetch('kickChatMember', { chat_id: chatId, user_id: userId });
                return { output: data };
            }

            case 'banChatMember': {
                const chatId = inputs.chatId;
                const userId = inputs.userId;
                if (!chatId) throw new Error('chatId is required.');
                if (!userId) throw new Error('userId is required.');
                const body: any = { chat_id: chatId, user_id: userId };
                if (inputs.untilDate) body.until_date = inputs.untilDate;
                if (inputs.revokeMessages !== undefined) body.revoke_messages = inputs.revokeMessages;
                const data = await tgFetch('banChatMember', body);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Telegram Bot action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[TelegramBot] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
