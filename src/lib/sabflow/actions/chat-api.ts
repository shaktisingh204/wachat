'use server';

export async function executeChatAPIAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!token) throw new Error('token is required.');
        if (!serverUrl) throw new Error('serverUrl is required.');

        const BASE = `${serverUrl}/api`;

        function buildUrl(path: string, extraParams: Record<string, any> = {}) {
            const url = new URL(`${BASE}${path}`);
            url.searchParams.set('token', token);
            for (const [k, v] of Object.entries(extraParams)) {
                if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
            }
            return url.toString();
        }

        async function apiGet(path: string, params: Record<string, any> = {}) {
            logger.log(`[ChatAPI] GET ${path}`);
            const res = await fetch(buildUrl(path, params));
            const data = await res.json();
            if (data.error) throw new Error(String(data.error));
            return data;
        }

        async function apiPost(path: string, body: Record<string, any> = {}) {
            logger.log(`[ChatAPI] POST ${path}`);
            const res = await fetch(buildUrl(path), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (data.error) throw new Error(String(data.error));
            return data;
        }

        switch (actionName) {
            case 'sendMessage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!body) throw new Error('body is required.');
                const payload: Record<string, any> = { chatId, body };
                if (inputs.quotedMsgId) payload.quotedMsgId = inputs.quotedMsgId;
                const data = await apiPost('/sendText', payload);
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'sendFile': {
                const chatId = String(inputs.chatId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { chatId, url };
                if (inputs.caption) payload.caption = inputs.caption;
                if (inputs.filename) payload.filename = inputs.filename;
                const data = await apiPost('/sendFile', payload);
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'sendImage': {
                const chatId = String(inputs.chatId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { chatId, url };
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await apiPost('/sendImage', payload);
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'sendDocument': {
                const chatId = String(inputs.chatId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { chatId, url };
                if (inputs.filename) payload.filename = inputs.filename;
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await apiPost('/sendFile', payload);
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'sendVideo': {
                const chatId = String(inputs.chatId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!url) throw new Error('url is required.');
                const payload: Record<string, any> = { chatId, url };
                if (inputs.caption) payload.caption = inputs.caption;
                const data = await apiPost('/sendVideo', payload);
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'sendAudio': {
                const chatId = String(inputs.chatId ?? '').trim();
                const url = String(inputs.url ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                if (!url) throw new Error('url is required.');
                const data = await apiPost('/sendVoice', { chatId, url });
                return { output: { id: String(data.id ?? ''), sent: 'true' } };
            }

            case 'getStatus': {
                const data = await apiGet('/status');
                return { output: { accountStatus: data.accountStatus ?? '', status: String(data.status ?? '') } };
            }

            case 'getMessages': {
                const chatId = String(inputs.chatId ?? '').trim();
                if (!chatId) throw new Error('chatId is required.');
                const params: Record<string, any> = { chatId };
                if (inputs.limit) params.limit = inputs.limit;
                if (inputs.fromMe !== undefined) params.fromMe = inputs.fromMe;
                const data = await apiGet('/messages', params);
                return { output: { messages: Array.isArray(data) ? data : (data.messages ?? []) } };
            }

            case 'getContacts': {
                const data = await apiGet('/contacts');
                return { output: { contacts: Array.isArray(data) ? data : (data.contacts ?? []), total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getQR': {
                const data = await apiGet('/qr-code');
                return { output: { qrCode: data.qr ?? data.base64 ?? '', status: String(data.status ?? '') } };
            }

            case 'logout': {
                const data = await apiPost('/logout', {});
                return { output: { result: data.result ?? 'true', status: String(data.status ?? '') } };
            }

            case 'setWebhook': {
                const webhookUrl = String(inputs.webhookUrl ?? '').trim();
                if (!webhookUrl) throw new Error('webhookUrl is required.');
                const payload: Record<string, any> = { url: webhookUrl };
                if (inputs.events) payload.events = Array.isArray(inputs.events) ? inputs.events : JSON.parse(inputs.events);
                const data = await apiPost('/setWebhook', payload);
                return { output: { result: data.result ?? 'true' } };
            }

            case 'getWebhook': {
                const data = await apiGet('/webhook');
                return { output: { url: data.url ?? '', events: data.events ?? [] } };
            }

            case 'listGroups': {
                const data = await apiGet('/groups');
                return { output: { groups: Array.isArray(data) ? data : (data.groups ?? []), total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'createGroup': {
                const name = String(inputs.name ?? '').trim();
                const participants = inputs.participants;
                if (!name) throw new Error('name is required.');
                if (!participants) throw new Error('participants are required.');
                const parsedParticipants = Array.isArray(participants) ? participants : JSON.parse(participants);
                const data = await apiPost('/createGroup', { name, participants: parsedParticipants });
                return { output: { id: String(data.gid ?? data.id ?? ''), name: String(data.name ?? name) } };
            }

            default:
                return { error: `ChatAPI action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'ChatAPI action failed.' };
    }
}
