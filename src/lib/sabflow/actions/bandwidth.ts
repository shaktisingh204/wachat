'use server';

export async function executeBandwidthAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { accountId, username, password } = inputs;

        if (!accountId) return { error: 'Bandwidth: accountId is required.' };
        if (!username) return { error: 'Bandwidth: username is required.' };
        if (!password) return { error: 'Bandwidth: password is required.' };

        const basicAuth = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        const msgBase = `https://messaging.bandwidth.com/api/v2/users/${accountId}`;
        const dashBase = `https://dashboard.bandwidth.com/api/accounts/${accountId}`;
        const voiceBase = `https://voice.bandwidth.com/api/v2/accounts/${accountId}`;

        const jsonHeaders: Record<string, string> = {
            'Authorization': basicAuth,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function get(url: string): Promise<any> {
            const res = await fetch(url, { method: 'GET', headers: jsonHeaders });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.description || data?.message || data?.error || JSON.stringify(data) || `Bandwidth error: ${res.status}`);
            return data;
        }

        async function post(url: string, body: any): Promise<any> {
            const res = await fetch(url, { method: 'POST', headers: jsonHeaders, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.description || data?.message || data?.error || JSON.stringify(data) || `Bandwidth error: ${res.status}`);
            return data;
        }

        logger.log(`Executing Bandwidth action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendSms': {
                const { from, to, text, applicationId } = inputs;
                if (!from) return { error: 'Bandwidth sendSms: from is required.' };
                if (!to) return { error: 'Bandwidth sendSms: to is required.' };
                if (!text) return { error: 'Bandwidth sendSms: text is required.' };
                if (!applicationId) return { error: 'Bandwidth sendSms: applicationId is required.' };
                const data = await post(`${msgBase}/messages`, {
                    from,
                    to: Array.isArray(to) ? to : [to],
                    text,
                    applicationId,
                });
                return { output: { id: data.id, status: data.status, time: data.time } };
            }

            case 'sendMms': {
                const { from, to, text, applicationId, mediaUrls } = inputs;
                if (!from) return { error: 'Bandwidth sendMms: from is required.' };
                if (!to) return { error: 'Bandwidth sendMms: to is required.' };
                if (!applicationId) return { error: 'Bandwidth sendMms: applicationId is required.' };
                const data = await post(`${msgBase}/messages`, {
                    from,
                    to: Array.isArray(to) ? to : [to],
                    text,
                    applicationId,
                    media: mediaUrls,
                });
                return { output: { id: data.id, status: data.status, time: data.time } };
            }

            case 'getMessageStatus': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'Bandwidth getMessageStatus: messageId is required.' };
                const data = await get(`${msgBase}/messages/${messageId}`);
                return { output: data };
            }

            case 'listMessages': {
                const { sourceTn, destinationTn, messageStatus, limit } = inputs;
                const qs = new URLSearchParams();
                if (sourceTn) qs.set('sourceTn', sourceTn);
                if (destinationTn) qs.set('destinationTn', destinationTn);
                if (messageStatus) qs.set('messageStatus', messageStatus);
                if (limit) qs.set('limit', String(limit));
                const data = await get(`${msgBase}/messages${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data };
            }

            case 'createApplication': {
                const { appName, callbackUrl, callbackCreds, msgCallbackUrl } = inputs;
                if (!appName) return { error: 'Bandwidth createApplication: appName is required.' };
                const data = await post(`${dashBase}/applications`, {
                    AppName: appName,
                    CallbackUrl: callbackUrl,
                    CallbackCreds: callbackCreds,
                    MsgCallbackUrl: msgCallbackUrl,
                });
                return { output: data };
            }

            case 'getApplication': {
                const { appId } = inputs;
                if (!appId) return { error: 'Bandwidth getApplication: appId is required.' };
                const data = await get(`${dashBase}/applications/${appId}`);
                return { output: data };
            }

            case 'listPhoneNumbers': {
                const data = await get(`${dashBase}/inservicenumbers`);
                return { output: data };
            }

            case 'searchAvailableNumbers': {
                const { areaCode, quantity, state } = inputs;
                const qs = new URLSearchParams();
                if (areaCode) qs.set('areaCode', areaCode);
                if (quantity) qs.set('quantity', String(quantity));
                if (state) qs.set('state', state);
                const data = await get(`${dashBase}/availableNumbers${qs.toString() ? '?' + qs.toString() : ''}`);
                return { output: data };
            }

            case 'orderPhoneNumber': {
                const { quantity, areaCode, tnList } = inputs;
                const data = await post(`${dashBase}/orders`, { quantity, areaCode, tnList });
                return { output: data };
            }

            case 'getOrder': {
                const { orderId } = inputs;
                if (!orderId) return { error: 'Bandwidth getOrder: orderId is required.' };
                const data = await get(`${dashBase}/orders/${orderId}`);
                return { output: data };
            }

            case 'makeVoiceCall': {
                const { from, to, applicationId, answerUrl } = inputs;
                if (!from) return { error: 'Bandwidth makeVoiceCall: from is required.' };
                if (!to) return { error: 'Bandwidth makeVoiceCall: to is required.' };
                if (!applicationId) return { error: 'Bandwidth makeVoiceCall: applicationId is required.' };
                if (!answerUrl) return { error: 'Bandwidth makeVoiceCall: answerUrl is required.' };
                const data = await post(`${voiceBase}/calls`, { from, to, applicationId, answerUrl });
                return { output: { callId: data.callId, state: data.state, startTime: data.startTime } };
            }

            case 'getCall': {
                const { callId } = inputs;
                if (!callId) return { error: 'Bandwidth getCall: callId is required.' };
                const data = await get(`${voiceBase}/calls/${callId}`);
                return { output: data };
            }

            default:
                return { error: `Bandwidth: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Bandwidth action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Bandwidth: An unexpected error occurred.' };
    }
}
