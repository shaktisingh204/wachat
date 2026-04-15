
'use server';

const DHL_BASE = 'https://api-eu.dhl.com';

async function dhlFetch(apiKey: string, method: string, path: string, body?: any, logger?: any) {
    const url = `${DHL_BASE}${path}`;
    logger?.log(`[DHL] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            'DHL-API-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.detail || data?.message || data?.title || text || `DHL API error ${res.status}`);
    return data;
}

export async function executeDhlAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const get = (path: string) => dhlFetch(apiKey, 'GET', path, undefined, logger);
        const post = (path: string, body: any) => dhlFetch(apiKey, 'POST', path, body, logger);
        const del = (path: string) => dhlFetch(apiKey, 'DELETE', path, undefined, logger);

        switch (actionName) {
            case 'trackShipment': {
                const trackingNumber = String(inputs.trackingNumber ?? inputs.id ?? '').trim();
                if (!trackingNumber) throw new Error('trackingNumber is required.');
                const data = await get(`/track/shipments?trackingNumber=${encodeURIComponent(trackingNumber)}`);
                return { output: data };
            }

            case 'getShipmentDetails': {
                const id = String(inputs.id ?? inputs.trackingNumber ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/track/shipments/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'createShipment': {
                if (!inputs.shipmentDetails) throw new Error('shipmentDetails object is required.');
                const data = await post('/ship/v1/shipments', inputs.shipmentDetails);
                return { output: data };
            }

            case 'getShipmentLabel': {
                const id = String(inputs.id ?? inputs.shipmentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/ship/v1/shipments/${encodeURIComponent(id)}/documents`);
                return { output: data };
            }

            case 'cancelShipment': {
                const id = String(inputs.id ?? inputs.shipmentId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await del(`/ship/v1/shipments/${encodeURIComponent(id)}`);
                return { output: { success: true, ...data } };
            }

            case 'getRates': {
                if (!inputs.rateRequest) throw new Error('rateRequest object is required.');
                const data = await post('/ship/v1/rates', inputs.rateRequest);
                return { output: data };
            }

            case 'getPickupLocations': {
                const params = new URLSearchParams();
                if (inputs.countryCode) params.set('countryCode', String(inputs.countryCode));
                if (inputs.addressLocality) params.set('addressLocality', String(inputs.addressLocality));
                if (inputs.postalCode) params.set('postalCode', String(inputs.postalCode));
                if (inputs.streetAddress) params.set('streetAddress', String(inputs.streetAddress));
                if (inputs.radius) params.set('radius', String(inputs.radius));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const qs = params.toString();
                const data = await get(`/location-finder/v1/find-by-address${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'schedulePickup': {
                if (!inputs.pickupDetails) throw new Error('pickupDetails object is required.');
                const data = await post('/ship/v1/pickups', inputs.pickupDetails);
                return { output: data };
            }

            case 'getPickup': {
                const id = String(inputs.id ?? inputs.pickupId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/ship/v1/pickups/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'cancelPickup': {
                const id = String(inputs.id ?? inputs.pickupId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await del(`/ship/v1/pickups/${encodeURIComponent(id)}`);
                return { output: { success: true, ...data } };
            }

            default:
                return { error: `DHL action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'DHL action failed.' };
    }
}
