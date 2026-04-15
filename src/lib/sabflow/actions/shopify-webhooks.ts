'use server';

export async function executeShopifyWebhooksAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const { accessToken, shop } = inputs;
        const baseUrl = `https://${shop}.myshopify.com/admin/api/2024-01`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': accessToken,
        };

        switch (actionName) {
            case 'listWebhooks': {
                const res = await fetch(`${baseUrl}/webhooks.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/${inputs.webhookId}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createWebhook': {
                const body = { webhook: { topic: inputs.topic, address: inputs.address, format: inputs.format || 'json' } };
                const res = await fetch(`${baseUrl}/webhooks.json`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'updateWebhook': {
                const body = { webhook: { id: inputs.webhookId, address: inputs.address } };
                const res = await fetch(`${baseUrl}/webhooks/${inputs.webhookId}.json`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/${inputs.webhookId}.json`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listEvents': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/events.json?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getEvent': {
                const res = await fetch(`${baseUrl}/events/${inputs.eventId}.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listScriptTags': {
                const res = await fetch(`${baseUrl}/script_tags.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createScriptTag': {
                const body = { script_tag: { event: inputs.event || 'onload', src: inputs.src } };
                const res = await fetch(`${baseUrl}/script_tags.json`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'updateScriptTag': {
                const body = { script_tag: { id: inputs.scriptTagId, src: inputs.src } };
                const res = await fetch(`${baseUrl}/script_tags/${inputs.scriptTagId}.json`, { method: 'PUT', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteScriptTag': {
                const res = await fetch(`${baseUrl}/script_tags/${inputs.scriptTagId}.json`, { method: 'DELETE', headers });
                return { output: { success: res.ok, status: res.status } };
            }
            case 'listCarrierServices': {
                const res = await fetch(`${baseUrl}/carrier_services.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createCarrierService': {
                const body = { carrier_service: { name: inputs.name, callback_url: inputs.callbackUrl, service_discovery: inputs.serviceDiscovery !== false } };
                const res = await fetch(`${baseUrl}/carrier_services.json`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            case 'listFulfillmentServices': {
                const res = await fetch(`${baseUrl}/fulfillment_services.json`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createFulfillmentService': {
                const body = { fulfillment_service: { name: inputs.name, callback_url: inputs.callbackUrl, inventory_management: inputs.inventoryManagement !== false, tracking_support: inputs.trackingSupport !== false, requires_shipping_method: inputs.requiresShippingMethod !== false, format: 'json' } };
                const res = await fetch(`${baseUrl}/fulfillment_services.json`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeShopifyWebhooksAction error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
