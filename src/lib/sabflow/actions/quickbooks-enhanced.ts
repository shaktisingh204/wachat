'use server';

export async function executeQuickbooksEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, realmId } = inputs;
    const BASE_URL = `https://quickbooks.api.intuit.com/v3/company/${realmId}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'MinorVersion': '65',
    };

    try {
        switch (actionName) {
            case 'query': {
                const encoded = encodeURIComponent(inputs.query);
                const res = await fetch(`${BASE_URL}/query?query=${encoded}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { queryResponse: data.QueryResponse } };
            }
            case 'getCustomer': {
                const res = await fetch(`${BASE_URL}/customer/${inputs.customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { customer: data.Customer } };
            }
            case 'createCustomer': {
                const body = { DisplayName: inputs.displayName, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/customer`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { customer: data.Customer } };
            }
            case 'updateCustomer': {
                const body = { Id: inputs.customerId, SyncToken: inputs.syncToken, ...inputs.fields, sparse: true };
                const res = await fetch(`${BASE_URL}/customer`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { customer: data.Customer } };
            }
            case 'getInvoice': {
                const res = await fetch(`${BASE_URL}/invoice/${inputs.invoiceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoice } };
            }
            case 'createInvoice': {
                const body = {
                    CustomerRef: { value: inputs.customerId },
                    Line: inputs.lines || [],
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/invoice`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoice } };
            }
            case 'updateInvoice': {
                const body = { Id: inputs.invoiceId, SyncToken: inputs.syncToken, ...inputs.fields, sparse: true };
                const res = await fetch(`${BASE_URL}/invoice`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoice } };
            }
            case 'sendInvoice': {
                const res = await fetch(`${BASE_URL}/invoice/${inputs.invoiceId}/send?sendTo=${inputs.email}`, { method: 'POST', headers, body: '' });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { invoice: data.Invoice } };
            }
            case 'getPayment': {
                const res = await fetch(`${BASE_URL}/payment/${inputs.paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { payment: data.Payment } };
            }
            case 'createPayment': {
                const body = {
                    CustomerRef: { value: inputs.customerId },
                    TotalAmt: inputs.totalAmt,
                    Line: inputs.lines || [],
                    ...inputs.fields,
                };
                const res = await fetch(`${BASE_URL}/payment`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { payment: data.Payment } };
            }
            case 'getAccount': {
                const res = await fetch(`${BASE_URL}/account/${inputs.accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { account: data.Account } };
            }
            case 'createAccount': {
                const body = { Name: inputs.name, AccountType: inputs.accountType, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/account`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { account: data.Account } };
            }
            case 'getVendor': {
                const res = await fetch(`${BASE_URL}/vendor/${inputs.vendorId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { vendor: data.Vendor } };
            }
            case 'createVendor': {
                const body = { DisplayName: inputs.displayName, ...inputs.fields };
                const res = await fetch(`${BASE_URL}/vendor`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { vendor: data.Vendor } };
            }
            case 'getPurchaseOrder': {
                const res = await fetch(`${BASE_URL}/purchaseorder/${inputs.purchaseOrderId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Fault?.Error?.[0]?.Message || JSON.stringify(data) };
                return { output: { purchaseOrder: data.PurchaseOrder } };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err.message || String(err) };
    }
}
