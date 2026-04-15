'use server';

async function acFetch(account: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    const base = `https://${account}.api-us1.com/api/3`;
    logger?.log(`[ACEnhanced] ${method} ${base}${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'Api-Token': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || `ActiveCampaign API error: ${res.status}`);
    return data;
}

export async function executeActivecampaignEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const account = String(inputs.account ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        if (!account) throw new Error('account is required.');
        const ac = (method: string, path: string, body?: any) => acFetch(account, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'createContact': {
                const data = await ac('POST', '/contacts', {
                    contact: {
                        email: inputs.email,
                        firstName: inputs.firstName,
                        lastName: inputs.lastName,
                        phone: inputs.phone,
                        fieldValues: inputs.fieldValues,
                    },
                });
                return { output: data };
            }
            case 'getContact': {
                const contactId = inputs.contactId;
                const data = await ac('GET', `/contacts/${contactId}`);
                return { output: data };
            }
            case 'updateContact': {
                const contactId = inputs.contactId;
                const payload: any = {};
                if (inputs.email) payload.email = inputs.email;
                if (inputs.firstName) payload.firstName = inputs.firstName;
                if (inputs.lastName) payload.lastName = inputs.lastName;
                if (inputs.phone) payload.phone = inputs.phone;
                if (inputs.fieldValues) payload.fieldValues = inputs.fieldValues;
                const data = await ac('PUT', `/contacts/${contactId}`, { contact: payload });
                return { output: data };
            }
            case 'deleteContact': {
                const contactId = inputs.contactId;
                await ac('DELETE', `/contacts/${contactId}`);
                return { output: { success: true, contactId } };
            }
            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.email) params.set('email', inputs.email);
                const data = await ac('GET', `/contacts?${params.toString()}`);
                return { output: data };
            }
            case 'tagContact': {
                const data = await ac('POST', '/contactTags', {
                    contactTag: {
                        contact: inputs.contactId,
                        tag: inputs.tagId,
                    },
                });
                return { output: data };
            }
            case 'untagContact': {
                const contactTagId = inputs.contactTagId;
                await ac('DELETE', `/contactTags/${contactTagId}`);
                return { output: { success: true, contactTagId } };
            }
            case 'createList': {
                const data = await ac('POST', '/lists', {
                    list: {
                        name: inputs.name,
                        stringid: inputs.stringid ?? inputs.name.toLowerCase().replace(/\s+/g, '-'),
                        sender_url: inputs.senderUrl ?? '',
                        sender_reminder: inputs.senderReminder ?? '',
                    },
                });
                return { output: data };
            }
            case 'addToList': {
                const data = await ac('POST', '/contactLists', {
                    contactList: {
                        list: inputs.listId,
                        contact: inputs.contactId,
                        status: 1,
                    },
                });
                return { output: data };
            }
            case 'createDeal': {
                const payload: any = {
                    title: inputs.title,
                    value: inputs.value ?? 0,
                    currency: inputs.currency ?? 'usd',
                    group: inputs.group,
                    stage: inputs.stage,
                    owner: inputs.owner,
                };
                if (inputs.contact) payload.contact = inputs.contact;
                if (inputs.description) payload.description = inputs.description;
                const data = await ac('POST', '/deals', { deal: payload });
                return { output: data };
            }
            case 'updateDeal': {
                const dealId = inputs.dealId;
                const payload: any = {};
                if (inputs.title) payload.title = inputs.title;
                if (inputs.value !== undefined) payload.value = inputs.value;
                if (inputs.stage) payload.stage = inputs.stage;
                if (inputs.status !== undefined) payload.status = inputs.status;
                const data = await ac('PUT', `/deals/${dealId}`, { deal: payload });
                return { output: data };
            }
            case 'getDeal': {
                const dealId = inputs.dealId;
                const data = await ac('GET', `/deals/${dealId}`);
                return { output: data };
            }
            case 'createNote': {
                const data = await ac('POST', '/notes', {
                    note: {
                        note: inputs.note,
                        relid: inputs.relid,
                        reltype: inputs.reltype ?? 'Subscriber',
                    },
                });
                return { output: data };
            }
            case 'addDealNote': {
                const data = await ac('POST', '/dealNotes', {
                    dealNote: {
                        note: inputs.note,
                        deal: inputs.dealId,
                    },
                });
                return { output: data };
            }
            case 'triggerAutomation': {
                const data = await ac('POST', '/contactAutomations', {
                    contactAutomation: {
                        contact: inputs.contactId,
                        automation: inputs.automationId,
                    },
                });
                return { output: data };
            }
            default:
                return { error: `Unknown ActiveCampaign Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger?.log(`[ACEnhanced] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
