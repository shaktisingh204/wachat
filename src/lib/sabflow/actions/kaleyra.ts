'use server';

export async function executeKaleyraAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.kaleyra.io/v1';
    const headers: Record<string, string> = {
        'api-key': inputs.apiKey || '',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ to: inputs.to, type: 'SMS', sender_id: inputs.senderId, body: inputs.body }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'sendBulkSMS': {
                const recipients = Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients];
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ to: recipients.join(','), type: 'SMS', sender_id: inputs.senderId, body: inputs.body }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'sendVoiceCall': {
                const res = await fetch(`${baseUrl}/voice/calls`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ to: inputs.to, from: inputs.from, tts_message: inputs.ttsMessage, tts_language: inputs.ttsLanguage || 'en-US' }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'sendFlash': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ to: inputs.to, type: 'Flash', sender_id: inputs.senderId, body: inputs.body }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getBalance': {
                const res = await fetch(`${baseUrl}/account/credits`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listSenderIDs': {
                const res = await fetch(`${baseUrl}/sender-ids`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getSenderID': {
                const res = await fetch(`${baseUrl}/sender-ids/${inputs.senderId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                const res = await fetch(`${baseUrl}/templates?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getTemplate': {
                const res = await fetch(`${baseUrl}/templates/${inputs.templateId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createTemplate': {
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name, body: inputs.body, type: inputs.type || 'SMS', sender_id: inputs.senderId }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listCampaigns': {
                const res = await fetch(`${baseUrl}/campaigns`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createCampaign': {
                const res = await fetch(`${baseUrl}/campaigns`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name, sender_id: inputs.senderId, template_id: inputs.templateId, scheduled_at: inputs.scheduledAt }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCampaignReport': {
                const res = await fetch(`${baseUrl}/campaigns/${inputs.campaignId}/report`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'sendWhatsApp': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ to: inputs.to, type: 'WhatsApp', sender_id: inputs.senderId, body: inputs.body, template_name: inputs.templateName }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getDeliveryReport': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}/report`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Kaleyra action error: ${err.message}`);
        return { error: err.message };
    }
}
