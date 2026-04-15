'use server';

export async function executeClickSendEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const username = String(inputs.username ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!username || !apiKey) throw new Error('username and apiKey are required.');

        const baseUrl = 'https://rest.clicksend.com/v3';
        const authHeader = 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64');

        const request = async (method: string, path: string, body?: any) => {
            const url = `${baseUrl}${path}`;
            logger.log(`[ClickSendEnhanced] ${method} ${url}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: authHeader,
                    'Content-Type': 'application/json',
                },
            };
            if (body && method !== 'GET') options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            const data = await res.json();
            if (!res.ok || data.response_code !== 'SUCCESS') {
                throw new Error(data?.response_msg || data?.message || `ClickSend error: ${res.status}`);
            }
            return data.data ?? data;
        };

        switch (actionName) {
            case 'sendSms': {
                const to = String(inputs.to ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                const from = String(inputs.from ?? '').trim();
                if (!to || !body) throw new Error('to and body are required.');
                const data = await request('POST', '/sms/send', {
                    messages: [{ to, body, from: from || undefined, source: 'sdk' }],
                });
                const msg = data.messages?.data?.[0];
                return { output: { messageId: msg?.message_id, status: msg?.status, to: msg?.to } };
            }

            case 'sendBulkSms': {
                const messages = inputs.messages;
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array is required.');
                const data = await request('POST', '/sms/send', { messages });
                return { output: { queued: data.messages?.queued_count ?? 0, total: data.messages?.data?.length ?? 0 } };
            }

            case 'sendMms': {
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const mediaFile = String(inputs.mediaFile ?? '').trim();
                if (!to || !subject || !mediaFile) throw new Error('to, subject, and mediaFile are required.');
                const data = await request('POST', '/mms/send', {
                    messages: [{
                        to,
                        subject,
                        media_file: mediaFile,
                        body: inputs.body ?? '',
                        from: inputs.from ?? undefined,
                    }],
                });
                const msg = data.messages?.data?.[0];
                return { output: { messageId: msg?.message_id, status: msg?.status } };
            }

            case 'sendEmail': {
                const to = inputs.to;
                const from = inputs.from;
                const subject = String(inputs.subject ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !from || !subject || !body) throw new Error('to, from, subject, and body are required.');
                const toList = Array.isArray(to) ? to : [{ email: to, name: inputs.toName ?? '' }];
                const data = await request('POST', '/email/send', {
                    to: toList,
                    from: { email: typeof from === 'string' ? from : from.email, name: inputs.fromName ?? '' },
                    subject,
                    body,
                });
                return { output: { messageId: data.email_id, status: data.status } };
            }

            case 'sendBulkEmail': {
                const emails = inputs.emails;
                if (!Array.isArray(emails) || emails.length === 0) throw new Error('emails array is required.');
                const results = await Promise.all(emails.map((email: any) =>
                    request('POST', '/email/send', email).catch((e: any) => ({ error: e.message }))
                ));
                return { output: { results, count: results.length } };
            }

            case 'sendVoice': {
                const to = String(inputs.to ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!to || !body) throw new Error('to and body are required.');
                const data = await request('POST', '/voice/send', {
                    messages: [{
                        to,
                        body,
                        lang: inputs.lang ?? 'en-us',
                        voice: inputs.voice ?? 'female',
                        custom_string: inputs.customString ?? '',
                    }],
                });
                const msg = data.messages?.data?.[0];
                return { output: { messageId: msg?.message_id, status: msg?.status } };
            }

            case 'sendPostcard': {
                const to = inputs.to;
                const message = String(inputs.message ?? '').trim();
                if (!to || !message) throw new Error('to and message are required.');
                const data = await request('POST', '/post/postcards/send', {
                    recipient: typeof to === 'string' ? { address_line_1: to } : to,
                    message,
                    template_used: inputs.templateUsed ?? 1,
                });
                return { output: { postcardId: data.postcard_id, status: data.status } };
            }

            case 'sendFax': {
                const to = String(inputs.to ?? '').trim();
                const fileUrl = String(inputs.fileUrl ?? '').trim();
                if (!to || !fileUrl) throw new Error('to and fileUrl are required.');
                const data = await request('POST', '/fax/send', {
                    messages: [{ to, file_url: fileUrl }],
                });
                const msg = data.messages?.data?.[0];
                return { output: { messageId: msg?.message_id, status: msg?.status } };
            }

            case 'getSmsHistory': {
                const params = new URLSearchParams();
                if (inputs.dateFrom) params.set('date_from', String(inputs.dateFrom));
                if (inputs.dateTo) params.set('date_to', String(inputs.dateTo));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/sms/history?${params.toString()}`);
                return { output: { messages: data.data ?? [], total: data.total ?? 0, page: data.current_page } };
            }

            case 'getEmailHistory': {
                const params = new URLSearchParams();
                if (inputs.dateFrom) params.set('date_from', String(inputs.dateFrom));
                if (inputs.dateTo) params.set('date_to', String(inputs.dateTo));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/email/history?${params.toString()}`);
                return { output: { emails: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'listContacts': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/lists/${listId}/contacts?${params.toString()}`);
                return { output: { contacts: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'createContact': {
                const listId = String(inputs.listId ?? '').trim();
                const phoneNumber = String(inputs.phoneNumber ?? '').trim();
                if (!listId || !phoneNumber) throw new Error('listId and phoneNumber are required.');
                const data = await request('POST', `/lists/${listId}/contacts`, {
                    phone_number: phoneNumber,
                    first_name: inputs.firstName ?? '',
                    last_name: inputs.lastName ?? '',
                    email: inputs.email ?? '',
                    custom_s1: inputs.customS1 ?? '',
                    custom_s2: inputs.customS2 ?? '',
                });
                return { output: { contactId: data.contact_id, phoneNumber: data.phone_number, listId } };
            }

            case 'listContactLists': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const data = await request('GET', `/lists?${params.toString()}`);
                return { output: { lists: data.data ?? [], total: data.total ?? 0 } };
            }

            case 'createContactList': {
                const listName = String(inputs.listName ?? '').trim();
                if (!listName) throw new Error('listName is required.');
                const data = await request('POST', '/lists', { list_name: listName });
                return { output: { listId: data.list_id, listName: data.list_name } };
            }

            case 'getBalance': {
                const data = await request('GET', '/account');
                return { output: { balance: data.balance, currencySymbol: data.currency?.currency_symbol, currencyCode: data.currency?.currency_code } };
            }

            default:
                return { error: `ClickSendEnhanced action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'ClickSendEnhanced action failed.' };
    }
}
