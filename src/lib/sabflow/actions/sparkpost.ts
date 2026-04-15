'use server';

const SPARKPOST_BASE = 'https://api.sparkpost.com/api/v1';

async function spFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[SparkPost] ${method} ${path}`);
    const url = `${SPARKPOST_BASE}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: apiKey,
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
        const errMsg = data?.errors?.[0]?.message || data?.errors?.[0]?.description || `SparkPost API error: ${res.status}`;
        throw new Error(errMsg);
    }
    return data;
}

export async function executeSparkPostAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'inputs.apiKey is required' };

        switch (actionName) {
            case 'sendEmail': {
                const payload: any = {
                    recipients: Array.isArray(inputs.recipients)
                        ? inputs.recipients
                        : [{ address: { email: inputs.to, name: inputs.toName } }],
                    content: {
                        from: { email: inputs.from, name: inputs.fromName },
                        subject: inputs.subject,
                        html: inputs.htmlBody,
                        text: inputs.textBody,
                        reply_to: inputs.replyTo,
                    },
                    options: {
                        sandbox: inputs.sandbox || false,
                        click_tracking: inputs.clickTracking ?? true,
                        open_tracking: inputs.openTracking ?? true,
                    },
                };
                if (inputs.templateId) {
                    payload.content = { template_id: inputs.templateId };
                    payload.substitution_data = inputs.substitutionData || {};
                }
                const data = await spFetch(apiKey, 'POST', '/transmissions', payload, logger);
                return { output: data?.results || data };
            }

            case 'listTransmissions': {
                const params = new URLSearchParams();
                if (inputs.campaignId) params.set('campaign_id', inputs.campaignId);
                if (inputs.templateId) params.set('template_id', inputs.templateId);
                const qs = params.toString() ? `?${params}` : '';
                const data = await spFetch(apiKey, 'GET', `/transmissions${qs}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'getTransmission': {
                if (!inputs.transmissionId) return { error: 'inputs.transmissionId is required' };
                const data = await spFetch(apiKey, 'GET', `/transmissions/${inputs.transmissionId}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'deleteTransmission': {
                if (!inputs.transmissionId) return { error: 'inputs.transmissionId is required' };
                await spFetch(apiKey, 'DELETE', `/transmissions/${inputs.transmissionId}`, undefined, logger);
                return { output: { success: true, transmissionId: inputs.transmissionId } };
            }

            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.draftOnly !== undefined) params.set('draft', String(inputs.draftOnly));
                const qs = params.toString() ? `?${params}` : '';
                const data = await spFetch(apiKey, 'GET', `/templates${qs}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'getTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                const params = new URLSearchParams();
                if (inputs.draft !== undefined) params.set('draft', String(inputs.draft));
                const qs = params.toString() ? `?${params}` : '';
                const data = await spFetch(apiKey, 'GET', `/templates/${inputs.templateId}${qs}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'createTemplate': {
                const data = await spFetch(apiKey, 'POST', '/templates', {
                    id: inputs.templateId,
                    name: inputs.name,
                    published: inputs.published ?? false,
                    content: {
                        from: inputs.from,
                        subject: inputs.subject,
                        html: inputs.htmlBody,
                        text: inputs.textBody,
                    },
                }, logger);
                return { output: data?.results || data };
            }

            case 'updateTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.published !== undefined) body.published = inputs.published;
                body.content = {
                    from: inputs.from,
                    subject: inputs.subject,
                    html: inputs.htmlBody,
                    text: inputs.textBody,
                };
                const data = await spFetch(apiKey, 'PUT', `/templates/${inputs.templateId}`, body, logger);
                return { output: data?.results || data };
            }

            case 'deleteTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                await spFetch(apiKey, 'DELETE', `/templates/${inputs.templateId}`, undefined, logger);
                return { output: { success: true, templateId: inputs.templateId } };
            }

            case 'listRecipientLists': {
                const data = await spFetch(apiKey, 'GET', '/recipient-lists', undefined, logger);
                return { output: data?.results || data };
            }

            case 'getRecipientList': {
                if (!inputs.listId) return { error: 'inputs.listId is required' };
                const params = new URLSearchParams();
                if (inputs.showRecipients !== undefined) params.set('show_recipients', String(inputs.showRecipients));
                const qs = params.toString() ? `?${params}` : '';
                const data = await spFetch(apiKey, 'GET', `/recipient-lists/${inputs.listId}${qs}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'createRecipientList': {
                const data = await spFetch(apiKey, 'POST', '/recipient-lists', {
                    id: inputs.listId,
                    name: inputs.name,
                    description: inputs.description,
                    recipients: inputs.recipients || [],
                }, logger);
                return { output: data?.results || data };
            }

            case 'listSuppressions': {
                const params = new URLSearchParams({
                    per_page: String(inputs.perPage || 20),
                    page: String(inputs.page || 1),
                });
                if (inputs.types) params.set('types', inputs.types);
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                const data = await spFetch(apiKey, 'GET', `/suppression-list?${params}`, undefined, logger);
                return { output: data?.results || data };
            }

            case 'listInboundDomains': {
                const data = await spFetch(apiKey, 'GET', '/inbound-domains', undefined, logger);
                return { output: data?.results || data };
            }

            case 'getDeliverability': {
                const params = new URLSearchParams({
                    from: inputs.from || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0],
                    to: inputs.to || new Date().toISOString().split('T')[0],
                    precision: inputs.precision || 'day',
                    metrics: inputs.metrics || 'count_injected,count_delivered,count_bounce',
                });
                if (inputs.campaignId) params.set('campaigns', inputs.campaignId);
                const data = await spFetch(apiKey, 'GET', `/metrics/deliverability?${params}`, undefined, logger);
                return { output: data?.results || data };
            }

            default:
                return { error: `Unknown SparkPost action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[SparkPost] Error: ${err.message}`);
        return { error: err.message || 'SparkPost action failed' };
    }
}
