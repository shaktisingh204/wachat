'use server';

const TRACK_BASE = 'https://track.customer.io/api/v1';
const APP_BASE = 'https://api.customer.io/v1';

export async function executeCustomerioEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const trackAuth = Buffer.from(`${inputs.siteId}:${inputs.apiKey}`).toString('base64');
    const trackHeaders: Record<string, string> = {
        'Authorization': `Basic ${trackAuth}`,
        'Content-Type': 'application/json',
    };
    const appHeaders: Record<string, string> = {
        'Authorization': `Bearer ${inputs.appApiKey || inputs.apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'identifyCustomer': {
                const res = await fetch(`${TRACK_BASE}/customers/${encodeURIComponent(inputs.customerId)}`, {
                    method: 'PUT',
                    headers: trackHeaders,
                    body: JSON.stringify(inputs.attributes || {}),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.meta?.error || 'identifyCustomer failed' };
                }
                return { output: { success: true, customerId: inputs.customerId } };
            }
            case 'trackEvent': {
                const res = await fetch(`${TRACK_BASE}/customers/${encodeURIComponent(inputs.customerId)}/events`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify({ name: inputs.eventName, data: inputs.data || {} }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.meta?.error || 'trackEvent failed' };
                }
                return { output: { success: true } };
            }
            case 'deleteCustomer': {
                const res = await fetch(`${TRACK_BASE}/customers/${encodeURIComponent(inputs.customerId)}`, {
                    method: 'DELETE',
                    headers: trackHeaders,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.meta?.error || 'deleteCustomer failed' };
                }
                return { output: { success: true } };
            }
            case 'addToSegment': {
                const res = await fetch(`${TRACK_BASE}/segments/${inputs.segmentId}/add_customers`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify({ ids: inputs.customerIds }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.meta?.error || 'addToSegment failed' };
                }
                return { output: { success: true } };
            }
            case 'removeFromSegment': {
                const res = await fetch(`${TRACK_BASE}/segments/${inputs.segmentId}/remove_customers`, {
                    method: 'POST',
                    headers: trackHeaders,
                    body: JSON.stringify({ ids: inputs.customerIds }),
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.meta?.error || 'removeFromSegment failed' };
                }
                return { output: { success: true } };
            }
            case 'listSegments': {
                const res = await fetch(`${APP_BASE}/segments`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'listSegments failed' };
                return { output: data };
            }
            case 'getSegment': {
                const res = await fetch(`${APP_BASE}/segments/${inputs.segmentId}`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'getSegment failed' };
                return { output: data };
            }
            case 'listCampaigns': {
                const res = await fetch(`${APP_BASE}/campaigns`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'listCampaigns failed' };
                return { output: data };
            }
            case 'getCampaign': {
                const res = await fetch(`${APP_BASE}/campaigns/${inputs.campaignId}`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'getCampaign failed' };
                return { output: data };
            }
            case 'listNewsletters': {
                const res = await fetch(`${APP_BASE}/newsletters`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'listNewsletters failed' };
                return { output: data };
            }
            case 'sendTransactional': {
                const res = await fetch(`${APP_BASE}/send/email`, {
                    method: 'POST',
                    headers: appHeaders,
                    body: JSON.stringify({
                        transactional_message_id: inputs.transactionalMessageId,
                        to: inputs.to,
                        identifiers: inputs.identifiers || { email: inputs.to },
                        message_data: inputs.messageData || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'sendTransactional failed' };
                return { output: data };
            }
            case 'sendBroadcast': {
                const res = await fetch(`${APP_BASE}/campaigns/${inputs.campaignId}/triggers`, {
                    method: 'POST',
                    headers: appHeaders,
                    body: JSON.stringify({ data: inputs.data || {}, recipients: inputs.recipients || {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'sendBroadcast failed' };
                return { output: data };
            }
            case 'exportCustomers': {
                const res = await fetch(`${APP_BASE}/exports/customers`, {
                    method: 'POST',
                    headers: appHeaders,
                    body: JSON.stringify({ segment: inputs.segment, filter: inputs.filter }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'exportCustomers failed' };
                return { output: data };
            }
            case 'createSegment': {
                const res = await fetch(`${APP_BASE}/segments`, {
                    method: 'POST',
                    headers: appHeaders,
                    body: JSON.stringify({ name: inputs.name, description: inputs.description, type: inputs.type || 'manual' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'createSegment failed' };
                return { output: data };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.start) params.set('start', String(inputs.start));
                const res = await fetch(`${APP_BASE}/messages?${params}`, { headers: appHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.meta?.error || 'listMessages failed' };
                return { output: data };
            }
            default:
                return { error: `Unknown Customer.io Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Customer.io Enhanced action error: ${err.message}`);
        return { error: err.message || 'Customer.io Enhanced action failed' };
    }
}
