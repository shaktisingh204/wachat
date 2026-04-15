'use server';

async function getWalmartToken(clientId: string, clientSecret: string): Promise<string> {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://marketplace.walmartapis.com/v3/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'WM_QOS.CORRELATION_ID': `sabflow-${Date.now()}`,
            'WM_SVC.NAME': 'SabFlow',
        },
        body: 'grant_type=client_credentials',
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error_description || 'Failed to get Walmart token');
    return data.access_token;
}

export async function executeWalmartAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://marketplace.walmartapis.com/v3';

    try {
        const token = await getWalmartToken(inputs.clientId, inputs.clientSecret);
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `Bearer ${token}`,
            'WM_QOS.CORRELATION_ID': `sabflow-${Date.now()}`,
            'WM_SVC.NAME': 'SabFlow',
            'WM_SEC.ACCESS_TOKEN': token,
        };

        switch (actionName) {
            case 'listItems': {
                const params = new URLSearchParams();
                if (inputs.nextCursor) params.set('nextCursor', inputs.nextCursor);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.lifecycleStatus) params.set('lifecycleStatus', inputs.lifecycleStatus);
                if (inputs.publishedStatus) params.set('publishedStatus', inputs.publishedStatus);
                const res = await fetch(`${baseUrl}/items?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to list items' };
                return { output: data };
            }
            case 'getItem': {
                const res = await fetch(`${baseUrl}/items/${inputs.sku}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to get item' };
                return { output: data };
            }
            case 'createItem': {
                const body = inputs.itemData || {};
                const res = await fetch(`${baseUrl}/items`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to create item' };
                return { output: data };
            }
            case 'updateItem': {
                const body = inputs.itemData || {};
                const res = await fetch(`${baseUrl}/items`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to update item' };
                return { output: data };
            }
            case 'retireItem': {
                const res = await fetch(`${baseUrl}/items/${inputs.sku}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to retire item' };
                return { output: data };
            }
            case 'getInventory': {
                const params = new URLSearchParams();
                params.set('sku', inputs.sku);
                const res = await fetch(`${baseUrl}/inventory?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to get inventory' };
                return { output: data };
            }
            case 'updateInventory': {
                const body: Record<string, any> = {
                    sku: inputs.sku,
                    quantity: {
                        unit: inputs.unit || 'EACH',
                        amount: inputs.amount,
                    },
                };
                if (inputs.fulfillmentLagTime) body.fulfillmentLagTime = inputs.fulfillmentLagTime;
                const res = await fetch(`${baseUrl}/inventory?sku=${inputs.sku}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to update inventory' };
                return { output: data };
            }
            case 'listOrders': {
                const params = new URLSearchParams();
                if (inputs.createdStartDate) params.set('createdStartDate', inputs.createdStartDate);
                if (inputs.createdEndDate) params.set('createdEndDate', inputs.createdEndDate);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/orders?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to list orders' };
                return { output: data };
            }
            case 'getOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.purchaseOrderId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to get order' };
                return { output: data };
            }
            case 'acknowledgeOrder': {
                const res = await fetch(`${baseUrl}/orders/${inputs.purchaseOrderId}/acknowledge`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to acknowledge order' };
                return { output: data };
            }
            case 'cancelOrder': {
                const body: Record<string, any> = {
                    orderCancellation: {
                        requestedCancelLines: inputs.cancelLines || [],
                    },
                };
                const res = await fetch(`${baseUrl}/orders/${inputs.purchaseOrderId}/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to cancel order' };
                return { output: data };
            }
            case 'shipOrder': {
                const body: Record<string, any> = {
                    orderShipment: {
                        orderLines: inputs.orderLines || [],
                    },
                };
                const res = await fetch(`${baseUrl}/orders/${inputs.purchaseOrderId}/shipping`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to ship order' };
                return { output: data };
            }
            case 'refundOrder': {
                const body: Record<string, any> = {
                    orderRefund: {
                        purchaseOrderId: inputs.purchaseOrderId,
                        orderLines: inputs.orderLines || [],
                    },
                };
                const res = await fetch(`${baseUrl}/orders/${inputs.purchaseOrderId}/refund`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to refund order' };
                return { output: data };
            }
            case 'getReports': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.version) params.set('version', inputs.version);
                const res = await fetch(`${baseUrl}/report/reportRequests?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to get reports' };
                return { output: data };
            }
            case 'getItemPerformance': {
                const params = new URLSearchParams();
                if (inputs.sku) params.set('sku', inputs.sku);
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                const res = await fetch(`${baseUrl}/items/performance?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.description || 'Failed to get item performance' };
                return { output: data };
            }
            default:
                return { error: `Unknown Walmart action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Walmart action error: ${err.message}`);
        return { error: err.message || 'Walmart action failed' };
    }
}
