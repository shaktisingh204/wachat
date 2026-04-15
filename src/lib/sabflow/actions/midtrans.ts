'use server';

export async function executeMidtransAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://api.midtrans.com/v2';
    const serverKey = inputs.serverKey;

    if (!serverKey) return { error: 'Missing inputs.serverKey' };

    const credentials = Buffer.from(`${serverKey}:`).toString('base64');

    const headers: Record<string, string> = {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
    };

    try {
        switch (actionName) {
            case 'createTransaction': {
                const body = {
                    payment_type: inputs.paymentType,
                    transaction_details: inputs.transactionDetails,
                    customer_details: inputs.customerDetails,
                    item_details: inputs.itemDetails,
                };
                if (!body.payment_type) return { error: 'Missing inputs.paymentType' };
                if (!body.transaction_details) return { error: 'Missing inputs.transactionDetails' };
                const res = await fetch(`${BASE_URL}/charge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'getTransactionStatus': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const res = await fetch(`${BASE_URL}/${orderId}/status`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'approveTransaction': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const res = await fetch(`${BASE_URL}/${orderId}/approve`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'cancelTransaction': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const res = await fetch(`${BASE_URL}/${orderId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'refundTransaction': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const body = {
                    refund_key: inputs.refundKey ?? `REFUND-${Date.now()}`,
                    amount: inputs.amount,
                    reason: inputs.reason,
                };
                const res = await fetch(`${BASE_URL}/${orderId}/refund`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'expireTransaction': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const res = await fetch(`${BASE_URL}/${orderId}/expire`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'captureTransaction': {
                const transactionId = inputs.transactionId;
                if (!transactionId) return { error: 'Missing inputs.transactionId' };
                const body = {
                    transaction_id: transactionId,
                    gross_amount: inputs.grossAmount,
                };
                const res = await fetch(`${BASE_URL}/capture`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'getPaymentAccount': {
                const accountId = inputs.accountId;
                if (!accountId) return { error: 'Missing inputs.accountId' };
                const res = await fetch(`${BASE_URL}/pay/account/${accountId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'createPaymentLink': {
                const body = {
                    transaction_details: inputs.transactionDetails,
                    customer_details: inputs.customerDetails,
                    usage_limit: inputs.usageLimit,
                    expiry: inputs.expiry,
                    item_details: inputs.itemDetails,
                };
                if (!body.transaction_details) return { error: 'Missing inputs.transactionDetails' };
                const res = await fetch('https://api.midtrans.com/v1/payment-links', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error_messages?.[0] ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.startDate) params.set('start_date', inputs.startDate);
                if (inputs.endDate) params.set('end_date', inputs.endDate);
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`https://api.midtrans.com/v1/transactions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'chargeCard': {
                const body = {
                    payment_type: 'credit_card',
                    transaction_details: inputs.transactionDetails,
                    credit_card: {
                        token_id: inputs.tokenId,
                        authentication: inputs.authentication ?? false,
                        bank: inputs.bank,
                        installment: inputs.installment,
                    },
                    customer_details: inputs.customerDetails,
                };
                if (!inputs.tokenId) return { error: 'Missing inputs.tokenId' };
                if (!body.transaction_details) return { error: 'Missing inputs.transactionDetails' };
                const res = await fetch(`${BASE_URL}/charge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.status_message ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'createSubscription': {
                const body = {
                    name: inputs.name,
                    amount: inputs.amount,
                    currency: inputs.currency ?? 'IDR',
                    payment_type: inputs.paymentType ?? 'credit_card',
                    token: inputs.token,
                    schedule: inputs.schedule,
                    customer_details: inputs.customerDetails,
                    metadata: inputs.metadata,
                };
                if (!body.name) return { error: 'Missing inputs.name' };
                if (!body.amount) return { error: 'Missing inputs.amount' };
                const res = await fetch('https://api.midtrans.com/v1/subscriptions', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error_messages?.[0] ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'getSubscription': {
                const subscriptionId = inputs.subscriptionId;
                if (!subscriptionId) return { error: 'Missing inputs.subscriptionId' };
                const res = await fetch(`https://api.midtrans.com/v1/subscriptions/${subscriptionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.error_messages?.[0] ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'updateSubscription': {
                const subscriptionId = inputs.subscriptionId;
                if (!subscriptionId) return { error: 'Missing inputs.subscriptionId' };
                const body = {
                    name: inputs.name,
                    amount: inputs.amount,
                    currency: inputs.currency,
                    token: inputs.token,
                    schedule: inputs.schedule,
                    metadata: inputs.metadata,
                };
                const res = await fetch(`https://api.midtrans.com/v1/subscriptions/${subscriptionId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error_messages?.[0] ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            case 'deleteSubscription': {
                const subscriptionId = inputs.subscriptionId;
                if (!subscriptionId) return { error: 'Missing inputs.subscriptionId' };
                const res = await fetch(`https://api.midtrans.com/v1/subscriptions/${subscriptionId}/disable`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.error_messages?.[0] ?? `Midtrans error: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Midtrans action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Midtrans action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeMidtransAction' };
    }
}
