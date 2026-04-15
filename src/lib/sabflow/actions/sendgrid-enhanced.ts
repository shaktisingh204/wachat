'use server';

const SENDGRID_BASE = 'https://api.sendgrid.com/v3';

async function sgFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[SendGridEnhanced] ${method} ${path}`);
    const url = `${SENDGRID_BASE}${path}`;
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
        throw new Error(data?.errors?.[0]?.message || `SendGrid API error: ${res.status}`);
    }
    return data;
}

export async function executeSendGridEnhancedAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) return { error: 'inputs.apiKey is required' };

        switch (actionName) {
            case 'sendEmail': {
                const payload: any = {
                    personalizations: [{ to: [{ email: inputs.to, name: inputs.toName }] }],
                    from: { email: inputs.from, name: inputs.fromName },
                    subject: inputs.subject,
                    content: [{ type: inputs.contentType || 'text/html', value: inputs.content }],
                };
                if (inputs.cc) payload.personalizations[0].cc = [{ email: inputs.cc }];
                if (inputs.bcc) payload.personalizations[0].bcc = [{ email: inputs.bcc }];
                if (inputs.replyTo) payload.reply_to = { email: inputs.replyTo };
                if (inputs.templateId) payload.template_id = inputs.templateId;
                const data = await sgFetch(apiKey, 'POST', '/mail/send', payload, logger);
                return { output: { success: true, data } };
            }

            case 'sendBulkEmail': {
                const personalizations = (inputs.recipients || []).map((r: any) => ({
                    to: [{ email: r.email, name: r.name }],
                    dynamic_template_data: r.templateData || {},
                }));
                const payload: any = {
                    personalizations,
                    from: { email: inputs.from, name: inputs.fromName },
                    subject: inputs.subject,
                    template_id: inputs.templateId,
                };
                if (inputs.content) {
                    payload.content = [{ type: 'text/html', value: inputs.content }];
                }
                const data = await sgFetch(apiKey, 'POST', '/mail/send', payload, logger);
                return { output: { success: true, data } };
            }

            case 'createTemplate': {
                const data = await sgFetch(apiKey, 'POST', '/templates', {
                    name: inputs.name,
                    generation: inputs.generation || 'dynamic',
                }, logger);
                return { output: data };
            }

            case 'getTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                const data = await sgFetch(apiKey, 'GET', `/templates/${inputs.templateId}`, undefined, logger);
                return { output: data };
            }

            case 'updateTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                const data = await sgFetch(apiKey, 'PATCH', `/templates/${inputs.templateId}`, {
                    name: inputs.name,
                }, logger);
                return { output: data };
            }

            case 'deleteTemplate': {
                if (!inputs.templateId) return { error: 'inputs.templateId is required' };
                await sgFetch(apiKey, 'DELETE', `/templates/${inputs.templateId}`, undefined, logger);
                return { output: { success: true, templateId: inputs.templateId } };
            }

            case 'listTemplates': {
                const params = new URLSearchParams({ generations: inputs.generations || 'dynamic' });
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                const data = await sgFetch(apiKey, 'GET', `/templates?${params}`, undefined, logger);
                return { output: data };
            }

            case 'addContact': {
                const data = await sgFetch(apiKey, 'PUT', '/marketing/contacts', {
                    contacts: [{
                        email: inputs.email,
                        first_name: inputs.firstName,
                        last_name: inputs.lastName,
                        phone_number: inputs.phone,
                        custom_fields: inputs.customFields || {},
                    }],
                    list_ids: inputs.listIds || [],
                }, logger);
                return { output: data };
            }

            case 'updateContact': {
                const data = await sgFetch(apiKey, 'PUT', '/marketing/contacts', {
                    contacts: [{
                        id: inputs.contactId,
                        email: inputs.email,
                        first_name: inputs.firstName,
                        last_name: inputs.lastName,
                        custom_fields: inputs.customFields || {},
                    }],
                }, logger);
                return { output: data };
            }

            case 'deleteContact': {
                if (!inputs.contactIds) return { error: 'inputs.contactIds is required' };
                const ids = Array.isArray(inputs.contactIds) ? inputs.contactIds.join(',') : inputs.contactIds;
                const data = await sgFetch(apiKey, 'DELETE', `/marketing/contacts?ids=${encodeURIComponent(ids)}`, undefined, logger);
                return { output: { success: true, data } };
            }

            case 'listContactLists': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('page_size', String(inputs.pageSize));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const qs = params.toString() ? `?${params}` : '';
                const data = await sgFetch(apiKey, 'GET', `/marketing/lists${qs}`, undefined, logger);
                return { output: data };
            }

            case 'searchContacts': {
                const data = await sgFetch(apiKey, 'POST', '/marketing/contacts/search', {
                    query: inputs.query,
                }, logger);
                return { output: data };
            }

            case 'createSegment': {
                const data = await sgFetch(apiKey, 'POST', '/marketing/segments/2.0', {
                    name: inputs.name,
                    query_dsl: inputs.queryDsl,
                    parent_list_ids: inputs.parentListIds || [],
                }, logger);
                return { output: data };
            }

            case 'createSingleSend': {
                const data = await sgFetch(apiKey, 'POST', '/marketing/singlesends', {
                    name: inputs.name,
                    send_to: { list_ids: inputs.listIds || [], all: inputs.sendToAll || false },
                    email_config: {
                        subject: inputs.subject,
                        html_content: inputs.htmlContent,
                        plain_content: inputs.plainContent,
                        generate_plain_content: inputs.generatePlainContent ?? true,
                        editor: inputs.editor || 'code',
                        suppression_group_id: inputs.suppressionGroupId,
                        sender_id: inputs.senderId,
                        ip_pool: inputs.ipPool,
                    },
                }, logger);
                return { output: data };
            }

            case 'scheduleSingleSend': {
                if (!inputs.singleSendId) return { error: 'inputs.singleSendId is required' };
                const body: any = {};
                if (inputs.sendAt) body.send_at = inputs.sendAt;
                const data = await sgFetch(apiKey, 'PUT', `/marketing/singlesends/${inputs.singleSendId}/schedule`, body, logger);
                return { output: data };
            }

            default:
                return { error: `Unknown SendGrid Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[SendGridEnhanced] Error: ${err.message}`);
        return { error: err.message || 'SendGrid Enhanced action failed' };
    }
}
