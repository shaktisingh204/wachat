'use server';

export async function executeMollieAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiKey = inputs.apiKey;
    const baseUrl = 'https://api.mollie.com/v2';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'createPayment': {
                const body: any = {
                    amount: { currency: inputs.currency, value: inputs.amount },
                    description: inputs.description,
                    redirectUrl: inputs.redirectUrl,
                };
                if (inputs.webhookUrl) body.webhookUrl = inputs.webhookUrl;
                if (inputs.method) body.method = inputs.method;
                if (inputs.metadata) body.metadata = inputs.metadata;
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'createPayment failed' };
                return { output: data };
            }
            case 'getPayment': {
                const paymentId = inputs.paymentId;
                const res = await fetch(`${baseUrl}/payments/${paymentId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'getPayment failed' };
                return { output: data };
            }
            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.from) params.append('from', inputs.from);
                const res = await fetch(`${baseUrl}/payments?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'listPayments failed' };
                return { output: data };
            }
            case 'cancelPayment': {
                const paymentId = inputs.paymentId;
                const res = await fetch(`${baseUrl}/payments/${paymentId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'cancelPayment failed' };
                return { output: data };
            }
            case 'createRefund': {
                const paymentId = inputs.paymentId;
                const body: any = {
                    amount: { currency: inputs.currency, value: inputs.amount },
                };
                if (inputs.description) body.description = inputs.description;
                const res = await fetch(`${baseUrl}/payments/${paymentId}/refunds`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'createRefund failed' };
                return { output: data };
            }
            case 'getRefund': {
                const paymentId = inputs.paymentId;
                const refundId = inputs.refundId;
                const res = await fetch(`${baseUrl}/payments/${paymentId}/refunds/${refundId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'getRefund failed' };
                return { output: data };
            }
            case 'listRefunds': {
                const paymentId = inputs.paymentId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                const endpoint = paymentId
                    ? `${baseUrl}/payments/${paymentId}/refunds?${params.toString()}`
                    : `${baseUrl}/refunds?${params.toString()}`;
                const res = await fetch(endpoint, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'listRefunds failed' };
                return { output: data };
            }
            case 'createOrder': {
                const body: any = {
                    orderNumber: inputs.orderNumber,
                    amount: { currency: inputs.currency, value: inputs.amount },
                    redirectUrl: inputs.redirectUrl,
                    billingAddress: inputs.billingAddress,
                    lines: inputs.lines,
                };
                if (inputs.webhookUrl) body.webhookUrl = inputs.webhookUrl;
                if (inputs.locale) body.locale = inputs.locale;
                const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'createOrder failed' };
                return { output: data };
            }
            case 'getOrder': {
                const orderId = inputs.orderId;
                const res = await fetch(`${baseUrl}/orders/${orderId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'getOrder failed' };
                return { output: data };
            }
            case 'updateOrder': {
                const orderId = inputs.orderId;
                const body: any = {};
                if (inputs.billingAddress) body.billingAddress = inputs.billingAddress;
                if (inputs.shippingAddress) body.shippingAddress = inputs.shippingAddress;
                if (inputs.orderNumber) body.orderNumber = inputs.orderNumber;
                const res = await fetch(`${baseUrl}/orders/${orderId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'updateOrder failed' };
                return { output: data };
            }
            case 'cancelOrder': {
                const orderId = inputs.orderId;
                const res = await fetch(`${baseUrl}/orders/${orderId}`, { method: 'DELETE', headers });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'cancelOrder failed' };
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                if (inputs.from) params.append('from', inputs.from);
                const res = await fetch(`${baseUrl}/orders?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'listOrders failed' };
                return { output: data };
            }
            case 'createSubscription': {
                const customerId = inputs.customerId;
                const body: any = {
                    amount: { currency: inputs.currency, value: inputs.amount },
                    interval: inputs.interval,
                    description: inputs.description,
                };
                if (inputs.times) body.times = inputs.times;
                if (inputs.startDate) body.startDate = inputs.startDate;
                if (inputs.mandateId) body.mandateId = inputs.mandateId;
                const res = await fetch(`${baseUrl}/customers/${customerId}/subscriptions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'createSubscription failed' };
                return { output: data };
            }
            case 'getSubscription': {
                const customerId = inputs.customerId;
                const subscriptionId = inputs.subscriptionId;
                const res = await fetch(`${baseUrl}/customers/${customerId}/subscriptions/${subscriptionId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'getSubscription failed' };
                return { output: data };
            }
            case 'listSubscriptions': {
                const customerId = inputs.customerId;
                const params = new URLSearchParams();
                if (inputs.limit) params.append('limit', inputs.limit);
                const endpoint = customerId
                    ? `${baseUrl}/customers/${customerId}/subscriptions?${params.toString()}`
                    : `${baseUrl}/subscriptions?${params.toString()}`;
                const res = await fetch(endpoint, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.detail || data?.title || 'listSubscriptions failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown mollie action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`mollie error: ${err.message}`);
        return { error: err.message || 'mollie action failed' };
    }
}
