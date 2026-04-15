
'use server';

const STRIPE_BASE = 'https://api.stripe.com/v1';

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

async function stripeRequest(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    secretKey: string,
    data?: Record<string, any>,
    queryParams?: Record<string, string>
): Promise<any> {
    let url = `${STRIPE_BASE}${path}`;
    const authHeader = `Basic ${Buffer.from(secretKey + ':').toString('base64')}`;

    if (queryParams && Object.keys(queryParams).length > 0) {
        const qs = new URLSearchParams(queryParams).toString();
        url = `${url}?${qs}`;
    }

    const headers: Record<string, string> = {
        Authorization: authHeader,
    };

    const options: RequestInit = { method, headers };

    if (method === 'POST' && data) {
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        options.body = toFormParams(data).toString();
    }

    const res = await fetch(url, options);
    const json = await res.json();
    if (!res.ok) {
        throw new Error(json?.error?.message || `Stripe error ${res.status}`);
    }
    return json;
}

export async function executeStripeBillingAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const secretKey: string = inputs.secretKey || inputs.apiKey || inputs.secret_key;
        if (!secretKey) throw new Error('Missing Stripe secretKey in inputs');

        switch (actionName) {
            case 'createSubscription': {
                const body: Record<string, any> = {
                    customer: inputs.customer,
                    'items[0][price]': inputs.price || (inputs.items?.[0]?.price),
                };
                if (inputs.trial_period_days) body.trial_period_days = inputs.trial_period_days;
                if (inputs.metadata) body.metadata = inputs.metadata;
                if (inputs.items && Array.isArray(inputs.items)) {
                    inputs.items.forEach((item: any, idx: number) => {
                        body[`items[${idx}][price]`] = item.price;
                        if (item.quantity) body[`items[${idx}][quantity]`] = item.quantity;
                    });
                }
                const result = await stripeRequest('POST', '/subscriptions', secretKey, body);
                return { output: result };
            }
            case 'getSubscription': {
                const result = await stripeRequest('GET', `/subscriptions/${inputs.id}`, secretKey);
                return { output: result };
            }
            case 'updateSubscription': {
                const body: Record<string, any> = {};
                if (inputs.items) body.items = inputs.items;
                if (inputs.metadata) body.metadata = inputs.metadata;
                if (inputs.proration_behavior) body.proration_behavior = inputs.proration_behavior;
                const result = await stripeRequest('POST', `/subscriptions/${inputs.id}`, secretKey, body);
                return { output: result };
            }
            case 'cancelSubscription': {
                const query: Record<string, string> = {};
                if (inputs.invoice_now !== undefined) query.invoice_now = String(inputs.invoice_now);
                const result = await stripeRequest('DELETE', `/subscriptions/${inputs.id}`, secretKey, undefined, query);
                return { output: result };
            }
            case 'listSubscriptions': {
                const query: Record<string, string> = {};
                if (inputs.customer) query.customer = inputs.customer;
                if (inputs.status) query.status = inputs.status;
                if (inputs.limit) query.limit = String(inputs.limit);
                const result = await stripeRequest('GET', '/subscriptions', secretKey, undefined, query);
                return { output: result };
            }
            case 'createPrice': {
                const body: Record<string, any> = {
                    currency: inputs.currency,
                    unit_amount: inputs.unit_amount,
                    product: inputs.product,
                };
                if (inputs.recurring) body.recurring = inputs.recurring;
                if (inputs.nickname) body.nickname = inputs.nickname;
                const result = await stripeRequest('POST', '/prices', secretKey, body);
                return { output: result };
            }
            case 'listPrices': {
                const query: Record<string, string> = {};
                if (inputs.product) query.product = inputs.product;
                if (inputs.active !== undefined) query.active = String(inputs.active);
                if (inputs.limit) query.limit = String(inputs.limit);
                const result = await stripeRequest('GET', '/prices', secretKey, undefined, query);
                return { output: result };
            }
            case 'createCoupon': {
                const body: Record<string, any> = {
                    duration: inputs.duration || 'once',
                };
                if (inputs.percent_off !== undefined) body.percent_off = inputs.percent_off;
                if (inputs.amount_off !== undefined) body.amount_off = inputs.amount_off;
                if (inputs.currency) body.currency = inputs.currency;
                if (inputs.name) body.name = inputs.name;
                if (inputs.id) body.id = inputs.id;
                const result = await stripeRequest('POST', '/coupons', secretKey, body);
                return { output: result };
            }
            case 'applyCoupon': {
                const result = await stripeRequest('POST', `/customers/${inputs.customerId || inputs.id}`, secretKey, {
                    coupon: inputs.coupon,
                });
                return { output: result };
            }
            case 'createPromoCode': {
                const body: Record<string, any> = { coupon: inputs.coupon };
                if (inputs.code) body.code = inputs.code;
                if (inputs.customer) body.customer = inputs.customer;
                if (inputs.expires_at) body.expires_at = inputs.expires_at;
                if (inputs.max_redemptions) body.max_redemptions = inputs.max_redemptions;
                const result = await stripeRequest('POST', '/promotion_codes', secretKey, body);
                return { output: result };
            }
            case 'listInvoices': {
                const query: Record<string, string> = {};
                if (inputs.customer) query.customer = inputs.customer;
                if (inputs.status) query.status = inputs.status;
                if (inputs.limit) query.limit = String(inputs.limit);
                const result = await stripeRequest('GET', '/invoices', secretKey, undefined, query);
                return { output: result };
            }
            case 'getInvoice': {
                const result = await stripeRequest('GET', `/invoices/${inputs.id}`, secretKey);
                return { output: result };
            }
            case 'payInvoice': {
                const body: Record<string, any> = {};
                if (inputs.payment_method) body.payment_method = inputs.payment_method;
                const result = await stripeRequest('POST', `/invoices/${inputs.id}/pay`, secretKey, body);
                return { output: result };
            }
            case 'sendInvoice': {
                const result = await stripeRequest('POST', `/invoices/${inputs.id}/send`, secretKey, {});
                return { output: result };
            }
            case 'createMeter': {
                const body: Record<string, any> = {
                    display_name: inputs.display_name || inputs.name,
                    event_name: inputs.event_name,
                    default_aggregation: { formula: inputs.formula || 'sum' },
                };
                if (inputs.customer_mapping) body.customer_mapping = inputs.customer_mapping;
                const result = await stripeRequest('POST', '/billing/meters', secretKey, body);
                return { output: result };
            }
            case 'recordMeterEvent': {
                const body: Record<string, any> = {
                    event_name: inputs.event_name,
                    payload: inputs.payload || { value: inputs.value || '1', stripe_customer_id: inputs.customer },
                };
                if (inputs.timestamp) body.timestamp = inputs.timestamp;
                if (inputs.identifier) body.identifier = inputs.identifier;
                const result = await stripeRequest('POST', '/billing/meter_events', secretKey, body);
                return { output: result };
            }
            default:
                throw new Error(`Unknown Stripe Billing action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.error?.('StripeBillingAction error', err);
        return { error: err?.message || String(err) };
    }
}
