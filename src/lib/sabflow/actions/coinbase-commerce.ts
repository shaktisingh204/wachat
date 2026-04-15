'use server';

// ---------------------------------------------------------------------------
// Coinbase Commerce – API v1
// Docs: https://docs.cdp.coinbase.com/commerce/reference
// ---------------------------------------------------------------------------

async function coinbaseFetch(
    apiKey: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const base = 'https://api.commerce.coinbase.com';
    const url = `${base}${path}`;
    logger?.log(`[CoinbaseCommerce] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            'X-CC-Api-Key': apiKey,
            'X-CC-Version': '2018-03-22',
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) {
        const errMsg = data?.error?.message || data?.message || `HTTP ${res.status}`;
        return { error: errMsg };
    }
    return data;
}

function buildQueryString(params: Record<string, any>): string {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
    }
    const qs = p.toString();
    return qs ? `?${qs}` : '';
}

export async function executeCoinbaseCommerceAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey || '';

        switch (actionName) {
            case 'createCharge': {
                const body = {
                    name: inputs.name,
                    description: inputs.description,
                    local_price: {
                        amount: String(inputs.amount),
                        currency: inputs.currency || 'USD',
                    },
                    pricing_type: inputs.pricingType || 'fixed_price',
                    metadata: inputs.metadata,
                    redirect_url: inputs.redirectUrl,
                    cancel_url: inputs.cancelUrl,
                };
                const result = await coinbaseFetch(apiKey, 'POST', '/charges', body, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'getCharge': {
                const chargeCode: string = inputs.chargeCode || inputs.chargeId || '';
                const result = await coinbaseFetch(apiKey, 'GET', `/charges/${chargeCode}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'listCharges': {
                const qs = buildQueryString({
                    limit: inputs.limit,
                    starting_after: inputs.startingAfter,
                    ending_before: inputs.endingBefore,
                    order: inputs.order,
                });
                const result = await coinbaseFetch(apiKey, 'GET', `/charges${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'cancelCharge': {
                const chargeCode: string = inputs.chargeCode || inputs.chargeId || '';
                const result = await coinbaseFetch(apiKey, 'POST', `/charges/${chargeCode}/cancel`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'createCheckout': {
                const body = {
                    name: inputs.name,
                    description: inputs.description,
                    local_price: inputs.amount
                        ? { amount: String(inputs.amount), currency: inputs.currency || 'USD' }
                        : undefined,
                    pricing_type: inputs.pricingType || 'fixed_price',
                    requested_info: inputs.requestedInfo || [],
                    metadata: inputs.metadata,
                };
                const result = await coinbaseFetch(apiKey, 'POST', '/checkouts', body, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'getCheckout': {
                const checkoutId: string = inputs.checkoutId || '';
                const result = await coinbaseFetch(apiKey, 'GET', `/checkouts/${checkoutId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'listCheckouts': {
                const qs = buildQueryString({
                    limit: inputs.limit,
                    starting_after: inputs.startingAfter,
                    ending_before: inputs.endingBefore,
                    order: inputs.order,
                });
                const result = await coinbaseFetch(apiKey, 'GET', `/checkouts${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'updateCheckout': {
                const checkoutId: string = inputs.checkoutId || '';
                const body = {
                    name: inputs.name,
                    description: inputs.description,
                    local_price: inputs.amount
                        ? { amount: String(inputs.amount), currency: inputs.currency || 'USD' }
                        : undefined,
                    pricing_type: inputs.pricingType,
                    requested_info: inputs.requestedInfo,
                    metadata: inputs.metadata,
                };
                const result = await coinbaseFetch(apiKey, 'PUT', `/checkouts/${checkoutId}`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'deleteCheckout': {
                const checkoutId: string = inputs.checkoutId || '';
                const result = await coinbaseFetch(apiKey, 'DELETE', `/checkouts/${checkoutId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: { deleted: true, checkoutId } };
            }

            case 'createInvoice': {
                const body = {
                    business_name: inputs.businessName,
                    customer_email: inputs.customerEmail,
                    customer_name: inputs.customerName,
                    local_price: {
                        amount: String(inputs.amount),
                        currency: inputs.currency || 'USD',
                    },
                    memo: inputs.memo,
                    metadata: inputs.metadata,
                };
                const result = await coinbaseFetch(apiKey, 'POST', '/invoices', body, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'getInvoice': {
                const invoiceId: string = inputs.invoiceId || '';
                const result = await coinbaseFetch(apiKey, 'GET', `/invoices/${invoiceId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'listInvoices': {
                const qs = buildQueryString({
                    limit: inputs.limit,
                    starting_after: inputs.startingAfter,
                    ending_before: inputs.endingBefore,
                    order: inputs.order,
                });
                const result = await coinbaseFetch(apiKey, 'GET', `/invoices${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'voidInvoice': {
                const invoiceId: string = inputs.invoiceId || '';
                const result = await coinbaseFetch(apiKey, 'PUT', `/invoices/${invoiceId}/void`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'resolveInvoice': {
                const invoiceId: string = inputs.invoiceId || '';
                const result = await coinbaseFetch(apiKey, 'PUT', `/invoices/${invoiceId}/resolve`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            case 'listEvents': {
                const qs = buildQueryString({
                    limit: inputs.limit,
                    starting_after: inputs.startingAfter,
                    ending_before: inputs.endingBefore,
                    order: inputs.order,
                });
                const result = await coinbaseFetch(apiKey, 'GET', `/events${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result.data ?? result };
            }

            default:
                return { error: `Coinbase Commerce action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err?.message || String(err) };
    }
}
