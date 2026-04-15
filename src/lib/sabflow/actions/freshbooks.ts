'use server';

export async function executeFreshBooksAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const accountId = String(inputs.accountId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!accountId) throw new Error('accountId is required.');

        const base = `https://api.freshbooks.com`;
        const headers = {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        };

        const fbFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[FreshBooks] ${method} ${path}`);
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const data = await res.json();
            if (!res.ok) {
                const msg = data?.response?.errors?.[0]?.message || data?.message || `FreshBooks API error: ${res.status}`;
                throw new Error(msg);
            }
            return data;
        };

        switch (actionName) {
            case 'listClients': {
                const data = await fbFetch('GET', `/accounting/account/${accountId}/users/clients`);
                return { output: { clients: data?.response?.result?.clients ?? [] } };
            }

            case 'getClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await fbFetch('GET', `/accounting/account/${accountId}/users/clients/${clientId}`);
                return { output: { client: data?.response?.result?.client ?? {} } };
            }

            case 'createClient': {
                const organization = String(inputs.organization ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!organization) throw new Error('organization is required.');
                const data = await fbFetch('POST', `/accounting/account/${accountId}/users/clients`, {
                    client: { organization, email },
                });
                return { output: { client: data?.response?.result?.client ?? {} } };
            }

            case 'updateClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const clientData: Record<string, any> = {};
                if (inputs.organization !== undefined) clientData.organization = inputs.organization;
                if (inputs.email !== undefined) clientData.email = inputs.email;
                const data = await fbFetch('PUT', `/accounting/account/${accountId}/users/clients/${clientId}`, { client: clientData });
                return { output: { client: data?.response?.result?.client ?? {} } };
            }

            case 'deleteClient': {
                const clientId = String(inputs.clientId ?? '').trim();
                if (!clientId) throw new Error('clientId is required.');
                const data = await fbFetch('PUT', `/accounting/account/${accountId}/users/clients/${clientId}`, { client: { vis_state: 1 } });
                return { output: { success: true, client: data?.response?.result?.client ?? {} } };
            }

            case 'listInvoices': {
                const data = await fbFetch('GET', `/accounting/account/${accountId}/invoices/invoices`);
                return { output: { invoices: data?.response?.result?.invoices ?? [] } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await fbFetch('GET', `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`);
                return { output: { invoice: data?.response?.result?.invoice ?? {} } };
            }

            case 'createInvoice': {
                const invoiceData: Record<string, any> = {};
                if (inputs.customerid !== undefined) invoiceData.customerid = inputs.customerid;
                if (inputs.lines !== undefined) invoiceData.lines = inputs.lines;
                if (inputs.payment_details !== undefined) invoiceData.payment_details = inputs.payment_details;
                const data = await fbFetch('POST', `/accounting/account/${accountId}/invoices/invoices`, { invoice: invoiceData });
                return { output: { invoice: data?.response?.result?.invoice ?? {} } };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const invoiceData: Record<string, any> = {};
                if (inputs.lines !== undefined) invoiceData.lines = inputs.lines;
                if (inputs.payment_details !== undefined) invoiceData.payment_details = inputs.payment_details;
                const data = await fbFetch('PUT', `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, { invoice: invoiceData });
                return { output: { invoice: data?.response?.result?.invoice ?? {} } };
            }

            case 'deleteInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await fbFetch('PUT', `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, { invoice: { vis_state: 1 } });
                return { output: { success: true, invoice: data?.response?.result?.invoice ?? {} } };
            }

            case 'sendInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await fbFetch('PUT', `/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, { invoice: { action_email: true } });
                return { output: { success: true, invoice: data?.response?.result?.invoice ?? {} } };
            }

            case 'listPayments': {
                const data = await fbFetch('GET', `/accounting/account/${accountId}/payments/payments`);
                return { output: { payments: data?.response?.result?.payments ?? [] } };
            }

            case 'createPayment': {
                const paymentData: Record<string, any> = {};
                if (inputs.invoiceid !== undefined) paymentData.invoiceid = inputs.invoiceid;
                if (inputs.amount !== undefined) paymentData.amount = { amount: inputs.amount, code: inputs.currencyCode ?? 'USD' };
                if (inputs.date !== undefined) paymentData.date = inputs.date;
                const data = await fbFetch('POST', `/accounting/account/${accountId}/payments/payments`, { payment: paymentData });
                return { output: { payment: data?.response?.result?.payment ?? {} } };
            }

            case 'listExpenses': {
                const data = await fbFetch('GET', `/accounting/account/${accountId}/expenses/expenses`);
                return { output: { expenses: data?.response?.result?.expenses ?? [] } };
            }

            case 'createExpense': {
                const expenseData: Record<string, any> = {};
                if (inputs.amount !== undefined) expenseData.amount = { amount: inputs.amount, code: inputs.currencyCode ?? 'USD' };
                if (inputs.categoryid !== undefined) expenseData.categoryid = inputs.categoryid;
                if (inputs.date !== undefined) expenseData.date = inputs.date;
                if (inputs.notes !== undefined) expenseData.notes = inputs.notes;
                const data = await fbFetch('POST', `/accounting/account/${accountId}/expenses/expenses`, { expense: expenseData });
                return { output: { expense: data?.response?.result?.expense ?? {} } };
            }

            case 'listItems': {
                const data = await fbFetch('GET', `/accounting/account/${accountId}/items/items`);
                return { output: { items: data?.response?.result?.items ?? [] } };
            }

            case 'createItem': {
                const itemData: Record<string, any> = {};
                if (inputs.name !== undefined) itemData.name = inputs.name;
                if (inputs.unit_cost !== undefined) itemData.unit_cost = { amount: inputs.unit_cost, code: inputs.currencyCode ?? 'USD' };
                if (inputs.description !== undefined) itemData.description = inputs.description;
                const data = await fbFetch('POST', `/accounting/account/${accountId}/items/items`, { item: itemData });
                return { output: { item: data?.response?.result?.item ?? {} } };
            }

            default:
                throw new Error(`Unknown FreshBooks action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[FreshBooks] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown FreshBooks error' };
    }
}
