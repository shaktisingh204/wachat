'use server';

export async function executeZendeskSellAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.getbase.com/v2';
    const headers = {
        'Authorization': `Bearer ${inputs.accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listLeads': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                const res = await fetch(`${baseUrl}/leads?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list leads' };
                return { output: data };
            }

            case 'getLead': {
                const res = await fetch(`${baseUrl}/leads/${inputs.leadId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get lead' };
                return { output: data };
            }

            case 'createLead': {
                const res = await fetch(`${baseUrl}/leads`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            organization_name: inputs.organizationName,
                            email: inputs.email,
                            phone: inputs.phone,
                            mobile: inputs.mobile,
                            description: inputs.description,
                            status: inputs.status,
                            source_id: inputs.sourceId,
                            owner_id: inputs.ownerId,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create lead' };
                return { output: data };
            }

            case 'updateLead': {
                const res = await fetch(`${baseUrl}/leads/${inputs.leadId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        data: {
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            organization_name: inputs.organizationName,
                            email: inputs.email,
                            phone: inputs.phone,
                            description: inputs.description,
                            status: inputs.status,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update lead' };
                return { output: data };
            }

            case 'deleteLead': {
                const res = await fetch(`${baseUrl}/leads/${inputs.leadId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.errors?.[0]?.message || 'Failed to delete lead' };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                const res = await fetch(`${baseUrl}/contacts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list contacts' };
                return { output: data };
            }

            case 'getContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get contact' };
                return { output: data };
            }

            case 'createContact': {
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            email: inputs.email,
                            phone: inputs.phone,
                            mobile: inputs.mobile,
                            title: inputs.title,
                            description: inputs.description,
                            owner_id: inputs.ownerId,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create contact' };
                return { output: data };
            }

            case 'listDeals': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.sortBy) params.set('sort_by', inputs.sortBy);
                const res = await fetch(`${baseUrl}/deals?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list deals' };
                return { output: data };
            }

            case 'getDeal': {
                const res = await fetch(`${baseUrl}/deals/${inputs.dealId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get deal' };
                return { output: data };
            }

            case 'createDeal': {
                const res = await fetch(`${baseUrl}/deals`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            name: inputs.name,
                            contact_id: inputs.contactId,
                            value: inputs.value,
                            currency: inputs.currency,
                            stage_id: inputs.stageId,
                            owner_id: inputs.ownerId,
                            expected_close_date: inputs.expectedCloseDate,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create deal' };
                return { output: data };
            }

            case 'updateDeal': {
                const res = await fetch(`${baseUrl}/deals/${inputs.dealId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        data: {
                            name: inputs.name,
                            value: inputs.value,
                            currency: inputs.currency,
                            stage_id: inputs.stageId,
                            expected_close_date: inputs.expectedCloseDate,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update deal' };
                return { output: data };
            }

            case 'listActivities': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.resourceType) params.set('resource_type', inputs.resourceType);
                if (inputs.resourceId) params.set('resource_id', String(inputs.resourceId));
                const res = await fetch(`${baseUrl}/activities?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list activities' };
                return { output: data };
            }

            case 'createActivity': {
                const res = await fetch(`${baseUrl}/activities`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        data: {
                            resource_type: inputs.resourceType,
                            resource_id: inputs.resourceId,
                            activity_type_id: inputs.activityTypeId,
                            done: inputs.done,
                            due_date: inputs.dueDate,
                            note: inputs.note,
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create activity' };
                return { output: data };
            }

            case 'listNotes': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.resourceType) params.set('resource_type', inputs.resourceType);
                if (inputs.resourceId) params.set('resource_id', String(inputs.resourceId));
                const res = await fetch(`${baseUrl}/notes?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list notes' };
                return { output: data };
            }

            default:
                return { error: `Unknown Zendesk Sell action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zendesk Sell action error: ${err.message}`);
        return { error: err.message || 'An unexpected error occurred' };
    }
}
