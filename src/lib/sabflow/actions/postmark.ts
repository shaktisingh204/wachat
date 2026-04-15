
'use server';

const POSTMARK_BASE = 'https://api.postmarkapp.com';

async function postmarkFetch(serverToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Postmark] ${method} ${path}`);
    const url = `${POSTMARK_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'X-Postmark-Server-Token': serverToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.Message || `Postmark API error: ${res.status}`);
    }
    return data;
}

export async function executePostmarkAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverToken = String(inputs.serverToken ?? '').trim();
        if (!serverToken) throw new Error('serverToken is required.');
        const pf = (method: string, path: string, body?: any) => postmarkFetch(serverToken, method, path, body, logger);

        switch (actionName) {
            case 'sendEmail': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!from || !to || !subject) throw new Error('from, to, and subject are required.');
                const body: any = { From: from, To: to, Subject: subject };
                if (inputs.htmlBody) body.HtmlBody = String(inputs.htmlBody);
                if (inputs.textBody) body.TextBody = String(inputs.textBody);
                if (inputs.replyTo) body.ReplyTo = String(inputs.replyTo);
                if (inputs.tag) body.Tag = String(inputs.tag);
                const data = await pf('POST', '/email', body);
                return { output: { messageId: data.MessageID, to: data.To, submittedAt: data.SubmittedAt } };
            }

            case 'sendEmailWithTemplate': {
                const from = String(inputs.from ?? '').trim();
                const to = String(inputs.to ?? '').trim();
                const templateId = inputs.templateId ? Number(inputs.templateId) : undefined;
                const templateAlias = inputs.templateAlias ? String(inputs.templateAlias) : undefined;
                if (!from || !to) throw new Error('from and to are required.');
                if (!templateId && !templateAlias) throw new Error('templateId or templateAlias is required.');
                const body: any = { From: from, To: to, TemplateModel: inputs.templateModel ?? {} };
                if (templateId) body.TemplateId = templateId;
                if (templateAlias) body.TemplateAlias = templateAlias;
                if (inputs.replyTo) body.ReplyTo = String(inputs.replyTo);
                const data = await pf('POST', '/email/withTemplate', body);
                return { output: { messageId: data.MessageID, to: data.To, submittedAt: data.SubmittedAt } };
            }

            case 'sendBatch': {
                const messages = inputs.messages ?? [];
                if (!Array.isArray(messages) || messages.length === 0) throw new Error('messages array is required.');
                const data = await pf('POST', '/email/batch', messages);
                return { output: { results: data } };
            }

            case 'getDeliveryStats': {
                const data = await pf('GET', '/deliverystats');
                return { output: data };
            }

            case 'getBounceSummary': {
                const data = await pf('GET', '/bounces/tags');
                return { output: { tags: data } };
            }

            case 'getBounces': {
                const count = Number(inputs.count ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const type = inputs.type ? `&type=${encodeURIComponent(String(inputs.type))}` : '';
                const data = await pf('GET', `/bounces?count=${count}&offset=${offset}${type}`);
                return { output: { bounces: data.Bounces ?? [], totalCount: data.TotalCount ?? 0 } };
            }

            case 'getBounce': {
                const bounceId = String(inputs.bounceId ?? '').trim();
                if (!bounceId) throw new Error('bounceId is required.');
                const data = await pf('GET', `/bounces/${bounceId}`);
                return { output: data };
            }

            case 'activateBounce': {
                const bounceId = String(inputs.bounceId ?? '').trim();
                if (!bounceId) throw new Error('bounceId is required.');
                const data = await pf('PUT', `/bounces/${bounceId}/activate`);
                return { output: { message: data.Message, bounce: data.Bounce } };
            }

            case 'getOutboundMessages': {
                const count = Number(inputs.count ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await pf('GET', `/messages/outbound?count=${count}&offset=${offset}`);
                return { output: { messages: data.Messages ?? [], totalCount: data.TotalCount ?? 0 } };
            }

            case 'getInboundMessages': {
                const count = Number(inputs.count ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await pf('GET', `/messages/inbound?count=${count}&offset=${offset}`);
                return { output: { messages: data.InboundMessages ?? [], totalCount: data.TotalCount ?? 0 } };
            }

            case 'getMessageEvents': {
                const messageId = String(inputs.messageId ?? '').trim();
                if (!messageId) throw new Error('messageId is required.');
                const data = await pf('GET', `/messages/outbound/${messageId}/opens`);
                return { output: { opens: data.Opens ?? [], totalCount: data.TotalCount ?? 0 } };
            }

            case 'listTemplates': {
                const count = Number(inputs.count ?? 25);
                const offset = Number(inputs.offset ?? 0);
                const data = await pf('GET', `/templates?count=${count}&offset=${offset}`);
                return { output: { templates: data.Templates ?? [], totalCount: data.TotalCount ?? 0 } };
            }

            case 'getTemplate': {
                const templateId = String(inputs.templateId ?? '').trim();
                if (!templateId) throw new Error('templateId is required.');
                const data = await pf('GET', `/templates/${templateId}`);
                return { output: data };
            }

            case 'createTemplate': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!name || !subject) throw new Error('name and subject are required.');
                const body: any = { Name: name, Subject: subject };
                if (inputs.htmlBody) body.HtmlBody = String(inputs.htmlBody);
                if (inputs.textBody) body.TextBody = String(inputs.textBody);
                const data = await pf('POST', '/templates', body);
                return { output: { templateId: data.TemplateId, name: data.Name, alias: data.Alias } };
            }

            case 'updateTemplate': {
                const templateId = String(inputs.templateId ?? '').trim();
                if (!templateId) throw new Error('templateId is required.');
                const body: any = {};
                if (inputs.name) body.Name = String(inputs.name);
                if (inputs.subject) body.Subject = String(inputs.subject);
                if (inputs.htmlBody) body.HtmlBody = String(inputs.htmlBody);
                if (inputs.textBody) body.TextBody = String(inputs.textBody);
                const data = await pf('PUT', `/templates/${templateId}`, body);
                return { output: { templateId: data.TemplateId, name: data.Name } };
            }

            default:
                throw new Error(`Unsupported Postmark action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
