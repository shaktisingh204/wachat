'use server';

export async function executeVapiAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;

        if (!apiKey) return { error: 'Vapi: apiKey is required.' };

        const base = 'https://api.vapi.ai';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function get(path: string): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Vapi error: ${res.status}`);
            return data;
        }

        async function post(path: string, body: any): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Vapi error: ${res.status}`);
            return data;
        }

        async function patch(path: string, body: any): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Vapi error: ${res.status}`);
            return data;
        }

        async function del(path: string): Promise<any> {
            const res = await fetch(`${base}${path}`, { method: 'DELETE', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.error || JSON.stringify(data) || `Vapi error: ${res.status}`);
            return data;
        }

        logger.log(`Executing Vapi action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'listAssistants': {
                const data = await get('/assistant');
                return { output: data };
            }

            case 'getAssistant': {
                const { id } = inputs;
                if (!id) return { error: 'Vapi getAssistant: id is required.' };
                const data = await get(`/assistant/${id}`);
                return { output: data };
            }

            case 'createAssistant': {
                const { name, voice, model, firstMessage, systemPrompt, ...rest } = inputs;
                if (!name) return { error: 'Vapi createAssistant: name is required.' };
                const body: any = { name, ...rest };
                if (voice) body.voice = voice;
                if (model) body.model = model;
                if (firstMessage) body.firstMessage = firstMessage;
                if (systemPrompt) {
                    body.model = body.model || {};
                    body.model.messages = [{ role: 'system', content: systemPrompt }];
                }
                const data = await post('/assistant', body);
                return { output: data };
            }

            case 'updateAssistant': {
                const { id, ...rest } = inputs;
                if (!id) return { error: 'Vapi updateAssistant: id is required.' };
                const data = await patch(`/assistant/${id}`, rest);
                return { output: data };
            }

            case 'deleteAssistant': {
                const { id } = inputs;
                if (!id) return { error: 'Vapi deleteAssistant: id is required.' };
                const data = await del(`/assistant/${id}`);
                return { output: data };
            }

            case 'listPhoneNumbers': {
                const data = await get('/phone-number');
                return { output: data };
            }

            case 'createPhoneNumber': {
                const { number, twilioAccountSid, twilioAuthToken, provider, ...rest } = inputs;
                if (!number) return { error: 'Vapi createPhoneNumber: number is required.' };
                const body: any = { number, provider: provider || 'twilio', ...rest };
                if (twilioAccountSid) body.twilioAccountSid = twilioAccountSid;
                if (twilioAuthToken) body.twilioAuthToken = twilioAuthToken;
                const data = await post('/phone-number', body);
                return { output: data };
            }

            case 'makeCall': {
                const { assistantId, phoneNumberId, customerNumber } = inputs;
                if (!assistantId) return { error: 'Vapi makeCall: assistantId is required.' };
                if (!phoneNumberId) return { error: 'Vapi makeCall: phoneNumberId is required.' };
                if (!customerNumber) return { error: 'Vapi makeCall: customerNumber is required.' };
                const data = await post('/call', {
                    assistantId,
                    phoneNumberId,
                    customer: { number: customerNumber },
                });
                return { output: { id: data.id, status: data.status, startedAt: data.startedAt } };
            }

            case 'getCall': {
                const { id } = inputs;
                if (!id) return { error: 'Vapi getCall: id is required.' };
                const data = await get(`/call/${id}`);
                return { output: data };
            }

            case 'listCalls': {
                const { assistantId, limit, createdAtGt, createdAtLt } = inputs;
                const qs = new URLSearchParams();
                if (assistantId) qs.set('assistantId', assistantId);
                if (limit) qs.set('limit', String(limit));
                if (createdAtGt) qs.set('createdAtGt', createdAtGt);
                if (createdAtLt) qs.set('createdAtLt', createdAtLt);
                const data = await get(`/call${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data };
            }

            case 'endCall': {
                const { id } = inputs;
                if (!id) return { error: 'Vapi endCall: id is required.' };
                const data = await del(`/call/${id}`);
                return { output: data };
            }

            case 'getCallLogs': {
                const { id } = inputs;
                if (!id) return { error: 'Vapi getCallLogs: id is required.' };
                const data = await get(`/call/${id}/logs`);
                return { output: data };
            }

            case 'createWebCall': {
                const { assistantId, ...rest } = inputs;
                if (!assistantId) return { error: 'Vapi createWebCall: assistantId is required.' };
                const data = await post('/call/web', { assistantId, ...rest });
                return { output: data };
            }

            case 'listAnalytics': {
                const data = await get('/analytics');
                return { output: data };
            }

            case 'createWebhook': {
                const { url, events } = inputs;
                if (!url) return { error: 'Vapi createWebhook: url is required.' };
                const data = await post('/webhook', { url, events });
                return { output: data };
            }

            default:
                return { error: `Vapi: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Vapi action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Vapi: An unexpected error occurred.' };
    }
}
