'use server';

export async function executeZendeskEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = `https://${inputs.subdomain}.zendesk.com/api/v2`;
        const basicAuth = Buffer.from(inputs.email + '/token:' + inputs.apiToken).toString('base64');
        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listTickets': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                if (inputs.sortOrder) params.set('sort_order', inputs.sortOrder);
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/tickets${query}`, { headers });
                if (!res.ok) return { error: `Failed to list tickets: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getTicket': {
                const res = await fetch(`${baseUrl}/tickets/${inputs.ticketId}`, { headers });
                if (!res.ok) return { error: `Failed to get ticket: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createTicket': {
                const ticket: Record<string, any> = {
                    subject: inputs.subject,
                    comment: { body: inputs.description || inputs.comment },
                };
                if (inputs.priority) ticket.priority = inputs.priority;
                if (inputs.status) ticket.status = inputs.status;
                if (inputs.type) ticket.type = inputs.type;
                if (inputs.requesterId) ticket.requester_id = inputs.requesterId;
                if (inputs.assigneeId) ticket.assignee_id = inputs.assigneeId;
                if (inputs.groupId) ticket.group_id = inputs.groupId;
                if (inputs.tags) ticket.tags = inputs.tags;
                if (inputs.customFields) ticket.custom_fields = inputs.customFields;
                const res = await fetch(`${baseUrl}/tickets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ ticket }),
                });
                if (!res.ok) return { error: `Failed to create ticket: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateTicket': {
                const ticket: Record<string, any> = {};
                if (inputs.subject) ticket.subject = inputs.subject;
                if (inputs.comment) ticket.comment = { body: inputs.comment };
                if (inputs.priority) ticket.priority = inputs.priority;
                if (inputs.status) ticket.status = inputs.status;
                if (inputs.assigneeId) ticket.assignee_id = inputs.assigneeId;
                if (inputs.groupId) ticket.group_id = inputs.groupId;
                if (inputs.tags) ticket.tags = inputs.tags;
                if (inputs.customFields) ticket.custom_fields = inputs.customFields;
                const res = await fetch(`${baseUrl}/tickets/${inputs.ticketId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ ticket }),
                });
                if (!res.ok) return { error: `Failed to update ticket: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'deleteTicket': {
                const res = await fetch(`${baseUrl}/tickets/${inputs.ticketId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete ticket: ${res.status} ${await res.text()}` };
                return { output: { deleted: true, ticketId: inputs.ticketId } };
            }

            case 'listUsers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.role) params.set('role', inputs.role);
                if (inputs.query) params.set('query', inputs.query);
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/users${query}`, { headers });
                if (!res.ok) return { error: `Failed to list users: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getUser': {
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, { headers });
                if (!res.ok) return { error: `Failed to get user: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createUser': {
                const userBody: Record<string, any> = {
                    name: inputs.name,
                    email: inputs.userEmail,
                };
                if (inputs.role) userBody.role = inputs.role;
                if (inputs.organizationId) userBody.organization_id = inputs.organizationId;
                if (inputs.phone) userBody.phone = inputs.phone;
                if (inputs.locale) userBody.locale = inputs.locale;
                if (inputs.timeZone) userBody.time_zone = inputs.timeZone;
                if (inputs.tags) userBody.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ user: userBody }),
                });
                if (!res.ok) return { error: `Failed to create user: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateUser': {
                const userBody: Record<string, any> = {};
                if (inputs.name) userBody.name = inputs.name;
                if (inputs.email) userBody.email = inputs.email;
                if (inputs.role) userBody.role = inputs.role;
                if (inputs.organizationId) userBody.organization_id = inputs.organizationId;
                if (inputs.phone) userBody.phone = inputs.phone;
                if (inputs.tags) userBody.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/users/${inputs.userId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ user: userBody }),
                });
                if (!res.ok) return { error: `Failed to update user: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listOrganizations': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params}` : '';
                const res = await fetch(`${baseUrl}/organizations${query}`, { headers });
                if (!res.ok) return { error: `Failed to list organizations: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getOrganization': {
                const res = await fetch(`${baseUrl}/organizations/${inputs.organizationId}`, { headers });
                if (!res.ok) return { error: `Failed to get organization: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createOrganization': {
                const org: Record<string, any> = { name: inputs.name };
                if (inputs.domainNames) org.domain_names = inputs.domainNames;
                if (inputs.details) org.details = inputs.details;
                if (inputs.notes) org.notes = inputs.notes;
                if (inputs.tags) org.tags = inputs.tags;
                if (inputs.groupId) org.group_id = inputs.groupId;
                const res = await fetch(`${baseUrl}/organizations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ organization: org }),
                });
                if (!res.ok) return { error: `Failed to create organization: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listArticles': {
                const params = new URLSearchParams();
                if (inputs.locale) params.set('locale', inputs.locale);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                if (inputs.sortOrder) params.set('sort_order', inputs.sortOrder);
                const query = params.toString() ? `?${params}` : '';
                const hcBase = `https://${inputs.subdomain}.zendesk.com/api/v2/help_center`;
                const res = await fetch(`${hcBase}/articles${query}`, { headers });
                if (!res.ok) return { error: `Failed to list articles: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createArticle': {
                const article: Record<string, any> = {
                    title: inputs.title,
                    body: inputs.body,
                    locale: inputs.locale || 'en-us',
                };
                if (inputs.draft !== undefined) article.draft = inputs.draft;
                if (inputs.promoted !== undefined) article.promoted = inputs.promoted;
                if (inputs.position !== undefined) article.position = inputs.position;
                if (inputs.authorId) article.author_id = inputs.authorId;
                if (inputs.labelNames) article.label_names = inputs.labelNames;
                const sectionId = inputs.sectionId;
                const hcBase = `https://${inputs.subdomain}.zendesk.com/api/v2/help_center`;
                const res = await fetch(`${hcBase}/sections/${sectionId}/articles`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ article }),
                });
                if (!res.ok) return { error: `Failed to create article: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'searchTickets': {
                const params = new URLSearchParams({ query: inputs.query });
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                if (inputs.sortOrder) params.set('sort_order', inputs.sortOrder);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/search?${params}`, { headers });
                if (!res.ok) return { error: `Failed to search tickets: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Zendesk action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zendesk Enhanced Action error: ${err.message}`);
        return { error: err.message || 'Zendesk Enhanced Action failed' };
    }
}
