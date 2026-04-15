
'use server';

const XERO_BASE = 'https://api.xero.com/api.xro/2.0';

async function xeroFetch(token: string, tenantId: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Xero] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Xero-tenant-id': tenantId,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${XERO_BASE}${path}`, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.Detail || data?.Message || data?.message || `Xero API error: ${res.status}`);
    return data;
}

export async function executeXeroAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const tenantId = String(inputs.tenantId ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        if (!tenantId) throw new Error('tenantId is required.');
        const xero = (method: string, path: string, body?: any) => xeroFetch(accessToken, tenantId, method, path, body, logger);

        switch (actionName) {
            case 'getOrganisation': {
                const data = await xero('GET', '/Organisation');
                const org = data.Organisations?.[0] ?? data;
                return { output: { name: org.Name, legalName: org.LegalName, country: org.CountryCode, baseCurrency: org.BaseCurrency, status: org.OrganisationStatus } };
            }

            case 'getContacts': {
                const where = inputs.where ? String(inputs.where).trim() : undefined;
                const path = where ? `/Contacts?where=${encodeURIComponent(where)}` : '/Contacts';
                const data = await xero('GET', path);
                return { output: { contacts: data.Contacts ?? [] } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await xero('GET', `/Contacts/${contactId}`);
                return { output: { contact: data.Contacts?.[0] ?? data } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const contact: any = { Name: name };
                if (inputs.email) contact.EmailAddress = String(inputs.email).trim();
                if (inputs.firstName) contact.FirstName = String(inputs.firstName).trim();
                if (inputs.lastName) contact.LastName = String(inputs.lastName).trim();
                if (inputs.phone) contact.Phones = [{ PhoneType: 'DEFAULT', PhoneNumber: String(inputs.phone).trim() }];
                const data = await xero('POST', '/Contacts', { Contacts: [contact] });
                const created = data.Contacts?.[0] ?? {};
                return { output: { contactId: created.ContactID, name: created.Name, status: created.ContactStatus } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const contact: any = {};
                if (inputs.name) contact.Name = String(inputs.name).trim();
                if (inputs.email) contact.EmailAddress = String(inputs.email).trim();
                const data = await xero('POST', `/Contacts/${contactId}`, { Contacts: [contact] });
                const updated = data.Contacts?.[0] ?? {};
                return { output: { contactId: updated.ContactID, name: updated.Name, status: updated.ContactStatus } };
            }

            case 'getInvoices': {
                const params: string[] = [];
                if (inputs.status) params.push(`where=Status%3D%22${encodeURIComponent(String(inputs.status))}%22`);
                if (inputs.contactId) params.push(`ContactIDs=${encodeURIComponent(String(inputs.contactId))}`);
                if (inputs.page) params.push(`page=${Number(inputs.page)}`);
                const path = `/Invoices${params.length ? '?' + params.join('&') : ''}`;
                const data = await xero('GET', path);
                return { output: { invoices: data.Invoices ?? [] } };
            }

            case 'getInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const data = await xero('GET', `/Invoices/${invoiceId}`);
                return { output: { invoice: data.Invoices?.[0] ?? data } };
            }

            case 'createInvoice': {
                const type = String(inputs.type ?? 'ACCREC');
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const lineItems = typeof inputs.lineItems === 'string' ? JSON.parse(inputs.lineItems) : inputs.lineItems;
                if (!Array.isArray(lineItems) || lineItems.length === 0) throw new Error('lineItems must be a non-empty array.');
                const invoice: any = {
                    Type: type,
                    Contact: { ContactID: contactId },
                    LineItems: lineItems,
                };
                if (inputs.dueDate) invoice.DueDate = String(inputs.dueDate).trim();
                if (inputs.reference) invoice.Reference = String(inputs.reference).trim();
                const data = await xero('POST', '/Invoices', { Invoices: [invoice] });
                const created = data.Invoices?.[0] ?? {};
                return { output: { invoiceId: created.InvoiceID, invoiceNumber: created.InvoiceNumber, status: created.Status, total: created.Total } };
            }

            case 'updateInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('invoiceId is required.');
                const invoice: any = {};
                if (inputs.status) invoice.Status = String(inputs.status).trim();
                const data = await xero('POST', `/Invoices/${invoiceId}`, { Invoices: [invoice] });
                const updated = data.Invoices?.[0] ?? {};
                return { output: { invoiceId: updated.InvoiceID, status: updated.Status } };
            }

            case 'getPayments': {
                const data = await xero('GET', '/Payments');
                return { output: { payments: data.Payments ?? [] } };
            }

            case 'createPayment': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                const accountId = String(inputs.accountId ?? '').trim();
                const amount = Number(inputs.amount);
                if (!invoiceId || !accountId || isNaN(amount)) throw new Error('invoiceId, accountId, and amount are required.');
                const payment: any = {
                    Invoice: { InvoiceID: invoiceId },
                    Account: { AccountID: accountId },
                    Amount: amount,
                };
                if (inputs.date) payment.Date = String(inputs.date).trim();
                const data = await xero('POST', '/Payments', { Payments: [payment] });
                const created = data.Payments?.[0] ?? {};
                return { output: { paymentId: created.PaymentID, amount: created.Amount, status: created.Status } };
            }

            case 'getAccounts': {
                const where = inputs.type ? `where=Type%3D%22${encodeURIComponent(String(inputs.type))}%22` : '';
                const path = `/Accounts${where ? '?' + where : ''}`;
                const data = await xero('GET', path);
                return { output: { accounts: data.Accounts ?? [] } };
            }

            case 'getJournals': {
                const page = Number(inputs.page ?? 1);
                const data = await xero('GET', `/Journals?page=${page}`);
                return { output: { journals: data.Journals ?? [] } };
            }

            case 'getBankTransactions': {
                const params: string[] = [];
                if (inputs.type) params.push(`where=Type%3D%22${encodeURIComponent(String(inputs.type))}%22`);
                if (inputs.page) params.push(`page=${Number(inputs.page)}`);
                const path = `/BankTransactions${params.length ? '?' + params.join('&') : ''}`;
                const data = await xero('GET', path);
                return { output: { bankTransactions: data.BankTransactions ?? [] } };
            }

            default:
                throw new Error(`Unknown Xero action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
