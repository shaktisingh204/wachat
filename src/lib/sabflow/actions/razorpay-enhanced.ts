
'use server';

const RAZORPAY_BASE = 'https://api.razorpay.com/v1';

async function rzpFetch(keyId: string, keySecret: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Razorpay] ${method} ${path}`);
    const base64Auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Basic ${base64Auth}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${RAZORPAY_BASE}${path}`, options);
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error?.description || data?.error?.reason || `Razorpay API error: ${res.status}`);
    }
    return data;
}

export async function executeRazorpayEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const keyId = String(inputs.keyId ?? '').trim();
        const keySecret = String(inputs.keySecret ?? '').trim();
        if (!keyId || !keySecret) throw new Error('keyId and keySecret are required.');
        const rzp = (method: string, path: string, body?: any) => rzpFetch(keyId, keySecret, method, path, body, logger);

        switch (actionName) {
            case 'createOrder': {
                const amount = Number(inputs.amount);
                const currency = String(inputs.currency ?? 'INR').trim();
                const receipt = String(inputs.receipt ?? `rcpt_${Date.now()}`).trim();
                if (!amount) throw new Error('amount is required (in paise).');
                const data = await rzp('POST', '/orders', { amount, currency, receipt });
                return { output: { id: data.id, status: data.status, amount: String(data.amount), currency: data.currency, receipt: data.receipt } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await rzp('GET', `/orders/${orderId}`);
                return { output: { id: data.id, status: data.status, amount: String(data.amount), currency: data.currency, amountPaid: String(data.amount_paid) } };
            }

            case 'getPayment': {
                const paymentId = String(inputs.paymentId ?? '').trim();
                if (!paymentId) throw new Error('paymentId is required.');
                const data = await rzp('GET', `/payments/${paymentId}`);
                return { output: { id: data.id, status: data.status, amount: String(data.amount), method: data.method, email: data.email ?? '', contact: data.contact ?? '' } };
            }

            case 'capturePayment': {
                const paymentId = String(inputs.paymentId ?? '').trim();
                const amount = Number(inputs.amount);
                const currency = String(inputs.currency ?? 'INR').trim();
                if (!paymentId || !amount) throw new Error('paymentId and amount are required.');
                const data = await rzp('POST', `/payments/${paymentId}/capture`, { amount, currency });
                return { output: { id: data.id, status: data.status, amount: String(data.amount) } };
            }

            case 'refundPayment': {
                const paymentId = String(inputs.paymentId ?? '').trim();
                const amount = inputs.amount ? Number(inputs.amount) : undefined;
                const notes = inputs.notes;
                if (!paymentId) throw new Error('paymentId is required.');
                const body: any = {};
                if (amount) body.amount = amount;
                if (notes) body.notes = typeof notes === 'string' ? JSON.parse(notes) : notes;
                const data = await rzp('POST', `/payments/${paymentId}/refund`, body);
                return { output: { id: data.id, status: data.status, amount: String(data.amount) } };
            }

            case 'createRefund': {
                const paymentId = String(inputs.paymentId ?? '').trim();
                const amount = Number(inputs.amount);
                if (!paymentId || !amount) throw new Error('paymentId and amount are required.');
                const data = await rzp('POST', `/payments/${paymentId}/refund`, { amount });
                return { output: { id: data.id, status: data.status, amount: String(data.amount) } };
            }

            case 'createCustomer': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                const contact = String(inputs.contact ?? '').trim();
                if (!name || !email || !contact) throw new Error('name, email, and contact are required.');
                const data = await rzp('POST', '/customers', { name, email, contact });
                return { output: { id: data.id, name: data.name, email: data.email, contact: data.contact } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await rzp('GET', `/customers/${customerId}`);
                return { output: { id: data.id, name: data.name, email: data.email, contact: data.contact } };
            }

            case 'createSubscription': {
                const planId = String(inputs.planId ?? '').trim();
                const totalCount = Number(inputs.totalCount ?? 12);
                const quantity = Number(inputs.quantity ?? 1);
                if (!planId) throw new Error('planId is required.');
                const data = await rzp('POST', '/subscriptions', { plan_id: planId, total_count: totalCount, quantity });
                return { output: { id: data.id, status: data.status, shortUrl: data.short_url ?? '' } };
            }

            case 'cancelSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                const cancelAtCycleEnd = inputs.cancelAtCycleEnd === true || inputs.cancelAtCycleEnd === 'true' ? 1 : 0;
                if (!subscriptionId) throw new Error('subscriptionId is required.');
                const data = await rzp('POST', `/subscriptions/${subscriptionId}/cancel`, { cancel_at_cycle_end: cancelAtCycleEnd });
                return { output: { id: data.id, status: data.status } };
            }

            case 'createPaymentLink': {
                const amount = Number(inputs.amount);
                const description = String(inputs.description ?? '').trim();
                const customerName = String(inputs.customerName ?? '').trim();
                const customerEmail = String(inputs.customerEmail ?? '').trim();
                const customerContact = String(inputs.customerContact ?? '').trim();
                if (!amount) throw new Error('amount is required.');
                const body: any = { amount, currency: 'INR', description: description || undefined };
                if (customerName || customerEmail || customerContact) {
                    body.customer = { name: customerName, email: customerEmail, contact: customerContact };
                }
                const data = await rzp('POST', '/payment_links', body);
                return { output: { id: data.id, shortUrl: data.short_url, status: data.status } };
            }

            case 'createPayout': {
                const fundAccountId = String(inputs.fundAccountId ?? '').trim();
                const amount = Number(inputs.amount);
                const currency = String(inputs.currency ?? 'INR').trim();
                const mode = String(inputs.mode ?? 'NEFT').trim();
                const purpose = String(inputs.purpose ?? 'payout').trim();
                if (!fundAccountId || !amount) throw new Error('fundAccountId and amount are required.');
                const data = await rzp('POST', '/payouts', { account_number: inputs.accountNumber, fund_account_id: fundAccountId, amount, currency, mode, purpose });
                return { output: { id: data.id, status: data.status, utr: data.utr ?? '' } };
            }

            default:
                return { error: `Razorpay action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Razorpay action failed.' };
    }
}
