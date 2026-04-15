'use server';

export async function executePayUAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.payubiz.in';

    if (!inputs.apiKey) return { error: 'Missing inputs.apiKey' };
    if (!inputs.apiSecret) return { error: 'Missing inputs.apiSecret' };

    const credentials = Buffer.from(`${inputs.apiKey}:${inputs.apiSecret}`).toString('base64');

    const headers: Record<string, string> = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    try {
        switch (actionName) {
            case 'initiatePayment': {
                const body = {
                    txnid: inputs.txnid,
                    amount: inputs.amount,
                    productinfo: inputs.productinfo,
                    firstname: inputs.firstname,
                    email: inputs.email,
                    phone: inputs.phone,
                    surl: inputs.successUrl,
                    furl: inputs.failureUrl,
                    hash: inputs.hash,
                };
                if (!body.txnid) return { error: 'Missing inputs.txnid' };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch(`${BASE_URL}/payment/initiate`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'verifyPayment': {
                const txnid = inputs.txnid;
                if (!txnid) return { error: 'Missing inputs.txnid' };
                const res = await fetch(`${BASE_URL}/payment/verify/${txnid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'refundPayment': {
                const body = {
                    txnid: inputs.txnid,
                    refundAmount: inputs.refundAmount,
                    payuId: inputs.payuId,
                };
                if (!body.txnid) return { error: 'Missing inputs.txnid' };
                if (!body.refundAmount) return { error: 'Missing inputs.refundAmount' };
                const res = await fetch(`${BASE_URL}/payment/refund`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'getTransactionDetails': {
                const txnid = inputs.txnid;
                if (!txnid) return { error: 'Missing inputs.txnid' };
                const res = await fetch(`${BASE_URL}/transactions/${txnid}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                const res = await fetch(`${BASE_URL}/transactions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'createCustomer': {
                const body = {
                    email: inputs.email,
                    phone: inputs.phone,
                    firstname: inputs.firstname,
                    lastname: inputs.lastname,
                };
                if (!body.email) return { error: 'Missing inputs.email' };
                const res = await fetch(`${BASE_URL}/customers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'getCustomer': {
                const customerId = inputs.customerId;
                if (!customerId) return { error: 'Missing inputs.customerId' };
                const res = await fetch(`${BASE_URL}/customers/${customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('perPage', String(inputs.perPage));
                const res = await fetch(`${BASE_URL}/customers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'createVirtualAccount': {
                const body = {
                    amount: inputs.amount,
                    txnid: inputs.txnid ?? `VA-${Date.now()}`,
                    email: inputs.email,
                    phone: inputs.phone,
                    firstname: inputs.firstname,
                    description: inputs.description,
                };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch(`${BASE_URL}/virtual-accounts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'getVirtualAccount': {
                const vaId = inputs.vaId;
                if (!vaId) return { error: 'Missing inputs.vaId' };
                const res = await fetch(`${BASE_URL}/virtual-accounts/${vaId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'listPaymentMethods': {
                const res = await fetch(`${BASE_URL}/payment-methods`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'getPaymentDetails': {
                const paymentId = inputs.paymentId;
                if (!paymentId) return { error: 'Missing inputs.paymentId' };
                const res = await fetch(`${BASE_URL}/payments/${paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'generatePaymentLink': {
                const body = {
                    amount: inputs.amount,
                    email: inputs.email,
                    phone: inputs.phone,
                    firstname: inputs.firstname,
                    description: inputs.description,
                    txnid: inputs.txnid ?? `LINK-${Date.now()}`,
                    surl: inputs.successUrl,
                    furl: inputs.failureUrl,
                };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch(`${BASE_URL}/payment-links`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${BASE_URL}/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            case 'createSubscription': {
                const body = {
                    planId: inputs.planId,
                    customerId: inputs.customerId,
                    startDate: inputs.startDate,
                    totalBillingCycles: inputs.totalBillingCycles,
                };
                if (!body.planId) return { error: 'Missing inputs.planId' };
                if (!body.customerId) return { error: 'Missing inputs.customerId' };
                const res = await fetch(`${BASE_URL}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.message ?? `PayU error: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown PayU action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`PayU action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executePayUAction' };
    }
}
