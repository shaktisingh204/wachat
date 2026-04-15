
'use server';

const ZB_BASE = 'https://www.zohoapis.com/books/v3';

async function zbFetch(accessToken: string, organizationId: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[ZohoBooks] ${method} ${path}`);
    const sep = path.includes('?') ? '&' : '?';
    const url = `${ZB_BASE}${path}${sep}organization_id=${organizationId}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Zoho-oauthtoken ${accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok || (data.code !== undefined && data.code !== 0)) {
        throw new Error(data?.message || `Zoho Books API error: ${res.status}`);
    }
    return data;
}

export async function executeZohoBooksAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const organizationId = String(inputs.organizationId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!organizationId) throw new Error('organizationId is required.');
        const zb = (method: string, path: string, body?: any) => zbFetch(accessToken, organizationId, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.contactType) params.set('contact_type', String(inputs.contactType));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/contacts${query}`);
                return { output: { contacts: data.contacts ?? [] } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await zb('GET', `/contacts/${contactId}`);
                return { output: data.contact ?? data };
            }

            case 'createContact': {
                const contactName = String(inputs.contactName ?? '').trim();
                if (!contactName) throw new Error('contactName is required.');
                const body: any = { contact_name: contactName };
                if (inputs.contactType) body.contact_type = inputs.contactType;
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.website) body.website = inputs.website;
                if (inputs.currencyCode) body.currency_code = inputs.currencyCode;
                const data = await zb('POST', '/contacts', body);
                return { output: data.contact ?? data };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.contactName) body.contact_name = inputs.contactName;
                if (inputs.email) body.email = inputs.email;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.website) body.website = inputs.website;
                const data = await zb('PUT', `/contacts/${contactId}`, body);
                return { output: data.contact ?? data };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await zb('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: true } };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.status) params.set('status', String(inputs.status));
                if (inputs.customerId) params.set('customer_id', String(inputs.customerId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/invoices${query}`);
                return { output: { invoices: data.invoices ?? [] } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await zb('GET', `/invoices/${invoiceId}`);
                return { output: data.invoice ?? data };
            }

            case 'createInvoice': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const body: any = { customer_id: customerId };
                if (inputs.invoiceNumber) body.invoice_number = inputs.invoiceNumber;
                if (inputs.date) body.date = inputs.date;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.terms) body.terms = inputs.terms;
                if (inputs.discount) body.discount = inputs.discount;
                const data = await zb('POST', '/invoices', body);
                return { output: data.invoice ?? data };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const body: any = {};
                if (inputs.customerId) body.customer_id = inputs.customerId;
                if (inputs.date) body.date = inputs.date;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                if (inputs.notes) body.notes = inputs.notes;
                const data = await zb('PUT', `/invoices/${invoiceId}`, body);
                return { output: data.invoice ?? data };
            }

            case 'deleteInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                await zb('DELETE', `/invoices/${invoiceId}`);
                return { output: { deleted: true } };
            }

            case 'emailInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const body: any = {};
                if (inputs.toEmailIds) body.to_mail_ids = Array.isArray(inputs.toEmailIds) ? inputs.toEmailIds : [inputs.toEmailIds];
                if (inputs.subject) body.subject = inputs.subject;
                if (inputs.body) body.body = inputs.body;
                const data = await zb('POST', `/invoices/${invoiceId}/email`, body);
                return { output: { sent: true, message: data.message ?? 'Email sent' } };
            }

            case 'listBills': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.status) params.set('status', String(inputs.status));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/bills${query}`);
                return { output: { bills: data.bills ?? [] } };
            }

            case 'getBill': {
                const billId = String(inputs.billId ?? '').trim();
                if (!billId) throw new Error('billId is required.');
                const data = await zb('GET', `/bills/${billId}`);
                return { output: data.bill ?? data };
            }

            case 'createBill': {
                const vendorId = String(inputs.vendorId ?? '').trim();
                if (!vendorId) throw new Error('vendorId is required.');
                const body: any = { vendor_id: vendorId };
                if (inputs.billNumber) body.bill_number = inputs.billNumber;
                if (inputs.date) body.date = inputs.date;
                if (inputs.dueDate) body.due_date = inputs.dueDate;
                if (inputs.lineItems) body.line_items = inputs.lineItems;
                if (inputs.notes) body.notes = inputs.notes;
                const data = await zb('POST', '/bills', body);
                return { output: data.bill ?? data };
            }

            case 'listExpenses': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/expenses${query}`);
                return { output: { expenses: data.expenses ?? [] } };
            }

            case 'createExpense': {
                const accountId = String(inputs.accountId ?? '').trim();
                const amount = inputs.amount;
                if (!accountId || amount === undefined) throw new Error('accountId and amount are required.');
                const body: any = {
                    account_id: accountId,
                    amount: Number(amount),
                };
                if (inputs.date) body.date = inputs.date;
                if (inputs.paidThroughAccountId) body.paid_through_account_id = inputs.paidThroughAccountId;
                if (inputs.description) body.description = inputs.description;
                if (inputs.currencyCode) body.currency_code = inputs.currencyCode;
                const data = await zb('POST', '/expenses', body);
                return { output: data.expense ?? data };
            }

            case 'listItems': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/items${query}`);
                return { output: { items: data.items ?? [] } };
            }

            case 'createItem': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.rate !== undefined) body.rate = Number(inputs.rate);
                if (inputs.description) body.description = inputs.description;
                if (inputs.unit) body.unit = inputs.unit;
                if (inputs.taxId) body.tax_id = inputs.taxId;
                const data = await zb('POST', '/items', body);
                return { output: data.item ?? data };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.customerId) params.set('customer_id', String(inputs.customerId));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await zb('GET', `/customerpayments${query}`);
                return { output: { payments: data.customerpayments ?? [] } };
            }

            default:
                throw new Error(`Unknown Zoho Books action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[ZohoBooks] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Zoho Books error' };
    }
}
