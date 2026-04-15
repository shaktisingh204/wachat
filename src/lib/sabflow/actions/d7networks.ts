'use server';

export async function executeD7NetworksAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiToken } = inputs;
    const baseUrl = 'https://api.d7networks.com';
    const authHeader = `Bearer ${apiToken}`;

    try {
        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/messages/v1/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            channel: inputs.channel || 'sms',
                            recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients],
                            content: inputs.content,
                            msg_type: inputs.msgType || 'text',
                            data_coding: inputs.dataCoding || 'text',
                            originator: inputs.originator || undefined,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendBulkMessage': {
                const messages = Array.isArray(inputs.messages) ? inputs.messages : JSON.parse(inputs.messages);
                const res = await fetch(`${baseUrl}/messages/v1/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getMessageStatus': {
                const res = await fetch(`${baseUrl}/messages/v1/message-logs/${inputs.messageId}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                const res = await fetch(`${baseUrl}/messages/v1/message-logs?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendWhatsAppMessage': {
                const res = await fetch(`${baseUrl}/whatsapp/v2/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            originator: inputs.originator,
                            recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients],
                            content: {
                                message_type: 'TEXT',
                                text: { body: inputs.body },
                            },
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendWhatsAppTemplate': {
                const res = await fetch(`${baseUrl}/whatsapp/v2/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            originator: inputs.originator,
                            recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients],
                            content: {
                                message_type: 'TEMPLATE',
                                template: {
                                    template_id: inputs.templateId,
                                    language: inputs.language || 'en',
                                    components: inputs.components || [],
                                },
                            },
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendViberMessage': {
                const res = await fetch(`${baseUrl}/viber/v1/send`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        messages: [{
                            originator: inputs.originator,
                            recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients],
                            content: inputs.content,
                            msg_type: inputs.msgType || 'text',
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getBalance': {
                const res = await fetch(`${baseUrl}/accounts/v1/balance`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listWebhooks': {
                const res = await fetch(`${baseUrl}/webhooks/v1`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'createWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/v1`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: inputs.url,
                        channel: inputs.channel || 'sms',
                        events: inputs.events || ['DELIVERED'],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'deleteWebhook': {
                const res = await fetch(`${baseUrl}/webhooks/v1/${inputs.webhookId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 200 || res.status === 204) return { output: { deleted: true, webhookId: inputs.webhookId } };
                const data = await res.json();
                return { error: data.message || JSON.stringify(data) };
            }

            case 'verifyNumber': {
                const res = await fetch(`${baseUrl}/hlr/v1/lookup`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ msisdn: inputs.phoneNumber }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getNumberInfo': {
                const res = await fetch(`${baseUrl}/hlr/v1/lookup/${inputs.phoneNumber}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'listSenderIDs': {
                const res = await fetch(`${baseUrl}/senderid/v1`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            case 'getSenderID': {
                const res = await fetch(`${baseUrl}/senderid/v1/${inputs.senderId}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || JSON.stringify(data) };
                return { output: data };
            }

            default:
                return { error: `Unknown D7 Networks action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`D7 Networks action error: ${err.message}`);
        return { error: err.message };
    }
}
