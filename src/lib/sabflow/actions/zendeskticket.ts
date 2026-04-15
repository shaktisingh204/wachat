
'use server';

async function zdTicketFetch(subdomain: string, email: string, apiToken: string, method: string, path: string, body?: any, logger?: any): Promise<any> {
    logger?.log(`[ZendeskTicket] ${method} ${path}`);
    const base64Auth = Buffer.from(`${email}/token:${apiToken}`).toString('base64');
    const url = `https://${subdomain}.zendesk.com/api/v2${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.description || data?.error || `Zendesk API error: ${res.status}`);
    }
    return data;
}

export async function executeZendeskTicketAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const subdomain = String(inputs.subdomain ?? '').trim().replace(/\.zendesk\.com.*/, '');
        const email = String(inputs.email ?? '').trim();
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!subdomain || !email || !apiToken) throw new Error('subdomain, email, and apiToken are required.');

        const zd = (method: string, path: string, body?: any) => zdTicketFetch(subdomain, email, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'createTicketFromEmail': {
                const subject = String(inputs.subject ?? '').trim();
                const comment = String(inputs.comment ?? '').trim();
                const requesterEmail = String(inputs.requesterEmail ?? '').trim();
                const requesterName = String(inputs.requesterName ?? '').trim();
                if (!subject || !comment || !requesterEmail) throw new Error('subject, comment, and requesterEmail are required.');
                const body: any = {
                    ticket: {
                        subject,
                        comment: { body: comment },
                        requester: { email: requesterEmail, name: requesterName || requesterEmail },
                        via: { channel: 'email' },
                    },
                };
                const data = await zd('POST', '/tickets.json', body);
                return { output: { id: String(data.ticket?.id ?? ''), subject: data.ticket?.subject, status: data.ticket?.status } };
            }

            case 'bulkUpdateTickets': {
                const ticketIds = inputs.ticketIds ?? [];
                const updateData = inputs.updateData ?? {};
                if (!ticketIds.length) throw new Error('ticketIds array is required.');
                const ids = Array.isArray(ticketIds) ? ticketIds.join(',') : String(ticketIds);
                const data = await zd('PUT', `/tickets/update_many.json?ids=${ids}`, { ticket: updateData });
                return { output: { jobStatus: data.job_status ?? data } };
            }

            case 'mergeTickets': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const targetIds = inputs.targetIds ?? [];
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('POST', `/tickets/${ticketId}/merge.json`, { ids: targetIds });
                return { output: { jobStatus: data.job_status ?? data } };
            }

            case 'listTicketAudits': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/audits.json`);
                return { output: { audits: data.audits ?? [], count: data.audits?.length ?? 0 } };
            }

            case 'getTicketMetrics': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/metrics.json`);
                return { output: { metrics: data.ticket_metric ?? data } };
            }

            case 'listTicketComments': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/comments.json`);
                return { output: { comments: data.comments ?? [], count: data.comments?.length ?? 0 } };
            }

            case 'satisfactionRating': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/satisfaction_rating.json`);
                return { output: { satisfactionRating: data.satisfaction_rating ?? data } };
            }

            case 'listMacros': {
                const data = await zd('GET', '/macros.json');
                return { output: { macros: data.macros ?? [], count: data.macros?.length ?? 0 } };
            }

            case 'applyMacro': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const macroId = String(inputs.macroId ?? '').trim();
                if (!ticketId || !macroId) throw new Error('ticketId and macroId are required.');
                const data = await zd('POST', `/tickets/${ticketId}/macros/${macroId}/apply.json`);
                return { output: { result: data.result ?? data } };
            }

            case 'listViews': {
                const data = await zd('GET', '/views.json');
                return { output: { views: data.views ?? [], count: data.views?.length ?? 0 } };
            }

            case 'executeView': {
                const viewId = String(inputs.viewId ?? '').trim();
                if (!viewId) throw new Error('viewId is required.');
                const data = await zd('GET', `/views/${viewId}/execute.json`);
                return { output: { rows: data.rows ?? [], columns: data.columns ?? [], count: data.rows?.length ?? 0 } };
            }

            case 'listBusinessHours': {
                const data = await zd('GET', '/business_hours/schedules.json');
                return { output: { schedules: data.schedules ?? [], count: data.schedules?.length ?? 0 } };
            }

            case 'listHolidays': {
                const scheduleId = String(inputs.scheduleId ?? '').trim();
                if (!scheduleId) throw new Error('scheduleId is required.');
                const data = await zd('GET', `/business_hours/schedules/${scheduleId}/holidays.json`);
                return { output: { holidays: data.holidays ?? [], count: data.holidays?.length ?? 0 } };
            }

            case 'listTicketTags': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('GET', `/tickets/${ticketId}/tags.json`);
                return { output: { tags: data.tags ?? [] } };
            }

            case 'addTagsToTicket': {
                const ticketId = String(inputs.ticketId ?? '').trim();
                const tags = inputs.tags ?? [];
                if (!ticketId) throw new Error('ticketId is required.');
                const data = await zd('POST', `/tickets/${ticketId}/tags.json`, { tags });
                return { output: { tags: data.tags ?? [] } };
            }

            default:
                return { error: `ZendeskTicket action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'ZendeskTicket action failed.' };
    }
}
