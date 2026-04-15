'use server';

export async function executeZenviaAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const BASE_URL = 'https://api.zenvia.com/v2';
        const apiToken = inputs.apiToken;

        const headers: Record<string, string> = {
            'X-API-Token': apiToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendSms': {
                const body: any = {
                    from: inputs.from,
                    to: inputs.to,
                    contents: [{ type: 'text', text: inputs.text }],
                };
                const res = await fetch(`${BASE_URL}/channels/sms/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendWhatsApp': {
                const body: any = {
                    from: inputs.from,
                    to: inputs.to,
                    contents: [{ type: inputs.contentType || 'text', text: inputs.text }],
                };
                const res = await fetch(`${BASE_URL}/channels/whatsapp/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendRcs': {
                const body: any = {
                    from: inputs.from,
                    to: inputs.to,
                    contents: [{ type: inputs.contentType || 'text', text: inputs.text }],
                };
                const res = await fetch(`${BASE_URL}/channels/rcs/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendEmail': {
                const body: any = {
                    from: inputs.from,
                    to: inputs.to,
                    contents: [{ type: inputs.contentType || 'text', text: inputs.text }],
                };
                const res = await fetch(`${BASE_URL}/channels/email/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getMessageStatus': {
                const channel = inputs.channel;
                const messageId = inputs.messageId;
                const res = await fetch(`${BASE_URL}/channels/${channel}/messages/${messageId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.channel) params.set('channel', inputs.channel);
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                if (inputs.pageSize) params.set('pageSize', inputs.pageSize);
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${BASE_URL}/messages?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'subscribeWebhook': {
                const body: any = {
                    eventType: inputs.eventType,
                    webhook: {
                        url: inputs.webhookUrl,
                        headers: inputs.webhookHeaders || {},
                    },
                    criteria: inputs.criteria || {},
                };
                const res = await fetch(`${BASE_URL}/subscriptions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listSubscriptions': {
                const res = await fetch(`${BASE_URL}/subscriptions`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'deleteSubscription': {
                const res = await fetch(`${BASE_URL}/subscriptions/${inputs.subscriptionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || `HTTP ${res.status}` };
                }
                return { output: { success: true, subscriptionId: inputs.subscriptionId } };
            }

            case 'getBalance': {
                const res = await fetch(`${BASE_URL}/balance`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getReport': {
                const params = new URLSearchParams();
                if (inputs.channel) params.set('channel', inputs.channel);
                if (inputs.startDate) params.set('startDate', inputs.startDate);
                if (inputs.endDate) params.set('endDate', inputs.endDate);
                if (inputs.direction) params.set('direction', inputs.direction);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE_URL}/reports/messages?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Zenvia action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger.log(`Zenvia action error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeZenviaAction' };
    }
}
