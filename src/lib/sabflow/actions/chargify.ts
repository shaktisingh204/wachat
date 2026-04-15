'use server';

export async function executeChargifyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const credentials = Buffer.from(`${inputs.apiKey}:x`).toString('base64');
        const baseUrl = `https://${inputs.subdomain}.chargify.com`;

        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listSubscriptions': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.productId) params.set('product_id', String(inputs.productId));
                const res = await fetch(`${baseUrl}/subscriptions.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to list subscriptions' };
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to get subscription' };
                return { output: data };
            }
            case 'createSubscription': {
                const body: Record<string, any> = {
                    subscription: {
                        product_handle: inputs.productHandle,
                        customer_attributes: inputs.customerAttributes || {
                            first_name: inputs.firstName,
                            last_name: inputs.lastName,
                            email: inputs.email,
                        },
                    },
                };
                if (inputs.paymentProfileAttributes) body.subscription.payment_profile_attributes = inputs.paymentProfileAttributes;
                if (inputs.couponCode) body.subscription.coupon_code = inputs.couponCode;
                const res = await fetch(`${baseUrl}/subscriptions.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to create subscription' };
                return { output: data };
            }
            case 'updateSubscription': {
                const body: Record<string, any> = { subscription: {} };
                if (inputs.productHandle) body.subscription.product_handle = inputs.productHandle;
                if (inputs.nextBillingAt) body.subscription.next_billing_at = inputs.nextBillingAt;
                if (inputs.snap) body.subscription.snap_day = inputs.snap;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to update subscription' };
                return { output: data };
            }
            case 'cancelSubscription': {
                const body: Record<string, any> = {};
                if (inputs.cancellationMessage) body.subscription = { cancellation_message: inputs.cancellationMessage };
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}.json`, {
                    method: 'DELETE',
                    headers,
                    body: Object.keys(body).length ? JSON.stringify(body) : undefined,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to cancel subscription' };
                return { output: data };
            }
            case 'reactivateSubscription': {
                const body: Record<string, any> = {};
                if (inputs.includeTrial) body.include_trial = inputs.includeTrial;
                if (inputs.preserveBalance) body.preserve_balance = inputs.preserveBalance;
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}/reactivate.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to reactivate subscription' };
                return { output: data };
            }
            case 'listComponents': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/components.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to list components' };
                return { output: data };
            }
            case 'getComponent': {
                const res = await fetch(`${baseUrl}/components/${inputs.componentId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to get component' };
                return { output: data };
            }
            case 'addComponentToSubscription': {
                const body = {
                    component: {
                        component_id: inputs.componentId,
                        unit_balance: inputs.unitBalance,
                        allocated_quantity: inputs.allocatedQuantity,
                    },
                };
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}/components/${inputs.componentId}.json`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to add component to subscription' };
                return { output: data };
            }
            case 'listProducts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.productFamilyId) {
                    const res = await fetch(`${baseUrl}/product_families/${inputs.productFamilyId}/products.json?${params}`, { headers });
                    const data = await res.json();
                    if (!res.ok) return { error: data.errors?.[0] || 'Failed to list products' };
                    return { output: data };
                }
                const res = await fetch(`${baseUrl}/products.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to list products' };
                return { output: data };
            }
            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${inputs.productId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to get product' };
                return { output: data };
            }
            case 'createProduct': {
                const body = {
                    product: {
                        name: inputs.name,
                        description: inputs.description,
                        price_in_cents: inputs.priceInCents,
                        interval: inputs.interval || 1,
                        interval_unit: inputs.intervalUnit || 'month',
                    },
                };
                const res = await fetch(`${baseUrl}/product_families/${inputs.productFamilyId}/products.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to create product' };
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.q) params.set('q', inputs.q);
                const res = await fetch(`${baseUrl}/customers.json?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to list customers' };
                return { output: data };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to get customer' };
                return { output: data };
            }
            case 'createCustomer': {
                const body = {
                    customer: {
                        first_name: inputs.firstName,
                        last_name: inputs.lastName,
                        email: inputs.email,
                        organization: inputs.organization,
                        phone: inputs.phone,
                        address: inputs.address,
                        city: inputs.city,
                        state: inputs.state,
                        zip: inputs.zip,
                        country: inputs.country,
                    },
                };
                const res = await fetch(`${baseUrl}/customers.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0] || 'Failed to create customer' };
                return { output: data };
            }
            default:
                return { error: `Unknown Chargify action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Chargify error: ${err.message}`);
        return { error: err.message || 'Unknown error in Chargify action' };
    }
}
