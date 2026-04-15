'use server';

export async function executeMessagebirdAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const { accessKey } = inputs;

        if (!accessKey) return { error: 'MessageBird: accessKey is required.' };

        const restBase = 'https://rest.messagebird.com';

        const defaultHeaders: Record<string, string> = {
            Authorization: `AccessKey ${accessKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        async function apiRequest(
            method: string,
            url: string,
            body?: any
        ): Promise<any> {
            const opts: RequestInit = { method, headers: defaultHeaders };
            if (body !== undefined) opts.body = JSON.stringify(body);

            const res = await fetch(url, opts);

            if (res.status === 204) return {};

            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }

            if (!res.ok) {
                const msg =
                    data?.errors?.[0]?.description ||
                    data?.message ||
                    JSON.stringify(data) ||
                    `MessageBird error: ${res.status}`;
                throw new Error(msg);
            }
            return data;
        }

        logger.log(`Executing MessageBird action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'sendSms': {
                const { originator, recipients, body, type, scheduledDatetime } = inputs;
                if (!originator) return { error: 'MessageBird sendSms: originator is required.' };
                if (!recipients) return { error: 'MessageBird sendSms: recipients is required.' };
                if (!body) return { error: 'MessageBird sendSms: body is required.' };

                const payload: Record<string, any> = {
                    originator,
                    recipients: Array.isArray(recipients) ? recipients : [recipients],
                    body,
                    type: type ?? 'sms',
                };
                if (scheduledDatetime) payload.scheduledDatetime = scheduledDatetime;

                const data = await apiRequest('POST', `${restBase}/messages`, payload);
                return {
                    output: {
                        id: data.id,
                        originator: data.originator,
                        recipients: {
                            items: (data.recipients?.items ?? []).map((item: any) => ({
                                recipient: item.recipient,
                                status: item.status,
                            })),
                        },
                        body: data.body,
                    },
                };
            }

            case 'getMessage': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'MessageBird getMessage: messageId is required.' };
                const data = await apiRequest('GET', `${restBase}/messages/${messageId}`);
                return {
                    output: {
                        id: data.id,
                        body: data.body,
                        originator: data.originator,
                        recipients: { items: data.recipients?.items ?? [] },
                        createdDatetime: data.createdDatetime,
                    },
                };
            }

            case 'listMessages': {
                const data = await apiRequest('GET', `${restBase}/messages`);
                return {
                    output: {
                        offset: data.offset,
                        limit: data.limit,
                        count: data.count,
                        totalCount: data.totalCount,
                        items: data.items ?? [],
                    },
                };
            }

            case 'deleteMessage': {
                const { messageId } = inputs;
                if (!messageId) return { error: 'MessageBird deleteMessage: messageId is required.' };
                await apiRequest('DELETE', `${restBase}/messages/${messageId}`);
                return { output: { deleted: true } };
            }

            case 'sendVoice': {
                const { originator, destination, body, language, voice, repeat, ifMachine } = inputs;
                if (!originator) return { error: 'MessageBird sendVoice: originator is required.' };
                if (!destination) return { error: 'MessageBird sendVoice: destination is required.' };
                if (!body) return { error: 'MessageBird sendVoice: body is required.' };

                const data = await apiRequest('POST', `${restBase}/voicemessages`, {
                    originator,
                    recipients: [destination],
                    body,
                    language: language ?? 'en-gb',
                    voice: voice ?? 'female',
                    repeat: repeat ?? 1,
                    ifMachine: ifMachine ?? 'continue',
                });
                return {
                    output: {
                        id: data.id,
                        recipients: { items: data.recipients?.items ?? [] },
                    },
                };
            }

            case 'sendVerify': {
                const { recipient, type: verifyType, timeout } = inputs;
                if (!recipient) return { error: 'MessageBird sendVerify: recipient is required.' };
                const data = await apiRequest('POST', `${restBase}/verify`, {
                    recipient,
                    type: verifyType ?? 'sms',
                    timeout: timeout ?? 30,
                });
                return { output: { id: data.id, recipient: data.recipient, status: data.status } };
            }

            case 'verifyToken': {
                const { id, token } = inputs;
                if (!id) return { error: 'MessageBird verifyToken: id is required.' };
                if (!token) return { error: 'MessageBird verifyToken: token is required.' };
                const data = await apiRequest(
                    'GET',
                    `${restBase}/verify/${id}?token=${encodeURIComponent(token)}`
                );
                return { output: { id: data.id, status: data.status } };
            }

            case 'getBalance': {
                const data = await apiRequest('GET', `${restBase}/balance`);
                return { output: { payment: data.payment, type: data.type, amount: data.amount } };
            }

            case 'listNumbers': {
                const data = await apiRequest(
                    'GET',
                    'https://numbers.messagebird.com/v1/phone-numbers'
                );
                return {
                    output: {
                        phoneNumbers: (data.items ?? data.phoneNumbers ?? []).map((n: any) => ({
                            number: n.number,
                            country: n.country,
                            type: n.type,
                        })),
                    },
                };
            }

            case 'sendWhatsApp': {
                const { from, to, type: msgType, text, hsm } = inputs;
                if (!from) return { error: 'MessageBird sendWhatsApp: from is required.' };
                if (!to) return { error: 'MessageBird sendWhatsApp: to is required.' };
                if (!msgType) return { error: 'MessageBird sendWhatsApp: type is required.' };

                const payload: Record<string, any> = { from, to, type: msgType };
                if (text) payload.content = { text: { body: text } };
                if (hsm) payload.content = { hsm };

                const data = await apiRequest(
                    'POST',
                    'https://whatsapp.messagebird.com/v1/messages',
                    payload
                );
                return { output: { id: data.id, status: data.status } };
            }

            case 'createConversation': {
                const { from, to, content } = inputs;
                if (!from) return { error: 'MessageBird createConversation: from is required.' };
                if (!to) return { error: 'MessageBird createConversation: to is required.' };
                if (!content) return { error: 'MessageBird createConversation: content is required.' };
                const data = await apiRequest(
                    'POST',
                    'https://conversations.messagebird.com/v1/conversations/start',
                    { from, to, type: 'whatsapp', content }
                );
                return { output: { id: data.id, status: data.status } };
            }

            case 'listLookup': {
                const { phoneNumber, countryCode } = inputs;
                if (!phoneNumber) return { error: 'MessageBird listLookup: phoneNumber is required.' };
                const qs = countryCode ? `?countryCode=${countryCode}` : '';
                const data = await apiRequest(
                    'GET',
                    `${restBase}/lookup/${encodeURIComponent(phoneNumber)}${qs}`
                );
                return {
                    output: {
                        phoneNumber: data.phoneNumber,
                        countryCode: data.countryCode,
                        type: data.type,
                        formats: data.formats ?? {},
                    },
                };
            }

            default:
                return { error: `MessageBird: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`MessageBird action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'MessageBird: An unexpected error occurred.' };
    }
}
