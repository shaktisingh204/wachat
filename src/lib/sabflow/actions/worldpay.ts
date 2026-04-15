'use server';

const WORLDPAY_BASE = 'https://api.worldpay.com/v1';

export async function executeWorldpayAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serviceKey = String(inputs.serviceKey ?? '').trim();
        if (!serviceKey) throw new Error('serviceKey is required.');

        const auth = Buffer.from(`${serviceKey}:`).toString('base64');

        async function wpFetch(method: string, path: string, body?: any) {
            logger?.log(`[Worldpay] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${WORLDPAY_BASE}${path}`, options);
            if (res.status === 204) return { success: true };
            const json = await res.json();
            if (!res.ok) {
                throw new Error(json?.message || json?.description || `Worldpay API error: ${res.status}`);
            }
            return json;
        }

        switch (actionName) {
            case 'createOrder': {
                const amount = Number(inputs.amount);
                const currencyCode = String(inputs.currencyCode ?? 'GBP').trim();
                const orderDescription = String(inputs.orderDescription ?? '').trim();
                const token = String(inputs.token ?? '').trim();
                if (!amount) throw new Error('amount is required.');
                const body: any = { token, amount, currencyCode, orderDescription: orderDescription || 'Order' };
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.billingAddress) body.billingAddress = typeof inputs.billingAddress === 'string' ? JSON.parse(inputs.billingAddress) : inputs.billingAddress;
                const data = await wpFetch('POST', '/orders', body);
                return { output: { orderCode: data?.orderCode, paymentStatus: data?.paymentStatus, amount: data?.amount, currencyCode: data?.currencyCode } };
            }

            case 'getOrder': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                const data = await wpFetch('GET', `/orders/${orderCode}`);
                return { output: { orderCode: data?.orderCode, paymentStatus: data?.paymentStatus, amount: data?.amount, currencyCode: data?.currencyCode, createdAt: data?.createdAt } };
            }

            case 'cancelOrder': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                await wpFetch('DELETE', `/orders/${orderCode}`);
                return { output: { success: true, orderCode } };
            }

            case 'refundOrder': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                const body: any = {};
                if (inputs.amount) body.amount = Number(inputs.amount);
                const data = await wpFetch('POST', `/orders/${orderCode}/refund`, body);
                return { output: { orderCode, refundedAmount: data?.amount ?? inputs.amount, success: true } };
            }

            case 'captureOrder': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                const body: any = {};
                if (inputs.captureAmount) body.captureAmount = Number(inputs.captureAmount);
                const data = await wpFetch('PUT', `/orders/${orderCode}/capture`, body);
                return { output: { orderCode, paymentStatus: data?.paymentStatus } };
            }

            case 'listOrders': {
                const limit = Number(inputs.limit ?? 10);
                const data = await wpFetch('GET', `/orders?limit=${limit}`);
                const orders = data?.orders ?? data ?? [];
                return { output: { orders: Array.isArray(orders) ? orders : [] } };
            }

            case 'create3DSOrder': {
                const amount = Number(inputs.amount);
                const currencyCode = String(inputs.currencyCode ?? 'GBP').trim();
                const token = String(inputs.token ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!amount || !token || !name) throw new Error('amount, token, and name are required.');
                const body: any = {
                    token,
                    amount,
                    currencyCode,
                    name,
                    is3DSOrder: true,
                    applyThreeDSecure: inputs.applyThreeDSecure !== false,
                    orderDescription: String(inputs.orderDescription ?? '3DS Order'),
                };
                if (inputs.successUrl) body.successUrl = String(inputs.successUrl);
                if (inputs.failureUrl) body.failureUrl = String(inputs.failureUrl);
                const data = await wpFetch('POST', '/orders', body);
                return { output: { orderCode: data?.orderCode, paymentStatus: data?.paymentStatus, redirectURL: data?.redirectURL } };
            }

            case 'authorize': {
                const amount = Number(inputs.amount);
                const currencyCode = String(inputs.currencyCode ?? 'GBP').trim();
                const token = String(inputs.token ?? '').trim();
                if (!amount || !token) throw new Error('amount and token are required.');
                const body: any = {
                    token,
                    amount,
                    currencyCode,
                    authorizeOnly: true,
                    orderDescription: String(inputs.orderDescription ?? 'Authorization'),
                };
                const data = await wpFetch('POST', '/orders', body);
                return { output: { orderCode: data?.orderCode, paymentStatus: data?.paymentStatus } };
            }

            case 'capture': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                const body: any = {};
                if (inputs.captureAmount) body.captureAmount = Number(inputs.captureAmount);
                const data = await wpFetch('PUT', `/orders/${orderCode}/capture`, body);
                return { output: { orderCode, paymentStatus: data?.paymentStatus } };
            }

            case 'refund': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                const body: any = {};
                if (inputs.amount) body.amount = Number(inputs.amount);
                const data = await wpFetch('POST', `/orders/${orderCode}/refund`, body);
                return { output: { orderCode, success: true, refundedAmount: data?.amount ?? inputs.amount } };
            }

            case 'void': {
                const orderCode = String(inputs.orderCode ?? '').trim();
                if (!orderCode) throw new Error('orderCode is required.');
                await wpFetch('DELETE', `/orders/${orderCode}`);
                return { output: { success: true, orderCode } };
            }

            case 'getSettlement': {
                const fromDate = String(inputs.fromDate ?? '').trim();
                const toDate = String(inputs.toDate ?? '').trim();
                const params = new URLSearchParams();
                if (fromDate) params.set('fromDate', fromDate);
                if (toDate) params.set('toDate', toDate);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await wpFetch('GET', `/settlements${query}`);
                return { output: { settlements: data?.settlements ?? data ?? [] } };
            }

            case 'listPaymentMethods': {
                const data = await wpFetch('GET', '/tokens');
                const tokens = data?.tokens ?? data ?? [];
                return { output: { paymentMethods: Array.isArray(tokens) ? tokens : [] } };
            }

            case 'createToken': {
                const cardNumber = String(inputs.cardNumber ?? '').trim();
                const expiryMonth = String(inputs.expiryMonth ?? '').trim();
                const expiryYear = String(inputs.expiryYear ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!cardNumber || !expiryMonth || !expiryYear || !name) throw new Error('cardNumber, expiryMonth, expiryYear, and name are required.');
                const body: any = {
                    reusable: inputs.reusable !== false,
                    paymentMethod: { name, cardNumber, expiryMonth, expiryYear, type: 'Card' },
                    clientKey: String(inputs.clientKey ?? '').trim(),
                };
                if (inputs.cvc) body.paymentMethod.cvc = String(inputs.cvc);
                const data = await wpFetch('POST', '/tokens', body);
                return { output: { token: data?.token, reusable: data?.reusable, paymentMethod: data?.paymentMethod } };
            }

            case 'deleteToken': {
                const token = String(inputs.token ?? '').trim();
                if (!token) throw new Error('token is required.');
                await wpFetch('DELETE', `/tokens/${token}`);
                return { output: { success: true, token } };
            }

            default:
                return { error: `Worldpay action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Worldpay action failed.' };
    }
}
