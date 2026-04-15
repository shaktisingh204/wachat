
'use server';

const CASHFREE_BASE_PROD = 'https://api.cashfree.com/pg';
const CASHFREE_BASE_TEST = 'https://sandbox.cashfree.com/pg';

async function cashfreeFetch(appId: string, secretKey: string, environment: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Cashfree] ${method} ${path}`);
    const base = environment === 'production' ? CASHFREE_BASE_PROD : CASHFREE_BASE_TEST;
    const options: RequestInit = {
        method,
        headers: {
            'x-client-id': appId,
            'x-client-secret': secretKey,
            'x-api-version': '2023-08-01',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Cashfree API error: ${res.status}`);
    }
    return data;
}

export async function executeCashfreeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const appId = String(inputs.appId ?? '').trim();
        const secretKey = String(inputs.secretKey ?? '').trim();
        const environment = String(inputs.environment ?? 'production').trim();
        if (!appId || !secretKey) throw new Error('appId and secretKey are required.');
        const cf = (method: string, path: string, body?: any) => cashfreeFetch(appId, secretKey, environment, method, path, body, logger);

        switch (actionName) {
            case 'createOrder': {
                const orderId = String(inputs.orderId ?? `order_${Date.now()}`).trim();
                const amount = Number(inputs.amount);
                const currency = String(inputs.currency ?? 'INR').trim();
                const customerName = String(inputs.customerName ?? '').trim();
                const customerEmail = String(inputs.customerEmail ?? '').trim();
                const customerPhone = String(inputs.customerPhone ?? '').trim();
                if (!amount || !customerName || !customerEmail || !customerPhone) throw new Error('amount, customerName, customerEmail, and customerPhone are required.');
                const body = {
                    order_id: orderId,
                    order_amount: amount,
                    order_currency: currency,
                    customer_details: { customer_id: `cust_${Date.now()}`, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone },
                };
                const data = await cf('POST', '/orders', body);
                return { output: { orderId: data.order_id, paymentSessionId: data.payment_session_id, orderStatus: data.order_status, paymentLink: data.order_meta?.payment_link ?? '' } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await cf('GET', `/orders/${orderId}`);
                return { output: { orderId: data.order_id, status: data.order_status, amount: String(data.order_amount), currency: data.order_currency } };
            }

            case 'getPayments': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await cf('GET', `/orders/${orderId}/payments`);
                return { output: { payments: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'initiateRefund': {
                const orderId = String(inputs.orderId ?? '').trim();
                const refundId = String(inputs.refundId ?? `refund_${Date.now()}`).trim();
                const refundAmount = Number(inputs.refundAmount);
                const refundNote = String(inputs.refundNote ?? '').trim();
                if (!orderId || !refundAmount) throw new Error('orderId and refundAmount are required.');
                const data = await cf('POST', `/orders/${orderId}/refunds`, { refund_id: refundId, refund_amount: refundAmount, refund_note: refundNote || undefined });
                return { output: { refundId: data.refund_id, status: data.refund_status, amount: String(data.refund_amount) } };
            }

            case 'getRefund': {
                const orderId = String(inputs.orderId ?? '').trim();
                const refundId = String(inputs.refundId ?? '').trim();
                if (!orderId || !refundId) throw new Error('orderId and refundId are required.');
                const data = await cf('GET', `/orders/${orderId}/refunds/${refundId}`);
                return { output: { refundId: data.refund_id, status: data.refund_status, amount: String(data.refund_amount) } };
            }

            case 'createPaymentLink': {
                const linkAmount = Number(inputs.linkAmount);
                const linkPurpose = String(inputs.linkPurpose ?? '').trim();
                const customerName = String(inputs.customerName ?? '').trim();
                const customerEmail = String(inputs.customerEmail ?? '').trim();
                const customerPhone = String(inputs.customerPhone ?? '').trim();
                if (!linkAmount || !linkPurpose) throw new Error('linkAmount and linkPurpose are required.');
                const body: any = { link_amount: linkAmount, link_currency: 'INR', link_purpose: linkPurpose };
                if (customerName || customerEmail || customerPhone) {
                    body.customer_details = { customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone };
                }
                const data = await cf('POST', '/links', body);
                return { output: { linkId: data.link_id, linkUrl: data.link_url, status: data.link_status } };
            }

            case 'getSettlements': {
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                let path = '/settlements';
                if (fromDate && toDate) path += `?from_date=${fromDate}&to_date=${toDate}`;
                const data = await cf('GET', path);
                return { output: { settlements: Array.isArray(data) ? data : [], count: Array.isArray(data) ? data.length : 0 } };
            }

            case 'getBalance': {
                const data = await cf('GET', '/balance');
                return { output: { balance: String(data.balance ?? 0), currency: data.currency ?? 'INR' } };
            }

            default:
                return { error: `Cashfree action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Cashfree action failed.' };
    }
}
