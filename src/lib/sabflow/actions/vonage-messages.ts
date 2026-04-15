'use server';

export async function executeVonageMessagesAction(actionName: string, inputs: any, user: any, logger: any) {
    const { apiKey, apiSecret } = inputs;
    const base64Auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const baseUrl = 'https://api.nexmo.com/v1';
    // Use JWT if provided, otherwise fall back to Basic auth
    const authHeader = inputs.jwtToken
        ? `Bearer ${inputs.jwtToken}`
        : `Basic ${base64Auth}`;

    const sendMessage = async (body: object) => {
        const res = await fetch(`${baseUrl}/messages`, {
            method: 'POST',
            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) return { error: data.title || data.detail || JSON.stringify(data) };
        return { output: data };
    };

    try {
        switch (actionName) {
            case 'sendSMS': {
                return await sendMessage({
                    message_type: 'text',
                    channel: 'sms',
                    to: inputs.to,
                    from: inputs.from,
                    text: inputs.text,
                });
            }

            case 'sendMMS': {
                return await sendMessage({
                    message_type: inputs.messageType || 'image',
                    channel: 'mms',
                    to: inputs.to,
                    from: inputs.from,
                    [inputs.messageType || 'image']: { url: inputs.mediaUrl, caption: inputs.caption || undefined },
                });
            }

            case 'sendWhatsAppText': {
                return await sendMessage({
                    message_type: 'text',
                    channel: 'whatsapp',
                    to: inputs.to,
                    from: inputs.from,
                    text: inputs.text,
                });
            }

            case 'sendWhatsAppTemplate': {
                return await sendMessage({
                    message_type: 'custom',
                    channel: 'whatsapp',
                    to: inputs.to,
                    from: inputs.from,
                    custom: {
                        type: 'template',
                        template: {
                            name: inputs.templateName,
                            language: { code: inputs.languageCode || 'en_US' },
                            components: inputs.components || [],
                        },
                    },
                });
            }

            case 'sendWhatsAppMedia': {
                const mediaType = inputs.mediaType || 'image';
                return await sendMessage({
                    message_type: mediaType,
                    channel: 'whatsapp',
                    to: inputs.to,
                    from: inputs.from,
                    [mediaType]: { url: inputs.mediaUrl, caption: inputs.caption || undefined },
                });
            }

            case 'sendViberText': {
                return await sendMessage({
                    message_type: 'text',
                    channel: 'viber_service',
                    to: inputs.to,
                    from: inputs.from,
                    text: inputs.text,
                    viber_service: {
                        category: inputs.category || 'transaction',
                        ttl: inputs.ttl || 600,
                    },
                });
            }

            case 'sendViberImage': {
                return await sendMessage({
                    message_type: 'image',
                    channel: 'viber_service',
                    to: inputs.to,
                    from: inputs.from,
                    image: { url: inputs.imageUrl },
                    viber_service: {
                        category: inputs.category || 'transaction',
                        ttl: inputs.ttl || 600,
                    },
                });
            }

            case 'sendFacebookMessage': {
                return await sendMessage({
                    message_type: inputs.messageType || 'text',
                    channel: 'messenger',
                    to: inputs.to,
                    from: inputs.from,
                    text: inputs.text,
                });
            }

            case 'sendRCSText': {
                return await sendMessage({
                    message_type: 'text',
                    channel: 'rcs',
                    to: inputs.to,
                    from: inputs.from,
                    text: inputs.text,
                });
            }

            case 'getMessageStatus': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageUuid}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.title || data.detail || JSON.stringify(data) };
                return { output: data };
            }

            case 'listInboundMessages': {
                const params = new URLSearchParams();
                if (inputs.page_size) params.set('page_size', inputs.page_size);
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${baseUrl}/messages?${params}`, {
                    headers: { 'Authorization': authHeader },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.title || data.detail || JSON.stringify(data) };
                return { output: data };
            }

            case 'sendOTP': {
                const res = await fetch(`https://api.nexmo.com/v2/verify`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        brand: inputs.brand,
                        workflow: [{ channel: inputs.channel || 'sms', to: inputs.to }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.title || data.detail || JSON.stringify(data) };
                return { output: data };
            }

            case 'verifyOTP': {
                const res = await fetch(`https://api.nexmo.com/v2/verify/${inputs.requestId}`, {
                    method: 'POST',
                    headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ code: inputs.code }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.title || data.detail || JSON.stringify(data) };
                return { output: data };
            }

            case 'cancelOTP': {
                const res = await fetch(`https://api.nexmo.com/v2/verify/${inputs.requestId}/cancel`, {
                    method: 'DELETE',
                    headers: { 'Authorization': authHeader },
                });
                if (res.status === 200 || res.status === 204) return { output: { cancelled: true, requestId: inputs.requestId } };
                const data = await res.json();
                return { error: data.title || data.detail || JSON.stringify(data) };
            }

            case 'getBalance': {
                const balanceAuth = `Basic ${base64Auth}`;
                const res = await fetch(`https://rest.nexmo.com/account/get-balance?api_key=${apiKey}&api_secret=${apiSecret}`, {
                    headers: { 'Authorization': balanceAuth },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.error_text || JSON.stringify(data) };
                return { output: { balance: data.value, autoReload: data.autoReload } };
            }

            default:
                return { error: `Unknown Vonage Messages action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Vonage Messages action error: ${err.message}`);
        return { error: err.message };
    }
}
