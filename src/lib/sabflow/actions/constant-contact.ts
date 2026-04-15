'use server';

const CC_BASE = 'https://api.cc.email/v3';

async function ccFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[ConstantContact] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CC_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.error_message || data?.message || `Constant Contact API error: ${res.status}`);
    }
    return data;
}

export async function executeConstantContactAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const cc = (method: string, path: string, body?: any) =>
            ccFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const params: string[] = [];
                if (inputs.limit) params.push(`limit=${Number(inputs.limit)}`);
                if (inputs.cursor) params.push(`cursor=${encodeURIComponent(String(inputs.cursor))}`);
                if (inputs.email) params.push(`email=${encodeURIComponent(String(inputs.email))}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await cc('GET', `/contacts${qs}`);
                return { output: { contacts: data.contacts ?? [], nextCursor: data._links?.next?.href ?? '' } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await cc('GET', `/contacts/${contactId}`);
                return { output: { contactId: data.contact_id ?? contactId, email: (data.email_address?.address ?? ''), firstName: data.first_name ?? '', lastName: data.last_name ?? '' } };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = {
                    email_address: { address: email, permission_to_send: inputs.permissionToSend ?? 'implicit' },
                };
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                if (inputs.listIds) body.list_memberships = Array.isArray(inputs.listIds) ? inputs.listIds : [inputs.listIds];
                const data = await cc('POST', '/contacts', body);
                return { output: { contactId: data.contact_id ?? '', email } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.firstName) body.first_name = String(inputs.firstName);
                if (inputs.lastName) body.last_name = String(inputs.lastName);
                if (inputs.email) body.email_address = { address: String(inputs.email), permission_to_send: inputs.permissionToSend ?? 'implicit' };
                if (inputs.listIds) body.list_memberships = Array.isArray(inputs.listIds) ? inputs.listIds : [inputs.listIds];
                const data = await cc('PUT', `/contacts/${contactId}`, body);
                return { output: { contactId: data.contact_id ?? contactId } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await cc('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true', contactId } };
            }

            case 'listLists': {
                const params: string[] = [];
                if (inputs.limit) params.push(`limit=${Number(inputs.limit)}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await cc('GET', `/contact_lists${qs}`);
                return { output: { lists: data.lists ?? [], total: String((data.lists ?? []).length) } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await cc('POST', '/contact_lists', { name, favorite: inputs.favorite ?? false });
                return { output: { listId: data.list_id ?? '', name: data.name ?? name } };
            }

            case 'addContactToList': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId || !contactId) throw new Error('listId and contactId are required.');
                await cc('POST', `/contact_lists/${listId}/contacts`, { source: { contact_ids: [contactId] } });
                return { output: { added: 'true', listId, contactId } };
            }

            case 'removeContactFromList': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId || !contactId) throw new Error('listId and contactId are required.');
                await cc('DELETE', `/contact_lists/${listId}/contacts/${contactId}`);
                return { output: { removed: 'true', listId, contactId } };
            }

            case 'listCampaigns': {
                const params: string[] = [];
                if (inputs.limit) params.push(`limit=${Number(inputs.limit)}`);
                if (inputs.cursor) params.push(`next=${encodeURIComponent(String(inputs.cursor))}`);
                const qs = params.length ? `?${params.join('&')}` : '';
                const data = await cc('GET', `/emails${qs}`);
                return { output: { campaigns: data.campaigns ?? [], nextCursor: data._links?.next?.href ?? '' } };
            }

            case 'getCampaign': {
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!campaignId) throw new Error('campaignId is required.');
                const data = await cc('GET', `/emails/${campaignId}`);
                return { output: { campaignId: data.campaign_id ?? campaignId, name: data.name ?? '', status: data.current_status ?? '' } };
            }

            case 'createEmailCampaign': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const body: any = { name };
                if (inputs.emailCampaignActivities) body.email_campaign_activities = Array.isArray(inputs.emailCampaignActivities) ? inputs.emailCampaignActivities : [inputs.emailCampaignActivities];
                const data = await cc('POST', '/emails', body);
                return { output: { campaignId: data.campaign_id ?? '', name: data.name ?? name } };
            }

            case 'scheduleCampaign': {
                const campaignActivityId = String(inputs.campaignActivityId ?? '').trim();
                if (!campaignActivityId) throw new Error('campaignActivityId is required.');
                const body: any = {};
                if (inputs.scheduledDate) body.scheduled_date = String(inputs.scheduledDate);
                const data = await cc('POST', `/emails/activities/${campaignActivityId}/schedules`, body);
                return { output: { scheduled: 'true', campaignActivityId, scheduledDate: data.scheduled_date ?? '' } };
            }

            case 'getCampaignActivity': {
                const campaignActivityId = String(inputs.campaignActivityId ?? '').trim();
                if (!campaignActivityId) throw new Error('campaignActivityId is required.');
                const data = await cc('GET', `/emails/activities/${campaignActivityId}`);
                return { output: { campaignActivityId: data.campaign_activity_id ?? campaignActivityId, status: data.current_status ?? '', subject: data.subject ?? '' } };
            }

            case 'getContactStats': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await cc('GET', `/reports/contact_reports/${contactId}/activity_details`);
                return { output: { stats: data ?? {}, contactId } };
            }

            default:
                return { error: `Constant Contact action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Constant Contact action failed.' };
    }
}
