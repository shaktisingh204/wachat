'use server';

export async function executeMailjetAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey, secretKey } = inputs;
        if (!apiKey || !secretKey) return { error: 'Mailjet apiKey and secretKey are required.' };

        const authHeader = `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`;
        const jsonHeaders: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
        };

        const BASE_V3 = 'https://api.mailjet.com/v3';
        const BASE_V31 = 'https://api.mailjet.com/v3.1';

        let res: Response;

        switch (actionName) {
            case 'sendEmail': {
                const { messages } = inputs;
                res = await fetch(`${BASE_V31}/send`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({ Messages: messages }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || data.Message || 'Failed to send email.' };
                return { output: data };
            }
            case 'listContacts': {
                const { limit, offset } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('Limit', String(limit));
                if (offset) params.set('Offset', String(offset));
                res = await fetch(`${BASE_V3}/REST/contact?${params.toString()}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list contacts.' };
                return { output: data };
            }
            case 'getContact': {
                const { contactId } = inputs;
                res = await fetch(`${BASE_V3}/REST/contact/${contactId}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get contact.' };
                return { output: data };
            }
            case 'addContact': {
                const { email, name, isExcludedFromCampaigns } = inputs;
                const body: any = { Email: email };
                if (name) body.Name = name;
                if (isExcludedFromCampaigns !== undefined) body.IsExcludedFromCampaigns = isExcludedFromCampaigns;
                res = await fetch(`${BASE_V3}/REST/contact`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to add contact.' };
                return { output: data };
            }
            case 'updateContactData': {
                const { contactId, data: contactData } = inputs;
                res = await fetch(`${BASE_V3}/REST/contactdata/${contactId}`, {
                    method: 'PUT',
                    headers: jsonHeaders,
                    body: JSON.stringify({ Data: contactData }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to update contact data.' };
                return { output: data };
            }
            case 'deleteContact': {
                const { contactId } = inputs;
                res = await fetch(`${BASE_V3}/REST/contact/${contactId}`, {
                    method: 'DELETE',
                    headers: jsonHeaders,
                });
                if (!res.ok) {
                    const data = await res.json();
                    return { error: data.ErrorMessage || 'Failed to delete contact.' };
                }
                return { output: { success: true } };
            }
            case 'listContactLists': {
                const { limit, offset } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('Limit', String(limit));
                if (offset) params.set('Offset', String(offset));
                res = await fetch(`${BASE_V3}/REST/contactslist?${params.toString()}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list contact lists.' };
                return { output: data };
            }
            case 'createContactList': {
                const { name } = inputs;
                res = await fetch(`${BASE_V3}/REST/contactslist`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({ Name: name }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to create contact list.' };
                return { output: data };
            }
            case 'addContactToList': {
                const { listId, email, action } = inputs;
                res = await fetch(`${BASE_V3}/REST/contactslist/${listId}/managecontact`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({ Email: email, Action: action || 'addnoforce' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to add contact to list.' };
                return { output: data };
            }
            case 'removeContactFromList': {
                const { listId, email } = inputs;
                res = await fetch(`${BASE_V3}/REST/contactslist/${listId}/managecontact`, {
                    method: 'POST',
                    headers: jsonHeaders,
                    body: JSON.stringify({ Email: email, Action: 'remove' }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to remove contact from list.' };
                return { output: data };
            }
            case 'listMessages': {
                const { limit, offset, campaignId } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('Limit', String(limit));
                if (offset) params.set('Offset', String(offset));
                if (campaignId) params.set('CampaignID', String(campaignId));
                res = await fetch(`${BASE_V3}/REST/message?${params.toString()}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list messages.' };
                return { output: data };
            }
            case 'getMessage': {
                const { messageId } = inputs;
                res = await fetch(`${BASE_V3}/REST/message/${messageId}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get message.' };
                return { output: data };
            }
            case 'getCampaigns': {
                const { limit, offset } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('Limit', String(limit));
                if (offset) params.set('Offset', String(offset));
                res = await fetch(`${BASE_V3}/REST/campaign?${params.toString()}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get campaigns.' };
                return { output: data };
            }
            case 'getTemplates': {
                const { limit, offset } = inputs;
                const params = new URLSearchParams();
                if (limit) params.set('Limit', String(limit));
                if (offset) params.set('Offset', String(offset));
                res = await fetch(`${BASE_V3}/REST/template?${params.toString()}`, { headers: jsonHeaders });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get templates.' };
                return { output: data };
            }
            default:
                return { error: `Mailjet action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        return { error: err.message || 'An unexpected error occurred in Mailjet action.' };
    }
}
