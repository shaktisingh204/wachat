'use server';

async function acumaticaLogin(baseUrl: string, name: string, password: string, company: string): Promise<string> {
    const res = await fetch(`${baseUrl}/entity/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, company }),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Acumatica login failed (${res.status}): ${text}`);
    }
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new Error('Acumatica login: no session cookie returned');
    // Extract the first cookie segment (e.g. ASP.NET_SessionId=...)
    const cookie = setCookie.split(';')[0];
    return cookie;
}

async function acuRequest(method: string, url: string, cookie: string, body?: any, queryParams?: Record<string, string>): Promise<any> {
    const reqUrl = new URL(url);
    if (queryParams) {
        for (const [k, v] of Object.entries(queryParams)) reqUrl.searchParams.set(k, v);
    }
    const res = await fetch(reqUrl.toString(), {
        method,
        headers: {
            Cookie: cookie,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (res.status === 204) return { success: true };
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        throw new Error(data?.message ?? data?.exceptionMessage ?? `Acumatica API error ${res.status}: ${text}`);
    }
    return data;
}

async function getSession(inputs: any): Promise<{ cookie: string; apiBase: string }> {
    if (!inputs.baseUrl) throw new Error('Missing required input: baseUrl');
    if (!inputs.username && !inputs.name) throw new Error('Missing required input: username');
    if (!inputs.password) throw new Error('Missing required input: password');
    const name = inputs.username ?? inputs.name;
    const company = inputs.company ?? '';
    const endpoint = inputs.endpoint ?? 'Default';
    const version = inputs.version ?? '23.200.001';
    const cookie = await acumaticaLogin(inputs.baseUrl, name, inputs.password, company);
    const apiBase = `${inputs.baseUrl}/entity/${endpoint}/${version}`;
    return { cookie, apiBase };
}

export async function executeAcumaticaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        logger.log(`Executing Acumatica action: ${actionName}`);
        const { cookie, apiBase } = await getSession(inputs);

        switch (actionName) {

            case 'listAccounts': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                const data = await acuRequest('GET', `${apiBase}/Account`, cookie, undefined, params);
                return { output: { accounts: data, count: Array.isArray(data) ? data.length : undefined } };
            }

            case 'getAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const data = await acuRequest('GET', `${apiBase}/Account/${inputs.accountId}`, cookie);
                return { output: { account: data } };
            }

            case 'createAccount': {
                if (!inputs.data) return { error: 'Missing required input: data (account fields)' };
                const data = await acuRequest('PUT', `${apiBase}/Account`, cookie, inputs.data);
                return { output: { created: true, account: data } };
            }

            case 'updateAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.data) return { error: 'Missing required input: data (fields to update)' };
                const data = await acuRequest('PUT', `${apiBase}/Account/${inputs.accountId}`, cookie, inputs.data);
                return { output: { updated: true, account: data } };
            }

            case 'listContacts': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                const data = await acuRequest('GET', `${apiBase}/Contact`, cookie, undefined, params);
                return { output: { contacts: data, count: Array.isArray(data) ? data.length : undefined } };
            }

            case 'getContact': {
                if (!inputs.contactId) return { error: 'Missing required input: contactId' };
                const data = await acuRequest('GET', `${apiBase}/Contact/${inputs.contactId}`, cookie);
                return { output: { contact: data } };
            }

            case 'createContact': {
                if (!inputs.data) return { error: 'Missing required input: data (contact fields)' };
                const data = await acuRequest('PUT', `${apiBase}/Contact`, cookie, inputs.data);
                return { output: { created: true, contact: data } };
            }

            case 'listOrders': {
                const entity = inputs.entity ?? 'SalesOrder';
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                const data = await acuRequest('GET', `${apiBase}/${entity}`, cookie, undefined, params);
                return { output: { orders: data, count: Array.isArray(data) ? data.length : undefined } };
            }

            case 'getOrder': {
                if (!inputs.orderId) return { error: 'Missing required input: orderId' };
                const entity = inputs.entity ?? 'SalesOrder';
                const data = await acuRequest('GET', `${apiBase}/${entity}/${inputs.orderId}`, cookie);
                return { output: { order: data } };
            }

            case 'createOrder': {
                if (!inputs.data) return { error: 'Missing required input: data (order fields)' };
                const entity = inputs.entity ?? 'SalesOrder';
                const data = await acuRequest('PUT', `${apiBase}/${entity}`, cookie, inputs.data);
                return { output: { created: true, order: data } };
            }

            case 'listProducts': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                const data = await acuRequest('GET', `${apiBase}/StockItem`, cookie, undefined, params);
                return { output: { products: data, count: Array.isArray(data) ? data.length : undefined } };
            }

            case 'getProduct': {
                if (!inputs.productId) return { error: 'Missing required input: productId' };
                const data = await acuRequest('GET', `${apiBase}/StockItem/${inputs.productId}`, cookie);
                return { output: { product: data } };
            }

            case 'listInvoices': {
                const params: Record<string, string> = {};
                if (inputs.select) params['$select'] = inputs.select;
                if (inputs.filter) params['$filter'] = inputs.filter;
                if (inputs.top) params['$top'] = String(inputs.top);
                if (inputs.skip) params['$skip'] = String(inputs.skip);
                const data = await acuRequest('GET', `${apiBase}/Invoice`, cookie, undefined, params);
                return { output: { invoices: data, count: Array.isArray(data) ? data.length : undefined } };
            }

            case 'getInvoice': {
                if (!inputs.invoiceId) return { error: 'Missing required input: invoiceId' };
                const data = await acuRequest('GET', `${apiBase}/Invoice/${inputs.invoiceId}`, cookie);
                return { output: { invoice: data } };
            }

            case 'createInvoice': {
                if (!inputs.data) return { error: 'Missing required input: data (invoice fields)' };
                const data = await acuRequest('PUT', `${apiBase}/Invoice`, cookie, inputs.data);
                return { output: { created: true, invoice: data } };
            }

            default:
                return { error: `Acumatica action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`Acumatica action error [${actionName}]: ${err?.message}`);
        return { error: err?.message ?? 'Unknown Acumatica error' };
    }
}
