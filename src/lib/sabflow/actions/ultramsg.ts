'use server';

export async function executeUltraMsgAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const instanceId = String(inputs.instanceId ?? '').trim();
        if (!token) throw new Error('token is required.');
        if (!instanceId) throw new Error('instanceId is required.');

        const BASE = `https://api.ultramsg.com/${instanceId}`;

        async function ultraPost(endpoint: string, body: Record<string, any>) {
            logger.log(`[UltraMsg] POST ${endpoint}`);
            const payload = { ...body, token };
            const res = await fetch(`${BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams(Object.entries(payload).map(([k, v]) => [k, String(v ?? '')])).toString(),
            });
            const data = await res.json();
            if (data.error) throw new Error(String(data.error));
            return data;
        }

        async function ultraGet(endpoint: string, params: Record<string, any> = {}) {
            logger.log(`[UltraMsg] GET ${endpoint}`);
            const url = new URL(`${BASE}${endpoint}`);
            url.searchParams.set('token', token);
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
            }
            const res = await fetch(url.toString());
            const data = await res.json();
            if (data.error) throw new Error(String(data.error));
            return data;
        }

        switch (actionName) {
            case 'sendMessage': {
                const to = String(inputs.to ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!body) throw new Error('body is required.');
                const data = await ultraPost('/messages/chat', { to, body });
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendImage': {
                const to = String(inputs.to ?? '').trim();
                const image = String(inputs.image ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!image) throw new Error('image URL is required.');
                const payload: Record<string, any> = { to, image };
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await ultraPost('/messages/image', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendDocument': {
                const to = String(inputs.to ?? '').trim();
                const document = String(inputs.document ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!document) throw new Error('document URL is required.');
                const payload: Record<string, any> = { to, document };
                if (inputs.filename) payload.filename = inputs.filename;
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await ultraPost('/messages/document', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendVideo': {
                const to = String(inputs.to ?? '').trim();
                const video = String(inputs.video ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!video) throw new Error('video URL is required.');
                const payload: Record<string, any> = { to, video };
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await ultraPost('/messages/video', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendAudio': {
                const to = String(inputs.to ?? '').trim();
                const audio = String(inputs.audio ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!audio) throw new Error('audio URL is required.');
                const data = await ultraPost('/messages/audio', { to, audio });
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendVoice': {
                const to = String(inputs.to ?? '').trim();
                const audio = String(inputs.audio ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!audio) throw new Error('audio URL is required.');
                const data = await ultraPost('/messages/voice', { to, audio });
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendLocation': {
                const to = String(inputs.to ?? '').trim();
                const lat = String(inputs.lat ?? '').trim();
                const lng = String(inputs.lng ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!lat || !lng) throw new Error('lat and lng are required.');
                const payload: Record<string, any> = { to, lat, lng };
                if (inputs.address) payload.address = inputs.address;
                const data = await ultraPost('/messages/location', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendContact': {
                const to = String(inputs.to ?? '').trim();
                const contact = String(inputs.contact ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!contact) throw new Error('contact (vcard or phone) is required.');
                const data = await ultraPost('/messages/contact', { to, contact });
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendButtons': {
                const to = String(inputs.to ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const buttons = inputs.buttons;
                if (!to) throw new Error('to is required.');
                if (!body) throw new Error('body is required.');
                if (!buttons) throw new Error('buttons are required.');
                const parsedButtons = Array.isArray(buttons) ? buttons : JSON.parse(buttons);
                const data = await ultraPost('/messages/buttons', { to, body, buttons: JSON.stringify(parsedButtons) });
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendList': {
                const to = String(inputs.to ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const sections = inputs.sections;
                if (!to) throw new Error('to is required.');
                if (!body) throw new Error('body is required.');
                if (!sections) throw new Error('sections are required.');
                const parsedSections = Array.isArray(sections) ? sections : JSON.parse(sections);
                const payload: Record<string, any> = { to, body, sections: JSON.stringify(parsedSections) };
                if (inputs.header) payload.header = inputs.header;
                if (inputs.footer) payload.footer = inputs.footer;
                if (inputs.title) payload.title = inputs.title;
                const data = await ultraPost('/messages/list', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'sendTemplate': {
                const to = String(inputs.to ?? '').trim();
                const templateId = String(inputs.templateId ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!templateId) throw new Error('templateId is required.');
                const payload: Record<string, any> = { to, template_id: templateId };
                if (inputs.variables) payload.variables = typeof inputs.variables === 'string' ? inputs.variables : JSON.stringify(inputs.variables);
                const data = await ultraPost('/messages/template', payload);
                return { output: { id: String(data.id ?? ''), sent: String(data.sent ?? 'true') } };
            }

            case 'getInstanceStatus': {
                const data = await ultraGet('/instance/status');
                return { output: { status: data.status ?? '', accountStatus: data.accountStatus ?? '' } };
            }

            case 'getMessages': {
                const params: Record<string, any> = {};
                if (inputs.page) params.page = inputs.page;
                if (inputs.limit) params.limit = inputs.limit;
                if (inputs.status) params.status = inputs.status;
                const data = await ultraGet('/messages', params);
                return { output: { messages: data.messages ?? [], total: String(data.total ?? 0) } };
            }

            case 'getContacts': {
                const params: Record<string, any> = {};
                if (inputs.page) params.page = inputs.page;
                if (inputs.limit) params.limit = inputs.limit;
                const data = await ultraGet('/contacts', params);
                return { output: { contacts: data.contacts ?? [], total: String(data.total ?? 0) } };
            }

            case 'getChats': {
                const params: Record<string, any> = {};
                if (inputs.page) params.page = inputs.page;
                if (inputs.limit) params.limit = inputs.limit;
                const data = await ultraGet('/chats', params);
                return { output: { chats: data.chats ?? [], total: String(data.total ?? 0) } };
            }

            default:
                return { error: `UltraMsg action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'UltraMsg action failed.' };
    }
}
