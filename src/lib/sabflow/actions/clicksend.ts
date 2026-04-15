'use server';

export async function executeClicksendAction(actionName: string, inputs: any, user: any, logger: any) {
    const { username, apiKey } = inputs;
    const base64Auth = Buffer.from(`${username}:${apiKey}`).toString('base64');
    const baseUrl = 'https://rest.clicksend.com/v3';
    const authHeader = `Basic ${base64Auth}`;

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${baseUrl}/sms/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            to: inputs.to,
                            body: inputs.body,
                            from: inputs.from || undefined,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendBulkSMS': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : JSON.parse(inputs.messages);
                const res = await fetch(`${baseUrl}/sms/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'listSMSHistory': {
                const params = new URLSearchParams();
                if (inputs.date_from) params.set('date_from', inputs.date_from);
                if (inputs.date_to) params.set('date_to', inputs.date_to);
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${baseUrl}/sms/history?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendMMS': {
                const res = await fetch(`${baseUrl}/mms/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            to: inputs.to,
                            body: inputs.body,
                            from: inputs.from || undefined,
                            media_file: inputs.mediaFile || undefined,
                            subject: inputs.subject || undefined,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendEmail': {
                const res = await fetch(`${baseUrl}/email/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        to: [{ email: inputs.toEmail, name: inputs.toName || '' }],
                        from: { email: inputs.fromEmail, name: inputs.fromName || '' },
                        subject: inputs.subject,
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendVoice': {
                const res = await fetch(`${baseUrl}/voice/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            to: inputs.to,
                            body: inputs.body,
                            voice: inputs.voice || 'female',
                            lang: inputs.lang || 'en-us',
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendFax': {
                const res = await fetch(`${baseUrl}/fax/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            to: inputs.to,
                            file_url: inputs.fileUrl,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'sendPostcard': {
                const res = await fetch(`${baseUrl}/post/postcards/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipients: [{
                            address_name: inputs.recipientName,
                            address_line_1: inputs.addressLine1,
                            address_city: inputs.city,
                            address_country: inputs.country,
                        }],
                        template_id: inputs.templateId || undefined,
                        custom_front: inputs.customFront || undefined,
                        custom_back: inputs.customBack || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'listContacts': {
                const listId = inputs.listId;
                const res = await fetch(`${baseUrl}/lists/${listId}/contacts`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'createContact': {
                const listId = inputs.listId;
                const res = await fetch(`${baseUrl}/lists/${listId}/contacts`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        phone_number: inputs.phoneNumber,
                        first_name: inputs.firstName || '',
                        last_name: inputs.lastName || '',
                        email: inputs.email || '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'createContactList': {
                const res = await fetch(`${baseUrl}/lists`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ list_name: inputs.listName }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'listContactLists': {
                const res = await fetch(`${baseUrl}/lists`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'uploadMedia': {
                const res = await fetch(`${baseUrl}/uploads`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        convert: inputs.convert || 'mms',
                        content: inputs.content,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            case 'getBalance': {
                const res = await fetch(`${baseUrl}/account`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: { balance: data.data?.balance, currency: data.data?.currency } };
            }

            case 'listCountries': {
                const res = await fetch(`${baseUrl}/countries`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.response_msg || JSON.stringify(data) };
                return { output: data.data };
            }

            default:
                return { error: `Unknown ClickSend action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ClickSend action error: ${err.message}`);
        return { error: err.message };
    }
}
