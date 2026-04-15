'use server';

const SENDPULSE_BASE = 'https://api.sendpulse.com';

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    const res = await fetch(`${SENDPULSE_BASE}/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `SendPulse auth error: ${res.status}`);
    return data.access_token as string;
}

async function spFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[SendPulse] ${method} ${path}`);
    const opts: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(`${SENDPULSE_BASE}${path}`, opts);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `SendPulse API error: ${res.status}`);
    return data;
}

export async function executeSendPulseAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const clientId = String(inputs.clientId ?? '').trim();
        const clientSecret = String(inputs.clientSecret ?? '').trim();
        if (!clientId) throw new Error('clientId is required.');
        if (!clientSecret) throw new Error('clientSecret is required.');

        const token = await getAccessToken(clientId, clientSecret);
        const sp = (method: string, path: string, body?: any) => spFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listMailingLists': {
                const limit = inputs.limit ?? 100;
                const offset = inputs.offset ?? 0;
                const data = await sp('GET', `/addressbooks?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getMailingList': {
                const id = inputs.listId ?? inputs.id;
                if (!id) throw new Error('listId is required.');
                const data = await sp('GET', `/addressbooks/${id}`);
                return { output: data };
            }
            case 'createMailingList': {
                const name = inputs.name;
                if (!name) throw new Error('name is required.');
                const data = await sp('POST', '/addressbooks', { bookName: name });
                return { output: data };
            }
            case 'addEmailsToList': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const emails = inputs.emails;
                if (!emails || !Array.isArray(emails)) throw new Error('emails array is required.');
                const data = await sp('POST', `/addressbooks/${listId}/emails`, { emails });
                return { output: data };
            }
            case 'deleteEmailFromList': {
                const listId = inputs.listId;
                if (!listId) throw new Error('listId is required.');
                const email = inputs.email;
                if (!email) throw new Error('email is required.');
                const data = await sp('DELETE', `/addressbooks/${listId}/emails`, { emails: [{ email }] });
                return { output: data };
            }
            case 'sendSmtpEmail': {
                const email = inputs.email;
                if (!email) throw new Error('email object is required.');
                const data = await sp('POST', '/smtp/emails', { email });
                return { output: data };
            }
            case 'sendSmsCampaign': {
                const payload: any = {
                    sender: inputs.sender,
                    phones: inputs.phones,
                    body: inputs.body,
                };
                if (inputs.date) payload.date = inputs.date;
                const data = await sp('POST', '/sms/send', payload);
                return { output: data };
            }
            case 'listCampaigns': {
                const limit = inputs.limit ?? 100;
                const offset = inputs.offset ?? 0;
                const data = await sp('GET', `/campaigns?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getCampaign': {
                const id = inputs.campaignId ?? inputs.id;
                if (!id) throw new Error('campaignId is required.');
                const data = await sp('GET', `/campaigns/${id}`);
                return { output: data };
            }
            case 'createCampaign': {
                const payload: any = {
                    senderName: inputs.senderName,
                    senderEmail: inputs.senderEmail,
                    subject: inputs.subject,
                    body: inputs.body,
                    list_id: inputs.listId,
                };
                if (inputs.name) payload.name = inputs.name;
                if (inputs.templateId) payload.template_id = inputs.templateId;
                const data = await sp('POST', '/campaigns', payload);
                return { output: data };
            }
            case 'sendCampaign': {
                const id = inputs.campaignId ?? inputs.id;
                if (!id) throw new Error('campaignId is required.');
                const data = await sp('POST', `/campaigns/${id}/send`);
                return { output: data };
            }
            case 'listTemplates': {
                const limit = inputs.limit ?? 100;
                const offset = inputs.offset ?? 0;
                const data = await sp('GET', `/templates?limit=${limit}&offset=${offset}`);
                return { output: data };
            }
            case 'getTemplate': {
                const id = inputs.templateId ?? inputs.id;
                if (!id) throw new Error('templateId is required.');
                const data = await sp('GET', `/templates/${id}`);
                return { output: data };
            }
            case 'createTemplate': {
                const payload: any = {
                    name: inputs.name,
                    body: inputs.body,
                };
                if (inputs.lang) payload.lang = inputs.lang;
                if (inputs.subject) payload.subject = inputs.subject;
                const data = await sp('POST', '/templates', payload);
                return { output: data };
            }
            case 'getStats': {
                const id = inputs.campaignId ?? inputs.id;
                if (!id) throw new Error('campaignId is required.');
                const data = await sp('GET', `/campaigns/${id}/statistic`);
                return { output: data };
            }
            default:
                throw new Error(`Unknown SendPulse action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[SendPulse] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'SendPulse action failed.' };
    }
}
