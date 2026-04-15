'use server';

export async function executeFreshdeskEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const domain = inputs.domain;
    const BASE = `https://${domain}.freshdesk.com/api/v2`;
    const authHeader = `Basic ${Buffer.from(`${inputs.apiKey}:X`).toString('base64')}`;
    const headers = {
        Authorization: authHeader,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createTicket': {
                const res = await fetch(`${BASE}/tickets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        subject: inputs.subject,
                        description: inputs.description,
                        email: inputs.email,
                        priority: inputs.priority || 1,
                        status: inputs.status || 2,
                        type: inputs.type,
                        tags: inputs.tags,
                        custom_fields: inputs.customFields,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create ticket' };
                return { output: data };
            }

            case 'getTicket': {
                const res = await fetch(`${BASE}/tickets/${inputs.ticketId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to get ticket' };
                return { output: data };
            }

            case 'updateTicket': {
                const res = await fetch(`${BASE}/tickets/${inputs.ticketId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        subject: inputs.subject,
                        description: inputs.description,
                        priority: inputs.priority,
                        status: inputs.status,
                        type: inputs.type,
                        tags: inputs.tags,
                        custom_fields: inputs.customFields,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to update ticket' };
                return { output: data };
            }

            case 'listTickets': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.orderBy) params.set('order_by', inputs.orderBy);
                if (inputs.orderType) params.set('order_type', inputs.orderType);
                const res = await fetch(`${BASE}/tickets?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list tickets' };
                return { output: { tickets: data } };
            }

            case 'deleteTicket': {
                const res = await fetch(`${BASE}/tickets/${inputs.ticketId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.description || 'Failed to delete ticket' };
                }
                return { output: { success: true } };
            }

            case 'addNote': {
                const res = await fetch(`${BASE}/tickets/${inputs.ticketId}/notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        body: inputs.body,
                        private: inputs.private !== undefined ? inputs.private : true,
                        notify_emails: inputs.notifyEmails,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to add note' };
                return { output: data };
            }

            case 'listNotes': {
                const res = await fetch(`${BASE}/tickets/${inputs.ticketId}/conversations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list notes' };
                return { output: { notes: data } };
            }

            case 'createContact': {
                const res = await fetch(`${BASE}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        email: inputs.email,
                        phone: inputs.phone,
                        mobile: inputs.mobile,
                        company_id: inputs.companyId,
                        custom_fields: inputs.customFields,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create contact' };
                return { output: data };
            }

            case 'getContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to get contact' };
                return { output: data };
            }

            case 'updateContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        email: inputs.email,
                        phone: inputs.phone,
                        mobile: inputs.mobile,
                        custom_fields: inputs.customFields,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to update contact' };
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${BASE}/contacts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list contacts' };
                return { output: { contacts: data } };
            }

            case 'createAgent': {
                const res = await fetch(`${BASE}/agents`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        email: inputs.email,
                        ticket_scope: inputs.ticketScope || 1,
                        role_ids: inputs.roleIds,
                        group_ids: inputs.groupIds,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create agent' };
                return { output: data };
            }

            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE}/agents?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list agents' };
                return { output: { agents: data } };
            }

            case 'listGroups': {
                const res = await fetch(`${BASE}/groups`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to list groups' };
                return { output: { groups: data } };
            }

            case 'createCompany': {
                const res = await fetch(`${BASE}/companies`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        domains: inputs.domains,
                        description: inputs.description,
                        custom_fields: inputs.customFields,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.description || 'Failed to create company' };
                return { output: data };
            }

            default:
                return { error: `Unknown Freshdesk Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Freshdesk Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Freshdesk Enhanced action' };
    }
}
