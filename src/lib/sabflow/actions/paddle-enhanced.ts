'use server';

export async function executePaddleEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        const isSandbox = inputs.sandbox === true || inputs.sandbox === 'true';
        const baseUrl = isSandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/products?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to list products' };
                return { output: data };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to get product' };
                return { output: data };
            }
            case 'createProduct': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    tax_category: inputs.taxCategory || 'standard',
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.imageUrl) body.image_url = inputs.imageUrl;
                if (inputs.customData) body.custom_data = inputs.customData;
                const res = await fetch(`${baseUrl}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to create product' };
                return { output: data };
            }
            case 'updateProduct': {
                const body: Record<string, any> = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.imageUrl) body.image_url = inputs.imageUrl;
                if (inputs.status) body.status = inputs.status;
                if (inputs.customData) body.custom_data = inputs.customData;
                const res = await fetch(`${baseUrl}/products/${inputs.productId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to update product' };
                return { output: data };
            }
            case 'listPrices': {
                const params = new URLSearchParams();
                if (inputs.productId) params.set('product_id', inputs.productId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/prices?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to list prices' };
                return { output: data };
            }
            case 'getPrice': {
                const res = await fetch(`${baseUrl}/prices/${inputs.priceId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to get price' };
                return { output: data };
            }
            case 'createPrice': {
                const body: Record<string, any> = {
                    product_id: inputs.productId,
                    description: inputs.description,
                    unit_price: {
                        amount: String(inputs.amount),
                        currency_code: inputs.currencyCode || 'USD',
                    },
                };
                if (inputs.billingCycle) body.billing_cycle = inputs.billingCycle;
                if (inputs.trialPeriod) body.trial_period = inputs.trialPeriod;
                if (inputs.customData) body.custom_data = inputs.customData;
                const res = await fetch(`${baseUrl}/prices`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to create price' };
                return { output: data };
            }
            case 'updatePrice': {
                const body: Record<string, any> = {};
                if (inputs.description) body.description = inputs.description;
                if (inputs.unitPrice) body.unit_price = inputs.unitPrice;
                if (inputs.billingCycle) body.billing_cycle = inputs.billingCycle;
                if (inputs.status) body.status = inputs.status;
                if (inputs.customData) body.custom_data = inputs.customData;
                const res = await fetch(`${baseUrl}/prices/${inputs.priceId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to update price' };
                return { output: data };
            }
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.customerId) params.set('customer_id', inputs.customerId);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/subscriptions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to list subscriptions' };
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to get subscription' };
                return { output: data };
            }
            case 'cancelSubscription': {
                const body: Record<string, any> = {};
                if (inputs.effectiveFrom) body.effective_from = inputs.effectiveFrom;
                if (inputs.resumeAt) body.resume_at = inputs.resumeAt;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to cancel subscription' };
                return { output: data };
            }
            case 'listTransactions': {
                const params = new URLSearchParams();
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.customerId) params.set('customer_id', inputs.customerId);
                if (inputs.subscriptionId) params.set('subscription_id', inputs.subscriptionId);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/transactions?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to list transactions' };
                return { output: data };
            }
            case 'getTransaction': {
                const res = await fetch(`${baseUrl}/transactions/${inputs.transactionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to get transaction' };
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.after) params.set('after', inputs.after);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to list customers' };
                return { output: data };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.detail || 'Failed to get customer' };
                return { output: data };
            }
            default:
                return { error: `Unknown Paddle action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Paddle Enhanced error: ${err.message}`);
        return { error: err.message || 'Unknown error in Paddle Enhanced action' };
    }
}
