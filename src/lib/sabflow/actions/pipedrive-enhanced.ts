
'use server';

async function pipedriveRequest(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    baseUrl: string,
    path: string,
    apiToken: string,
    body?: Record<string, any>,
    queryParams?: Record<string, string>
): Promise<any> {
    const params = new URLSearchParams({ api_token: apiToken, ...(queryParams || {}) });
    const url = `${baseUrl}${path}?${params.toString()}`;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    const options: RequestInit = { method, headers };
    if (body && method !== 'GET' && method !== 'DELETE') {
        options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok || json?.success === false) {
        throw new Error(json?.error || json?.message || `Pipedrive error ${res.status}`);
    }
    return json;
}

export async function executePipedriveEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const apiToken: string = inputs.apiToken || inputs.api_token;
        if (!apiToken) throw new Error('Missing Pipedrive apiToken in inputs');

        const companyDomain = inputs.companyDomain || inputs.company_domain;
        const baseUrl = companyDomain
            ? `https://${companyDomain}.pipedrive.com/api/v1`
            : 'https://api.pipedrive.com/v1';

        const req = (
            method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
            path: string,
            body?: Record<string, any>,
            queryParams?: Record<string, string>
        ) => pipedriveRequest(method, baseUrl, path, apiToken, body, queryParams);

        switch (actionName) {
            case 'listProducts': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.start) query.start = String(inputs.start);
                const result = await req('GET', '/products', undefined, query);
                return { output: result };
            }
            case 'getProduct': {
                const result = await req('GET', `/products/${inputs.id}`);
                return { output: result };
            }
            case 'createProduct': {
                const result = await req('POST', '/products', {
                    name: inputs.name,
                    code: inputs.code,
                    unit: inputs.unit,
                    tax: inputs.tax,
                    prices: inputs.prices,
                    visible_to: inputs.visible_to,
                    owner_id: inputs.owner_id,
                });
                return { output: result };
            }
            case 'updateProduct': {
                const result = await req('PUT', `/products/${inputs.id}`, {
                    name: inputs.name,
                    code: inputs.code,
                    unit: inputs.unit,
                    tax: inputs.tax,
                    prices: inputs.prices,
                    visible_to: inputs.visible_to,
                });
                return { output: result };
            }
            case 'deleteProduct': {
                const result = await req('DELETE', `/products/${inputs.id}`);
                return { output: result };
            }
            case 'listDealProducts': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.start) query.start = String(inputs.start);
                const dealId = inputs.dealId || inputs.deal_id;
                const result = await req('GET', `/deals/${dealId}/products`, undefined, query);
                return { output: result };
            }
            case 'addProductToDeal': {
                const dealId = inputs.dealId || inputs.deal_id;
                const result = await req('POST', `/deals/${dealId}/products`, {
                    product_id: inputs.product_id,
                    unit_price: inputs.unit_price,
                    quantity: inputs.quantity || 1,
                    discount_percentage: inputs.discount_percentage,
                    comments: inputs.comments,
                });
                return { output: result };
            }
            case 'removeProductFromDeal': {
                const dealId = inputs.dealId || inputs.deal_id;
                const result = await req('DELETE', `/deals/${dealId}/products/${inputs.id}`);
                return { output: result };
            }
            case 'listGoals': {
                const query: Record<string, string> = {};
                if (inputs.type) query['type[name]'] = inputs.type;
                if (inputs.limit) query.limit = String(inputs.limit);
                const result = await req('GET', '/goals', undefined, query);
                return { output: result };
            }
            case 'createGoal': {
                const result = await req('POST', '/goals', {
                    title: inputs.title,
                    type: inputs.type || { name: 'deals_won', params: {} },
                    assignee: inputs.assignee || { id: inputs.assignee_id, type: 'person' },
                    expected_outcome: inputs.expected_outcome,
                    duration: inputs.duration,
                    interval: inputs.interval,
                });
                return { output: result };
            }
            case 'listLeads': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.start) query.start = String(inputs.start);
                if (inputs.archived_status) query.archived_status = inputs.archived_status;
                const result = await req('GET', '/leads', undefined, query);
                return { output: result };
            }
            case 'getLead': {
                const result = await req('GET', `/leads/${inputs.id}`);
                return { output: result };
            }
            case 'createLead': {
                const body: Record<string, any> = {
                    title: inputs.title,
                };
                if (inputs.owner_id) body.owner_id = inputs.owner_id;
                if (inputs.label_ids) body.label_ids = inputs.label_ids;
                if (inputs.person_id) body.person_id = inputs.person_id;
                if (inputs.organization_id) body.organization_id = inputs.organization_id;
                if (inputs.value) body.value = inputs.value;
                if (inputs.expected_close_date) body.expected_close_date = inputs.expected_close_date;
                const result = await req('POST', '/leads', body);
                return { output: result };
            }
            case 'updateLead': {
                const body: Record<string, any> = {};
                if (inputs.title) body.title = inputs.title;
                if (inputs.owner_id) body.owner_id = inputs.owner_id;
                if (inputs.label_ids) body.label_ids = inputs.label_ids;
                if (inputs.value) body.value = inputs.value;
                if (inputs.is_archived !== undefined) body.is_archived = inputs.is_archived;
                if (inputs.expected_close_date) body.expected_close_date = inputs.expected_close_date;
                const result = await req('PATCH', `/leads/${inputs.id}`, body);
                return { output: result };
            }
            case 'deleteLead': {
                const result = await req('DELETE', `/leads/${inputs.id}`);
                return { output: result };
            }
            case 'convertLeadToDeal': {
                const result = await req('POST', `/leads/${inputs.id}/convert`, inputs.deal || {});
                return { output: result };
            }
            case 'listMailThreads': {
                const query: Record<string, string> = {};
                if (inputs.limit) query.limit = String(inputs.limit);
                if (inputs.start) query.start = String(inputs.start);
                if (inputs.folder) query.folder = inputs.folder;
                const result = await req('GET', '/mailbox/mailThreads', undefined, query);
                return { output: result };
            }
            case 'getMailThread': {
                const result = await req('GET', `/mailbox/mailThreads/${inputs.id}`);
                return { output: result };
            }
            default:
                throw new Error(`Unknown Pipedrive Enhanced action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.('PipedriveEnhancedAction error', err);
        return { error: err?.message || String(err) };
    }
}
