
'use server';

export async function executeTelnyxAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const base = 'https://api.telnyx.com/v2';

        async function telnyxFetch(method: string, url: string, body?: any) {
            logger?.log(`[Telnyx] ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                const msg = data?.errors?.[0]?.detail || data?.errors?.[0]?.title || data?.message || `Telnyx API error: ${res.status}`;
                throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
            }
            return data;
        }

        switch (actionName) {
            case 'sendSms': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!from) throw new Error('from is required.');
                if (!to) throw new Error('to is required.');
                if (!text) throw new Error('text is required.');
                const data = await telnyxFetch('POST', `${base}/messages`, { from, to, text });
                return { output: { id: data?.data?.id, status: data?.data?.to?.[0]?.status } };
            }

            case 'sendMms': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const mediaUrls = inputs.media_urls ?? inputs.mediaUrls;
                if (!from) throw new Error('from is required.');
                if (!to) throw new Error('to is required.');
                if (!mediaUrls) throw new Error('media_urls is required.');
                const body: any = {
                    from,
                    to,
                    media_urls: Array.isArray(mediaUrls) ? mediaUrls : [mediaUrls],
                };
                if (inputs.text) body.text = String(inputs.text);
                const data = await telnyxFetch('POST', `${base}/messages`, body);
                return { output: { id: data?.data?.id, status: data?.data?.to?.[0]?.status } };
            }

            case 'sendFax': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const mediaUrl = String(inputs.media_url ?? inputs.mediaUrl ?? '').trim();
                if (!from) throw new Error('from is required.');
                if (!to) throw new Error('to is required.');
                if (!mediaUrl) throw new Error('media_url is required.');
                const data = await telnyxFetch('POST', `${base}/faxes`, { from, to, media_url: mediaUrl });
                return { output: { id: data?.data?.id, status: data?.data?.status } };
            }

            case 'makeProgrammableVoiceCall': {
                const connectionId = String(inputs.connection_id ?? inputs.connectionId ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                if (!connectionId) throw new Error('connection_id is required.');
                if (!to) throw new Error('to is required.');
                if (!from) throw new Error('from is required.');
                const body: any = { connection_id: connectionId, to, from };
                if (inputs.timeout_secs !== undefined) body.timeout_secs = Number(inputs.timeout_secs);
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);
                const data = await telnyxFetch('POST', `${base}/calls`, body);
                return { output: { callControlId: data?.data?.call_control_id, callLegId: data?.data?.call_leg_id, status: data?.data?.is_alive } };
            }

            case 'getCall': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                const data = await telnyxFetch('GET', `${base}/calls/${callControlId}`);
                return { output: { call: data?.data ?? data } };
            }

            case 'answerCall': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                const body: any = {};
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);
                const data = await telnyxFetch('POST', `${base}/calls/${callControlId}/actions/answer`, body);
                return { output: { result: data?.data ?? {} } };
            }

            case 'hangupCall': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                const data = await telnyxFetch('POST', `${base}/calls/${callControlId}/actions/hangup`, {});
                return { output: { result: data?.data ?? {} } };
            }

            case 'sendDtmf': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                const digits = String(inputs.digits ?? '').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                if (!digits) throw new Error('digits is required.');
                const data = await telnyxFetch('POST', `${base}/calls/${callControlId}/actions/send_dtmf`, { digits });
                return { output: { result: data?.data ?? {} } };
            }

            case 'playAudio': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                const audioUrl = String(inputs.audioUrl ?? inputs.audio_url ?? '').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                if (!audioUrl) throw new Error('audioUrl is required.');
                const body: any = { audio_url: audioUrl };
                if (inputs.loop) body.loop = inputs.loop;
                const data = await telnyxFetch('POST', `${base}/calls/${callControlId}/actions/playback_start`, body);
                return { output: { result: data?.data ?? {} } };
            }

            case 'speakText': {
                const callControlId = String(inputs.callControlId ?? '').trim();
                const payload = String(inputs.payload ?? inputs.text ?? '').trim();
                const voice = String(inputs.voice ?? 'female').trim();
                const language = String(inputs.language ?? 'en-US').trim();
                if (!callControlId) throw new Error('callControlId is required.');
                if (!payload) throw new Error('payload (text) is required.');
                const data = await telnyxFetch('POST', `${base}/calls/${callControlId}/actions/speak`, {
                    payload,
                    voice,
                    language,
                    payload_type: inputs.payloadType ?? 'text',
                });
                return { output: { result: data?.data ?? {} } };
            }

            case 'listPhoneNumbers': {
                const params = new URLSearchParams();
                if (inputs.filterStatus) params.set('filter[status]', String(inputs.filterStatus));
                if (inputs.filterCountryCode) params.set('filter[country_code]', String(inputs.filterCountryCode));
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await telnyxFetch('GET', `${base}/phone_numbers${qs}`);
                return { output: { phoneNumbers: data?.data ?? [] } };
            }

            case 'buyPhoneNumber': {
                const phoneNumbers = inputs.phoneNumbers ?? inputs.phone_numbers;
                if (!phoneNumbers) throw new Error('phoneNumbers is required.');
                const body: any = {
                    phone_numbers: Array.isArray(phoneNumbers) ? phoneNumbers.map((n: any) => ({ phone_number: String(n) })) : [{ phone_number: String(phoneNumbers) }],
                };
                if (inputs.messagingProfileId) body.messaging_profile_id = String(inputs.messagingProfileId);
                if (inputs.connectionId) body.connection_id = String(inputs.connectionId);
                const data = await telnyxFetch('POST', `${base}/phone_numbers/orders`, body);
                return { output: { order: data?.data ?? {} } };
            }

            case 'listMessagingProfiles': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page[size]', String(inputs.pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await telnyxFetch('GET', `${base}/messaging_profiles${qs}`);
                return { output: { messagingProfiles: data?.data ?? [] } };
            }

            case 'createMessagingProfile': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.webhookUrl) body.webhook_url = String(inputs.webhookUrl);
                if (inputs.webhookApiVersion) body.webhook_api_version = String(inputs.webhookApiVersion);
                if (inputs.enabled !== undefined) body.enabled = Boolean(inputs.enabled);
                const data = await telnyxFetch('POST', `${base}/messaging_profiles`, body);
                return { output: { messagingProfile: data?.data ?? {} } };
            }

            case 'getBalance': {
                const data = await telnyxFetch('GET', `${base}/balance`);
                return { output: { balance: data?.data?.balance, creditLimit: data?.data?.credit_limit, currency: data?.data?.currency, availableCredit: data?.data?.available_credit } };
            }

            default:
                return { error: `Telnyx action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Telnyx action failed.' };
    }
}
