'use server';

export async function executeMessageMediaAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiKey, apiSecret } = inputs;
    const base64Auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const baseUrl = 'https://api.messagemedia.com/v1';
    const authHeader = `Basic ${base64Auth}`;

    try {
        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            destination_number: inputs.destinationNumber,
                            content: inputs.content,
                            source_number: inputs.sourceNumber || undefined,
                            format: inputs.format || 'SMS',
                            scheduled: inputs.scheduled || undefined,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendBulkMessages': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : JSON.parse(inputs.messages);
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getMessageStatus': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${baseUrl}/messages?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listReceivedMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                const res = await fetch(`${baseUrl}/replies?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'deleteReceivedMessages': {
                const ids = Array.isArray(inputs.messageIds) ? inputs.messageIds : JSON.parse(inputs.messageIds);
                const res = await fetch(`${baseUrl}/replies`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reply_ids: ids }),
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { error: data.message || JSON.stringify(data) };
            }

            case 'getDeliveryReports': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                const res = await fetch(`${baseUrl}/delivery_reports?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listReplies': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                const res = await fetch(`${baseUrl}/replies?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'deleteReplies': {
                const ids = Array.isArray(inputs.replyIds) ? inputs.replyIds : JSON.parse(inputs.replyIds);
                const res = await fetch(`${baseUrl}/replies`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ reply_ids: ids }),
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { error: data.message || JSON.stringify(data) };
            }

            case 'createWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: inputs.url,
                        method: inputs.method || 'POST',
                        encoding: inputs.encoding || 'JSON',
                        events: inputs.events || ['RECEIVED_SMS'],
                        template: inputs.template || undefined,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listWebhooks': {
                const res = await fetch(`${baseUrl}/webhooks/messages`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'deleteWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/messages/${inputs.webhookId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true, webhookId: inputs.webhookId } };
                const data = await res.json();
                return { error: data.message || JSON.stringify(data) };
            }

            case 'listMetadata': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}/metadata`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getBalance': {
                const res = await fetch(`${baseUrl}/accounts/self`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: { balance: data.balance, currency: data.currency } };
            }

            case 'listBlockedNumbers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                const res = await fetch(`${baseUrl}/numbers/blocked?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            default:
                return { error: `Unknown MessageMedia action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MessageMedia action error: ${err.message}`);
        return { error: err.message };
    }
}
