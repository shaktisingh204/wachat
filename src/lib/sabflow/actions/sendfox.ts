
'use server';

const SENDFOX_BASE = 'https://api.sendfox.com';

async function sendfoxFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    const url = `${SENDFOX_BASE}${path}`;
    logger?.log(`[Sendfox] ${method} ${url}`);
    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || data?.error || text || `Sendfox API error ${res.status}`);
    return data;
}

export async function executeSendfoxAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const get = (path: string) => sendfoxFetch(accessToken, 'GET', path, undefined, logger);
        const post = (path: string, body: any) => sendfoxFetch(accessToken, 'POST', path, body, logger);
        const patch = (path: string, body: any) => sendfoxFetch(accessToken, 'PATCH', path, body, logger);
        const del = (path: string) => sendfoxFetch(accessToken, 'DELETE', path, undefined, logger);

        switch (actionName) {
            case 'listLists': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const data = await get(`/lists${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'getList': {
                const id = String(inputs.id ?? inputs.listId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/lists/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await post('/lists', { name });
                return { output: data };
            }

            case 'deleteList': {
                const id = String(inputs.id ?? inputs.listId ?? '').trim();
                if (!id) throw new Error('id is required.');
                await del(`/lists/${encodeURIComponent(id)}`);
                return { output: { success: true, id } };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.email) params.set('email', String(inputs.email));
                const qs = params.toString();
                const data = await get(`/contacts${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'getContact': {
                const id = String(inputs.id ?? inputs.contactId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/contacts/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.first_name) body.first_name = String(inputs.first_name);
                if (inputs.last_name) body.last_name = String(inputs.last_name);
                if (inputs.lists) body.lists = inputs.lists; // array of list IDs
                const data = await post('/contacts', body);
                return { output: data };
            }

            case 'updateContact': {
                const id = String(inputs.id ?? inputs.contactId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const body: any = {};
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.first_name) body.first_name = String(inputs.first_name);
                if (inputs.last_name) body.last_name = String(inputs.last_name);
                const data = await patch(`/contacts/${encodeURIComponent(id)}`, body);
                return { output: data };
            }

            case 'deleteContact': {
                const id = String(inputs.id ?? inputs.contactId ?? '').trim();
                if (!id) throw new Error('id is required.');
                await del(`/contacts/${encodeURIComponent(id)}`);
                return { output: { success: true, id } };
            }

            case 'addContactToList': {
                const contactId = String(inputs.contactId ?? inputs.id ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                if (!listId) throw new Error('listId is required.');
                const data = await post(`/contacts/${encodeURIComponent(contactId)}/lists`, { list_id: listId });
                return { output: { success: true, ...data } };
            }

            case 'removeContactFromList': {
                const contactId = String(inputs.contactId ?? inputs.id ?? '').trim();
                const listId = String(inputs.listId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                if (!listId) throw new Error('listId is required.');
                await del(`/contacts/${encodeURIComponent(contactId)}/lists/${encodeURIComponent(listId)}`);
                return { output: { success: true, contactId, listId } };
            }

            case 'listCampaigns': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString();
                const data = await get(`/campaigns${qs ? '?' + qs : ''}`);
                return { output: data };
            }

            case 'getCampaign': {
                const id = String(inputs.id ?? inputs.campaignId ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await get(`/campaigns/${encodeURIComponent(id)}`);
                return { output: data };
            }

            case 'createCampaign': {
                const name = String(inputs.name ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body_html = String(inputs.body_html ?? inputs.html ?? '').trim();
                if (!name) throw new Error('name is required.');
                if (!subject) throw new Error('subject is required.');
                if (!body_html) throw new Error('body_html is required.');
                const payload: any = { name, subject, body_html };
                if (inputs.from_name) payload.from_name = String(inputs.from_name);
                if (inputs.reply_to) payload.reply_to = String(inputs.reply_to);
                if (inputs.lists) payload.lists = inputs.lists;
                const data = await post('/campaigns', payload);
                return { output: data };
            }

            case 'scheduleCampaign': {
                const id = String(inputs.id ?? inputs.campaignId ?? '').trim();
                const scheduleDate = String(inputs.scheduleDate ?? inputs.schedule_date ?? '').trim();
                if (!id) throw new Error('id is required.');
                if (!scheduleDate) throw new Error('scheduleDate is required (ISO 8601 format).');
                const data = await post(`/campaigns/${encodeURIComponent(id)}/schedule`, { schedule_date: scheduleDate });
                return { output: { success: true, ...data } };
            }

            default:
                return { error: `Sendfox action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Sendfox action failed.' };
    }
}
