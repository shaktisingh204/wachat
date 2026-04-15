'use server';

export async function executeMoEngageAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiHost = inputs.apiHost || 'api-01.moengage.com';
        const baseUrl = `https://${apiHost}/v1`;
        const credentials = Buffer.from(`${inputs.appId}:${inputs.apiKey}`).toString('base64');
        const headers: Record<string, string> = {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json',
            'MOE-APPKEY': inputs.appId,
        };

        switch (actionName) {
            case 'trackUser':
            case 'identify': {
                const res = await fetch(`${baseUrl}/customer`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'customer',
                        customer_id: inputs.customerId,
                        attributes: inputs.attributes || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to track user' };
                return { output: data };
            }

            case 'trackEvent': {
                const res = await fetch(`${baseUrl}/event`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'event',
                        customer_id: inputs.customerId,
                        actions: [{
                            action: inputs.action,
                            attributes: inputs.attributes || {},
                            platform: inputs.platform || 'general',
                            app_version: inputs.appVersion || '',
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to track event' };
                return { output: data };
            }

            case 'trackPurchase': {
                const res = await fetch(`${baseUrl}/event`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        type: 'event',
                        customer_id: inputs.customerId,
                        actions: [{
                            action: 'transaction',
                            attributes: inputs.attributes || {},
                            platform: inputs.platform || 'general',
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to track purchase' };
                return { output: data };
            }

            case 'sendPush': {
                const res = await fetch(`${baseUrl}/message/push`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target_users: inputs.targetUsers || [],
                        message: inputs.message || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send push' };
                return { output: data };
            }

            case 'sendEmail': {
                const res = await fetch(`${baseUrl}/message/email`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send email' };
                return { output: data };
            }

            case 'sendSms': {
                const res = await fetch(`${baseUrl}/message/sms`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send SMS' };
                return { output: data };
            }

            case 'sendInApp': {
                const res = await fetch(`${baseUrl}/message/inapp`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send in-app message' };
                return { output: data };
            }

            case 'createSegment': {
                const res = await fetch(`${baseUrl}/segment`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filter: inputs.filter || {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create segment' };
                return { output: data };
            }

            case 'getSegmentUsers': {
                const res = await fetch(`${baseUrl}/segment/${inputs.segmentId}/users`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get segment users' };
                return { output: data };
            }

            case 'listCampaigns': {
                const res = await fetch(`${baseUrl}/campaigns`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list campaigns' };
                return { output: data };
            }

            case 'getCampaign': {
                const res = await fetch(`${baseUrl}/campaigns/${inputs.campaignId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get campaign' };
                return { output: data };
            }

            case 'createCampaign': {
                const res = await fetch(`${baseUrl}/campaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create campaign' };
                return { output: data };
            }

            case 'deleteUser': {
                const res = await fetch(`${baseUrl}/customer/${encodeURIComponent(inputs.customerId)}`, { method: 'DELETE', headers });
                if (res.status === 200 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { error: data.message || 'Failed to delete user' };
            }

            default:
                return { error: `Unknown MoEngage action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MoEngage action error: ${err.message}`);
        return { error: err.message || 'MoEngage action failed' };
    }
}
