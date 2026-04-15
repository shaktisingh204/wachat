
'use server';

export async function executeSquareAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const base = 'https://connect.squareup.com/v2';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Square-Version': '2024-01-17',
            'Content-Type': 'application/json',
        };

        async function req(method: string, path: string, body?: any): Promise<any> {
            const res = await fetch(`${base}${path}`, {
                method,
                headers,
                ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
            });
            const data = await res.json();
            if (!res.ok) {
                const errMsg = data?.errors?.[0]?.detail ?? data?.errors?.[0]?.code ?? JSON.stringify(data);
                throw new Error(errMsg);
            }
            return data;
        }

        switch (actionName) {
            case 'listLocations': {
                const data = await req('GET', '/locations');
                const locations = data.locations ?? [];
                logger.log(`[Square] Listed ${locations.length} locations`);
                return { output: { locations, count: String(locations.length) } };
            }

            case 'getLocation': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/locations/${id}`);
                return { output: data.location ?? data };
            }

            case 'createPayment': {
                if (!inputs.source_id) throw new Error('source_id is required.');
                if (!inputs.amount_money) throw new Error('amount_money is required.');
                const idempotencyKey = String(inputs.idempotency_key ?? inputs.idempotencyKey ?? crypto.randomUUID()).trim();
                const body: any = {
                    source_id: inputs.source_id,
                    amount_money: inputs.amount_money,
                    idempotency_key: idempotencyKey,
                };
                if (inputs.location_id !== undefined) body.location_id = inputs.location_id;
                if (inputs.customer_id !== undefined) body.customer_id = inputs.customer_id;
                if (inputs.note !== undefined) body.note = inputs.note;
                const data = await req('POST', '/payments', body);
                logger.log(`[Square] Created payment: ${data.payment?.id}`);
                return { output: data.payment ?? data };
            }

            case 'getPayment': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/payments/${id}`);
                return { output: data.payment ?? data };
            }

            case 'cancelPayment': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('POST', `/payments/${id}/cancel`);
                logger.log(`[Square] Cancelled payment: ${id}`);
                return { output: data.payment ?? data };
            }

            case 'refundPayment': {
                const idempotencyKey = String(inputs.idempotency_key ?? inputs.idempotencyKey ?? crypto.randomUUID()).trim();
                const body: any = {
                    idempotency_key: idempotencyKey,
                };
                if (inputs.payment_id !== undefined) body.payment_id = inputs.payment_id;
                if (inputs.amount_money !== undefined) body.amount_money = inputs.amount_money;
                if (inputs.reason !== undefined) body.reason = inputs.reason;
                const data = await req('POST', '/refunds', body);
                logger.log(`[Square] Refunded payment`);
                return { output: data.refund ?? data };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.begin_time) params.set('begin_time', inputs.begin_time);
                if (inputs.end_time) params.set('end_time', inputs.end_time);
                if (inputs.location_id) params.set('location_id', inputs.location_id);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/payments${query}`);
                const payments = data.payments ?? [];
                return { output: { payments, count: String(payments.length) } };
            }

            case 'createCustomer': {
                const body: any = {};
                if (inputs.given_name !== undefined) body.given_name = inputs.given_name;
                if (inputs.family_name !== undefined) body.family_name = inputs.family_name;
                if (inputs.email_address !== undefined) body.email_address = inputs.email_address;
                if (inputs.phone_number !== undefined) body.phone_number = inputs.phone_number;
                if (inputs.reference_id !== undefined) body.reference_id = inputs.reference_id;
                if (inputs.note !== undefined) body.note = inputs.note;
                const idempotencyKey = inputs.idempotency_key ?? inputs.idempotencyKey;
                if (idempotencyKey) body.idempotency_key = idempotencyKey;
                const data = await req('POST', '/customers', body);
                logger.log(`[Square] Created customer: ${data.customer?.id}`);
                return { output: data.customer ?? data };
            }

            case 'getCustomer': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await req('GET', `/customers/${id}`);
                return { output: data.customer ?? data };
            }

            case 'searchCustomers': {
                const body: any = {};
                if (inputs.query !== undefined) body.query = inputs.query;
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                if (inputs.cursor !== undefined) body.cursor = inputs.cursor;
                const data = await req('POST', '/customers/search', body);
                const customers = data.customers ?? [];
                return { output: { customers, count: String(customers.length) } };
            }

            case 'listCatalog': {
                const params = new URLSearchParams();
                if (inputs.types) params.set('types', inputs.types);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await req('GET', `/catalog/list${query}`);
                const objects = data.objects ?? [];
                return { output: { objects, count: String(objects.length) } };
            }

            case 'retrieveCatalog': {
                const objectId = String(inputs.objectId ?? inputs.object_id ?? '').trim();
                if (!objectId) throw new Error('objectId is required.');
                const data = await req('GET', `/catalog/object/${objectId}`);
                return { output: data.object ?? data };
            }

            case 'createCatalogObject': {
                const idempotencyKey = String(inputs.idempotency_key ?? inputs.idempotencyKey ?? crypto.randomUUID()).trim();
                const body: any = {
                    idempotency_key: idempotencyKey,
                    object: inputs.object,
                };
                const data = await req('POST', '/catalog/object', body);
                logger.log(`[Square] Created catalog object: ${data.catalog_object?.id}`);
                return { output: data.catalog_object ?? data };
            }

            case 'listOrders': {
                const body: any = {};
                if (inputs.location_ids !== undefined) body.location_ids = inputs.location_ids;
                else if (inputs.location_id !== undefined) body.location_ids = [inputs.location_id];
                if (inputs.query !== undefined) body.query = inputs.query;
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                if (inputs.cursor !== undefined) body.cursor = inputs.cursor;
                const data = await req('POST', '/orders/search', body);
                const orders = data.orders ?? [];
                return { output: { orders, count: String(orders.length) } };
            }

            case 'createOrder': {
                const idempotencyKey = String(inputs.idempotency_key ?? inputs.idempotencyKey ?? crypto.randomUUID()).trim();
                const body: any = {
                    idempotency_key: idempotencyKey,
                    order: inputs.order,
                };
                const data = await req('POST', '/orders', body);
                logger.log(`[Square] Created order: ${data.order?.id}`);
                return { output: data.order ?? data };
            }

            case 'updateOrder': {
                const orderId = String(inputs.orderId ?? inputs.order_id ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const body: any = {
                    order: inputs.order,
                };
                if (inputs.idempotency_key ?? inputs.idempotencyKey) {
                    body.idempotency_key = inputs.idempotency_key ?? inputs.idempotencyKey;
                }
                if (inputs.fields_to_clear !== undefined) body.fields_to_clear = inputs.fields_to_clear;
                const data = await req('PUT', `/orders/${orderId}`, body);
                return { output: data.order ?? data };
            }

            case 'listSubscriptions': {
                const body: any = {};
                if (inputs.query !== undefined) body.query = inputs.query;
                if (inputs.cursor !== undefined) body.cursor = inputs.cursor;
                if (inputs.limit !== undefined) body.limit = inputs.limit;
                const data = await req('POST', '/subscriptions/search', body);
                const subscriptions = data.subscriptions ?? [];
                return { output: { subscriptions, count: String(subscriptions.length) } };
            }

            case 'createSubscription': {
                const idempotencyKey = String(inputs.idempotency_key ?? inputs.idempotencyKey ?? crypto.randomUUID()).trim();
                const body: any = {
                    idempotency_key: idempotencyKey,
                };
                if (inputs.location_id !== undefined) body.location_id = inputs.location_id;
                if (inputs.plan_id !== undefined) body.plan_id = inputs.plan_id;
                if (inputs.plan_variation_id !== undefined) body.plan_variation_id = inputs.plan_variation_id;
                if (inputs.customer_id !== undefined) body.customer_id = inputs.customer_id;
                if (inputs.start_date !== undefined) body.start_date = inputs.start_date;
                if (inputs.card_id !== undefined) body.card_id = inputs.card_id;
                const data = await req('POST', '/subscriptions', body);
                logger.log(`[Square] Created subscription: ${data.subscription?.id}`);
                return { output: data.subscription ?? data };
            }

            default:
                throw new Error(`Unknown Square action: ${actionName}`);
        }
    } catch (err: any) {
        return { error: err.message ?? String(err) };
    }
}
