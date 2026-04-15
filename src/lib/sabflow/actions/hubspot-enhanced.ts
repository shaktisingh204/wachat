'use server';

export async function executeHubSpotEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const baseUrl = 'https://api.hubapi.com';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listContacts': {
                const limit = inputs.limit ?? 100;
                const after = inputs.after ?? '';
                const url = `${baseUrl}/crm/v3/objects/contacts?limit=${limit}${after ? `&after=${after}` : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data.results, paging: data.paging } };
            }
            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const properties = inputs.properties ? `?properties=${encodeURIComponent(inputs.properties)}` : '';
                const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}${properties}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }
            case 'createContact': {
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }
            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }
            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const res = await fetch(`${baseUrl}/crm/v3/objects/contacts/${contactId}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, contactId } };
            }
            case 'listDeals': {
                const limit = inputs.limit ?? 100;
                const after = inputs.after ?? '';
                const url = `${baseUrl}/crm/v3/objects/deals?limit=${limit}${after ? `&after=${after}` : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deals: data.results, paging: data.paging } };
            }
            case 'getDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const properties = inputs.properties ? `?properties=${encodeURIComponent(inputs.properties)}` : '';
                const res = await fetch(`${baseUrl}/crm/v3/objects/deals/${dealId}${properties}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deal: data } };
            }
            case 'createDeal': {
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/deals`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deal: data } };
            }
            case 'updateDeal': {
                const dealId = String(inputs.dealId ?? '').trim();
                if (!dealId) throw new Error('dealId is required.');
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/deals/${dealId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { deal: data } };
            }
            case 'listCompanies': {
                const limit = inputs.limit ?? 100;
                const after = inputs.after ?? '';
                const url = `${baseUrl}/crm/v3/objects/companies?limit=${limit}${after ? `&after=${after}` : ''}`;
                const res = await fetch(url, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { companies: data.results, paging: data.paging } };
            }
            case 'getCompany': {
                const companyId = String(inputs.companyId ?? '').trim();
                if (!companyId) throw new Error('companyId is required.');
                const properties = inputs.properties ? `?properties=${encodeURIComponent(inputs.properties)}` : '';
                const res = await fetch(`${baseUrl}/crm/v3/objects/companies/${companyId}${properties}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { company: data } };
            }
            case 'createCompany': {
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/companies`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { company: data } };
            }
            case 'updateCompany': {
                const companyId = String(inputs.companyId ?? '').trim();
                if (!companyId) throw new Error('companyId is required.');
                const properties = inputs.properties ?? {};
                const res = await fetch(`${baseUrl}/crm/v3/objects/companies/${companyId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ properties }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { company: data } };
            }
            case 'searchObjects': {
                const objectType = String(inputs.objectType ?? 'contacts').trim();
                const filterGroups = inputs.filterGroups ?? [];
                const sorts = inputs.sorts ?? [];
                const properties = inputs.properties ?? [];
                const limit = inputs.limit ?? 100;
                const after = inputs.after ?? 0;
                const res = await fetch(`${baseUrl}/crm/v3/objects/${objectType}/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filterGroups, sorts, properties, limit, after }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { results: data.results, total: data.total, paging: data.paging } };
            }
            case 'createAssociation': {
                const fromObjectType = String(inputs.fromObjectType ?? '').trim();
                const fromObjectId = String(inputs.fromObjectId ?? '').trim();
                const toObjectType = String(inputs.toObjectType ?? '').trim();
                const toObjectId = String(inputs.toObjectId ?? '').trim();
                const associationTypeId = inputs.associationTypeId ?? 1;
                if (!fromObjectType || !fromObjectId || !toObjectType || !toObjectId) {
                    throw new Error('fromObjectType, fromObjectId, toObjectType, and toObjectId are required.');
                }
                const res = await fetch(`${baseUrl}/crm/v4/objects/${fromObjectType}/${fromObjectId}/associations/${toObjectType}/${toObjectId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify([{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId }]),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { association: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
