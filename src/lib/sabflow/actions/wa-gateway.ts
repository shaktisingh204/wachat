'use server';

export async function executeWAGatewayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const baseUrl = String(inputs.baseUrl ?? '').trim().replace(/\/$/, '');
        if (!token) throw new Error('token is required.');
        if (!baseUrl) throw new Error('baseUrl is required.');

        const BASE = `${baseUrl}/api/v1`;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        async function waGet(path: string, params: Record<string, any> = {}) {
            logger.log(`[WAGateway] GET ${path}`);
            const url = new URL(`${BASE}${path}`);
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
            }
            const res = await fetch(url.toString(), { headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || `WAGateway GET ${path} failed.`);
            return data;
        }

        async function waPost(path: string, body: Record<string, any> = {}) {
            logger.log(`[WAGateway] POST ${path}`);
            const res = await fetch(`${BASE}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || data.error || `WAGateway POST ${path} failed.`);
            return data;
        }

        switch (actionName) {
            case 'sendMessage': {
                const to = String(inputs.to ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!message) throw new Error('message is required.');
                const payload: Record<string, any> = { to, message, type: 'text' };
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendImage': {
                const to = String(inputs.to ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { to, url, type: 'image' };
                if (inputs.caption) payload.caption = inputs.caption;
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendDocument': {
                const to = String(inputs.to ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { to, url, type: 'document' };
                if (inputs.filename) payload.filename = inputs.filename;
                if (inputs.caption) payload.caption = inputs.caption;
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendVideo': {
                const to = String(inputs.to ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { to, url, type: 'video' };
                if (inputs.caption) payload.caption = inputs.caption;
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendAudio': {
                const to = String(inputs.to ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { to, url, type: 'audio' };
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendLocation': {
                const to = String(inputs.to ?? '').trim();
                const latitude = String(inputs.latitude ?? '').trim();
                const longitude = String(inputs.longitude ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!latitude || !longitude) throw new Error('latitude and longitude are required.');
                const payload: Record<string, any> = { to, latitude, longitude, type: 'location' };
                if (inputs.address) payload.address = inputs.address;
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendButtons': {
                const to = String(inputs.to ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const buttons = inputs.buttons;
                if (!to) throw new Error('to is required.');
                if (!message) throw new Error('message is required.');
                if (!buttons) throw new Error('buttons are required.');
                const parsedButtons = Array.isArray(buttons) ? buttons : JSON.parse(buttons);
                const payload: Record<string, any> = { to, message, buttons: parsedButtons, type: 'buttons' };
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendList': {
                const to = String(inputs.to ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                const sections = inputs.sections;
                if (!to) throw new Error('to is required.');
                if (!message) throw new Error('message is required.');
                if (!sections) throw new Error('sections are required.');
                const parsedSections = Array.isArray(sections) ? sections : JSON.parse(sections);
                const payload: Record<string, any> = { to, message, sections: parsedSections, type: 'list' };
                if (inputs.buttonText) payload.button_text = inputs.buttonText;
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'sendTemplate': {
                const to = String(inputs.to ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                const languageCode = String(inputs.languageCode ?? 'en').trim();
                if (!to) throw new Error('to is required.');
                if (!templateName) throw new Error('templateName is required.');
                const payload: Record<string, any> = { to, template_name: templateName, language: { code: languageCode }, type: 'template' };
                if (inputs.components) {
                    payload.components = Array.isArray(inputs.components) ? inputs.components : JSON.parse(inputs.components);
                }
                if (inputs.deviceId) payload.device_id = inputs.deviceId;
                const data = await waPost('/messages/send', payload);
                return { output: { id: String(data.id ?? data.message_id ?? ''), status: String(data.status ?? 'sent') } };
            }

            case 'getStatus': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                const path = deviceId ? `/devices/${deviceId}/status` : '/devices/status';
                const data = await waGet(path);
                return { output: { status: data.status ?? '', connected: String(data.connected ?? '') } };
            }

            case 'getContacts': {
                const params: Record<string, any> = {};
                if (inputs.deviceId) params.device_id = inputs.deviceId;
                if (inputs.page) params.page = inputs.page;
                if (inputs.limit) params.limit = inputs.limit;
                const data = await waGet('/contacts', params);
                return { output: { contacts: data.contacts ?? data.data ?? [], total: String(data.total ?? 0) } };
            }

            case 'getGroups': {
                const params: Record<string, any> = {};
                if (inputs.deviceId) params.device_id = inputs.deviceId;
                const data = await waGet('/groups', params);
                return { output: { groups: data.groups ?? data.data ?? [], total: String(data.total ?? 0) } };
            }

            case 'getMessages': {
                const params: Record<string, any> = {};
                if (inputs.chatId) params.chat_id = inputs.chatId;
                if (inputs.deviceId) params.device_id = inputs.deviceId;
                if (inputs.page) params.page = inputs.page;
                if (inputs.limit) params.limit = inputs.limit;
                const data = await waGet('/messages', params);
                return { output: { messages: data.messages ?? data.data ?? [], total: String(data.total ?? 0) } };
            }

            case 'connectDevice': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const data = await waPost(`/devices/${deviceId}/connect`, {});
                return { output: { status: data.status ?? 'connecting', qrCode: data.qr_code ?? '' } };
            }

            case 'disconnectDevice': {
                const deviceId = String(inputs.deviceId ?? '').trim();
                if (!deviceId) throw new Error('deviceId is required.');
                const data = await waPost(`/devices/${deviceId}/disconnect`, {});
                return { output: { status: data.status ?? 'disconnected' } };
            }

            default:
                return { error: `WAGateway action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'WAGateway action failed.' };
    }
}
