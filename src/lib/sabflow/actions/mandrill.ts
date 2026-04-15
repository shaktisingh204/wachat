
'use server';

const MANDRILL_BASE = 'https://mandrillapp.com/api/1.0';

async function mandrillPost(endpoint: string, body: any, logger?: any): Promise<any> {
    const url = `${MANDRILL_BASE}${endpoint}`;
    logger?.log(`[Mandrill] POST ${endpoint}`);

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        throw new Error(data?.message || data?.error || `Mandrill API error: ${res.status}`);
    }

    if (data?.status === 'error') {
        throw new Error(data.message || 'Mandrill returned an error status.');
    }

    return data;
}

export async function executeMandrillAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const key = String(inputs.key ?? '').trim();
        if (!key) throw new Error('key (Mandrill API key) is required.');

        switch (actionName) {
            case 'sendMessage': {
                const message = inputs.message ?? {};
                const data = await mandrillPost('/messages/send', { key, message }, logger);
                return { output: { results: data } };
            }

            case 'sendTemplate': {
                const templateName = String(inputs.templateName ?? '').trim();
                if (!templateName) throw new Error('templateName is required.');
                const templateContent = inputs.templateContent ?? [];
                const message = inputs.message ?? {};
                const data = await mandrillPost(
                    '/messages/send-template',
                    { key, template_name: templateName, template_content: templateContent, message },
                    logger
                );
                return { output: { results: data } };
            }

            case 'scheduleMessage': {
                const message = inputs.message ?? {};
                const sendAt = String(inputs.sendAt ?? '').trim();
                if (!sendAt) throw new Error('sendAt is required (ISO 8601 UTC).');
                const data = await mandrillPost(
                    '/messages/send',
                    { key, message, send_at: sendAt },
                    logger
                );
                return { output: { results: data } };
            }

            case 'listSentMessages': {
                const query = String(inputs.query ?? '').trim();
                const payload: any = { key };
                if (query) payload.query = query;
                if (inputs.dateFrom) payload.date_from = String(inputs.dateFrom);
                if (inputs.dateTo) payload.date_to = String(inputs.dateTo);
                if (inputs.limit !== undefined) payload.limit = Number(inputs.limit);
                const data = await mandrillPost('/messages/search', payload, logger);
                return { output: { messages: data } };
            }

            case 'getMessageInfo': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await mandrillPost('/messages/info', { key, id }, logger);
                return { output: { message: data } };
            }

            case 'listTemplates': {
                const payload: any = { key };
                if (inputs.label) payload.label = String(inputs.label);
                const data = await mandrillPost('/templates/list', payload, logger);
                return { output: { templates: data } };
            }

            case 'getTemplate': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await mandrillPost('/templates/info', { key, name }, logger);
                return { output: { template: data } };
            }

            case 'addTemplate': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const payload: any = { key, name };
                if (inputs.fromEmail) payload.from_email = String(inputs.fromEmail);
                if (inputs.fromName) payload.from_name = String(inputs.fromName);
                if (inputs.subject) payload.subject = String(inputs.subject);
                if (inputs.code) payload.code = String(inputs.code);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.publish !== undefined) payload.publish = Boolean(inputs.publish);
                const data = await mandrillPost('/templates/add', payload, logger);
                logger.log(`[Mandrill] Template added: ${data.name}`);
                return { output: { template: data } };
            }

            case 'updateTemplate': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const payload: any = { key, name };
                if (inputs.fromEmail) payload.from_email = String(inputs.fromEmail);
                if (inputs.fromName) payload.from_name = String(inputs.fromName);
                if (inputs.subject) payload.subject = String(inputs.subject);
                if (inputs.code) payload.code = String(inputs.code);
                if (inputs.text) payload.text = String(inputs.text);
                if (inputs.publish !== undefined) payload.publish = Boolean(inputs.publish);
                const data = await mandrillPost('/templates/update', payload, logger);
                logger.log(`[Mandrill] Template updated: ${data.name}`);
                return { output: { template: data } };
            }

            case 'deleteTemplate': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await mandrillPost('/templates/delete', { key, name }, logger);
                logger.log(`[Mandrill] Template deleted: ${data.name}`);
                return { output: { template: data } };
            }

            case 'listSubaccounts': {
                const payload: any = { key };
                if (inputs.q) payload.q = String(inputs.q);
                const data = await mandrillPost('/subaccounts/list', payload, logger);
                return { output: { subaccounts: data } };
            }

            case 'getSubaccount': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await mandrillPost('/subaccounts/info', { key, id }, logger);
                return { output: { subaccount: data } };
            }

            case 'listWebhooks': {
                const data = await mandrillPost('/webhooks/list', { key }, logger);
                return { output: { webhooks: data } };
            }

            default:
                return { error: `Mandrill action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mandrill action failed.' };
    }
}
