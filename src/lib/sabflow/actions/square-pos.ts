'use server';

export async function executeSquarePosAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = 'https://connect.squareup.com/v2';
    const token = inputs.accessToken;

    if (!token) return { error: 'Missing inputs.accessToken' };

    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
    };

    try {
        switch (actionName) {
            case 'listLocations': {
                const res = await fetch(`${BASE_URL}/locations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'getLocation': {
                const locationId = inputs.locationId;
                if (!locationId) return { error: 'Missing inputs.locationId' };
                const res = await fetch(`${BASE_URL}/locations/${locationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'listCatalog': {
                const params = new URLSearchParams();
                if (inputs.types) params.set('types', inputs.types);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${BASE_URL}/catalog/list?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'getCatalogObject': {
                const objectId = inputs.objectId;
                if (!objectId) return { error: 'Missing inputs.objectId' };
                const res = await fetch(`${BASE_URL}/catalog/object/${objectId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'searchCatalog': {
                const body = inputs.searchBody ?? {};
                const res = await fetch(`${BASE_URL}/catalog/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'createCatalogObject': {
                const body = {
                    idempotency_key: inputs.idempotencyKey ?? `${Date.now()}`,
                    object: inputs.object,
                };
                if (!body.object) return { error: 'Missing inputs.object' };
                const res = await fetch(`${BASE_URL}/catalog/object`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'upsertCatalogObject': {
                const body = {
                    idempotency_key: inputs.idempotencyKey ?? `${Date.now()}`,
                    object: inputs.object,
                };
                if (!body.object) return { error: 'Missing inputs.object' };
                const res = await fetch(`${BASE_URL}/catalog/object`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'deleteCatalogObject': {
                const objectId = inputs.objectId;
                if (!objectId) return { error: 'Missing inputs.objectId' };
                const res = await fetch(`${BASE_URL}/catalog/object/${objectId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'listOrders': {
                const locationId = inputs.locationId;
                if (!locationId) return { error: 'Missing inputs.locationId' };
                const body: any = { location_ids: [locationId] };
                if (inputs.cursor) body.cursor = inputs.cursor;
                if (inputs.limit) body.limit = inputs.limit;
                const res = await fetch(`${BASE_URL}/orders/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'getOrder': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const res = await fetch(`${BASE_URL}/orders/${orderId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'createOrder': {
                const body = {
                    idempotency_key: inputs.idempotencyKey ?? `${Date.now()}`,
                    order: inputs.order,
                };
                if (!body.order) return { error: 'Missing inputs.order' };
                const res = await fetch(`${BASE_URL}/orders`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'updateOrder': {
                const orderId = inputs.orderId;
                if (!orderId) return { error: 'Missing inputs.orderId' };
                const body = {
                    idempotency_key: inputs.idempotencyKey ?? `${Date.now()}`,
                    order: inputs.order,
                    fields_to_clear: inputs.fieldsToClear,
                };
                const res = await fetch(`${BASE_URL}/orders/${orderId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'listPayments': {
                const params = new URLSearchParams();
                if (inputs.locationId) params.set('location_id', inputs.locationId);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.beginTime) params.set('begin_time', inputs.beginTime);
                if (inputs.endTime) params.set('end_time', inputs.endTime);
                const res = await fetch(`${BASE_URL}/payments?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'getPayment': {
                const paymentId = inputs.paymentId;
                if (!paymentId) return { error: 'Missing inputs.paymentId' };
                const res = await fetch(`${BASE_URL}/payments/${paymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            case 'createPayment': {
                const body = {
                    idempotency_key: inputs.idempotencyKey ?? `${Date.now()}`,
                    source_id: inputs.sourceId,
                    amount_money: inputs.amountMoney,
                    location_id: inputs.locationId,
                    note: inputs.note,
                    reference_id: inputs.referenceId,
                    buyer_email_address: inputs.buyerEmailAddress,
                };
                if (!body.source_id) return { error: 'Missing inputs.sourceId' };
                if (!body.amount_money) return { error: 'Missing inputs.amountMoney' };
                const res = await fetch(`${BASE_URL}/payments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.errors?.[0]?.detail ?? `Square error: ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown Square POS action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Square POS action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in executeSquarePosAction' };
    }
}
