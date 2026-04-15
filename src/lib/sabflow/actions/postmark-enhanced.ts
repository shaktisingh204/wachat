'use server';

const POSTMARK_BASE = 'https://api.postmarkapp.com';

async function pmFetch(token: string, tokenType: 'server' | 'account', method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[PostmarkEnhanced] ${method} ${path}`);
    const url = `${POSTMARK_BASE}${path}`;
    const headerKey = tokenType === 'account' ? 'X-Postmark-Account-Token' : 'X-Postmark-Server-Token';
    const options: RequestInit = {
        method,
        headers: {
            [headerKey]: token,
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

export async function executePostmarkEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverToken = String(inputs.serverToken ?? '').trim();
        const accountToken = String(inputs.accountToken ?? '').trim();

        const resolveToken = (prefer: 'server' | 'account' = 'server'): [string, 'server' | 'account'] => {
            if (prefer === 'account' && accountToken) return [accountToken, 'account'];
            if (serverToken) return [serverToken, 'server'];
            if (accountToken) return [accountToken, 'account'];
            throw new Error('inputs.serverToken or inputs.accountToken is required');
        };

        switch (actionName) {
            case 'sendEmail': {
                const [token, type] = resolveToken('server');
                const data = await pmFetch(token, type, 'POST', '/email', {
                    From: inputs.from,
                    To: inputs.to,
                    Cc: inputs.cc,
                    Bcc: inputs.bcc,
                    Subject: inputs.subject,
                    HtmlBody: inputs.htmlBody,
                    TextBody: inputs.textBody,
                    ReplyTo: inputs.replyTo,
                    Tag: inputs.tag,
                    TrackOpens: inputs.trackOpens ?? true,
                    TrackLinks: inputs.trackLinks || 'None',
                    MessageStream: inputs.messageStream || 'outbound',
                }, logger);
                return { output: data };
            }

            case 'sendEmailBatch': {
                const [token, type] = resolveToken('server');
                const data = await pmFetch(token, type, 'POST', '/email/batch', inputs.messages || [], logger);
                return { output: data };
            }

            case 'sendEmailWithTemplate': {
                const [token, type] = resolveToken('server');
                const data = await pmFetch(token, type, 'POST', '/email/withTemplate', {
                    From: inputs.from,
                    To: inputs.to,
                    TemplateId: inputs.templateId,
                    TemplateAlias: inputs.templateAlias,
                    TemplateModel: inputs.templateModel || {},
                    ReplyTo: inputs.replyTo,
                    Tag: inputs.tag,
                    TrackOpens: inputs.trackOpens ?? true,
                    MessageStream: inputs.messageStream || 'outbound',
                }, logger);
                return { output: data };
            }

            case 'getEmailMessage': {
                const [token, type] = resolveToken('server');
                if (!inputs.messageId) return { error: 'inputs.messageId is required' };
                const data = await pmFetch(token, type, 'GET', `/messages/outbound/${inputs.messageId}/details`, undefined, logger);
                return { output: data };
            }

            case 'listMessages': {
                const [token, type] = resolveToken('server');
                const params = new URLSearchParams({
                    count: String(inputs.count || 20),
                    offset: String(inputs.offset || 0),
                });
                if (inputs.recipient) params.set('recipient', inputs.recipient);
                if (inputs.fromEmail) params.set('fromemail', inputs.fromEmail);
                if (inputs.subject) params.set('subject', inputs.subject);
                if (inputs.tag) params.set('tag', inputs.tag);
                const stream = inputs.messageStream || 'outbound';
                const data = await pmFetch(token, type, 'GET', `/messages/${stream}?${params}`, undefined, logger);
                return { output: data };
            }

            case 'listBounces': {
                const [token, type] = resolveToken('server');
                const params = new URLSearchParams({
                    count: String(inputs.count || 20),
                    offset: String(inputs.offset || 0),
                });
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.inactive !== undefined) params.set('inactive', String(inputs.inactive));
                const data = await pmFetch(token, type, 'GET', `/bounces?${params}`, undefined, logger);
                return { output: data };
            }

            case 'getBounce': {
                const [token, type] = resolveToken('server');
                if (!inputs.bounceId) return { error: 'inputs.bounceId is required' };
                const data = await pmFetch(token, type, 'GET', `/bounces/${inputs.bounceId}`, undefined, logger);
                return { output: data };
            }

            case 'activateBounce': {
                const [token, type] = resolveToken('server');
                if (!inputs.bounceId) return { error: 'inputs.bounceId is required' };
                const data = await pmFetch(token, type, 'PUT', `/bounces/${inputs.bounceId}/activate`, undefined, logger);
                return { output: data };
            }

            case 'listTemplates': {
                const [token, type] = resolveToken('server');
                const params = new URLSearchParams({
                    count: String(inputs.count || 20),
                    offset: String(inputs.offset || 0),
                });
                if (inputs.templateType) params.set('templateType', inputs.templateType);
                const data = await pmFetch(token, type, 'GET', `/templates?${params}`, undefined, logger);
                return { output: data };
            }

            case 'getTemplate': {
                const [token, type] = resolveToken('server');
                if (!inputs.templateIdOrAlias) return { error: 'inputs.templateIdOrAlias is required' };
                const data = await pmFetch(token, type, 'GET', `/templates/${inputs.templateIdOrAlias}`, undefined, logger);
                return { output: data };
            }

            case 'createTemplate': {
                const [token, type] = resolveToken('server');
                const data = await pmFetch(token, type, 'POST', '/templates', {
                    Name: inputs.name,
                    Subject: inputs.subject,
                    HtmlBody: inputs.htmlBody,
                    TextBody: inputs.textBody,
                    Alias: inputs.alias,
                    TemplateType: inputs.templateType || 'Standard',
                    LayoutTemplate: inputs.layoutTemplate,
                }, logger);
                return { output: data };
            }

            case 'updateTemplate': {
                const [token, type] = resolveToken('server');
                if (!inputs.templateIdOrAlias) return { error: 'inputs.templateIdOrAlias is required' };
                const data = await pmFetch(token, type, 'PUT', `/templates/${inputs.templateIdOrAlias}`, {
                    Name: inputs.name,
                    Subject: inputs.subject,
                    HtmlBody: inputs.htmlBody,
                    TextBody: inputs.textBody,
                    Alias: inputs.alias,
                }, logger);
                return { output: data };
            }

            case 'deleteTemplate': {
                const [token, type] = resolveToken('server');
                if (!inputs.templateIdOrAlias) return { error: 'inputs.templateIdOrAlias is required' };
                await pmFetch(token, type, 'DELETE', `/templates/${inputs.templateIdOrAlias}`, undefined, logger);
                return { output: { success: true, templateIdOrAlias: inputs.templateIdOrAlias } };
            }

            case 'getDeliveryStats': {
                const [token, type] = resolveToken('server');
                const data = await pmFetch(token, type, 'GET', '/deliverystats', undefined, logger);
                return { output: data };
            }

            case 'listServers': {
                const [token, type] = resolveToken('account');
                const params = new URLSearchParams({
                    count: String(inputs.count || 20),
                    offset: String(inputs.offset || 0),
                });
                if (inputs.name) params.set('name', inputs.name);
                const data = await pmFetch(token, type, 'GET', `/servers?${params}`, undefined, logger);
                return { output: data };
            }

            default:
                return { error: `Unknown Postmark Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[PostmarkEnhanced] Error: ${err.message}`);
        return { error: err.message || 'Postmark Enhanced action failed' };
    }
}
