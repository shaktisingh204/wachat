
'use server';

const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

async function sgPost(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[SendGrid] POST ${path}`);
    const res = await fetch(`${SENDGRID_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    if (res.status === 204) return { ok: true };
    const data = await res.json();
    if (!res.ok) {
        const errMsg = data?.errors?.[0]?.message || `SendGrid API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

async function sgGet(apiKey: string, path: string, logger: any) {
    logger.log(`[SendGrid] GET ${path}`);
    const res = await fetch(`${SENDGRID_BASE}${path}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    const data = await res.json();
    if (!res.ok) {
        const errMsg = data?.errors?.[0]?.message || `SendGrid API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

async function sgDelete(apiKey: string, path: string, logger: any) {
    logger.log(`[SendGrid] DELETE ${path}`);
    const res = await fetch(`${SENDGRID_BASE}${path}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`SendGrid DELETE error: ${res.status}`);
    return { ok: true };
}

async function sgPatch(apiKey: string, path: string, body: any, logger: any) {
    logger.log(`[SendGrid] PATCH ${path}`);
    const res = await fetch(`${SENDGRID_BASE}${path}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.errors?.[0]?.message || `SendGrid PATCH error: ${res.status}`);
    return data;
}

export async function executeSendgridAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        switch (actionName) {
            case 'sendEmail': {
                const toEmail = String(inputs.toEmail ?? '').trim();
                const toName = String(inputs.toName ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const fromName = String(inputs.fromName ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const htmlContent = String(inputs.htmlContent ?? '').trim();
                const textContent = String(inputs.textContent ?? '').trim();
                if (!toEmail || !fromEmail || !subject) throw new Error('toEmail, fromEmail, and subject are required.');

                const body: any = {
                    personalizations: [{ to: [{ email: toEmail, name: toName || undefined }] }],
                    from: { email: fromEmail, name: fromName || undefined },
                    subject,
                    content: [],
                };
                if (textContent) body.content.push({ type: 'text/plain', value: textContent });
                if (htmlContent) body.content.push({ type: 'text/html', value: htmlContent });
                if (!body.content.length) body.content.push({ type: 'text/plain', value: ' ' });

                await sgPost(apiKey, '/mail/send', body, logger);
                logger.log(`[SendGrid] Email sent to ${toEmail}`);
                return { output: { status: 'sent', to: toEmail } };
            }

            case 'sendTemplateEmail': {
                const toEmail = String(inputs.toEmail ?? '').trim();
                const fromEmail = String(inputs.fromEmail ?? '').trim();
                const templateId = String(inputs.templateId ?? '').trim();
                const dynamicData = inputs.dynamicData;
                if (!toEmail || !fromEmail || !templateId) throw new Error('toEmail, fromEmail, and templateId are required.');

                const parsedData = typeof dynamicData === 'string' ? JSON.parse(dynamicData || '{}') : (dynamicData ?? {});
                const body: any = {
                    personalizations: [{ to: [{ email: toEmail }], dynamic_template_data: parsedData }],
                    from: { email: fromEmail },
                    template_id: templateId,
                };
                await sgPost(apiKey, '/mail/send', body, logger);
                return { output: { status: 'sent', to: toEmail, templateId } };
            }

            case 'addContact': {
                const email = String(inputs.email ?? '').trim();
                const firstName = String(inputs.firstName ?? '').trim();
                const lastName = String(inputs.lastName ?? '').trim();
                if (!email) throw new Error('email is required.');
                const contact: any = { email };
                if (firstName) contact.first_name = firstName;
                if (lastName) contact.last_name = lastName;
                const data = await sgPatch(apiKey, '/marketing/contacts', { contacts: [contact] }, logger);
                return { output: { jobId: data.job_id ?? '', status: 'queued' } };
            }

            case 'getContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await sgPost(apiKey, '/marketing/contacts/search/emails', { emails: [email] }, logger);
                const contact = data.result?.[email]?.contact ?? null;
                return { output: { contact, found: String(!!contact) } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await sgDelete(apiKey, `/marketing/contacts?ids=${contactId}`, logger);
                return { output: { deleted: 'true' } };
            }

            case 'addToList': {
                const email = String(inputs.email ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!email || !listId) throw new Error('email and listId are required.');
                const contact: any = { email };
                await sgPatch(apiKey, '/marketing/contacts', { contacts: [contact], list_ids: [listId] }, logger);
                return { output: { status: 'queued', listId } };
            }

            case 'getLists': {
                const data = await sgGet(apiKey, '/marketing/lists?page_size=100', logger);
                const lists = data.result ?? [];
                return { output: { lists, count: lists.length } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await sgPost(apiKey, '/marketing/lists', { name }, logger);
                return { output: { id: data.id, name: data.name } };
            }

            case 'getStats': {
                const startDate = String(inputs.startDate ?? '').trim();
                if (!startDate) throw new Error('startDate is required.');
                const data = await sgGet(apiKey, `/stats?start_date=${startDate}`, logger);
                const stats = data?.[0]?.stats?.[0]?.metrics ?? {};
                return { output: { ...stats } };
            }

            default:
                return { error: `SendGrid action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'SendGrid action failed.' };
    }
}
