'use server';

export async function executeEgoiAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { apiKey } = inputs;
        if (!apiKey) return { error: 'E-goi: apiKey is required.' };

        const baseUrl = 'https://api.egoiapp.com';
        const headers: Record<string, string> = {
            'Apikey': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        async function apiGet(path: string): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'GET', headers });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.title || data?.detail || JSON.stringify(data) || `E-goi error: ${res.status}`);
            return data;
        }

        async function apiPost(path: string, body: any): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.title || data?.detail || JSON.stringify(data) || `E-goi error: ${res.status}`);
            return data;
        }

        async function apiPatch(path: string, body: any): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.title || data?.detail || JSON.stringify(data) || `E-goi error: ${res.status}`);
            return data;
        }

        async function apiDelete(path: string): Promise<any> {
            const res = await fetch(`${baseUrl}${path}`, { method: 'DELETE', headers });
            if (res.status === 204) return { success: true };
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.title || data?.detail || JSON.stringify(data) || `E-goi error: ${res.status}`);
            return data;
        }

        logger.log(`Executing E-goi action: ${actionName}`, { inputs });

        switch (actionName) {
            case 'getLists': {
                const { offset = 0, limit = 10 } = inputs;
                const data = await apiGet(`/lists?offset=${offset}&limit=${limit}`);
                return { output: { lists: data.items ?? data, total: data.total_items } };
            }

            case 'getList': {
                const { listId } = inputs;
                if (!listId) return { error: 'E-goi getList: listId is required.' };
                const data = await apiGet(`/lists/${listId}`);
                return { output: { list: data } };
            }

            case 'createList': {
                const { internalName, language = 'en' } = inputs;
                if (!internalName) return { error: 'E-goi createList: internalName is required.' };
                const data = await apiPost('/lists', { internal_name: internalName, language });
                return { output: { listId: data.list_id, list: data } };
            }

            case 'getContacts': {
                const { listId, offset = 0, limit = 10 } = inputs;
                if (!listId) return { error: 'E-goi getContacts: listId is required.' };
                const data = await apiGet(`/lists/${listId}/contacts?offset=${offset}&limit=${limit}`);
                return { output: { contacts: data.items ?? data, total: data.total_items } };
            }

            case 'getContact': {
                const { listId, contactId } = inputs;
                if (!listId) return { error: 'E-goi getContact: listId is required.' };
                if (!contactId) return { error: 'E-goi getContact: contactId is required.' };
                const data = await apiGet(`/lists/${listId}/contacts/${contactId}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const { listId, email, firstName, lastName, phone } = inputs;
                if (!listId) return { error: 'E-goi createContact: listId is required.' };
                if (!email) return { error: 'E-goi createContact: email is required.' };
                const body: any = { base: { email } };
                if (firstName) body.base.first_name = firstName;
                if (lastName) body.base.last_name = lastName;
                if (phone) body.base.cellphone = phone;
                const data = await apiPost(`/lists/${listId}/contacts`, body);
                return { output: { contactId: data.contact_id, contact: data } };
            }

            case 'updateContact': {
                const { listId, contactId, email, firstName, lastName, phone } = inputs;
                if (!listId) return { error: 'E-goi updateContact: listId is required.' };
                if (!contactId) return { error: 'E-goi updateContact: contactId is required.' };
                const body: any = { base: {} };
                if (email) body.base.email = email;
                if (firstName) body.base.first_name = firstName;
                if (lastName) body.base.last_name = lastName;
                if (phone) body.base.cellphone = phone;
                const data = await apiPatch(`/lists/${listId}/contacts/${contactId}`, body);
                return { output: { contact: data } };
            }

            case 'deleteContact': {
                const { listId, contactId } = inputs;
                if (!listId) return { error: 'E-goi deleteContact: listId is required.' };
                if (!contactId) return { error: 'E-goi deleteContact: contactId is required.' };
                const data = await apiDelete(`/lists/${listId}/contacts/${contactId}`);
                return { output: data };
            }

            case 'addContactToList': {
                const { listId, contactId } = inputs;
                if (!listId) return { error: 'E-goi addContactToList: listId is required.' };
                if (!contactId) return { error: 'E-goi addContactToList: contactId is required.' };
                const data = await apiPost(`/lists/${listId}/contacts/actions/attach-tag`, {
                    contacts: [contactId],
                });
                return { output: data };
            }

            case 'removeFromList': {
                const { listId, contactId } = inputs;
                if (!listId) return { error: 'E-goi removeFromList: listId is required.' };
                if (!contactId) return { error: 'E-goi removeFromList: contactId is required.' };
                const data = await apiPost(`/lists/${listId}/contacts/actions/remove`, {
                    contacts: [contactId],
                });
                return { output: data };
            }

            case 'getCampaigns': {
                const { listId, offset = 0, limit = 10 } = inputs;
                let path = `/campaigns?offset=${offset}&limit=${limit}`;
                if (listId) path += `&list_id=${listId}`;
                const data = await apiGet(path);
                return { output: { campaigns: data.items ?? data, total: data.total_items } };
            }

            case 'getCampaign': {
                const { campaignHash } = inputs;
                if (!campaignHash) return { error: 'E-goi getCampaign: campaignHash is required.' };
                const data = await apiGet(`/campaigns/email/${campaignHash}`);
                return { output: { campaign: data } };
            }

            case 'createEmailCampaign': {
                const { listId, internalName, subject, senderName, senderEmail, content } = inputs;
                if (!listId) return { error: 'E-goi createEmailCampaign: listId is required.' };
                if (!internalName) return { error: 'E-goi createEmailCampaign: internalName is required.' };
                if (!subject) return { error: 'E-goi createEmailCampaign: subject is required.' };
                if (!senderEmail) return { error: 'E-goi createEmailCampaign: senderEmail is required.' };
                const body: any = {
                    list_id: listId,
                    internal_name: internalName,
                    subject,
                    sender: { name: senderName ?? 'Sender', email: senderEmail },
                    content: { type: 'html', message: content ?? '' },
                };
                const data = await apiPost('/campaigns/email', body);
                return { output: { campaignHash: data.campaign_hash, campaign: data } };
            }

            case 'sendCampaign': {
                const { campaignHash, listId, segmentId } = inputs;
                if (!campaignHash) return { error: 'E-goi sendCampaign: campaignHash is required.' };
                if (!listId) return { error: 'E-goi sendCampaign: listId is required.' };
                const body: any = {
                    list_id: listId,
                    segments: { type: segmentId ? 'segment' : 'all', segment_id: segmentId },
                    type: 'now',
                };
                const data = await apiPost(`/campaigns/email/${campaignHash}/actions/send`, body);
                return { output: data };
            }

            case 'scheduleCampaign': {
                const { campaignHash, listId, scheduleDate } = inputs;
                if (!campaignHash) return { error: 'E-goi scheduleCampaign: campaignHash is required.' };
                if (!listId) return { error: 'E-goi scheduleCampaign: listId is required.' };
                if (!scheduleDate) return { error: 'E-goi scheduleCampaign: scheduleDate is required.' };
                const body: any = {
                    list_id: listId,
                    segments: { type: 'all' },
                    type: 'scheduled',
                    date_time: scheduleDate,
                };
                const data = await apiPost(`/campaigns/email/${campaignHash}/actions/send`, body);
                return { output: data };
            }

            case 'getStats': {
                const { campaignHash } = inputs;
                if (!campaignHash) return { error: 'E-goi getStats: campaignHash is required.' };
                const data = await apiGet(`/reports/email/campaigns/${campaignHash}`);
                return { output: { stats: data } };
            }

            case 'getTags': {
                const { offset = 0, limit = 10 } = inputs;
                const data = await apiGet(`/tags?offset=${offset}&limit=${limit}`);
                return { output: { tags: data.items ?? data, total: data.total_items } };
            }

            default:
                return { error: `E-goi: Unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`E-goi action error [${actionName}]:`, err?.message ?? err);
        return { error: err?.message ?? 'E-goi: An unexpected error occurred.' };
    }
}
