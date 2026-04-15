'use server';

export async function executeWhatsAppCloudAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const phoneNumberId = String(inputs.phoneNumberId ?? '').trim();
        const baseUrl = `https://graph.facebook.com/v18.0`;

        const waFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[WhatsAppCloud] ${method} ${path}`);
            const res = await fetch(`${baseUrl}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = text; }
            if (!res.ok) throw new Error(data?.error?.message || data?.message || `WhatsApp Cloud API error: ${res.status}`);
            return data;
        };

        const sendMsg = async (to: string, msgBody: any) => {
            if (!phoneNumberId) throw new Error('phoneNumberId is required.');
            if (!to) throw new Error('to (recipient phone number) is required.');
            const payload = { messaging_product: 'whatsapp', to, ...msgBody };
            return waFetch('POST', `/${phoneNumberId}/messages`, payload);
        };

        switch (actionName) {
            case 'sendTextMessage': {
                if (!inputs.to) throw new Error('to is required.');
                if (!inputs.text) throw new Error('text is required.');
                const data = await sendMsg(inputs.to, {
                    type: 'text',
                    text: { body: inputs.text, preview_url: inputs.previewUrl ?? false },
                });
                return { output: data };
            }

            case 'sendTemplateMessage': {
                if (!inputs.to) throw new Error('to is required.');
                if (!inputs.templateName) throw new Error('templateName is required.');
                const body: any = {
                    type: 'template',
                    template: {
                        name: inputs.templateName,
                        language: { code: inputs.languageCode ?? 'en_US' },
                    },
                };
                if (inputs.components) body.template.components = inputs.components;
                const data = await sendMsg(inputs.to, body);
                return { output: data };
            }

            case 'sendImageMessage': {
                if (!inputs.to) throw new Error('to is required.');
                const imageObj: any = inputs.imageId
                    ? { id: inputs.imageId }
                    : { link: inputs.imageUrl };
                if (inputs.caption) imageObj.caption = inputs.caption;
                const data = await sendMsg(inputs.to, { type: 'image', image: imageObj });
                return { output: data };
            }

            case 'sendVideoMessage': {
                if (!inputs.to) throw new Error('to is required.');
                const videoObj: any = inputs.videoId
                    ? { id: inputs.videoId }
                    : { link: inputs.videoUrl };
                if (inputs.caption) videoObj.caption = inputs.caption;
                const data = await sendMsg(inputs.to, { type: 'video', video: videoObj });
                return { output: data };
            }

            case 'sendAudioMessage': {
                if (!inputs.to) throw new Error('to is required.');
                const audioObj: any = inputs.audioId
                    ? { id: inputs.audioId }
                    : { link: inputs.audioUrl };
                const data = await sendMsg(inputs.to, { type: 'audio', audio: audioObj });
                return { output: data };
            }

            case 'sendDocumentMessage': {
                if (!inputs.to) throw new Error('to is required.');
                const docObj: any = inputs.documentId
                    ? { id: inputs.documentId }
                    : { link: inputs.documentUrl };
                if (inputs.caption) docObj.caption = inputs.caption;
                if (inputs.filename) docObj.filename = inputs.filename;
                const data = await sendMsg(inputs.to, { type: 'document', document: docObj });
                return { output: data };
            }

            case 'sendInteractiveButtons': {
                if (!inputs.to) throw new Error('to is required.');
                if (!inputs.bodyText) throw new Error('bodyText is required.');
                if (!inputs.buttons || !Array.isArray(inputs.buttons)) throw new Error('buttons (array) is required.');
                const interactive: any = {
                    type: 'button',
                    body: { text: inputs.bodyText },
                    action: {
                        buttons: inputs.buttons.map((b: any, i: number) => ({
                            type: 'reply',
                            reply: { id: b.id ?? `btn_${i}`, title: b.title },
                        })),
                    },
                };
                if (inputs.headerText) interactive.header = { type: 'text', text: inputs.headerText };
                if (inputs.footerText) interactive.footer = { text: inputs.footerText };
                const data = await sendMsg(inputs.to, { type: 'interactive', interactive });
                return { output: data };
            }

            case 'sendInteractiveList': {
                if (!inputs.to) throw new Error('to is required.');
                if (!inputs.bodyText) throw new Error('bodyText is required.');
                if (!inputs.buttonText) throw new Error('buttonText is required.');
                if (!inputs.sections || !Array.isArray(inputs.sections)) throw new Error('sections (array) is required.');
                const interactive: any = {
                    type: 'list',
                    body: { text: inputs.bodyText },
                    action: { button: inputs.buttonText, sections: inputs.sections },
                };
                if (inputs.headerText) interactive.header = { type: 'text', text: inputs.headerText };
                if (inputs.footerText) interactive.footer = { text: inputs.footerText };
                const data = await sendMsg(inputs.to, { type: 'interactive', interactive });
                return { output: data };
            }

            case 'sendLocationMessage': {
                if (!inputs.to) throw new Error('to is required.');
                if (inputs.latitude === undefined) throw new Error('latitude is required.');
                if (inputs.longitude === undefined) throw new Error('longitude is required.');
                const location: any = {
                    latitude: inputs.latitude,
                    longitude: inputs.longitude,
                };
                if (inputs.name) location.name = inputs.name;
                if (inputs.address) location.address = inputs.address;
                const data = await sendMsg(inputs.to, { type: 'location', location });
                return { output: data };
            }

            case 'sendContactMessage': {
                if (!inputs.to) throw new Error('to is required.');
                if (!inputs.contacts || !Array.isArray(inputs.contacts)) throw new Error('contacts (array) is required.');
                const data = await sendMsg(inputs.to, { type: 'contacts', contacts: inputs.contacts });
                return { output: data };
            }

            case 'markAsRead': {
                if (!phoneNumberId) throw new Error('phoneNumberId is required.');
                if (!inputs.messageId) throw new Error('messageId is required.');
                const data = await waFetch('POST', `/${phoneNumberId}/messages`, {
                    messaging_product: 'whatsapp',
                    status: 'read',
                    message_id: inputs.messageId,
                });
                return { output: data };
            }

            case 'getPhoneNumbers': {
                if (!inputs.wabaid) throw new Error('wabaid (WhatsApp Business Account ID) is required.');
                const data = await waFetch('GET', `/${inputs.wabaid}/phone_numbers`);
                return { output: data };
            }

            case 'getTemplates': {
                if (!inputs.wabaid) throw new Error('wabaid (WhatsApp Business Account ID) is required.');
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.fields) params.set('fields', String(inputs.fields));
                const query = params.toString() ? `?${params}` : '';
                const data = await waFetch('GET', `/${inputs.wabaid}/message_templates${query}`);
                return { output: data };
            }

            case 'createTemplate': {
                if (!inputs.wabaid) throw new Error('wabaid is required.');
                if (!inputs.name) throw new Error('name is required.');
                const body: any = {
                    name: inputs.name,
                    language: inputs.language ?? 'en_US',
                    category: inputs.category ?? 'UTILITY',
                };
                if (inputs.components) body.components = inputs.components;
                const data = await waFetch('POST', `/${inputs.wabaid}/message_templates`, body);
                return { output: data };
            }

            case 'deleteTemplate': {
                if (!inputs.wabaid) throw new Error('wabaid is required.');
                if (!inputs.name) throw new Error('name is required.');
                const data = await waFetch('DELETE', `/${inputs.wabaid}/message_templates?name=${encodeURIComponent(inputs.name)}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown WhatsApp Cloud action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[WhatsAppCloud] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
