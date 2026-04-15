'use server';

export async function executeSageAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.accounting.sage.com/v3.1';
    const { accessToken } = inputs;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listAccounts': {
                const res = await fetch(`${BASE_URL}/ledger_accounts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { accounts: data.$items } };
            }
            case 'getAccount': {
                const res = await fetch(`${BASE_URL}/ledger_accounts/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { account: data } };
            }
            case 'listContacts': {
                const res = await fetch(`${BASE_URL}/contacts`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { contacts: data.$items } };
            }
            case 'getContact': {
                const res = await fetch(`${BASE_URL}/contacts/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { contact: data } };
            }
            case 'createContact': {
                const body = { name: inputs.name, contact_type_ids: inputs.contactTypeIds || [], ...inputs.fields };
                const res = await fetch(`${BASE_URL}/contacts`, { method: 'POST', headers, body: JSON.stringify({ contact: body }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { contact: data } };
            }
            case 'updateContact': {
                const body = { ...inputs.fields };
                const res = await fetch(`${BASE_URL}/contacts/${inputs.contactId}`, { method: 'PUT', headers, body: JSON.stringify({ contact: body }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { contact: data } };
            }
            case 'listSalesInvoices': {
                const res = await fetch(`${BASE_URL}/sales_invoices`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { salesInvoices: data.$items } };
            }
            case 'getSalesInvoice': {
                const res = await fetch(`${BASE_URL}/sales_invoices/${inputs.invoiceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { salesInvoice: data } };
            }
            case 'createSalesInvoice': {
                const body = {
                    contact_id: inputs.contactId,
                    invoice_lines: inputs.invoiceLines || [],
                    date: inputs.date,
                    due_date: inputs.dueDate,
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/sales_invoices`, { method: 'POST', headers, body: JSON.stringify({ sales_invoice: body }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { salesInvoice: data } };
            }
            case 'listPurchaseInvoices': {
                const res = await fetch(`${BASE_URL}/purchase_invoices`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { purchaseInvoices: data.$items } };
            }
            case 'createPurchaseInvoice': {
                const body = {
                    contact_id: inputs.contactId,
                    invoice_lines: inputs.invoiceLines || [],
                    date: inputs.date,
                    due_date: inputs.dueDate,
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/purchase_invoices`, { method: 'POST', headers, body: JSON.stringify({ purchase_invoice: body }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { purchaseInvoice: data } };
            }
            case 'listPayments': {
                const res = await fetch(`${BASE_URL}/payments`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payments: data.$items } };
            }
            case 'createPayment': {
                const body = {
                    transaction_type_id: inputs.transactionTypeId,
                    amount: inputs.amount,
                    date: inputs.date,
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/payments`, { method: 'POST', headers, body: JSON.stringify({ payment: body }) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { payment: data } };
            }
            case 'listTaxRates': {
                const res = await fetch(`${BASE_URL}/tax_rates`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { taxRates: data.$items } };
            }
            case 'getBusinessInfo': {
                const res = await fetch(`${BASE_URL}/business`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { business: data } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
