'use server';

const GR_BASE = 'https://api.getresponse.com/v3';

async function grFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[GetResponse] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-Auth-Token': `api-key ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${GR_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || data?.codeDescription || `GetResponse API error: ${res.status}`);
    }
    return data;
}

export async function executeGetresponseAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const gr = (method: string, path: string, body?: any) =>
            grFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const params: string[] = [];
                if (inputs.listId) params.push(`query[campaignId]=${encodeURIComponent(String(inputs.listId))}`);
                if (inputs.page) params.push(`page=${Number(inputs.page)}`);
                if (inputs.perPage) params.push(`perPage=${Number(inputs.perPage)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await gr('GET', `/contacts${qs}`);
                return { output: { contacts: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await gr('GET', `/contacts/${contactId}`);
                return { output: { contactId: data.contactId ?? contactId, email: data.email ?? '', name: data.name ?? '', campaign: data.campaign ?? {} } };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!email || !campaignId) throw new Error('email and campaignId are required.');
                const body: any = { email, campaign: { campaignId } };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.dayOfCycle !== undefined && inputs.dayOfCycle !== '') {
                    body.dayOfCycle = String(Number(inputs.dayOfCycle));
                }
                const data = await gr('POST', '/contacts', body);
                return { output: { contactId: data?.contactId ?? '', email: data?.email ?? email } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.dayOfCycle !== undefined && inputs.dayOfCycle !== '') {
                    body.dayOfCycle = String(Number(inputs.dayOfCycle));
                }
                const data = await gr('POST', `/contacts/${contactId}`, body);
                return { output: { contactId: data?.contactId ?? contactId } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await gr('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true', contactId } };
            }

            case 'listCampaigns': {
                const data = await gr('GET', '/campaigns');
                return { output: { campaigns: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await gr('GET', `/campaigns/${campaignId}`);
                return { output: { campaignId: data?.campaignId ?? campaignId, name: data?.name ?? '' } };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                if (!name || !fromEmail || !fromName) throw new Error('name, fromEmail, and fromName are required.');
                const body: any = { name, from: { email: fromEmail, name: fromName } };
                if (inputs.replyToEmail) body.replyTo = { email: String(inputs.replyToEmail) };
                const data = await gr('POST', '/campaigns', body);
                return { output: { campaignId: data?.campaignId ?? '', name: data?.name ?? name } };
            }

            case 'updateCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.fromEmail || inputs.fromName) {
                    body.from = {};
                    if (inputs.fromEmail) body.from.email = String(inputs.fromEmail);
                    if (inputs.fromName) body.from.name = String(inputs.fromName);
                }
                const data = await gr('POST', `/campaigns/${campaignId}`, body);
                return { output: { campaignId: data?.campaignId ?? campaignId, name: data?.name ?? '' } };
            }

            case 'listAutoresponders': {
                const data = await gr('GET', '/autoresponders');
                return { output: { autoresponders: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getAutoresponder': {
                const autoresponderId = String(inputs.autoresponderId ?? '').trim();
                if (!autoresponderId) throw new Error('autoresponderId is required.');
                const data = await gr('GET', `/autoresponders/${autoresponderId}`);
                return { output: { autoresponderId: data?.autoresponderId ?? autoresponderId, name: data?.name ?? '', subject: data?.subject ?? '' } };
            }

            case 'createNewsletterDraft': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!name || !subject) throw new Error('name and subject are required.');
                const body: any = { name, subject, type: 'draft' };
                if (inputs.fromField) body.fromField = typeof inputs.fromField === 'string' ? JSON.parse(inputs.fromField) : inputs.fromField;
                if (inputs.toFields) body.toFields = Array.isArray(inputs.toFields) ? inputs.toFields : (typeof inputs.toFields === 'string' ? JSON.parse(inputs.toFields) : [inputs.toFields]);
                if (inputs.content) body.content = typeof inputs.content === 'string' ? { html: inputs.content } : inputs.content;
                const data = await gr('POST', '/newsletters', body);
                return { output: { newsletterId: data?.newsletterId ?? '', name: data?.name ?? name } };
            }

            case 'sendNewsletter': {
                const newsletterId = String(inputs.newsletterId ?? '').trim();
                if (!newsletterId) throw new Error('newsletterId is required.');
                await gr('POST', `/newsletters/${newsletterId}/send`);
                return { output: { sent: 'true', newsletterId } };
            }

            case 'listLandingPages': {
                const data = await gr('GET', '/landing-pages');
                return { output: { landingPages: Array.isArray(data) ? data : [], total: String(Array.isArray(data) ? data.length : 0) } };
            }

            case 'getAccountInfo': {
                const data = await gr('GET', '/accounts');
                return { output: { accountId: data?.accountId ?? '', email: data?.email ?? '', firstName: data?.firstName ?? '', lastName: data?.lastName ?? '' } };
            }

            default:
                return { error: `GetResponse action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'GetResponse action failed.' };
    }
}
