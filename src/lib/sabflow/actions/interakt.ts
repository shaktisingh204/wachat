'use server';

export async function executeInteraktAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const BASE_URL = 'https://api.interakt.ai/v1';
        const apiKey = inputs.apiKey;

        const headers: Record<string, string> = {
            Authorization: `Basic ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'sendTextMessage': {
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                    callbackData: inputs.callbackData || '',
                    type: 'Text',
                    data: {
                        message: inputs.message,
                    },
                };
                const res = await fetch(`${BASE_URL}/public/message/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendTemplateMessage': {
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                    callbackData: inputs.callbackData || '',
                    type: 'Template',
                    template: {
                        name: inputs.templateName,
                        languageCode: inputs.languageCode || 'en',
                        headerValues: inputs.headerValues || [],
                        bodyValues: inputs.bodyValues || [],
                        buttonValues: inputs.buttonValues || {},
                    },
                };
                const res = await fetch(`${BASE_URL}/public/message/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendMediaMessage': {
                const mediaType = inputs.mediaType || 'Image';
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                    callbackData: inputs.callbackData || '',
                    type: mediaType,
                    data: {
                        mediaUrl: inputs.mediaUrl,
                        caption: inputs.caption || '',
                        filename: inputs.filename || '',
                    },
                };
                const res = await fetch(`${BASE_URL}/public/message/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'checkUserExists': {
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                };
                const res = await fetch(`${BASE_URL}/public/track/users/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createUser': {
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                    traits: inputs.traits || {},
                };
                const res = await fetch(`${BASE_URL}/public/track/users/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'updateUser': {
                const body: any = {
                    countryCode: inputs.countryCode,
                    phoneNumber: inputs.phoneNumber,
                    traits: inputs.traits || {},
                };
                const res = await fetch(`${BASE_URL}/public/track/users/`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'sendBulkMessages': {
                const body: any = {
                    messages: inputs.messages,
                };
                const res = await fetch(`${BASE_URL}/public/message/bulk/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listTemplates': {
                const res = await fetch(`${BASE_URL}/public/templates/`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getMessageStatus': {
                const res = await fetch(`${BASE_URL}/public/message/?messageId=${inputs.messageId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || data.error || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Interakt action "${actionName}" is not supported.` };
        }
    } catch (err: any) {
        logger.log(`Interakt action error: ${err.message}`);
        return { error: err.message || 'Unknown error in executeInteraktAction' };
    }
}
