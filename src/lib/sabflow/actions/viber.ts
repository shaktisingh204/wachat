'use server';

export async function executeViberAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://chatapi.viber.com/pa';
        const headers = {
            'X-Viber-Auth-Token': inputs.authToken,
            'Content-Type': 'application/json',
        };

        const post = (path: string, body: any) =>
            fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) }).then(r => r.json());

        const senderDefaults = {
            name: inputs.senderName || 'SabFlow',
            avatar: inputs.senderAvatar || '',
        };

        switch (actionName) {
            case 'getAccountInfo': {
                const data = await post('/get_account_info', {});
                return { output: data };
            }

            case 'sendMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: inputs.type || 'text',
                    sender: senderDefaults,
                    text: inputs.text,
                    media: inputs.media,
                    thumbnail: inputs.thumbnail,
                    tracking_data: inputs.trackingData,
                });
                return { output: data };
            }

            case 'sendTextMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'text',
                    sender: senderDefaults,
                    text: inputs.text,
                    tracking_data: inputs.trackingData,
                });
                return { output: data };
            }

            case 'sendPictureMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'picture',
                    sender: senderDefaults,
                    text: inputs.caption || '',
                    media: inputs.mediaUrl,
                    thumbnail: inputs.thumbnailUrl,
                });
                return { output: data };
            }

            case 'sendVideoMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'video',
                    sender: senderDefaults,
                    media: inputs.mediaUrl,
                    thumbnail: inputs.thumbnailUrl,
                    size: inputs.size,
                    duration: inputs.duration,
                });
                return { output: data };
            }

            case 'sendFileMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'file',
                    sender: senderDefaults,
                    media: inputs.mediaUrl,
                    size: inputs.size,
                    file_name: inputs.fileName,
                });
                return { output: data };
            }

            case 'sendContactMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'contact',
                    sender: senderDefaults,
                    contact: {
                        name: inputs.contactName,
                        phone_number: inputs.contactPhone,
                    },
                });
                return { output: data };
            }

            case 'sendLocationMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'location',
                    sender: senderDefaults,
                    location: {
                        lat: inputs.lat,
                        lon: inputs.lon,
                    },
                });
                return { output: data };
            }

            case 'sendStickerMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'sticker',
                    sender: senderDefaults,
                    sticker_id: inputs.stickerId,
                });
                return { output: data };
            }

            case 'sendCarouselMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'rich_media',
                    sender: senderDefaults,
                    rich_media: {
                        Type: 'rich_media',
                        ButtonsGroupColumns: inputs.columns || 6,
                        ButtonsGroupRows: inputs.rows || 7,
                        Buttons: inputs.buttons || [],
                    },
                    min_api_version: inputs.minApiVersion || 7,
                });
                return { output: data };
            }

            case 'sendKeyboardMessage': {
                const data = await post('/send_message', {
                    receiver: inputs.receiver,
                    type: 'text',
                    sender: senderDefaults,
                    text: inputs.text,
                    keyboard: {
                        Type: 'keyboard',
                        Revision: inputs.revision || 1,
                        Buttons: inputs.buttons || [],
                    },
                    min_api_version: inputs.minApiVersion || 1,
                });
                return { output: data };
            }

            case 'getOnlineUsers': {
                const data = await post('/get_online', {
                    ids: inputs.ids || [],
                });
                return { output: data };
            }

            case 'getUserDetails': {
                const data = await post('/get_user_details', {
                    id: inputs.userId,
                });
                return { output: data };
            }

            case 'setWebhook': {
                const data = await post('/set_webhook', {
                    url: inputs.webhookUrl,
                    event_types: inputs.eventTypes || ['delivered', 'seen', 'failed', 'subscribed', 'unsubscribed', 'conversation_started'],
                    send_name: inputs.sendName !== false,
                    send_photo: inputs.sendPhoto !== false,
                });
                return { output: data };
            }

            case 'broadcastMessage': {
                const data = await post('/broadcast_message', {
                    broadcast_list: inputs.broadcastList || [],
                    type: inputs.type || 'text',
                    sender: senderDefaults,
                    text: inputs.text,
                    media: inputs.media,
                    thumbnail: inputs.thumbnail,
                });
                return { output: data };
            }

            default:
                return { error: `Viber action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'Viber action failed with an unknown error.' };
    }
}
