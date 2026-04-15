'use server';

export async function executeKlarnaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { username, password, playground } = inputs;
        const baseUrl = playground ? 'https://api.playground.klarna.com' : 'https://api.klarna.com';
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${credentials}`,
        };

        switch (actionName) {
            case 'createSession': {
                const body = inputs.session || {
                    purchase_country: inputs.purchaseCountry || 'US',
                    purchase_currency: inputs.purchaseCurrency || 'USD',
                    locale: inputs.locale || 'en-US',
                    order_amount: inputs.orderAmount,
                    order_lines: inputs.orderLines,
                };
                const res = await fetch(`${baseUrl}/payments/v1/sessions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'readSession': {
                const res = await fetch(`${baseUrl}/payments/v1/sessions/${inputs.sessionId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'updateSession': {
                const body = inputs.session || { order_amount: inputs.orderAmount, order_lines: inputs.orderLines };
                const res = await fetch(`${baseUrl}/payments/v1/sessions/${inputs.sessionId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'createOrder': {
                const body = inputs.order || {
                    purchase_country: inputs.purchaseCountry || 'US',
                    purchase_currency: inputs.purchaseCurrency || 'USD',
                    locale: inputs.locale || 'en-US',
                    order_amount: inputs.orderAmount,
                    order_lines: inputs.orderLines,
                    billing_address: inputs.billingAddress,
                    authorization_token: inputs.authorizationToken,
                };
                const res = await fetch(`${baseUrl}/payments/v1/authorizations/${inputs.authorizationToken}/order`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/ordermanagement/v1/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'captureOrder': {
                const body = inputs.capture || { captured_amount: inputs.capturedAmount, order_lines: inputs.orderLines };
                const res = await fetch(`${baseUrl}/ordermanagement/v1/orders/${inputs.orderId}/captures`, { method: 'POST', headers, body: JSON.stringify(body) });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'refundOrder': {
                const body = { refunded_amount: inputs.refundedAmount, order_lines: inputs.orderLines };
                const res = await fetch(`${baseUrl}/ordermanagement/v1/orders/${inputs.orderId}/refunds`, { method: 'POST', headers, body: JSON.stringify(body) });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'cancelOrder': {
                const res = await fetch(`${baseUrl}/ordermanagement/v1/orders/${inputs.orderId}/cancel`, { method: 'POST', headers, body: '{}' });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'createCheckoutOrder': {
                const body = inputs.checkoutOrder || {
                    purchase_country: inputs.purchaseCountry || 'US',
                    purchase_currency: inputs.purchaseCurrency || 'USD',
                    locale: inputs.locale || 'en-US',
                    order_amount: inputs.orderAmount,
                    order_lines: inputs.orderLines,
                    merchant_urls: inputs.merchantUrls,
                };
                const res = await fetch(`${baseUrl}/checkout/v3/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getCheckoutOrder': {
                const res = await fetch(`${baseUrl}/checkout/v3/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'updateCheckoutOrder': {
                const body = inputs.checkoutOrder || { order_amount: inputs.orderAmount, order_lines: inputs.orderLines };
                const res = await fetch(`${baseUrl}/checkout/v3/orders/${inputs.orderId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getTransactions': {
                const params = new URLSearchParams();
                if (inputs.orderId) params.set('order_id', inputs.orderId);
                const res = await fetch(`${baseUrl}/merchant-card/v3/settlements/transactions?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createDispute': {
                const body = inputs.dispute || { order_id: inputs.orderId, dispute_type: inputs.disputeType, description: inputs.description };
                const res = await fetch(`${baseUrl}/merchantcardservice/v3/disputes`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.size) params.set('size', inputs.size);
                const res = await fetch(`${baseUrl}/ordermanagement/v1/orders?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getCustomerToken': {
                const body = inputs.tokenRequest || { purchase_country: inputs.purchaseCountry || 'US', purchase_currency: inputs.purchaseCurrency || 'USD', locale: inputs.locale || 'en-US', billing_address: inputs.billingAddress, intended_use: inputs.intendedUse || 'SUBSCRIPTION', authorization_token: inputs.authorizationToken };
                const res = await fetch(`${baseUrl}/payments/v1/authorizations/${inputs.authorizationToken}/customer-token`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeKlarnaAction error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
