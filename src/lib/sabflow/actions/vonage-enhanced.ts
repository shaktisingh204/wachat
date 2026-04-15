'use server';

export async function executeVonageEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.nexmo.com/v2';

        const getAuthHeader = () => {
            if (inputs.jwt) {
                return `Bearer ${inputs.jwt}`;
            }
            const apiKey = String(inputs.apiKey ?? '').trim();
            const apiSecret = String(inputs.apiSecret ?? '').trim();
            if (!apiKey || !apiSecret) throw new Error('jwt or apiKey+apiSecret are required.');
            return 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
        };

        const request = async (method: string, path: string, body?: any) => {
            const url = path.startsWith('http') ? path : `${baseUrl}${path}`;
            logger.log(`[VonageEnhanced] ${method} ${url}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: getAuthHeader(),
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body && method !== 'GET') options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.title || data?.message || `Vonage error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'sendSms': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const apiSecret = String(inputs.apiSecret ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!to || !from || !text) throw new Error('to, from, and text are required.');
                const res = await fetch('https://rest.nexmo.com/sms/json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, to, from, text }),
                });
                const data = await res.json();
                const msg = data.messages?.[0];
                if (msg?.status !== '0') throw new Error(msg?.['error-text'] || 'SMS sending failed.');
                return { output: { messageId: msg['message-id'], status: msg.status, remainingBalance: msg['remaining-balance'] } };
            }

            case 'sendMms': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const mediaUrl = String(inputs.mediaUrl ?? '').trim();
                if (!to || !from || !mediaUrl) throw new Error('to, from, and mediaUrl are required.');
                const data = await request('POST', '/messages', {
                    message_type: 'image',
                    to: { type: 'mms', number: to },
                    from: { type: 'mms', number: from },
                    image: { url: mediaUrl, caption: inputs.caption ?? '' },
                });
                return { output: { messageUuid: data.message_uuid } };
            }

            case 'sendWhatsApp': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!to || !from || !text) throw new Error('to, from, and text are required.');
                const data = await request('POST', '/messages', {
                    message_type: 'text',
                    to: { type: 'whatsapp', number: to },
                    from: { type: 'whatsapp', number: from },
                    text: { body: text },
                });
                return { output: { messageUuid: data.message_uuid } };
            }

            case 'makeCall': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const answerUrl = String(inputs.answerUrl ?? '').trim();
                if (!to || !from || !answerUrl) throw new Error('to, from, and answerUrl are required.');
                const data = await request('POST', '/calls', {
                    to: [{ type: 'phone', number: to }],
                    from: { type: 'phone', number: from },
                    answer_url: [answerUrl],
                    event_url: inputs.eventUrl ? [inputs.eventUrl] : undefined,
                });
                return { output: { uuid: data.uuid, status: data.status, direction: data.direction } };
            }

            case 'getCall': {
                const uuid = String(inputs.uuid ?? '').trim();
                if (!uuid) throw new Error('uuid is required.');
                const data = await request('GET', `/calls/${uuid}`);
                return { output: { uuid: data.uuid, status: data.status, direction: data.direction, duration: data.duration } };
            }

            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const data = await request('GET', `/calls?${params.toString()}`);
                return { output: { calls: data._embedded?.calls ?? [], count: data.count ?? 0 } };
            }

            case 'endCall': {
                const uuid = String(inputs.uuid ?? '').trim();
                if (!uuid) throw new Error('uuid is required.');
                await request('PUT', `/calls/${uuid}`, { action: 'hangup' });
                return { output: { uuid, action: 'hangup' } };
            }

            case 'createConversation': {
                const name = String(inputs.name ?? '').trim();
                const displayName = String(inputs.displayName ?? inputs.name ?? '').trim();
                const data = await request('POST', '/conversations', {
                    name,
                    display_name: displayName,
                    properties: inputs.properties ?? {},
                });
                return { output: { id: data.id, name: data.name, displayName: data.display_name } };
            }

            case 'getConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await request('GET', `/conversations/${conversationId}`);
                return { output: { id: data.id, name: data.name, displayName: data.display_name, state: data.state } };
            }

            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const data = await request('GET', `/conversations?${params.toString()}`);
                return { output: { conversations: data._embedded?.conversations ?? [], count: data.count ?? 0 } };
            }

            case 'addMember': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                if (!conversationId || !userId) throw new Error('conversationId and userId are required.');
                const data = await request('POST', `/conversations/${conversationId}/members`, {
                    user: { id: userId },
                    state: inputs.state ?? 'joined',
                    channel: inputs.channel ?? { type: 'app' },
                });
                return { output: { id: data.id, state: data.state, userId } };
            }

            case 'createApplication': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await request('POST', 'https://api.nexmo.com/v2/applications', {
                    name,
                    capabilities: inputs.capabilities ?? {},
                });
                return { output: { id: data.id, name: data.name, keys: { privateKey: data.keys?.private_key } } };
            }

            case 'getApplication': {
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!applicationId) throw new Error('applicationId is required.');
                const data = await request('GET', `https://api.nexmo.com/v2/applications/${applicationId}`);
                return { output: { id: data.id, name: data.name, capabilities: data.capabilities } };
            }

            case 'listApplications': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const data = await request('GET', `https://api.nexmo.com/v2/applications?${params.toString()}`);
                return { output: { applications: data._embedded?.applications ?? [], totalItems: data.total_items } };
            }

            case 'sendVerify': {
                const apiKey = String(inputs.apiKey ?? '').trim();
                const apiSecret = String(inputs.apiSecret ?? '').trim();
                const number = String(inputs.number ?? '').trim();
                const brand = String(inputs.brand ?? 'Verification').trim();
                if (!number) throw new Error('number is required.');
                const res = await fetch('https://api.nexmo.com/verify/json', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret, number, brand, code_length: inputs.codeLength ?? 6 }),
                });
                const data = await res.json();
                if (data.status !== '0') throw new Error(data.error_text || 'Verify request failed.');
                return { output: { requestId: data.request_id, status: data.status } };
            }

            default:
                return { error: `VonageEnhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'VonageEnhanced action failed.' };
    }
}
