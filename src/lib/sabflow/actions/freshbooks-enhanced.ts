'use server';

export async function executeFreshBooksEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.freshbooks.com';
    const accessToken = inputs.accessToken;

    try {
        switch (actionName) {
            case 'listClients': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required' };
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.search) params.set('search[email]', inputs.search);
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/users/clients?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list clients' };
                return { output: data };
            }

            case 'getClient': {
                const { accountId, clientId } = inputs;
                if (!accountId || !clientId) return { error: 'accountId and clientId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/users/clients/${clientId}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get client' };
                return { output: data };
            }

            case 'createClient': {
                const { accountId, email, fname, lname, organization } = inputs;
                if (!accountId || !email) return { error: 'accountId and email are required' };
                const body: any = { client: { email } };
                if (fname) body.client.fname = fname;
                if (lname) body.client.lname = lname;
                if (organization) body.client.organization = organization;
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/users/clients`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create client' };
                return { output: data };
            }

            case 'updateClient': {
                const { accountId, clientId, ...updateFields } = inputs;
                if (!accountId || !clientId) return { error: 'accountId and clientId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/users/clients/${clientId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify({ client: updateFields }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update client' };
                return { output: data };
            }

            case 'deleteClient': {
                const { accountId, clientId } = inputs;
                if (!accountId || !clientId) return { error: 'accountId and clientId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/users/clients/${clientId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify({ client: { vis_state: 1 } }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete client' };
                return { output: { success: true, ...data } };
            }

            case 'listInvoices': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required' };
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.status) params.set('search[v2_status]', inputs.status);
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/invoices/invoices?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list invoices' };
                return { output: data };
            }

            case 'getInvoice': {
                const { accountId, invoiceId } = inputs;
                if (!accountId || !invoiceId) return { error: 'accountId and invoiceId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get invoice' };
                return { output: data };
            }

            case 'createInvoice': {
                const { accountId, customerid, lines } = inputs;
                if (!accountId || !customerid) return { error: 'accountId and customerid are required' };
                const body: any = { invoice: { customerid } };
                if (lines) body.invoice.lines = lines;
                if (inputs.create_date) body.invoice.create_date = inputs.create_date;
                if (inputs.due_offset_days) body.invoice.due_offset_days = inputs.due_offset_days;
                if (inputs.currency_code) body.invoice.currency_code = inputs.currency_code;
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/invoices/invoices`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create invoice' };
                return { output: data };
            }

            case 'updateInvoice': {
                const { accountId, invoiceId, ...updateFields } = inputs;
                if (!accountId || !invoiceId) return { error: 'accountId and invoiceId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify({ invoice: updateFields }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update invoice' };
                return { output: data };
            }

            case 'sendInvoice': {
                const { accountId, invoiceId, email, subject, message } = inputs;
                if (!accountId || !invoiceId) return { error: 'accountId and invoiceId are required' };
                const body: any = { invoice: { action_email: true } };
                if (email) body.invoice.email = email;
                if (subject) body.invoice.email_subject = subject;
                if (message) body.invoice.email_body = message;
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/invoices/invoices/${invoiceId}`, {
                    method: 'PUT',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send invoice' };
                return { output: data };
            }

            case 'listPayments': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required' };
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/payments/payments?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list payments' };
                return { output: data };
            }

            case 'getPayment': {
                const { accountId, paymentId } = inputs;
                if (!accountId || !paymentId) return { error: 'accountId and paymentId are required' };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/payments/payments/${paymentId}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get payment' };
                return { output: data };
            }

            case 'createPayment': {
                const { accountId, invoiceid, date, amount, type } = inputs;
                if (!accountId || !invoiceid || !date || !amount) return { error: 'accountId, invoiceid, date and amount are required' };
                const body: any = { payment: { invoiceid, date, amount: { amount, code: inputs.currency_code || 'USD' }, type: type || 'Check' } };
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/payments/payments`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create payment' };
                return { output: data };
            }

            case 'listExpenses': {
                const { accountId } = inputs;
                if (!accountId) return { error: 'accountId is required' };
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/expenses/expenses?${params}`, {
                    headers: { Authorization: `Bearer ${accessToken}`, 'Api-Version': 'alpha' },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list expenses' };
                return { output: data };
            }

            case 'createExpense': {
                const { accountId, date, amount, category } = inputs;
                if (!accountId || !date || !amount) return { error: 'accountId, date and amount are required' };
                const body: any = {
                    expense: {
                        date,
                        amount: { amount, code: inputs.currency_code || 'USD' },
                    },
                };
                if (category) body.expense.categoryid = category;
                if (inputs.notes) body.expense.notes = inputs.notes;
                if (inputs.clientid) body.expense.clientid = inputs.clientid;
                const res = await fetch(`${baseUrl}/accounting/account/${accountId}/expenses/expenses`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', 'Api-Version': 'alpha' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create expense' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`FreshBooks Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unknown error in FreshBooks Enhanced action' };
    }
}
