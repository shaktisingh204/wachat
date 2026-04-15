'use server';

export async function executeSquareEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken, sandbox } = inputs;
        const baseUrl = sandbox ? 'https://connect.squareupsandbox.com/v2' : 'https://connect.squareup.com/v2';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-18',
            'Authorization': `Bearer ${accessToken}`,
        };

        switch (actionName) {
            case 'createPayment': {
                const body = {
                    source_id: inputs.sourceId,
                    idempotency_key: inputs.idempotencyKey || crypto.randomUUID(),
                    amount_money: { amount: inputs.amount, currency: inputs.currency || 'USD' },
                    location_id: inputs.locationId,
                };
                const res = await fetch(`${baseUrl}/payments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getPayment': {
                const res = await fetch(`${baseUrl}/payments/${inputs.paymentId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/payments?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'refundPayment': {
                const body = {
                    idempotency_key: inputs.idempotencyKey || crypto.randomUUID(),
                    payment_id: inputs.paymentId,
                    amount_money: { amount: inputs.amount, currency: inputs.currency || 'USD' },
                    reason: inputs.reason,
                };
                const res = await fetch(`${baseUrl}/refunds`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'createOrder': {
                const body = {
                    order: { location_id: inputs.locationId, line_items: inputs.lineItems },
                    idempotency_key: inputs.idempotencyKey || crypto.randomUUID(),
                };
                const res = await fetch(`${baseUrl}/orders`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listOrders': {
                const body = { location_ids: inputs.locationIds, limit: inputs.limit || 50 };
                const res = await fetch(`${baseUrl}/orders/search`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'createCustomer': {
                const body = { given_name: inputs.givenName, family_name: inputs.familyName, email_address: inputs.emailAddress, phone_number: inputs.phoneNumber };
                const res = await fetch(`${baseUrl}/customers`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getCustomer': {
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'updateCustomer': {
                const body = inputs.customer || { given_name: inputs.givenName, family_name: inputs.familyName, email_address: inputs.emailAddress };
                const res = await fetch(`${baseUrl}/customers/${inputs.customerId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listCustomers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/customers?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createSubscription': {
                const body = {
                    idempotency_key: inputs.idempotencyKey || crypto.randomUUID(),
                    location_id: inputs.locationId,
                    plan_variation_id: inputs.planVariationId,
                    customer_id: inputs.customerId,
                    start_date: inputs.startDate,
                };
                const res = await fetch(`${baseUrl}/subscriptions`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'getSubscription': {
                const res = await fetch(`${baseUrl}/subscriptions/${inputs.subscriptionId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listInventory': {
                const params = new URLSearchParams();
                if (inputs.locationIds) params.set('location_ids', inputs.locationIds);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/inventory/counts/batch-retrieve`, { method: 'POST', headers, body: JSON.stringify({ catalog_object_ids: inputs.catalogObjectIds, location_ids: inputs.locationIds }) });
                const data = await res.json();
                return { output: data };
            }
            case 'createCatalogItem': {
                const body = {
                    idempotency_key: inputs.idempotencyKey || crypto.randomUUID(),
                    object: {
                        type: 'ITEM',
                        id: inputs.id || '#item',
                        item_data: { name: inputs.name, description: inputs.description, variations: inputs.variations },
                    },
                };
                const res = await fetch(`${baseUrl}/catalog/object`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeSquareEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
