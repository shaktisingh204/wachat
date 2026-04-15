
'use server';

const BREVO_BASE = 'https://api.brevo.com/v3';

async function brevoFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Brevo] ${method} ${path}`);
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
    if (res.status === 204 || res.status === 201 && res.headers.get('content-length') === '0') return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Brevo API error: ${res.status}`);
    }
    return data;
}

export async function executeBrevoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const bv = (method: string, path: string, body?: any) => brevoFetch(apiKey, method, path, body, logger);

        switch (actionName) {
            case 'sendTransactionalEmail': {
                const toEmail = String(inputs.toEmail ?? '').trim();
                const toName = String(inputs.toName ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const htmlContent = String(inputs.htmlContent ?? '').trim();
                const textContent = String(inputs.textContent ?? '').trim();
                if (!toEmail || !fromEmail || !subject) throw new Error('toEmail, fromEmail, and subject are required.');
                const body: any = {
                    to: [{ email: toEmail, name: toName || undefined }],
                    sender: { email: fromEmail, name: fromName || undefined },
                    subject,
                };
                if (htmlContent) body.htmlContent = htmlContent;
                if (textContent) body.textContent = textContent;
                const data = await bv('POST', '/smtp/email', body);
                return { output: { messageId: data.messageId ?? '', status: 'sent' } };
            }

            case 'sendTemplateEmail': {
                const templateId = Number(inputs.templateId);
                const toEmail = String(inputs.toEmail ?? '').trim();
                const params = inputs.params;
                if (!templateId || !toEmail) throw new Error('templateId and toEmail are required.');
                const body: any = { to: [{ email: toEmail }], templateId };
                if (params) body.params = typeof params === 'string' ? JSON.parse(params) : params;
                const data = await bv('POST', '/smtp/email', body);
                return { output: { messageId: data.messageId ?? '', status: 'sent' } };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                const listIds = inputs.listIds;
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (firstName || lastName) body.attributes = { FIRSTNAME: firstName, LASTNAME: lastName };
                if (listIds) {
                    body.listIds = Array.isArray(listIds) ? listIds.map(Number) : (String(listIds).split(',').map(Number));
                }
                const data = await bv('POST', '/contacts', body);
                return { output: { id: String(data.id ?? ''), email } };
            }

            case 'updateContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = {};
                if (inputs.firstName || inputs.lastName) {
                    body.attributes = { FIRSTNAME: String(inputs.firstName ?? ''), LASTNAME: String(inputs.lastName ?? '') };
                }
                if (inputs.listIds) {
                    body.listIds = Array.isArray(inputs.listIds) ? inputs.listIds.map(Number) : String(inputs.listIds).split(',').map(Number);
                }
                await bv('PUT', `/contacts/${encodeURIComponent(email)}`, body);
                return { output: { updated: 'true', email } };
            }

            case 'getContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await bv('GET', `/contacts/${encodeURIComponent(email)}`);
                return { output: { id: String(data.id ?? ''), email: data.email, attributes: data.attributes ?? {}, listIds: data.listIds ?? [] } };
            }

            case 'deleteContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                await bv('DELETE', `/contacts/${encodeURIComponent(email)}`);
                return { output: { deleted: 'true', email } };
            }

            case 'addToList': {
                const listId = String(inputs.listId ?? '').trim();
                const emails = inputs.emails;
                if (!listId || !emails) throw new Error('listId and emails are required.');
                const emailArr = Array.isArray(emails) ? emails : String(emails).split(',').map((e: string) => e.trim());
                const data = await bv('POST', `/contacts/lists/${listId}/contacts/add`, { emails: emailArr });
                return { output: { contacts: String(data.contacts ?? emailArr.length), listId } };
            }

            case 'removeFromList': {
                const listId = String(inputs.listId ?? '').trim();
                const emails = inputs.emails;
                if (!listId || !emails) throw new Error('listId and emails are required.');
                const emailArr = Array.isArray(emails) ? emails : String(emails).split(',').map((e: string) => e.trim());
                const data = await bv('POST', `/contacts/lists/${listId}/contacts/remove`, { emails: emailArr });
                return { output: { contacts: String(data.contacts ?? 0), listId } };
            }

            case 'createSmsMessage': {
                const sender = String(inputs.sender ?? '').trim();
                const recipient = String(inputs.recipient ?? '').trim();
                const content = String(inputs.content ?? '').trim();
                if (!sender || !recipient || !content) throw new Error('sender, recipient, and content are required.');
                const data = await bv('POST', '/transactionalSMS/sms', { sender, recipient, content });
                return { output: { reference: data.reference ?? '', remainingCredits: String(data.remainingCredits ?? 0) } };
            }

            case 'sendWhatsappTemplate': {
                const contactNumbers = inputs.contactNumbers;
                const templateId = Number(inputs.templateId);
                if (!contactNumbers || !templateId) throw new Error('contactNumbers and templateId are required.');
                const numbers = Array.isArray(contactNumbers) ? contactNumbers : String(contactNumbers).split(',').map((n: string) => n.trim());
                const data = await bv('POST', '/whatsapp/sendTemplate', { contactNumbers: numbers, templateId });
                return { output: { messageId: data.messageId ?? '' } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                const folderId = Number(inputs.folderId ?? 1);
                if (!name) throw new Error('name is required.');
                const data = await bv('POST', '/contacts/lists', { name, folderId });
                return { output: { id: String(data.id ?? ''), name } };
            }

            case 'getEmailStats': {
                const startDate = String(inputs.startDate ?? '').trim();
                const endDate = String(inputs.endDate ?? '').trim();
                if (!startDate || !endDate) throw new Error('startDate and endDate are required.');
                const data = await bv('GET', `/smtp/statistics/reports?startDate=${startDate}&endDate=${endDate}`);
                return { output: { reports: data.reports ?? [] } };
            }

            default:
                return { error: `Brevo action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Brevo action failed.' };
    }
}
