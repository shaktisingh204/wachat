'use server';

export async function executeTextMagicAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://rest.textmagic.com/api/v2';
    const basicAuth = Buffer.from(`${inputs.username || ''}:${inputs.apiKey || ''}`).toString('base64');
    const headers: Record<string, string> = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text: inputs.text, phones: inputs.phones, from: inputs.from }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'sendBulkMessage': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text: inputs.text, phones: Array.isArray(inputs.phones) ? inputs.phones.join(',') : inputs.phones, from: inputs.from }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getMessageStatus': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${baseUrl}/messages?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteMessage': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.search) params.set('search', inputs.search);
                const res = await fetch(`${baseUrl}/contacts?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createContact': {
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ phone: inputs.phone, firstName: inputs.firstName, lastName: inputs.lastName, email: inputs.email, companyName: inputs.companyName }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ phone: inputs.phone, firstName: inputs.firstName, lastName: inputs.lastName, email: inputs.email, companyName: inputs.companyName }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listLists': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${baseUrl}/lists?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createList': {
                const res = await fetch(`${baseUrl}/lists`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name, description: inputs.description, shared: inputs.shared || false }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateList': {
                const res = await fetch(`${baseUrl}/lists/${inputs.listId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ name: inputs.name, description: inputs.description, shared: inputs.shared }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getBalance': {
                const res = await fetch(`${baseUrl}/user`, { headers });
                const data = await res.json();
                return { output: { balance: data.balance, currency: data.currency } };
            }
            case 'listScheduledMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.limit) params.set('limit', inputs.limit);
                const res = await fetch(`${baseUrl}/schedules?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createScheduledMessage': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ text: inputs.text, phones: inputs.phones, from: inputs.from, sendingDateTime: inputs.sendingDateTime, sendingTimezone: inputs.sendingTimezone || 'UTC' }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`TextMagic action error: ${err.message}`);
        return { error: err.message };
    }
}
