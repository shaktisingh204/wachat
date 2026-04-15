'use server';

export async function executePlivoAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const { authId, authToken } = inputs;

        if (!authId) return { error: 'Plivo: authId is required.' };
        if (!authToken) return { error: 'Plivo: authToken is required.' };

        const apiBase = 'https://api.plivo.com/v1';
        const accountPrefix = `/Account/${authId}`;
        const basicAuth = `Basic ${Buffer.from(`${authId}:${authToken}`).toString('base64')}`;

        const defaultHeaders: Record<string, string> = {
            Authorization: basicAuth,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function apiRequest(
            method: string,
            path: string,
            body?: Record<string, any>
        ): Promise<any> {
            const url = path.startsWith('http') ? path : `${apiBase}${path}`;
            const opts: RequestInit = { method, headers: defaultHeaders };
            if (body !== undefined) opts.body = JSON.stringify(body);

            const res = await fetch(url, opts);

            if (res.status === 204) return {};

            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }

            if (!res.ok) {
                const msg =
                    data?.error ||
                    data?.message ||
                    data?.api_id ||
                    JSON.stringify(data) ||
                    `Plivo error: ${res.status}`;
                throw new Error(msg);
            }
            return data;
        }

        function buildQs(params: Record<string, any>): string {
            const qs = new URLSearchParams();
            for (const [k, v] of Object.entries(params)) {
                if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
            }
            const str = qs.toString();
            return str ? `?${str}` : '';
        }

        logger.log(`Executing Plivo action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendSms': {
                const { src, dst, text, type, url: callbackUrl, method } = inputs;
                if (!src) return { error: 'Plivo sendSms: src is required.' };
                if (!dst) return { error: 'Plivo sendSms: dst is required.' };
                if (!text) return { error: 'Plivo sendSms: text is required.' };

                const payload: Record<string, any> = {
                    src,
                    dst,
                    text,
                    type: type ?? 'sms',
                };
                if (callbackUrl) payload.url = callbackUrl;
                if (method) payload.method = method;

                const data = await apiRequest('POST', `${accountPrefix}/Message/`, payload);
                return {
                    output: {
                        message: data.message,
                        messageUuid: data.message_uuid ?? [],
                        apiId: data.api_id,
                    },
                };
            }

            case 'getMessage': {
                const { messageUuid } = inputs;
                if (!messageUuid) return { error: 'Plivo getMessage: messageUuid is required.' };
                const data = await apiRequest('GET', `${accountPrefix}/Message/${messageUuid}/`);
                return {
                    output: {
                        messageUuid: data.message_uuid,
                        src: data.src,
                        dst: data.dst,
                        text: data.message_text,
                        messageState: data.message_state,
                        units: data.units,
                    },
                };
            }

            case 'listMessages': {
                const { limit, offset, src, dst, messageDirection } = inputs;
                const qs = buildQs({
                    limit,
                    offset,
                    src,
                    dst,
                    message_direction: messageDirection ?? 'outbound',
                });
                const data = await apiRequest('GET', `${accountPrefix}/Message/${qs}`);
                return {
                    output: {
                        apiId: data.api_id,
                        response: {
                            objects: data.objects ?? [],
                            meta: data.meta ?? {},
                        },
                    },
                };
            }

            case 'makeCall': {
                const {
                    from,
                    to,
                    answerUrl,
                    answerMethod,
                    hangupUrl,
                    callerName,
                } = inputs;
                if (!from) return { error: 'Plivo makeCall: from is required.' };
                if (!to) return { error: 'Plivo makeCall: to is required.' };
                if (!answerUrl) return { error: 'Plivo makeCall: answerUrl is required.' };

                const payload: Record<string, any> = {
                    from,
                    to,
                    answer_url: answerUrl,
                    answer_method: answerMethod ?? 'POST',
                };
                if (hangupUrl) payload.hangup_url = hangupUrl;
                if (callerName) payload.caller_name = callerName;

                const data = await apiRequest('POST', `${accountPrefix}/Call/`, payload);
                return {
                    output: {
                        apiId: data.api_id,
                        message: data.message,
                        requestUuid: data.request_uuid,
                    },
                };
            }

            case 'getCall': {
                const { callUuid } = inputs;
                if (!callUuid) return { error: 'Plivo getCall: callUuid is required.' };
                const data = await apiRequest('GET', `${accountPrefix}/Call/${callUuid}/`);
                return {
                    output: {
                        callUuid: data.call_uuid,
                        fromNumber: data.from_number,
                        toNumber: data.to_number,
                        callStatus: data.call_status,
                        duration: data.duration,
                        totalCost: data.total_cost,
                    },
                };
            }

            case 'listCalls': {
                const { limit, offset, callStatus, fromNumber, toNumber } = inputs;
                const qs = buildQs({
                    limit,
                    offset,
                    call_status: callStatus ?? '',
                    from_number: fromNumber ?? '',
                    to_number: toNumber ?? '',
                });
                const data = await apiRequest('GET', `${accountPrefix}/Call/${qs}`);
                return {
                    output: {
                        apiId: data.api_id,
                        response: {
                            objects: data.objects ?? [],
                            meta: data.meta ?? {},
                        },
                    },
                };
            }

            case 'hangupCall': {
                const { callUuid } = inputs;
                if (!callUuid) return { error: 'Plivo hangupCall: callUuid is required.' };
                const data = await apiRequest('DELETE', `${accountPrefix}/Call/${callUuid}/`);
                return { output: { apiId: data.api_id, message: data.message } };
            }

            case 'listNumbers': {
                const { limit, offset } = inputs;
                const qs = buildQs({ limit, offset });
                const data = await apiRequest('GET', `${accountPrefix}/Number/${qs}`);
                return {
                    output: {
                        apiId: data.api_id,
                        response: {
                            objects: (data.objects ?? []).map((n: any) => ({
                                number: n.number,
                                numberType: n.number_type,
                                country: n.country,
                            })),
                            meta: data.meta ?? {},
                        },
                    },
                };
            }

            case 'getBalance': {
                const data = await apiRequest('GET', `${accountPrefix}/`);
                return {
                    output: {
                        accountId: data.account_id ?? data.auth_id,
                        cashCredits: data.cash_credits,
                        autoRechargeTrigger: data.auto_recharge_trigger,
                    },
                };
            }

            case 'lookupNumber': {
                const { number } = inputs;
                if (!number) return { error: 'Plivo lookupNumber: number is required.' };
                const data = await apiRequest(
                    'GET',
                    `https://lookup.plivo.com/v1/Number/${encodeURIComponent(number)}?country=IN`
                );
                return {
                    output: {
                        phoneNumber: data.phone_number,
                        countryIso2: data.country_iso2,
                        numberType: data.number_type,
                        country: data.country ?? {},
                    },
                };
            }

            case 'sendVerify': {
                const { recipient, channel } = inputs;
                if (!recipient) return { error: 'Plivo sendVerify: recipient is required.' };

                const { appUuid } = inputs;
                const payload: Record<string, any> = {
                    recipient,
                    channel: channel ?? 'sms',
                };
                if (appUuid) payload.app_uuid = appUuid;

                const data = await apiRequest(
                    'POST',
                    `${apiBase}${accountPrefix}/Verify/Session/`,
                    payload
                );
                return {
                    output: {
                        sessionUuid: data.session_uuid,
                        message: data.message,
                    },
                };
            }

            case 'verifyOtp': {
                const { sessionUuid, otp } = inputs;
                if (!sessionUuid) return { error: 'Plivo verifyOtp: sessionUuid is required.' };
                if (!otp) return { error: 'Plivo verifyOtp: otp is required.' };
                const data = await apiRequest(
                    'POST',
                    `${apiBase}${accountPrefix}/Verify/Session/${sessionUuid}/`,
                    { otp }
                );
                return {
                    output: {
                        sessionUuid: data.session_uuid,
                        message: data.message,
                        alias: data.alias,
                    },
                };
            }

            default:
                return { error: `Plivo: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Plivo action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'Plivo: An unexpected error occurred.' };
    }
}
