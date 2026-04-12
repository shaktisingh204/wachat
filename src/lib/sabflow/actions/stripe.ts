
'use server';

import type { WithId, User } from '@/lib/definitions';
import axios from 'axios';

const STRIPE_BASE = 'https://api.stripe.com/v1';

function getStripeKey(user: WithId<User>): string {
    const settings = (user as any).sabFlowConnections?.find((c: any) => c.appName === 'Stripe');
    if (!settings?.credentials?.apiKey) {
        throw new Error('Stripe is not connected or missing API Key.');
    }
    return String(settings.credentials.apiKey);
}

/**
 * Stripe uses application/x-www-form-urlencoded for POST bodies, not JSON.
 * This helper flattens a plain object to URLSearchParams, supporting nested
 * keys via bracket notation (e.g. { metadata: { foo: 'bar' } } → metadata[foo]=bar).
 */
function toFormParams(obj: Record<string, any>, prefix = ''): URLSearchParams {
    const params = new URLSearchParams();
    const walk = (value: any, keyPath: string) => {
        if (value === undefined || value === null || value === '') return;
        if (Array.isArray(value)) {
            value.forEach((item, idx) => walk(item, `${keyPath}[${idx}]`));
            return;
        }
        if (typeof value === 'object') {
            for (const [k, v] of Object.entries(value)) {
                walk(v, keyPath ? `${keyPath}[${k}]` : k);
            }
            return;
        }
        params.append(keyPath, String(value));
    };
    for (const [k, v] of Object.entries(obj)) {
        walk(v, prefix ? `${prefix}[${k}]` : k);
    }
    return params;
}

async function stripeRequest(method: 'GET' | 'POST', path: string, apiKey: string, data?: Record<string, any>) {
    const url = `${STRIPE_BASE}${path}`;
    const config: any = {
        method,
        url,
        headers: {
            Authorization: `Bearer ${apiKey}`,
        },
    };
    if (method === 'POST' && data) {
        config.data = toFormParams(data).toString();
        config.headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }
    const res = await axios(config);
    return res.data;
}

export async function executeStripeAction(
    actionName: string,
    inputs: any,
    user: WithId<User>,
    logger: any
) {
    try {
        const apiKey = getStripeKey(user);

        switch (actionName) {
            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const payload: any = { email };
                if (inputs.name) payload.name = String(inputs.name);
                if (inputs.phone) payload.phone = String(inputs.phone);
                const data = await stripeRequest('POST', '/customers', apiKey, payload);
                logger.log(`[Stripe] Created customer ${data.id}`);
                return { output: { customerId: data.id, email: data.email } };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const data = await stripeRequest('GET', `/customers/${customerId}`, apiKey);
                return { output: { customer: data } };
            }

            case 'createPaymentLink': {
                const priceId = String(inputs.priceId ?? '').trim();
                if (!priceId) throw new Error('priceId is required.');
                const quantity = Math.max(1, Number(inputs.quantity) || 1);
                const data = await stripeRequest('POST', '/payment_links', apiKey, {
                    line_items: [{ price: priceId, quantity }],
                });
                return { output: { url: data.url, id: data.id } };
            }

            case 'createInvoice': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('customerId is required.');
                const payload: any = { customer: customerId };
                if (inputs.description) payload.description = String(inputs.description);
                const data = await stripeRequest('POST', '/invoices', apiKey, payload);
                return { output: { invoiceId: data.id } };
            }

            case 'refundPayment': {
                const paymentIntentId = String(inputs.paymentIntentId ?? '').trim();
                if (!paymentIntentId) throw new Error('paymentIntentId is required.');
                const payload: any = { payment_intent: paymentIntentId };
                if (inputs.amount !== undefined && inputs.amount !== null && inputs.amount !== '') {
                    const amt = Number(inputs.amount);
                    if (Number.isFinite(amt) && amt > 0) payload.amount = Math.round(amt);
                }
                const data = await stripeRequest('POST', '/refunds', apiKey, payload);
                return { output: { refundId: data.id, status: data.status } };
            }

            default:
                return { error: `Stripe action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e?.response?.data?.error?.message || e.message || 'Stripe action failed.';
        return { error: msg };
    }
}
