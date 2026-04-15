'use server';

export async function executeInfobipAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrlHost = String(inputs.baseUrl ?? '').trim();
        if (!apiKey || !baseUrlHost) throw new Error('apiKey and baseUrl are required.');

        const baseUrl = `https://${baseUrlHost}`;
        const headers = {
            Authorization: `App ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const request = async (method: string, path: string, body?: any) => {
            const url = `${baseUrl}${path}`;
            logger.log(`[Infobip] ${method} ${url}`);
            const options: RequestInit = { method, headers };
            if (body && method !== 'GET') options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204 || res.status === 202) return { success: true };
            const data = await res.json();
            if (!res.ok) throw new Error(data?.requestError?.serviceException?.text || data?.message || `Infobip error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'sendSms': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!to || !text) throw new Error('to and text are required.');
                const data = await request('POST', '/sms/2/text/advanced', {
                    messages: [{ from: from || undefined, destinations: [{ to }], text }],
                });
                const msg = data.messages?.[0];
                return { output: { messageId: msg?.messageId, status: msg?.status?.name, bulkId: data.bulkId } };
            }

            case 'sendBulkSms': {
                const messages = inputs.messages;
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array is required.');
                const data = await request('POST', '/sms/2/text/advanced', { messages });
                return { output: { bulkId: data.bulkId, messageCount: data.messages?.length ?? 0, messages: data.messages } };
            }

            case 'sendWhatsApp': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!to || !from || !text) throw new Error('to, from, and text are required.');
                const data = await request('POST', '/whatsapp/1/message/text', {
                    from,
                    to,
                    content: { text },
                });
                return { output: { messageId: data.messages?.[0]?.messageId, status: data.messages?.[0]?.status?.name } };
            }

            case 'sendWhatsAppTemplate': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const templateName = String(inputs.templateName ?? '').trim();
                const language = String(inputs.language ?? 'en').trim();
                if (!to || !from || !templateName) throw new Error('to, from, and templateName are required.');
                const data = await request('POST', '/whatsapp/1/message/template', {
                    from,
                    to,
                    content: {
                        templateName,
                        templateData: {
                            body: { placeholders: inputs.placeholders ?? [] },
                        },
                        language,
                    },
                });
                return { output: { messageId: data.messages?.[0]?.messageId, status: data.messages?.[0]?.status?.name } };
            }

            case 'sendEmail': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const text = String(inputs.text ?? inputs.html ?? '').trim();
                if (!to || !from || !subject) throw new Error('to, from, and subject are required.');
                const formData = new FormData();
                formData.append('to', to);
                formData.append('from', from);
                formData.append('subject', subject);
                if (inputs.html) formData.append('html', inputs.html);
                else formData.append('text', text);
                const res = await fetch(`${baseUrl}/email/3/send`, {
                    method: 'POST',
                    headers: { Authorization: `App ${apiKey}` },
                    body: formData,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.requestError?.serviceException?.text || `Infobip email error: ${res.status}`);
                return { output: { messageId: data.messages?.[0]?.messageId, status: data.messages?.[0]?.status?.name } };
            }

            case 'sendEmailBulk': {
                const messages = inputs.messages;
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array is required.');
                const data = await request('POST', '/email/3/bulk', { messages });
                return { output: { bulkId: data.bulkId, count: messages.length } };
            }

            case 'getDeliveryReports': {
                const params = new URLSearchParams();
                if (inputs.bulkId) params.set('bulkId', String(inputs.bulkId));
                if (inputs.messageId) params.set('messageId', String(inputs.messageId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/sms/1/reports?${params.toString()}`);
                return { output: { results: data.results ?? [], count: data.results?.length ?? 0 } };
            }

            case 'getSmsLogs': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', String(inputs.from));
                if (inputs.to) params.set('to', String(inputs.to));
                if (inputs.bulkId) params.set('bulkId', String(inputs.bulkId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/sms/1/logs?${params.toString()}`);
                return { output: { results: data.results ?? [], count: data.results?.length ?? 0 } };
            }

            case 'getEmailLogs': {
                const params = new URLSearchParams();
                if (inputs.messageId) params.set('messageId', String(inputs.messageId));
                if (inputs.bulkId) params.set('bulkId', String(inputs.bulkId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/email/1/logs?${params.toString()}`);
                return { output: { results: data.results ?? [], count: data.results?.length ?? 0 } };
            }

            case 'sendVoice': {
                const to = String(inputs.to ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                const text = String(inputs.text ?? '').trim();
                if (!to || !from || !text) throw new Error('to, from, and text are required.');
                const data = await request('POST', '/tts/3/single', {
                    from,
                    to,
                    text,
                    language: inputs.language ?? 'en',
                    voice: inputs.voice ?? { name: 'Joanna', gender: 'female' },
                });
                return { output: { messageId: data.messageId, status: data.status?.name } };
            }

            case 'createFlow': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await request('POST', '/moments/1/flows', {
                    name,
                    description: inputs.description ?? '',
                    draft: inputs.draft ?? true,
                });
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'triggerFlow': {
                const flowId = String(inputs.flowId ?? '').trim();
                if (!flowId) throw new Error('flowId is required.');
                const data = await request('POST', `/moments/1/flows/${flowId}/participants`, {
                    participants: inputs.participants ?? [],
                });
                return { output: { flowId, participants: data.participants ?? [], processedCount: data.processedCount } };
            }

            case 'getFlowStats': {
                const flowId = String(inputs.flowId ?? '').trim();
                if (!flowId) throw new Error('flowId is required.');
                const data = await request('GET', `/moments/1/flows/${flowId}/statistics`);
                return { output: data };
            }

            case 'lookupPhone': {
                const to = String(inputs.to ?? '').trim();
                if (!to) throw new Error('to (phone number) is required.');
                const encoded = encodeURIComponent(to);
                const data = await request('GET', `/number/1/info/${encoded}`);
                return { output: { number: data.to, countryCode: data.countryCode, networkName: data.networkName, numberType: data.numberType } };
            }

            case 'verifyPhone': {
                const to = String(inputs.to ?? '').trim();
                const applicationId = String(inputs.applicationId ?? '').trim();
                if (!to || !applicationId) throw new Error('to and applicationId are required.');
                const data = await request('POST', '/2fa/2/pin', {
                    applicationId,
                    to,
                    from: inputs.from ?? undefined,
                });
                return { output: { pinId: data.pinId, to: data.to, ncStatus: data.ncStatus, smsStatus: data.smsStatus } };
            }

            default:
                return { error: `Infobip action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Infobip action failed.' };
    }
}
