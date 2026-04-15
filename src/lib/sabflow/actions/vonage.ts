'use server';

export async function executeVonageAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const { apiKey, apiSecret } = inputs;

        if (!apiKey) return { error: 'Vonage: apiKey is required.' };
        if (!apiSecret) return { error: 'Vonage: apiSecret is required.' };

        const restBase = 'https://rest.nexmo.com';
        const basicAuth = `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')}`;

        async function postUrlEncoded(url: string, params: URLSearchParams): Promise<any> {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString(),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(
                    data?.error_text || data?.title || JSON.stringify(data) || `Vonage error: ${res.status}`
                );
            }
            return data;
        }

        async function getRequest(url: string, authHeader?: string): Promise<any> {
            const opts: RequestInit = { method: 'GET', headers: { Accept: 'application/json' } };
            if (authHeader) (opts.headers as any)['Authorization'] = authHeader;
            const res = await fetch(url, opts);
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(
                    data?.title || data?.error_text || JSON.stringify(data) || `Vonage error: ${res.status}`
                );
            }
            return data;
        }

        async function postJson(url: string, body: any, authHeader: string): Promise<any> {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
                body: JSON.stringify(body),
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(
                    data?.title || data?.detail || JSON.stringify(data) || `Vonage error: ${res.status}`
                );
            }
            return data;
        }

        logger.log(`Executing Vonage action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendSms': {
                const { from, to, text } = inputs;
                if (!from) return { error: 'Vonage sendSms: from is required.' };
                if (!to) return { error: 'Vonage sendSms: to is required.' };
                if (!text) return { error: 'Vonage sendSms: text is required.' };
                const params = new URLSearchParams({
                    api_key: apiKey,
                    api_secret: apiSecret,
                    from,
                    to,
                    text,
                });
                const data = await postUrlEncoded(`${restBase}/sms/json`, params);
                return {
                    output: {
                        messages: (data.messages ?? []).map((m: any) => ({
                            messageId: m['message-id'],
                            status: m.status,
                            to: m.to,
                            remainingBalance: m['remaining-balance'],
                        })),
                    },
                };
            }

            case 'sendVerify': {
                const { number, brand } = inputs;
                if (!number) return { error: 'Vonage sendVerify: number is required.' };
                if (!brand) return { error: 'Vonage sendVerify: brand is required.' };
                const params = new URLSearchParams({
                    api_key: apiKey,
                    api_secret: apiSecret,
                    number,
                    brand,
                });
                const data = await postUrlEncoded('https://api.nexmo.com/verify/json', params);
                return { output: { requestId: data.request_id, status: data.status } };
            }

            case 'checkVerify': {
                const { requestId, code } = inputs;
                if (!requestId) return { error: 'Vonage checkVerify: requestId is required.' };
                if (!code) return { error: 'Vonage checkVerify: code is required.' };
                const params = new URLSearchParams({
                    api_key: apiKey,
                    api_secret: apiSecret,
                    request_id: requestId,
                    code,
                });
                const data = await postUrlEncoded('https://api.nexmo.com/verify/check/json', params);
                return {
                    output: {
                        requestId: data.request_id,
                        status: data.status,
                        eventId: data.event_id,
                    },
                };
            }

            case 'cancelVerify': {
                const { requestId } = inputs;
                if (!requestId) return { error: 'Vonage cancelVerify: requestId is required.' };
                const params = new URLSearchParams({
                    api_key: apiKey,
                    api_secret: apiSecret,
                    request_id: requestId,
                    cmd: 'cancel',
                });
                const data = await postUrlEncoded('https://api.nexmo.com/verify/control/json', params);
                return { output: { status: data.status, command: data.command } };
            }

            case 'listNumbers': {
                const data = await getRequest(
                    `${restBase}/account/numbers?api_key=${apiKey}&api_secret=${apiSecret}`
                );
                return {
                    output: {
                        count: data.count,
                        numbers: (data['numbers'] ?? []).map((n: any) => ({
                            msisdn: n.msisdn,
                            country: n.country,
                            type: n.type,
                            features: n.features ?? [],
                        })),
                    },
                };
            }

            case 'buyNumber': {
                const { country, msisdn } = inputs;
                if (!country) return { error: 'Vonage buyNumber: country is required.' };
                if (!msisdn) return { error: 'Vonage buyNumber: msisdn is required.' };
                const params = new URLSearchParams({
                    api_key: apiKey,
                    api_secret: apiSecret,
                    country,
                    msisdn,
                });
                const data = await postUrlEncoded(`${restBase}/number/buy`, params);
                return {
                    output: { errorCode: data['error-code'], errorCodeLabel: data['error-code-label'] },
                };
            }

            case 'getBalance': {
                const data = await getRequest(
                    `${restBase}/account/get-balance?api_key=${apiKey}&api_secret=${apiSecret}`
                );
                return { output: { value: data.value, autoReload: data.autoReload } };
            }

            case 'makeCall': {
                const { to: toNumber, from: fromNumber, answerUrl, eventUrl } = inputs;
                if (!toNumber) return { error: 'Vonage makeCall: to is required.' };
                if (!fromNumber) return { error: 'Vonage makeCall: from is required.' };
                if (!answerUrl) return { error: 'Vonage makeCall: answerUrl is required.' };
                const body = {
                    to: [{ type: 'phone', number: toNumber }],
                    from: { type: 'phone', number: fromNumber },
                    answer_url: [answerUrl],
                    event_url: [eventUrl ?? answerUrl],
                };
                const data = await postJson('https://api.nexmo.com/v1/calls', body, basicAuth);
                return {
                    output: {
                        uuid: data.uuid,
                        status: data.status,
                        direction: data.direction,
                        conversation_uuid: data.conversation_uuid,
                    },
                };
            }

            case 'getCall': {
                const { callUuid } = inputs;
                if (!callUuid) return { error: 'Vonage getCall: callUuid is required.' };
                const data = await getRequest(
                    `https://api.nexmo.com/v1/calls/${callUuid}`,
                    basicAuth
                );
                return {
                    output: { uuid: data.uuid, status: data.status, duration: data.duration },
                };
            }

            case 'listCalls': {
                const { status: callStatus, pageSize } = inputs;
                const params = new URLSearchParams();
                if (callStatus) params.set('status', callStatus);
                if (pageSize) params.set('page_size', String(pageSize));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const data = await getRequest(
                    `https://api.nexmo.com/v1/calls${qs}`,
                    basicAuth
                );
                return { output: { count: data.count, calls: data._embedded?.calls ?? [] } };
            }

            case 'sendWhatsApp': {
                const { from, to, text } = inputs;
                if (!from) return { error: 'Vonage sendWhatsApp: from is required.' };
                if (!to) return { error: 'Vonage sendWhatsApp: to is required.' };
                if (!text) return { error: 'Vonage sendWhatsApp: text is required.' };
                const body = {
                    message_type: 'text',
                    text,
                    to,
                    from,
                    channel: 'whatsapp',
                };
                const data = await postJson(
                    'https://messages-sandbox.nexmo.com/v1/messages',
                    body,
                    basicAuth
                );
                return { output: { messageUuid: data.message_uuid } };
            }

            case 'lookupNumber': {
                const { number } = inputs;
                if (!number) return { error: 'Vonage lookupNumber: number is required.' };
                const data = await getRequest(
                    `https://api.nexmo.com/ni/basic/json?number=${number}&api_key=${apiKey}&api_secret=${apiSecret}`
                );
                return {
                    output: {
                        nationalFormatNumber: data.national_format_number,
                        countryName: data.country_name,
                        carrier: { name: data.carrier?.name },
                        valid: data.valid_number,
                    },
                };
            }

            default:
                return { error: `Vonage: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Vonage action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Vonage: An unexpected error occurred.' };
    }
}
