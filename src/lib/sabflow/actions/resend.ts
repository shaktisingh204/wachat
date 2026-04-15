'use server';

const RESEND_BASE = 'https://api.resend.com';

async function resendFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Resend] ${method} ${path}`);
    const url = `${RESEND_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
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
        throw new Error(data?.message || data?.name || `Resend API error: ${res.status}`);
    }
    return data;
}

export async function executeResendAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'inputs.apiKey is required' };

        switch (actionName) {
            case 'sendEmail': {
                const payload: any = {
                    from: inputs.from,
                    to: Array.isArray(inputs.to) ? inputs.to : [inputs.to],
                    subject: inputs.subject,
                    html: inputs.html,
                    text: inputs.text,
                    reply_to: inputs.replyTo,
                    cc: inputs.cc,
                    bcc: inputs.bcc,
                    scheduled_at: inputs.scheduledAt,
                    tags: inputs.tags,
                    attachments: inputs.attachments,
                    headers: inputs.headers,
                };
                const data = await resendFetch(apiKey, 'POST', '/emails', payload, logger);
                return { output: data };
            }

            case 'sendBatchEmails': {
                if (!Array.isArray(inputs.emails)) return { error: 'inputs.emails must be an array' };
                const data = await resendFetch(apiKey, 'POST', '/emails/batch', inputs.emails, logger);
                return { output: data };
            }

            case 'getEmail': {
                if (!inputs.emailId) return { error: 'inputs.emailId is required' };
                const data = await resendFetch(apiKey, 'GET', `/emails/${inputs.emailId}`, undefined, logger);
                return { output: data };
            }

            case 'cancelEmail': {
                if (!inputs.emailId) return { error: 'inputs.emailId is required' };
                const data = await resendFetch(apiKey, 'POST', `/emails/${inputs.emailId}/cancel`, undefined, logger);
                return { output: data };
            }

            case 'createDomain': {
                if (!inputs.name) return { error: 'inputs.name is required' };
                const data = await resendFetch(apiKey, 'POST', '/domains', {
                    name: inputs.name,
                    region: inputs.region || 'us-east-1',
                }, logger);
                return { output: data };
            }

            case 'getDomain': {
                if (!inputs.domainId) return { error: 'inputs.domainId is required' };
                const data = await resendFetch(apiKey, 'GET', `/domains/${inputs.domainId}`, undefined, logger);
                return { output: data };
            }

            case 'updateDomain': {
                if (!inputs.domainId) return { error: 'inputs.domainId is required' };
                const data = await resendFetch(apiKey, 'PATCH', `/domains/${inputs.domainId}`, {
                    open_tracking: inputs.openTracking,
                    click_tracking: inputs.clickTracking,
                    tls: inputs.tls,
                }, logger);
                return { output: data };
            }

            case 'verifyDomain': {
                if (!inputs.domainId) return { error: 'inputs.domainId is required' };
                const data = await resendFetch(apiKey, 'POST', `/domains/${inputs.domainId}/verify`, undefined, logger);
                return { output: data };
            }

            case 'deleteDomain': {
                if (!inputs.domainId) return { error: 'inputs.domainId is required' };
                const data = await resendFetch(apiKey, 'DELETE', `/domains/${inputs.domainId}`, undefined, logger);
                return { output: { success: true, data } };
            }

            case 'listDomains': {
                const data = await resendFetch(apiKey, 'GET', '/domains', undefined, logger);
                return { output: data };
            }

            case 'createAudience': {
                if (!inputs.name) return { error: 'inputs.name is required' };
                const data = await resendFetch(apiKey, 'POST', '/audiences', { name: inputs.name }, logger);
                return { output: data };
            }

            case 'deleteAudience': {
                if (!inputs.audienceId) return { error: 'inputs.audienceId is required' };
                const data = await resendFetch(apiKey, 'DELETE', `/audiences/${inputs.audienceId}`, undefined, logger);
                return { output: { success: true, data } };
            }

            case 'listAudiences': {
                const data = await resendFetch(apiKey, 'GET', '/audiences', undefined, logger);
                return { output: data };
            }

            case 'getAudienceContact': {
                if (!inputs.audienceId) return { error: 'inputs.audienceId is required' };
                if (!inputs.contactId) return { error: 'inputs.contactId is required' };
                const data = await resendFetch(apiKey, 'GET', `/audiences/${inputs.audienceId}/contacts/${inputs.contactId}`, undefined, logger);
                return { output: data };
            }

            case 'removeContact': {
                if (!inputs.audienceId) return { error: 'inputs.audienceId is required' };
                if (!inputs.contactId) return { error: 'inputs.contactId is required' };
                const data = await resendFetch(apiKey, 'DELETE', `/audiences/${inputs.audienceId}/contacts/${inputs.contactId}`, undefined, logger);
                return { output: { success: true, data } };
            }

            default:
                return { error: `Unknown Resend action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[Resend] Error: ${err.message}`);
        return { error: err.message || 'Resend action failed' };
    }
}
