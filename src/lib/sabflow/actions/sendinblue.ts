'use server';

// Sendinblue v3 API — for legacy compatibility. For the newer Brevo API, see brevo.ts.
const SIB_BASE = 'https://api.sendinblue.com/v3';

async function sibFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Sendinblue] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${SIB_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Sendinblue API error: ${res.status}`);
    }
    return data;
}

export async function executesendinblueAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const sib = (method: string, path: string, body?: any) =>
            sibFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'sendEmail': {
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const htmlContent = String(inputs.htmlContent ?? '').trim();
                if (!to) throw new Error('to is required.');
                if (!subject) throw new Error('subject is required.');
                if (!htmlContent) throw new Error('htmlContent is required.');
                const body: any = {
                    to: [{ email: to }],
                    subject,
                    htmlContent,
                };
                if (inputs.sender) {
                    const sender =
                        typeof inputs.sender === 'string' ? JSON.parse(inputs.sender) : inputs.sender;
                    body.sender = sender;
                } else {
                    body.sender = { email: to };
                }
                if (inputs.replyTo) body.replyTo = { email: String(inputs.replyTo).trim() };
                if (inputs.params) {
                    body.params =
                        typeof inputs.params === 'string' ? JSON.parse(inputs.params) : inputs.params;
                }
                const data = await sib('POST', '/smtp/email', body);
                return { output: { messageId: data.messageId ?? '' } };
            }

            case 'sendTransactional': {
                const templateId = Number(inputs.templateId);
                const to = String(inputs.to ?? '').trim();
                if (!templateId) throw new Error('templateId is required.');
                if (!to) throw new Error('to is required.');
                const body: any = { templateId, to: [{ email: to }] };
                if (inputs.params) {
                    body.params =
                        typeof inputs.params === 'string' ? JSON.parse(inputs.params) : inputs.params;
                }
                const data = await sib('POST', '/smtp/email', body);
                return { output: { messageId: data.messageId ?? '' } };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                const attrs: any = {};
                if (inputs.firstName) attrs.FIRSTNAME = String(inputs.firstName).trim();
                if (inputs.lastName) attrs.LASTNAME = String(inputs.lastName).trim();
                if (inputs.attributes) {
                    const extra =
                        typeof inputs.attributes === 'string'
                            ? JSON.parse(inputs.attributes)
                            : inputs.attributes;
                    Object.assign(attrs, extra);
                }
                if (Object.keys(attrs).length) body.attributes = attrs;
                if (inputs.listIds) {
                    body.listIds = Array.isArray(inputs.listIds)
                        ? inputs.listIds.map(Number)
                        : String(inputs.listIds).split(',').map(Number);
                }
                const data = await sib('POST', '/contacts', body);
                return { output: { id: String(data.id ?? '') } };
            }

            case 'getContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await sib('GET', `/contacts/${encodeURIComponent(email)}`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        email: data.email ?? email,
                        attributes: data.attributes ?? {},
                    },
                };
            }

            case 'updateContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = {};
                if (inputs.attributes) {
                    body.attributes =
                        typeof inputs.attributes === 'string'
                            ? JSON.parse(inputs.attributes)
                            : inputs.attributes;
                }
                if (inputs.listIds) {
                    body.listIds = Array.isArray(inputs.listIds)
                        ? inputs.listIds.map(Number)
                        : String(inputs.listIds).split(',').map(Number);
                }
                if (inputs.unsubscribeFromList !== undefined) {
                    body.unlinkListIds = Array.isArray(inputs.unsubscribeFromList)
                        ? inputs.unsubscribeFromList.map(Number)
                        : String(inputs.unsubscribeFromList).split(',').map(Number);
                }
                await sib('PUT', `/contacts/${encodeURIComponent(email)}`, body);
                return { output: { updated: 'true', email } };
            }

            case 'deleteContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                await sib('DELETE', `/contacts/${encodeURIComponent(email)}`);
                return { output: { deleted: 'true', email } };
            }

            case 'listLists': {
                const data = await sib('GET', '/contacts/lists');
                return { output: { lists: data.lists ?? [] } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                const folderId = Number(inputs.folderId ?? 1);
                if (!name) throw new Error('name is required.');
                if (!folderId) throw new Error('folderId is required.');
                const data = await sib('POST', '/contacts/lists', { name, folderId });
                return { output: { id: String(data.id ?? '') } };
            }

            case 'addToList': {
                const listId = String(inputs.listId ?? '').trim();
                const emails = inputs.emails;
                if (!listId) throw new Error('listId is required.');
                if (!emails) throw new Error('emails is required.');
                const emailArr = Array.isArray(emails)
                    ? emails
                    : String(emails).split(',').map((e: string) => e.trim());
                await sib('POST', `/contacts/lists/${listId}/contacts/add`, { emails: emailArr });
                return { output: { added: 'true', listId, count: String(emailArr.length) } };
            }

            case 'removeFromList': {
                const listId = String(inputs.listId ?? '').trim();
                const emails = inputs.emails;
                if (!listId) throw new Error('listId is required.');
                if (!emails) throw new Error('emails is required.');
                const emailArr = Array.isArray(emails)
                    ? emails
                    : String(emails).split(',').map((e: string) => e.trim());
                await sib('POST', `/contacts/lists/${listId}/contacts/remove`, { emails: emailArr });
                return { output: { removed: 'true', listId, count: String(emailArr.length) } };
            }

            case 'listCampaigns': {
                let qs = '';
                const parts: string[] = [];
                if (inputs.type) parts.push(`type=${encodeURIComponent(String(inputs.type))}`);
                if (inputs.status) parts.push(`status=${encodeURIComponent(String(inputs.status))}`);
                if (parts.length) qs = `?${parts.join('&')}`;
                const data = await sib('GET', `/emailCampaigns${qs}`);
                return { output: { campaigns: data.campaigns ?? [] } };
            }

            case 'getCampaignStats': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await sib('GET', `/emailCampaigns/${campaignId}`);
                return { output: { statistics: data.statistics ?? {} } };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const sender = inputs.sender;
                const recipients = inputs.recipients;
                const htmlContent = String(inputs.htmlContent ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!subject) throw new Error('subject is required.');
                if (!sender) throw new Error('sender is required.');
                if (!recipients) throw new Error('recipients is required.');
                if (!htmlContent) throw new Error('htmlContent is required.');
                const body: any = {
                    name,
                    subject,
                    htmlContent,
                    sender: typeof sender === 'string' ? JSON.parse(sender) : sender,
                    recipients: typeof recipients === 'string' ? JSON.parse(recipients) : recipients,
                };
                const data = await sib('POST', '/emailCampaigns', body);
                return { output: { id: String(data.id ?? '') } };
            }

            default:
                return { error: `Sendinblue action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Sendinblue action failed.' };
    }
}
