'use server';

async function getZuoraToken(clientId: string, clientSecret: string): Promise<string> {
    const body = new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
    });
    const res = await fetch('https://rest.zuora.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Zuora OAuth failed: ${res.status} ${text}`);
    }
    const data = await res.json();
    return data.access_token;
}

export async function executeZuoraAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = await getZuoraToken(inputs.clientId, inputs.clientSecret);
        const baseUrl = 'https://rest.zuora.com';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.accountKey) params.set('accountKey', inputs.accountKey);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/v1/subscriptions/accounts/${inputs.accountKey || ''}?${params}`, { headers });
                if (!res.ok) return { error: `listSubscriptions failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/v1/subscriptions/${inputs.subscriptionKey}`, { headers });
                if (!res.ok) return { error: `getSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createSubscription': {
                const body: Record<string, any> = {
                    accountKey: inputs.accountKey,
                    termType: inputs.termType || 'TERMED',
                    initialTerm: inputs.initialTerm || 12,
                    initialTermPeriodType: inputs.initialTermPeriodType || 'Month',
                    renewalTerm: inputs.renewalTerm || 12,
                    renewalTermPeriodType: inputs.renewalTermPeriodType || 'Month',
                    contractEffectiveDate: inputs.contractEffectiveDate,
                    subscribeToRatePlans: inputs.subscribeToRatePlans,
                };
                if (inputs.autoRenew !== undefined) body.autoRenew = inputs.autoRenew;
                if (inputs.notes) body.notes = inputs.notes;
                const res = await fetch(`${baseUrl}/v1/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateSubscription': {
                const body: Record<string, any> = {};
                if (inputs.autoRenew !== undefined) body.autoRenew = inputs.autoRenew;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.renewalTerm) body.renewalTerm = inputs.renewalTerm;
                if (inputs.update) body.update = inputs.update;
                const res = await fetch(`${baseUrl}/v1/subscriptions/${inputs.subscriptionKey}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'cancelSubscription': {
                const body: Record<string, any> = {
                    cancellationPolicy: inputs.cancellationPolicy || 'EndOfCurrentTermPeriod',
                    cancellationEffectiveDate: inputs.cancellationEffectiveDate,
                };
                if (inputs.invoiceCollect !== undefined) body.invoiceCollect = inputs.invoiceCollect;
                const res = await fetch(`${baseUrl}/v1/subscriptions/${inputs.subscriptionKey}/cancel`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `cancelSubscription failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listAccounts': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/v1/accounts?${params}`, { headers });
                if (!res.ok) return { error: `listAccounts failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getAccount': {
                const res = await fetch(`${baseUrl}/v1/accounts/${inputs.accountKey}`, { headers });
                if (!res.ok) return { error: `getAccount failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createAccount': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    currency: inputs.currency,
                    billCycleDay: inputs.billCycleDay || 1,
                    autoPay: inputs.autoPay || false,
                    soldToContact: inputs.soldToContact,
                    billToContact: inputs.billToContact || inputs.soldToContact,
                };
                if (inputs.paymentTerm) body.paymentTerm = inputs.paymentTerm;
                if (inputs.notes) body.notes = inputs.notes;
                const res = await fetch(`${baseUrl}/v1/accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createAccount failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'updateAccount': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.autoPay !== undefined) body.autoPay = inputs.autoPay;
                if (inputs.paymentTerm) body.paymentTerm = inputs.paymentTerm;
                if (inputs.notes) body.notes = inputs.notes;
                if (inputs.billToContact) body.billToContact = inputs.billToContact;
                if (inputs.soldToContact) body.soldToContact = inputs.soldToContact;
                const res = await fetch(`${baseUrl}/v1/accounts/${inputs.accountKey}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `updateAccount failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listInvoices': {
                const params = new URLSearchParams();
                if (inputs.accountKey) params.set('accountKey', inputs.accountKey);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/v1/transactions/invoices/accounts/${inputs.accountKey}?${params}`, { headers });
                if (!res.ok) return { error: `listInvoices failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getInvoice': {
                const res = await fetch(`${baseUrl}/v1/invoices/${inputs.invoiceId}`, { headers });
                if (!res.ok) return { error: `getInvoice failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'generateInvoice': {
                const body: Record<string, any> = {
                    accountKey: inputs.accountKey,
                    invoiceDate: inputs.invoiceDate,
                    targetDate: inputs.targetDate,
                };
                if (inputs.invoiceItems) body.invoiceItems = inputs.invoiceItems;
                const res = await fetch(`${baseUrl}/v1/operations/invoice-collect`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `generateInvoice failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.accountKey) params.set('accountKey', inputs.accountKey);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/v1/transactions/payments/accounts/${inputs.accountKey}?${params}`, { headers });
                if (!res.ok) return { error: `listPayments failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'createPayment': {
                const body: Record<string, any> = {
                    accountId: inputs.accountId,
                    amount: inputs.amount,
                    currency: inputs.currency,
                    type: inputs.type || 'External',
                    effectiveDate: inputs.effectiveDate,
                };
                if (inputs.paymentMethodId) body.paymentMethodId = inputs.paymentMethodId;
                if (inputs.comment) body.comment = inputs.comment;
                if (inputs.invoices) body.invoices = inputs.invoices;
                const res = await fetch(`${baseUrl}/v1/payments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPayment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            case 'getPaymentMethod': {
                const res = await fetch(`${baseUrl}/v1/payment-methods/${inputs.paymentMethodId}`, { headers });
                if (!res.ok) return { error: `getPaymentMethod failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Zuora action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Zuora action error: ${err.message}`);
        return { error: err.message || 'Zuora action failed' };
    }
}
