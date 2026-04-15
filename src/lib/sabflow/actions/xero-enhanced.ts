'use server';

export async function executeXeroEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.xero.com/api.xro/2.0';
    const { accessToken, tenantId } = inputs;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
    if (tenantId) {
        headers['Xero-tenant-id'] = tenantId;
    }

    try {
        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${BASE_URL}/Accounts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { accounts: data.Accounts } };
            }
            case 'getAccount': {
                const res = await fetch(`${BASE_URL}/Accounts/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { account: data.Accounts?.[0] } };
            }
            case 'listContacts': {
                const res = await fetch(`${BASE_URL}/Contacts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { contacts: data.Contacts } };
            }
            case 'getContact': {
                const res = await fetch(`${BASE_URL}/Contacts/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { contact: data.Contacts?.[0] } };
            }
            case 'createContact': {
                const body = { Name: inputs.name, EmailAddress: inputs.email, ...inputs.extra };
                const res = await fetch(`${BASE_URL}/Contacts`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { contact: data.Contacts?.[0] } };
            }
            case 'updateContact': {
                const body = { ContactID: inputs.contactId, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/Contacts/${inputs.contactId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { contact: data.Contacts?.[0] } };
            }
            case 'listInvoices': {
                const res = await fetch(`${BASE_URL}/Invoices`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { invoices: data.Invoices } };
            }
            case 'getInvoice': {
                const res = await fetch(`${BASE_URL}/Invoices/${inputs.invoiceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoices?.[0] } };
            }
            case 'createInvoice': {
                const body = {
                    Type: inputs.type || 'ACCREC',
                    Contact: { ContactID: inputs.contactId },
                    LineItems: inputs.lineItems || [],
                    ...inputs.extra,
                };
                const res = await fetch(`${BASE_URL}/Invoices`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoices?.[0] } };
            }
            case 'updateInvoice': {
                const body = { InvoiceID: inputs.invoiceId, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/Invoices/${inputs.invoiceId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoices?.[0] } };
            }
            case 'deleteInvoice': {
                const body = { InvoiceID: inputs.invoiceId, Status: 'DELETED' };
                const res = await fetch(`${BASE_URL}/Invoices/${inputs.invoiceId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { success: true } };
            }
            case 'listPayments': {
                const res = await fetch(`${BASE_URL}/Payments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { payments: data.Payments } };
            }
            case 'createPayment': {
                const body = {
                    Invoice: { InvoiceID: inputs.invoiceId },
                    Account: { AccountID: inputs.accountId },
                    Amount: inputs.amount,
                    Date: inputs.date,
                    ...inputs.extra,
                };
                const res = await fetch(`${BASE_URL}/Payments`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { payment: data.Payments?.[0] } };
            }
            case 'getReport': {
                const res = await fetch(`${BASE_URL}/Reports/${inputs.reportId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.Message || JSON.stringify(data) };
                return { output: { report: data.Reports?.[0] } };
            }
            case 'listOrganisations': {
                const res = await fetch('https://api.xero.com/connections', { headers });
                const data = await res.json();
                if (!res.ok) return { error: JSON.stringify(data) };
                return { output: { organisations: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
