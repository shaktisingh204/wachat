'use server';

const COPPER_BASE = 'https://api.copper.com/developer_api/v1';

async function copperFetch(apiKey: string, email: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Copper] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'X-PW-AccessToken': apiKey,
            'X-PW-Application': 'developer_api',
            'X-PW-UserEmail': email,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${COPPER_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Copper API error: ${res.status}`);
    }
    return data;
}

export async function executeCopperAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const email = String(inputs.email ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!email) throw new Error('email is required.');
        const cp = (method: string, path: string, body?: any) =>
            copperFetch(apiKey, email, method, path, body, logger);

        switch (actionName) {
            case 'listPeople': {
                const page_size = inputs.pageSize ? Number(inputs.pageSize) : 20;
                const page_number = inputs.pageNumber ? Number(inputs.pageNumber) : 1;
                const data = await cp('POST', '/people/search', { page_size, page_number });
                return { output: { people: Array.isArray(data) ? data : [] } };
            }

            case 'getPerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                const data = await cp('GET', `/people/${personId}`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? '',
                        emails: data.emails ?? [],
                        phone_numbers: data.phone_numbers ?? [],
                    },
                };
            }

            case 'createPerson': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.email) body.emails = [{ email: String(inputs.email).trim(), category: 'work' }];
                if (inputs.phone) body.phone_numbers = [{ number: String(inputs.phone).trim(), category: 'work' }];
                if (inputs.companyName) body.company_name = String(inputs.companyName).trim();
                const data = await cp('POST', '/people', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'updatePerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.email) body.emails = [{ email: String(inputs.email).trim(), category: 'work' }];
                const data = await cp('PUT', `/people/${personId}`, body);
                return { output: { id: String(data.id ?? personId) } };
            }

            case 'deletePerson': {
                const personId = String(inputs.personId ?? '').trim();
                if (!personId) throw new Error('personId is required.');
                await cp('DELETE', `/people/${personId}`);
                return { output: { deleted: 'true', personId } };
            }

            case 'listCompanies': {
                const page_size = inputs.pageSize ? Number(inputs.pageSize) : 20;
                const data = await cp('POST', '/companies/search', { page_size });
                return { output: { companies: Array.isArray(data) ? data : [] } };
            }

            case 'getCompany': {
                const companyId = String(inputs.companyId ?? '').trim();
                if (!companyId) throw new Error('companyId is required.');
                const data = await cp('GET', `/companies/${companyId}`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        name: data.name ?? '',
                        website: data.websites?.[0]?.url ?? '',
                    },
                };
            }

            case 'createCompany': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.website) body.websites = [{ url: String(inputs.website).trim(), category: 'work' }];
                if (inputs.phone) body.phone_numbers = [{ number: String(inputs.phone).trim(), category: 'work' }];
                const data = await cp('POST', '/companies', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'listOpportunities': {
                const page_size = inputs.pageSize ? Number(inputs.pageSize) : 20;
                const data = await cp('POST', '/opportunities/search', { page_size });
                return { output: { opportunities: Array.isArray(data) ? data : [] } };
            }

            case 'createOpportunity': {
                const name = String(inputs.name ?? '').trim();
                const companyId = String(inputs.companyId ?? '').trim();
                const status = String(inputs.status ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!companyId) throw new Error('companyId is required.');
                if (!status) throw new Error('status is required.');
                const body: any = { name, company_id: Number(companyId), status };
                if (inputs.monetaryValue !== undefined) body.monetary_value = Number(inputs.monetaryValue);
                const data = await cp('POST', '/opportunities', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'listTasks': {
                const data = await cp('POST', '/tasks/search', {});
                return { output: { tasks: Array.isArray(data) ? data : [] } };
            }

            case 'createTask': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.dueDate) body.due_date = Number(inputs.dueDate);
                if (inputs.relatedResourceId && inputs.relatedResourceType) {
                    body.related_resource = {
                        id: Number(inputs.relatedResourceId),
                        type: String(inputs.relatedResourceType).trim(),
                    };
                }
                const data = await cp('POST', '/tasks', body);
                return { output: { id: String(data.id ?? ''), name: data.name ?? name } };
            }

            case 'listActivities': {
                const parentId = String(inputs.parentId ?? '').trim();
                const parentType = String(inputs.parentType ?? '').trim();
                if (!parentId) throw new Error('parentId is required.');
                if (!parentType) throw new Error('parentType is required.');
                const data = await cp(
                    'GET',
                    `/activities?parent[id]=${parentId}&parent[type]=${parentType}`
                );
                return { output: { activities: Array.isArray(data) ? data : [] } };
            }

            default:
                return { error: `Copper action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Copper action failed.' };
    }
}
