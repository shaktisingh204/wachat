'use server';

export async function executeTelegramEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `https://api.telegram.org/bot${inputs.botToken}`;

        const post = (method: string, body: any) =>
            fetch(`${baseUrl}/${method}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            }).then(r => r.json());

        const get = (method: string) =>
            fetch(`${baseUrl}/${method}`).then(r => r.json());

        switch (actionName) {
            case 'sendMessage': {
                const data = await post('sendMessage', {
                    chat_id: inputs.chatId,
                    text: inputs.text,
                    parse_mode: inputs.parseMode || 'HTML',
                    disable_notification: inputs.disableNotification || false,
                    reply_to_message_id: inputs.replyToMessageId,
                });
                return { output: data };
            }

            case 'sendPhoto': {
                const data = await post('sendPhoto', {
                    chat_id: inputs.chatId,
                    photo: inputs.photo,
                    caption: inputs.caption,
                    parse_mode: inputs.parseMode || 'HTML',
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'sendDocument': {
                const data = await post('sendDocument', {
                    chat_id: inputs.chatId,
                    document: inputs.document,
                    caption: inputs.caption,
                    parse_mode: inputs.parseMode || 'HTML',
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'sendVideo': {
                const data = await post('sendVideo', {
                    chat_id: inputs.chatId,
                    video: inputs.video,
                    caption: inputs.caption,
                    duration: inputs.duration,
                    width: inputs.width,
                    height: inputs.height,
                    parse_mode: inputs.parseMode || 'HTML',
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'sendAudio': {
                const data = await post('sendAudio', {
                    chat_id: inputs.chatId,
                    audio: inputs.audio,
                    caption: inputs.caption,
                    duration: inputs.duration,
                    performer: inputs.performer,
                    title: inputs.title,
                    parse_mode: inputs.parseMode || 'HTML',
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'sendLocation': {
                const data = await post('sendLocation', {
                    chat_id: inputs.chatId,
                    latitude: inputs.latitude,
                    longitude: inputs.longitude,
                    live_period: inputs.livePeriod,
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'sendPoll': {
                const data = await post('sendPoll', {
                    chat_id: inputs.chatId,
                    question: inputs.question,
                    options: inputs.options || [],
                    is_anonymous: inputs.isAnonymous !== false,
                    type: inputs.type || 'regular',
                    allows_multiple_answers: inputs.allowsMultipleAnswers || false,
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'editMessage': {
                const data = await post('editMessageText', {
                    chat_id: inputs.chatId,
                    message_id: inputs.messageId,
                    text: inputs.text,
                    parse_mode: inputs.parseMode || 'HTML',
                    inline_message_id: inputs.inlineMessageId,
                });
                return { output: data };
            }

            case 'deleteMessage': {
                const data = await post('deleteMessage', {
                    chat_id: inputs.chatId,
                    message_id: inputs.messageId,
                });
                return { output: data };
            }

            case 'pinMessage': {
                const data = await post('pinChatMessage', {
                    chat_id: inputs.chatId,
                    message_id: inputs.messageId,
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            case 'unpinMessage': {
                const data = await post('unpinChatMessage', {
                    chat_id: inputs.chatId,
                    message_id: inputs.messageId,
                });
                return { output: data };
            }

            case 'getChat': {
                const data = await post('getChat', {
                    chat_id: inputs.chatId,
                });
                return { output: data };
            }

            case 'getChatMembers': {
                const data = await post('getChatAdministrators', {
                    chat_id: inputs.chatId,
                });
                return { output: data };
            }

            case 'kickChatMember': {
                const data = await post('banChatMember', {
                    chat_id: inputs.chatId,
                    user_id: inputs.userId,
                    until_date: inputs.untilDate,
                    revoke_messages: inputs.revokeMessages || false,
                });
                return { output: data };
            }

            case 'sendInvoice': {
                const data = await post('sendInvoice', {
                    chat_id: inputs.chatId,
                    title: inputs.title,
                    description: inputs.description,
                    payload: inputs.payload,
                    provider_token: inputs.providerToken,
                    currency: inputs.currency || 'USD',
                    prices: inputs.prices || [],
                    start_parameter: inputs.startParameter,
                    disable_notification: inputs.disableNotification || false,
                });
                return { output: data };
            }

            default:
                return { error: `Telegram Enhanced action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'Telegram Enhanced action failed with an unknown error.' };
    }
}
