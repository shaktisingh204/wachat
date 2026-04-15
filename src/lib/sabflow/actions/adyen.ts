'use server';

// ---------------------------------------------------------------------------
// Adyen – Checkout v70 + Management v3
// Docs: https://docs.adyen.com/api-explorer
// ---------------------------------------------------------------------------

async function adyenFetch(
    apiKey: string,
    live: boolean,
    baseType: 'checkout' | 'management',
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    let base: string;
    if (baseType === 'checkout') {
        base = live ? 'https://checkout-live.adyen.com/v70' : 'https://checkout-test.adyen.com/v70';
    } else {
        base = live ? 'https://management-live.adyen.com/v3' : 'https://management-test.adyen.com/v3';
    }

    const url = `${base}${path}`;
    logger?.log(`[Adyen] ${method} ${url}`);

    const options: RequestInit = {
        method,
        headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) return { error: data?.message || data?.detail || `HTTP ${res.status}` };
    return data;
}

export async function executeAdyenAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey: string = inputs.apiKey || '';
        const live: boolean = inputs.live === true || inputs.live === 'true';
        const merchantAccountCode: string = inputs.merchantAccountCode || inputs.merchantAccount || '';

        switch (actionName) {
            case 'createPaymentSession': {
                const body = {
                    merchantAccount: merchantAccountCode,
                    amount: { currency: inputs.currency || 'USD', value: Number(inputs.amount) },
                    returnUrl: inputs.returnUrl,
                    reference: inputs.reference,
                    countryCode: inputs.countryCode,
                    shopperLocale: inputs.shopperLocale,
                    channel: inputs.channel || 'Web',
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/sessions', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'submitPayment': {
                const body = {
                    merchantAccount: merchantAccountCode,
                    amount: { currency: inputs.currency || 'USD', value: Number(inputs.amount) },
                    reference: inputs.reference,
                    returnUrl: inputs.returnUrl,
                    paymentMethod: inputs.paymentMethod,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/payments', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getPaymentDetails': {
                const body = {
                    paymentData: inputs.paymentData,
                    details: inputs.details,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/payments/details', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createPaymentLink': {
                const body = {
                    merchantAccount: merchantAccountCode,
                    amount: { currency: inputs.currency || 'USD', value: Number(inputs.amount) },
                    reference: inputs.reference,
                    description: inputs.description,
                    expiresAt: inputs.expiresAt,
                    returnUrl: inputs.returnUrl,
                    shopperReference: inputs.shopperReference,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/paymentLinks', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'capturePayment': {
                const pspReference: string = inputs.pspReference || '';
                const body = {
                    merchantAccount: merchantAccountCode,
                    amount: { currency: inputs.currency || 'USD', value: Number(inputs.amount) },
                    reference: inputs.reference,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', `/payments/${pspReference}/captures`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'refundPayment': {
                const pspReference: string = inputs.pspReference || '';
                const body = {
                    merchantAccount: merchantAccountCode,
                    amount: { currency: inputs.currency || 'USD', value: Number(inputs.amount) },
                    reference: inputs.reference,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', `/payments/${pspReference}/refunds`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'cancelPayment': {
                const pspReference: string = inputs.pspReference || '';
                const body = {
                    merchantAccount: merchantAccountCode,
                    reference: inputs.reference,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', `/payments/${pspReference}/cancels`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listPaymentMethods': {
                const body = {
                    merchantAccount: merchantAccountCode,
                    countryCode: inputs.countryCode,
                    channel: inputs.channel || 'Web',
                    amount: inputs.amount ? { currency: inputs.currency || 'USD', value: Number(inputs.amount) } : undefined,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/paymentMethods', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getMerchantAccount': {
                const merchantId: string = inputs.merchantId || merchantAccountCode;
                const result = await adyenFetch(apiKey, live, 'management', 'GET', `/merchants/${merchantId}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listMerchantAccounts': {
                const params = new URLSearchParams();
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageNumber) params.set('pageNumber', String(inputs.pageNumber));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await adyenFetch(apiKey, live, 'management', 'GET', `/merchants${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createWebhook': {
                const merchantId: string = inputs.merchantId || merchantAccountCode;
                const body = {
                    type: inputs.type || 'standard',
                    url: inputs.url,
                    username: inputs.username,
                    password: inputs.password,
                    active: inputs.active !== false,
                    communicationFormat: inputs.communicationFormat || 'JSON',
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'management', 'POST', `/merchants/${merchantId}/webhooks`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'testWebhook': {
                const merchantId: string = inputs.merchantId || merchantAccountCode;
                const webhookId: string = inputs.webhookId || '';
                const body = { types: inputs.types || ['AUTHORISATION'] };
                const result = await adyenFetch(apiKey, live, 'management', 'POST', `/merchants/${merchantId}/webhooks/${webhookId}/test`, body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'createStorePaymentMethod': {
                const body = {
                    merchantAccount: merchantAccountCode,
                    shopperReference: inputs.shopperReference,
                    paymentMethod: inputs.paymentMethod,
                    returnUrl: inputs.returnUrl,
                    ...inputs.extra,
                };
                const result = await adyenFetch(apiKey, live, 'checkout', 'POST', '/paymentMethods/balance', body, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'getStoredPaymentMethod': {
                const merchantId: string = inputs.merchantId || merchantAccountCode;
                const shopperReference: string = inputs.shopperReference || '';
                const storedPaymentMethodId: string = inputs.storedPaymentMethodId || '';
                const result = await adyenFetch(
                    apiKey, live, 'management', 'GET',
                    `/merchants/${merchantId}/paymentMethodSettings?shopperReference=${shopperReference}&storedPaymentMethodId=${storedPaymentMethodId}`,
                    undefined, logger
                );
                if (result.error) return { error: result.error };
                return { output: result };
            }

            case 'listStoredPaymentMethods': {
                const params = new URLSearchParams();
                if (inputs.shopperReference) params.set('shopperReference', inputs.shopperReference);
                if (inputs.merchantAccount) params.set('merchantAccount', inputs.merchantAccount);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const result = await adyenFetch(apiKey, live, 'checkout', 'GET', `/storedPaymentMethods${qs}`, undefined, logger);
                if (result.error) return { error: result.error };
                return { output: result };
            }

            default:
                return { error: `Adyen action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err?.message || String(err) };
    }
}
