'use server';

// ---------------------------------------------------------------------------
// Paddle Billing – API v2
// Docs: https://developer.paddle.com/api-reference
// ---------------------------------------------------------------------------

async function paddleFetch(
    apiKey: string,
    sandbox: boolean,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = sandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
    const url = `${base}${path}`;
    logger?.log(`[Paddle] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = { raw: text };
    }
    if (!res.ok) {
        const msg =
            data?.error?.detail ??
            data?.error?.code ??
            data?.error?.type ??
            `Paddle API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function buildQuery(params: Record<string, any>): string {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') {
            parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
        }
    }
    return parts.length ? `?${parts.join('&')}` : '';
}

export async function executePaddleAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('"apiKey" is required.');
        const sandbox = inputs.sandbox === true || inputs.sandbox === 'true';

        const pd = (method: string, path: string, body?: any) =>
            paddleFetch(apiKey, sandbox, method, path, body, logger);

        switch (actionName) {
            // ── Customers ────────────────────────────────────────────────────
            case 'listCustomers': {
                const q = buildQuery({
                    after: inputs.after,
                    per_page: inputs.perPage ?? 50,
                });
                const data = await pd('GET', `/customers${q}`);
                return {
                    output: {
                        data: (data.data ?? []).map((c: any) => ({
                            id: c.id,
                            email: c.email,
                            name: c.name,
                            customData: c.custom_data,
                        })),
                        meta: data.meta ?? {},
                    },
                };
            }

            case 'getCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('"customerId" is required.');
                const data = await pd('GET', `/customers/${customerId}`);
                const c = data.data ?? {};
                return {
                    output: {
                        data: { id: c.id, email: c.email, name: c.name, status: c.status },
                    },
                };
            }

            case 'createCustomer': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('"email" is required.');
                const body: any = { email };
                if (inputs.name) body.name = String(inputs.name).trim();
                if (inputs.customData !== undefined) body.custom_data = inputs.customData;
                const data = await pd('POST', '/customers', body);
                return { output: { data: { id: data.data?.id, email: data.data?.email } } };
            }

            case 'updateCustomer': {
                const customerId = String(inputs.customerId ?? '').trim();
                if (!customerId) throw new Error('"customerId" is required.');
                const body: any = {};
                if (inputs.name !== undefined) body.name = String(inputs.name).trim();
                if (inputs.email !== undefined) body.email = String(inputs.email).trim();
                const data = await pd('PATCH', `/customers/${customerId}`, body);
                return { output: { data: { id: data.data?.id } } };
            }

            // ── Products ─────────────────────────────────────────────────────
            case 'listProducts': {
                const q = buildQuery({
                    after: inputs.after,
                    status: inputs.status,
                });
                const data = await pd('GET', `/products${q}`);
                return {
                    output: {
                        data: (data.data ?? []).map((p: any) => ({
                            id: p.id,
                            name: p.name,
                            description: p.description,
                            status: p.status,
                        })),
                        meta: data.meta ?? {},
                    },
                };
            }

            case 'getProduct': {
                const productId = String(inputs.productId ?? '').trim();
                if (!productId) throw new Error('"productId" is required.');
                const data = await pd('GET', `/products/${productId}`);
                const p = data.data ?? {};
                return {
                    output: {
                        data: { id: p.id, name: p.name, description: p.description, prices: p.prices ?? [] },
                    },
                };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                const taxCategory = String(inputs.taxCategory ?? '').trim();
                if (!name) throw new Error('"name" is required.');
                if (!taxCategory) throw new Error('"taxCategory" is required.');
                const body: any = { name, tax_category: taxCategory };
                if (inputs.description) body.description = String(inputs.description).trim();
                if (inputs.imageUrl) body.image_url = String(inputs.imageUrl).trim();
                const data = await pd('POST', '/products', body);
                return { output: { data: { id: data.data?.id, name: data.data?.name } } };
            }

            // ── Prices ───────────────────────────────────────────────────────
            case 'listPrices': {
                const q = buildQuery({ product_id: inputs.productId ?? '' });
                const data = await pd('GET', `/prices${q}`);
                return {
                    output: {
                        data: (data.data ?? []).map((p: any) => ({
                            id: p.id,
                            description: p.description,
                            unitPrice: p.unit_price,
                            trialPeriod: p.trial_period,
                        })),
                    },
                };
            }

            // ── Subscriptions ─────────────────────────────────────────────────
            case 'listSubscriptions': {
                const q = buildQuery({
                    customer_id: inputs.customerId ?? '',
                    status: inputs.status,
                });
                const data = await pd('GET', `/subscriptions${q}`);
                return { output: { data: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'getSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('"subscriptionId" is required.');
                const data = await pd('GET', `/subscriptions/${subscriptionId}`);
                const s = data.data ?? {};
                return {
                    output: {
                        data: {
                            id: s.id,
                            status: s.status,
                            customerId: s.customer_id,
                            items: s.items ?? [],
                        },
                    },
                };
            }

            case 'cancelSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('"subscriptionId" is required.');
                const body = {
                    effective_from: inputs.effectiveFrom ?? 'next_billing_period',
                };
                const data = await pd('POST', `/subscriptions/${subscriptionId}/cancel`, body);
                return { output: { data: { status: data.data?.status ?? 'canceled' } } };
            }

            // ── Transactions ──────────────────────────────────────────────────
            case 'listTransactions': {
                const q = buildQuery({
                    customer_id: inputs.customerId,
                    subscription_id: inputs.subscriptionId,
                    after: inputs.after,
                });
                const data = await pd('GET', `/transactions${q}`);
                return { output: { data: data.data ?? [], meta: data.meta ?? {} } };
            }

            case 'getTransaction': {
                const transactionId = String(inputs.transactionId ?? '').trim();
                if (!transactionId) throw new Error('"transactionId" is required.');
                const data = await pd('GET', `/transactions/${transactionId}`);
                const t = data.data ?? {};
                return {
                    output: {
                        data: {
                            id: t.id,
                            status: t.status,
                            customer: t.customer,
                            total: t.details?.totals?.total,
                            currency: t.currency_code,
                        },
                    },
                };
            }

            // ── Discounts ─────────────────────────────────────────────────────
            case 'createDiscount': {
                const description = String(inputs.description ?? '').trim();
                const type = String(inputs.type ?? '').trim();
                const amount = String(inputs.amount ?? '').trim();
                if (!description) throw new Error('"description" is required.');
                if (!type) throw new Error('"type" is required.');
                if (!amount) throw new Error('"amount" is required.');
                const body: any = { description, type, amount };
                if (inputs.currencyCode) body.currency_code = String(inputs.currencyCode).trim();
                if (inputs.recur !== undefined) body.recur = inputs.recur;
                if (inputs.maxRecurrences !== undefined)
                    body.maximum_recurring_intervals = Number(inputs.maxRecurrences);
                const data = await pd('POST', '/discounts', body);
                return { output: { data: { id: data.data?.id, code: data.data?.code } } };
            }

            default:
                return { error: `Paddle action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'Paddle action failed.';
        logger?.log(`[Paddle] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
