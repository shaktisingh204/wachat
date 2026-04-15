
'use server';

const CM_BASE = 'https://api.createsend.com/api/v3.3';

async function cmFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[CampaignMonitor] ${method} ${path}`);
    const auth = Buffer.from(`${apiKey}:x`).toString('base64');
    const url = `${CM_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
        throw new Error(data?.Message || data?.message || `Campaign Monitor API error: ${res.status}`);
    }
    return data;
}

export async function executeCampaignMonitorAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const cm = (method: string, path: string, body?: any) => cmFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listClients': {
                const data = await cm('GET', '/clients.json');
                return { output: { clients: data } };
            }
            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await cm('GET', `/clients/${clientId}.json`);
                return { output: data };
            }
            case 'createClient': {
                const companyName = String(inputs.companyName ?? '').trim();
                const country = String(inputs.country ?? '').trim();
                const timezone = String(inputs.timezone ?? '').trim();
                if (!companyName) throw new Error('companyName is required.');
                const data = await cm('POST', '/clients.json', { CompanyName: companyName, Country: country, TimeZone: timezone });
                return { output: { clientId: data } };
            }
            case 'listLists': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await cm('GET', `/clients/${clientId}/lists.json`);
                return { output: { lists: data } };
            }
            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await cm('GET', `/lists/${listId}.json`);
                return { output: data };
            }
            case 'createList': {
                const clientId = String(inputs.clientId ?? '').trim();
                const title = String(inputs.title ?? '').trim();
                if (!clientId || !title) throw new Error('clientId and title are required.');
                const body: any = { Title: title };
                if (inputs.unsubscribePage) body.UnsubscribePage = inputs.unsubscribePage;
                if (inputs.confirmOptIn !== undefined) body.ConfirmOptIn = inputs.confirmOptIn;
                const data = await cm('POST', `/lists/${clientId}.json`, body);
                return { output: { listId: data } };
            }
            case 'addSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                const body: any = { EmailAddress: email };
                if (inputs.name) body.Name = inputs.name;
                if (inputs.customFields) body.CustomFields = inputs.customFields;
                if (inputs.resubscribe !== undefined) body.Resubscribe = inputs.resubscribe;
                const data = await cm('POST', `/subscribers/${listId}.json`, body);
                return { output: { email: data } };
            }
            case 'importSubscribers': {
                const listId = String(inputs.listId ?? '').trim();
                const subscribers = inputs.subscribers;
                if (!listId) throw new Error('listId is required.');
                if (!Array.isArray(subscribers)) throw new Error('subscribers must be an array.');
                const body: any = { Subscribers: subscribers, Resubscribe: inputs.resubscribe ?? false };
                const data = await cm('POST', `/subscribers/${listId}/import.json`, body);
                return { output: data };
            }
            case 'unsubscribe': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                await cm('POST', `/subscribers/${listId}/unsubscribe.json`, { EmailAddress: email });
                return { output: { success: true } };
            }
            case 'deleteSubscriber': {
                const listId = String(inputs.listId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!listId || !email) throw new Error('listId and email are required.');
                await cm('DELETE', `/subscribers/${listId}.json?email=${encodeURIComponent(email)}`);
                return { output: { success: true } };
            }
            case 'listCampaigns': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await cm('GET', `/clients/${clientId}/campaigns.json`);
                return { output: { campaigns: data } };
            }
            case 'getCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await cm('GET', `/campaigns/${campaignId}/summary.json`);
                return { output: data };
            }
            case 'createCampaign': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: any = {
                    Name: inputs.name,
                    Subject: inputs.subject,
                    FromName: inputs.fromName,
                    FromEmail: inputs.fromEmail,
                    ReplyTo: inputs.replyTo,
                    HtmlUrl: inputs.htmlUrl,
                    ListIDs: inputs.listIds ?? [],
                    SegmentIDs: inputs.segmentIds ?? [],
                };
                const data = await cm('POST', `/campaigns/${clientId}.json`, body);
                return { output: { campaignId: data } };
            }
            case 'sendCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const body: any = {
                    ConfirmationEmail: inputs.confirmationEmail,
                    SendDate: inputs.sendDate ?? 'Immediately',
                };
                await cm('POST', `/campaigns/${campaignId}/send.json`, body);
                return { output: { success: true } };
            }
            case 'getCampaignStats': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await cm('GET', `/campaigns/${campaignId}/summary.json`);
                return { output: data };
            }
            case 'listTemplates': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await cm('GET', `/clients/${clientId}/templates.json`);
                return { output: { templates: data } };
            }
            default:
                throw new Error(`Unknown Campaign Monitor action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[CampaignMonitor] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
