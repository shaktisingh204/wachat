
'use server';

function getPaypalBaseUrl(environment: string): string {
    return environment === 'sandbox'
        ? 'https://api-m.sandbox.paypal.com'
        : 'https://api-m.paypal.com';
}

async function getPaypalAccessToken(
    clientId: string,
    clientSecret: string,
    environment: string
): Promise<string> {
    const base = getPaypalBaseUrl(environment);
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await fetch(`${base}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
        },
        body: 'grant_type=client_credentials',
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.error_description ?? `PayPal auth failed: ${res.status}`);
    }
    return data.access_token;
}

async function paypalFetch(
    base: string,
    accessToken: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    const url = `${base}${path}`;
    logger?.log(`[PayPal] ${method} ${path}`);

    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'PayPal-Request-Id': `sabflow-${Date.now()}`,
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);

    const res = await fetch(url, options);

    // 204 No Content
    if (res.status === 204) return { success: true };

    const text = await res.text();
    let data: any;
    try {
        data = JSON.parse(text);
    } catch {
        data = text;
    }

    if (!res.ok) {
        const msg = data?.message ?? data?.error_description ?? `PayPal API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

function parseJson(value: any, fieldName: string): any {
    if (value === undefined || value === null) return undefined;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(String(value));
    } catch {
        throw new Error(`"${fieldName}" must be valid JSON.`);
    }
}

export async function executePaypalAction(
    actionName: string,
    inputs: any,
    _user: any,
    logger: any
) {
    try {
        const clientId = String(inputs.clientId ?? '').trim();
        const clientSecret = String(inputs.clientSecret ?? '').trim();
        const environment = String(inputs.environment ?? 'production').toLowerCase().trim();
        if (!clientId) throw new Error('"clientId" is required.');
        if (!clientSecret) throw new Error('"clientSecret" is required.');

        const accessToken = await getPaypalAccessToken(clientId, clientSecret, environment);
        const base = getPaypalBaseUrl(environment);
        const pp = (method: string, path: string, body?: any) =>
            paypalFetch(base, accessToken, method, path, body, logger);

        switch (actionName) {
            case 'createOrder': {
                const amount = String(inputs.amount ?? '').trim();
                const currency = String(inputs.currency ?? 'USD').trim().toUpperCase();
                if (!amount) throw new Error('"amount" is required.');
                logger.log(`[PayPal] createOrder ${amount} ${currency}`);
                const body: any = {
                    intent: 'CAPTURE',
                    purchase_units: [
                        {
                            amount: { currency_code: currency, value: amount },
                            ...(inputs.description ? { description: String(inputs.description) } : {}),
                        },
                    ],
                };
                const data = await pp('POST', '/v2/checkout/orders', body);
                return {
                    output: {
                        orderId: data.id,
                        status: data.status,
                        approveLink: (data.links ?? []).find((l: any) => l.rel === 'approve')?.href ?? null,
                    },
                };
            }

            case 'captureOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('"orderId" is required.');
                logger.log(`[PayPal] captureOrder ${orderId}`);
                const data = await pp('POST', `/v2/checkout/orders/${orderId}/capture`, {});
                const capture = data.purchase_units?.[0]?.payments?.captures?.[0] ?? {};
                return {
                    output: {
                        orderId: data.id,
                        status: data.status,
                        captureId: capture.id ?? null,
                        captureStatus: capture.status ?? null,
                        amount: capture.amount ?? null,
                    },
                };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('"orderId" is required.');
                logger.log(`[PayPal] getOrder ${orderId}`);
                const data = await pp('GET', `/v2/checkout/orders/${orderId}`);
                return { output: { order: data } };
            }

            case 'refundCapture': {
                const captureId = String(inputs.captureId ?? '').trim();
                if (!captureId) throw new Error('"captureId" is required.');
                const body: any = {};
                if (inputs.amount !== undefined && inputs.amount !== '') {
                    const currency = String(inputs.currency ?? 'USD').trim().toUpperCase();
                    body.amount = { currency_code: currency, value: String(inputs.amount) };
                }
                if (inputs.reason) body.note_to_payer = String(inputs.reason).slice(0, 255);
                logger.log(`[PayPal] refundCapture ${captureId}`);
                const data = await pp('POST', `/v2/payments/captures/${captureId}/refund`, body);
                return {
                    output: {
                        refundId: data.id,
                        status: data.status,
                        amount: data.amount ?? null,
                    },
                };
            }

            case 'createProduct': {
                const name = String(inputs.name ?? '').trim();
                const description = String(inputs.description ?? '').trim();
                const type = String(inputs.type ?? 'SERVICE').trim().toUpperCase();
                if (!name) throw new Error('"name" is required.');
                logger.log(`[PayPal] createProduct "${name}"`);
                const data = await pp('POST', '/v1/catalogs/products', {
                    name,
                    description: description || undefined,
                    type,
                });
                return { output: { productId: data.id, name: data.name, type: data.type } };
            }

            case 'createPlan': {
                const productId = String(inputs.productId ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                if (!productId) throw new Error('"productId" is required.');
                if (!name) throw new Error('"name" is required.');
                const billingCycles = parseJson(inputs.billingCycles, 'billingCycles');
                const paymentPreferences = parseJson(inputs.paymentPreferences, 'paymentPreferences');
                if (!Array.isArray(billingCycles)) throw new Error('"billingCycles" must be a JSON array.');
                if (!paymentPreferences) throw new Error('"paymentPreferences" is required.');
                logger.log(`[PayPal] createPlan "${name}" for product ${productId}`);
                const data = await pp('POST', '/v1/billing/plans', {
                    product_id: productId,
                    name,
                    billing_cycles: billingCycles,
                    payment_preferences: paymentPreferences,
                });
                return { output: { planId: data.id, status: data.status, name: data.name } };
            }

            case 'createSubscription': {
                const planId = String(inputs.planId ?? '').trim();
                if (!planId) throw new Error('"planId" is required.');
                const body: any = { plan_id: planId };
                if (inputs.subscriberEmail) {
                    body.subscriber = { email_address: String(inputs.subscriberEmail) };
                }
                logger.log(`[PayPal] createSubscription for plan ${planId}`);
                const data = await pp('POST', '/v1/billing/subscriptions', body);
                return {
                    output: {
                        subscriptionId: data.id,
                        status: data.status,
                        approveLink: (data.links ?? []).find((l: any) => l.rel === 'approve')?.href ?? null,
                    },
                };
            }

            case 'cancelSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('"subscriptionId" is required.');
                const reason = String(inputs.reason ?? 'Cancelled by user').trim();
                logger.log(`[PayPal] cancelSubscription ${subscriptionId}`);
                await pp('POST', `/v1/billing/subscriptions/${subscriptionId}/cancel`, { reason });
                return { output: { cancelled: true, subscriptionId } };
            }

            case 'getSubscription': {
                const subscriptionId = String(inputs.subscriptionId ?? '').trim();
                if (!subscriptionId) throw new Error('"subscriptionId" is required.');
                logger.log(`[PayPal] getSubscription ${subscriptionId}`);
                const data = await pp('GET', `/v1/billing/subscriptions/${subscriptionId}`);
                return { output: { subscription: data } };
            }

            case 'createInvoice': {
                const invoicerEmail = String(inputs.invoicerEmail ?? '').trim();
                const recipientEmail = String(inputs.recipientEmail ?? '').trim();
                if (!invoicerEmail) throw new Error('"invoicerEmail" is required.');
                if (!recipientEmail) throw new Error('"recipientEmail" is required.');
                const items = parseJson(inputs.items, 'items');
                if (!Array.isArray(items)) throw new Error('"items" must be a JSON array.');
                const currencyCode = String(inputs.currencyCode ?? 'USD').trim().toUpperCase();
                logger.log(`[PayPal] createInvoice from ${invoicerEmail} to ${recipientEmail}`);
                const body = {
                    detail: { currency_code: currencyCode, payment_term: { term_type: 'NET_10' } },
                    invoicer: { email_address: invoicerEmail },
                    primary_recipients: [{ billing_info: { email_address: recipientEmail } }],
                    items,
                };
                const data = await pp('POST', '/v2/invoicing/invoices', body);
                return { output: { invoiceId: data.id, status: data.status, href: data.href ?? null } };
            }

            case 'sendInvoice': {
                const invoiceId = String(inputs.invoiceId ?? '').trim();
                if (!invoiceId) throw new Error('"invoiceId" is required.');
                logger.log(`[PayPal] sendInvoice ${invoiceId}`);
                await pp('POST', `/v2/invoicing/invoices/${invoiceId}/send`, {
                    send_to_recipient: true,
                    send_to_invoicer: false,
                });
                return { output: { sent: true, invoiceId } };
            }

            default:
                return { error: `PayPal action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        const msg = e.message || 'PayPal action failed.';
        logger.log(`[PayPal] Error in "${actionName}": ${msg}`);
        return { error: msg };
    }
}
