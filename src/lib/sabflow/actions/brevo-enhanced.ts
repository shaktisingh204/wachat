'use server';

const BREVO_BASE = 'https://api.brevo.com/v3';

async function brevoFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[BrevoEnhanced] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${BREVO_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `Brevo API error: ${res.status}`);
    return data;
}

export async function executeBrevoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const bv = (method: string, path: string, body?: any) => brevoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'sendTransactionalEmail': {
                const payload: any = {
                    to: inputs.to,
                    subject: inputs.subject,
                    htmlContent: inputs.htmlContent,
                };
                if (inputs.sender) payload.sender = inputs.sender;
                if (inputs.textContent) payload.textContent = inputs.textContent;
                if (inputs.templateId) payload.templateId = Number(inputs.templateId);
                if (inputs.params) payload.params = inputs.params;
                const data = await bv('POST', '/smtp/email', payload);
                return { output: data };
            }
            case 'sendSMS': {
                const data = await bv('POST', '/transactionalSMS/sms', {
                    sender: inputs.sender,
                    recipient: inputs.recipient,
                    content: inputs.content,
                    type: inputs.type ?? 'transactional',
                });
                return { output: data };
            }
            case 'createContact': {
                const payload: any = { email: inputs.email };
                if (inputs.attributes) payload.attributes = inputs.attributes;
                if (inputs.listIds) payload.listIds = inputs.listIds;
                if (inputs.updateEnabled !== undefined) payload.updateEnabled = inputs.updateEnabled;
                const data = await bv('POST', '/contacts', payload);
                return { output: data };
            }
            case 'updateContact': {
                const identifier = encodeURIComponent(inputs.identifier ?? inputs.email);
                const payload: any = {};
                if (inputs.attributes) payload.attributes = inputs.attributes;
                if (inputs.listIds) payload.listIds = inputs.listIds;
                if (inputs.unlinkListIds) payload.unlinkListIds = inputs.unlinkListIds;
                await bv('PUT', `/contacts/${identifier}`, payload);
                return { output: { success: true, identifier } };
            }
            case 'getContact': {
                const identifier = encodeURIComponent(inputs.identifier ?? inputs.email);
                const data = await bv('GET', `/contacts/${identifier}`);
                return { output: data };
            }
            case 'deleteContact': {
                const identifier = encodeURIComponent(inputs.identifier ?? inputs.email);
                await bv('DELETE', `/contacts/${identifier}`);
                return { output: { success: true, identifier } };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.sort) params.set('sort', inputs.sort);
                const data = await bv('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }
            case 'addToList': {
                const listId = inputs.listId;
                const data = await bv('POST', `/contacts/lists/${listId}/contacts/add`, {
                    emails: inputs.emails,
                });
                return { output: data };
            }
            case 'removeFromList': {
                const listId = inputs.listId;
                const data = await bv('POST', `/contacts/lists/${listId}/contacts/remove`, {
                    emails: inputs.emails,
                });
                return { output: data };
            }
            case 'createList': {
                const data = await bv('POST', '/contacts/lists', {
                    name: inputs.name,
                    folderId: inputs.folderId ? Number(inputs.folderId) : 1,
                });
                return { output: data };
            }
            case 'listLists': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const data = await bv('GET', `/contacts/lists?${params.toString()}`);
                return { output: data };
            }
            case 'createEmailCampaign': {
                const payload: any = {
                    name: inputs.name,
                    subject: inputs.subject,
                    sender: inputs.sender,
                    recipients: inputs.recipients,
                };
                if (inputs.htmlContent) payload.htmlContent = inputs.htmlContent;
                if (inputs.templateId) payload.templateId = Number(inputs.templateId);
                if (inputs.scheduledAt) payload.scheduledAt = inputs.scheduledAt;
                const data = await bv('POST', '/emailCampaigns', payload);
                return { output: data };
            }
            case 'sendEmailCampaign': {
                const campaignId = inputs.campaignId;
                await bv('POST', `/emailCampaigns/${campaignId}/sendNow`);
                return { output: { success: true, campaignId } };
            }
            case 'getCampaignStats': {
                const campaignId = inputs.campaignId;
                const data = await bv('GET', `/emailCampaigns/${campaignId}`);
                return { output: data };
            }
            case 'createEmailTemplate': {
                const payload: any = {
                    templateName: inputs.templateName,
                    subject: inputs.subject,
                    htmlContent: inputs.htmlContent,
                    sender: inputs.sender,
                };
                if (inputs.isActive !== undefined) payload.isActive = inputs.isActive;
                const data = await bv('POST', '/smtp/templates', payload);
                return { output: data };
            }
            default:
                return { error: `Unknown Brevo Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[BrevoEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
