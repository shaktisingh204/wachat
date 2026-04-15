
'use server';

async function ninjFetch(serverUrl: string, apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[InvoiceNinja] ${method} ${path}`);
    const url = `${serverUrl}/api/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'X-API-TOKEN': apiToken,
            'X-Requested-With': 'XMLHttpRequest',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = text; }
    if (!res.ok) {
        throw new Error(data?.message || `Invoice Ninja API error: ${res.status}`);
    }
    return data;
}

export async function executeInvoiceNinjaAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!serverUrl || !apiToken) throw new Error('serverUrl and apiToken are required.');
        const nf = (method: string, path: string, body?: any) => ninjFetch(serverUrl, apiToken, method, path, body, logger);

        switch (actionName) {
            case 'listInvoices': {
                const perPage = Number(inputs.perPage ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await nf('GET', `/invoices?per_page=${perPage}&page=${page}`);
                return { output: { data: data.data ?? [], meta: data.meta } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await nf('GET', `/invoices/${invoiceId}`);
                return { output: data.data ?? data };
            }

            case 'createInvoice': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const lineItems = inputs.lineItems ?? [];
                const body: any = { client_id: clientId, line_items: lineItems };
                if (inputs.dueDate) body.due_date = String(inputs.dueDate);
                if (inputs.number) body.number = String(inputs.number);
                if (inputs.publicNotes) body.public_notes = String(inputs.publicNotes);
                const data = await nf('POST', '/invoices', body);
                return { output: data.data ?? data };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const body: any = {};
                if (inputs.clientId) body.client_id = String(inputs.clientId);
                if (inputs.dueDate) body.due_date = String(inputs.dueDate);
                if (inputs.publicNotes) body.public_notes = String(inputs.publicNotes);
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                const data = await nf('PUT', `/invoices/${invoiceId}`, body);
                return { output: data.data ?? data };
            }

            case 'deleteInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                await nf('DELETE', `/invoices/${invoiceId}`);
                return { output: { success: true, invoiceId } };
            }

            case 'sendInvoiceEmail': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await nf('POST', `/emails`, { entity: 'invoice', entity_id: invoiceId, template: String(inputs.template ?? 'email_template_invoice'), subject: String(inputs.subject ?? ''), body: String(inputs.body ?? '') });
                return { output: { success: true, invoiceId } };
            }

            case 'listClients': {
                const perPage = Number(inputs.perPage ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await nf('GET', `/clients?per_page=${perPage}&page=${page}`);
                return { output: { data: data.data ?? [], meta: data.meta } };
            }

            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await nf('GET', `/clients/${clientId}`);
                return { output: data.data ?? data };
            }

            case 'createClient': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.email) body.contacts = [{ email: String(inputs.email), first_name: String(inputs.firstName ?? ''), last_name: String(inputs.lastName ?? '') }];
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.address1) body.address1 = String(inputs.address1);
                const data = await nf('POST', '/clients', body);
                return { output: data.data ?? data };
            }

            case 'updateClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.address1) body.address1 = String(inputs.address1);
                const data = await nf('PUT', `/clients/${clientId}`, body);
                return { output: data.data ?? data };
            }

            case 'listPayments': {
                const perPage = Number(inputs.perPage ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await nf('GET', `/payments?per_page=${perPage}&page=${page}`);
                return { output: { data: data.data ?? [], meta: data.meta } };
            }

            case 'createPayment': {
                const clientId = String(inputs.clientId ?? '').trim();
                const amount = Number(inputs.amount ?? 0);
                if (!clientId) throw new Error('clientId is required.');
                const body: any = { client_id: clientId, amount, date: String(inputs.date ?? new Date().toISOString().split('T')[0]) };
                if (inputs.invoices) body.invoices = inputs.invoices;
                if (inputs.typeId) body.type_id = String(inputs.typeId);
                const data = await nf('POST', '/payments', body);
                return { output: data.data ?? data };
            }

            case 'listQuotes': {
                const perPage = Number(inputs.perPage ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await nf('GET', `/quotes?per_page=${perPage}&page=${page}`);
                return { output: { data: data.data ?? [], meta: data.meta } };
            }

            case 'createQuote': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const body: any = { client_id: clientId, line_items: inputs.lineItems ?? [] };
                if (inputs.validUntil) body.valid_until = String(inputs.validUntil);
                const data = await nf('POST', '/quotes', body);
                return { output: data.data ?? data };
            }

            case 'listExpenses': {
                const perPage = Number(inputs.perPage ?? 20);
                const page = Number(inputs.page ?? 1);
                const data = await nf('GET', `/expenses?per_page=${perPage}&page=${page}`);
                return { output: { data: data.data ?? [], meta: data.meta } };
            }

            default:
                throw new Error(`Unsupported Invoice Ninja action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
