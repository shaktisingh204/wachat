'use server';

export async function executeGoogleMerchantAction(actionName: string, inputs: any, user: any, logger: any) {
    const { accessToken, merchantId } = inputs;
    const baseUrl = `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}`;

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listProducts': {
                const params = new URLSearchParams({ maxResults: inputs.maxResults || '50', pageToken: inputs.pageToken || '' });
                const res = await fetch(`${baseUrl}/products?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listProducts failed' };
                return { output: data };
            }

            case 'getProduct': {
                const res = await fetch(`${baseUrl}/products/${encodeURIComponent(inputs.productId)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getProduct failed' };
                return { output: data };
            }

            case 'insertProduct': {
                const res = await fetch(`${baseUrl}/products`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'insertProduct failed' };
                return { output: data };
            }

            case 'updateProduct': {
                const params = new URLSearchParams({ updateMask: inputs.updateMask || '' });
                const res = await fetch(`${baseUrl}/products/${encodeURIComponent(inputs.productId)}?${params}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateProduct failed' };
                return { output: data };
            }

            case 'deleteProduct': {
                const res = await fetch(`${baseUrl}/products/${encodeURIComponent(inputs.productId)}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.error?.message || 'deleteProduct failed' };
                }
                return { output: { success: true } };
            }

            case 'listOrders': {
                const params = new URLSearchParams({
                    maxResults: inputs.maxResults || '50',
                    pageToken: inputs.pageToken || '',
                    statuses: inputs.statuses || '',
                    acknowledged: inputs.acknowledged || '',
                });
                const res = await fetch(`${baseUrl}/orders?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listOrders failed' };
                return { output: data };
            }

            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getOrder failed' };
                return { output: data };
            }

            case 'acknowledgeOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}/acknowledge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ operationId: inputs.operationId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'acknowledgeOrder failed' };
                return { output: data };
            }

            case 'cancelOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        operationId: inputs.operationId,
                        reason: inputs.reason,
                        reasonText: inputs.reasonText || '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'cancelOrder failed' };
                return { output: data };
            }

            case 'createShipment': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}/shipLineItems`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'createShipment failed' };
                return { output: data };
            }

            case 'updateShipment': {
                const res = await fetch(`${baseUrl}/orders/${inputs.orderId}/updateShipment`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.body || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'updateShipment failed' };
                return { output: data };
            }

            case 'listShippingSettings': {
                const params = new URLSearchParams({ maxResults: inputs.maxResults || '50', pageToken: inputs.pageToken || '' });
                const res = await fetch(`${baseUrl}/shippingsettings?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listShippingSettings failed' };
                return { output: data };
            }

            case 'getShippingSettings': {
                const targetMerchantId = inputs.targetMerchantId || merchantId;
                const res = await fetch(`${baseUrl}/shippingsettings/${targetMerchantId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getShippingSettings failed' };
                return { output: data };
            }

            case 'listAccounts': {
                const params = new URLSearchParams({ maxResults: inputs.maxResults || '50', pageToken: inputs.pageToken || '' });
                const res = await fetch(`https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/accounts?${params}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'listAccounts failed' };
                return { output: data };
            }

            case 'getAccount': {
                const targetAccountId = inputs.accountId || merchantId;
                const res = await fetch(`https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/accounts/${targetAccountId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.error?.message || 'getAccount failed' };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`google-merchant error: ${err.message}`);
        return { error: err.message || 'Unexpected error in google-merchant action' };
    }
}
