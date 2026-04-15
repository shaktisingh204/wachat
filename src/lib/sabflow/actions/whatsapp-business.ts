'use server';

export async function executeWhatsAppBusinessAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `https://graph.facebook.com/v19.0/${inputs.phoneNumberId}`;
        const headers = {
            'Authorization': `Bearer ${inputs.accessToken}`,
            'Content-Type': 'application/json',
        };

        const post = (path: string, body: any) =>
            fetch(`${baseUrl}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            }).then(r => r.json());

        const get = (url: string) =>
            fetch(url, { method: 'GET', headers }).then(r => r.json());

        const patch = (url: string, body: any) =>
            fetch(url, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
            }).then(r => r.json());

        switch (actionName) {
            case 'sendTextMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'text',
                    text: {
                        preview_url: inputs.previewUrl || false,
                        body: inputs.body,
                    },
                });
                return { output: data };
            }

            case 'sendTemplateMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    to: inputs.to,
                    type: 'template',
                    template: {
                        name: inputs.templateName,
                        language: { code: inputs.languageCode || 'en_US' },
                        components: inputs.components || [],
                    },
                });
                return { output: data };
            }

            case 'sendImageMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'image',
                    image: {
                        link: inputs.imageUrl,
                        caption: inputs.caption,
                    },
                });
                return { output: data };
            }

            case 'sendVideoMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'video',
                    video: {
                        link: inputs.videoUrl,
                        caption: inputs.caption,
                    },
                });
                return { output: data };
            }

            case 'sendDocumentMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'document',
                    document: {
                        link: inputs.documentUrl,
                        caption: inputs.caption,
                        filename: inputs.filename,
                    },
                });
                return { output: data };
            }

            case 'sendAudioMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'audio',
                    audio: {
                        link: inputs.audioUrl,
                    },
                });
                return { output: data };
            }

            case 'sendLocationMessage': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'location',
                    location: {
                        longitude: inputs.longitude,
                        latitude: inputs.latitude,
                        name: inputs.name,
                        address: inputs.address,
                    },
                });
                return { output: data };
            }

            case 'sendInteractiveButtons': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'interactive',
                    interactive: {
                        type: 'button',
                        body: { text: inputs.bodyText },
                        action: {
                            buttons: inputs.buttons || [],
                        },
                    },
                });
                return { output: data };
            }

            case 'sendInteractiveList': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: inputs.to,
                    type: 'interactive',
                    interactive: {
                        type: 'list',
                        header: inputs.header ? { type: 'text', text: inputs.header } : undefined,
                        body: { text: inputs.bodyText },
                        footer: inputs.footer ? { text: inputs.footer } : undefined,
                        action: {
                            button: inputs.buttonLabel || 'Select',
                            sections: inputs.sections || [],
                        },
                    },
                });
                return { output: data };
            }

            case 'markMessageRead': {
                const data = await post('/messages', {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: inputs.messageId,
                });
                return { output: data };
            }

            case 'getMediaUrl': {
                const data = await get(`https://graph.facebook.com/v19.0/${inputs.mediaId}`);
                return { output: data };
            }

            case 'uploadMedia': {
                const formData = new FormData();
                formData.append('messaging_product', 'whatsapp');
                formData.append('type', inputs.mediaType || 'image/jpeg');
                if (inputs.fileUrl) {
                    const fileRes = await fetch(inputs.fileUrl);
                    const blob = await fileRes.blob();
                    formData.append('file', blob, inputs.filename || 'file');
                }
                const uploadRes = await fetch(`${baseUrl}/media`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${inputs.accessToken}` },
                    body: formData,
                });
                const data = await uploadRes.json();
                return { output: data };
            }

            case 'getPhoneNumbers': {
                const data = await get(`https://graph.facebook.com/v19.0/${inputs.wabaId}/phone_numbers?access_token=${inputs.accessToken}`);
                return { output: data };
            }

            case 'getBusinessProfile': {
                const data = await get(`${baseUrl}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`);
                return { output: data };
            }

            case 'updateBusinessProfile': {
                const data = await patch(`${baseUrl}/whatsapp_business_profile`, {
                    messaging_product: 'whatsapp',
                    about: inputs.about,
                    address: inputs.address,
                    description: inputs.description,
                    email: inputs.email,
                    websites: inputs.websites,
                    vertical: inputs.vertical,
                });
                return { output: data };
            }

            default:
                return { error: `WhatsApp Business action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        return { error: err.message || 'WhatsApp Business action failed with an unknown error.' };
    }
}
