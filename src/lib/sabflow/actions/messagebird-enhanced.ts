'use server';

export async function executeMessageBirdEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://rest.messagebird.com';
    const headers: Record<string, string> = {
        'Authorization': `AccessKey ${inputs.apiKey || ''}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ originator: inputs.originator, recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients], body: inputs.body }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listSMSMessages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/messages?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getMessage': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteSMS': {
                const res = await fetch(`${baseUrl}/messages/${inputs.messageId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'sendVoiceMessage': {
                const res = await fetch(`${baseUrl}/voicemessages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ originator: inputs.originator, recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients], body: inputs.body, language: inputs.language || 'en-gb', voice: inputs.voice || 'male' }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listVoiceMessages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/voicemessages?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getVoiceMessage': {
                const res = await fetch(`${baseUrl}/voicemessages/${inputs.id}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'sendWhatsApp': {
                const res = await fetch(`${baseUrl}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ originator: inputs.originator, recipients: Array.isArray(inputs.recipients) ? inputs.recipients : [inputs.recipients], type: 'hsm', content: { hsm: { namespace: inputs.namespace, templateName: inputs.templateName, language: { policy: 'deterministic', code: inputs.languageCode || 'en' }, params: inputs.params || [] } } }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/contacts?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createContact': {
                const res = await fetch(`${baseUrl}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ msisdn: inputs.msisdn, firstName: inputs.firstName, lastName: inputs.lastName, custom1: inputs.custom1, custom2: inputs.custom2 }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ firstName: inputs.firstName, lastName: inputs.lastName, custom1: inputs.custom1, custom2: inputs.custom2 }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteContact': {
                const res = await fetch(`${baseUrl}/contacts/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'listGroups': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/groups?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createGroup': {
                const res = await fetch(`${baseUrl}/groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'lookupPhoneNumber': {
                const params = new URLSearchParams();
                if (inputs.countryCode) params.set('countryCode', inputs.countryCode);
                const res = await fetch(`${baseUrl}/lookup/${inputs.phoneNumber}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`MessageBirdEnhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
