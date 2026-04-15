
'use server';

const AUTOPILOT_BASE = 'https://api2.autopilothq.com/v1';

export async function executeAutopilotAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const req = async (method: string, path: string, body?: any) => {
            logger?.log(`[Autopilot] ${method} ${AUTOPILOT_BASE}${path}`);
            const opts: RequestInit = {
                method,
                headers: {
                    autopilotapikey: apiKey,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) opts.body = JSON.stringify(body);
            const res = await fetch(`${AUTOPILOT_BASE}${path}`, opts);
            if (res.status === 204) return {};
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data?.message || data?.error || `Autopilot API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'addContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const contact: any = { Email: email };
                if (inputs.firstName) contact.FirstName = String(inputs.firstName);
                if (inputs.lastName) contact.LastName = String(inputs.lastName);
                if (inputs.phone) contact.Phone = String(inputs.phone);
                if (inputs.company) contact.Company = String(inputs.company);
                if (inputs.customFields && typeof inputs.customFields === 'object') {
                    Object.assign(contact, inputs.customFields);
                }
                const data = await req('POST', '/contact', { contact });
                return { output: { contact: data.contact ?? data, id: data.contact_id ?? '' } };
            }

            case 'updateContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const contact: any = { Email: email };
                if (inputs.firstName) contact.FirstName = String(inputs.firstName);
                if (inputs.lastName) contact.LastName = String(inputs.lastName);
                if (inputs.phone) contact.Phone = String(inputs.phone);
                if (inputs.company) contact.Company = String(inputs.company);
                if (inputs.customFields && typeof inputs.customFields === 'object') {
                    Object.assign(contact, inputs.customFields);
                }
                const data = await req('POST', '/contact', { contact });
                return { output: { contact: data.contact ?? data, id: data.contact_id ?? '' } };
            }

            case 'getContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const data = await req('GET', `/contact/email/${encodeURIComponent(email)}`);
                return { output: { contact: data.contact ?? data } };
            }

            case 'deleteContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                await req('DELETE', `/contact/email/${encodeURIComponent(email)}`);
                return { output: { success: true, email } };
            }

            case 'listContacts': {
                const body: any = {};
                if (inputs.limit) body.limit = Number(inputs.limit);
                if (inputs.bookmark) body.bookmark = String(inputs.bookmark);
                const data = await req('POST', '/contacts', body);
                return { output: { contacts: data.contacts ?? [], bookmark: data.bookmark ?? '', count: data.total_contacts ?? 0 } };
            }

            case 'addToList': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!contactId) throw new Error('contactId is required.');
                const data = await req('POST', `/list/${listId}/contact/${contactId}`);
                return { output: { success: true, result: data } };
            }

            case 'removeFromList': {
                const listId = String(inputs.listId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                if (!contactId) throw new Error('contactId is required.');
                await req('DELETE', `/list/${listId}/contact/${contactId}`);
                return { output: { success: true, listId, contactId } };
            }

            case 'getList': {
                const listId = String(inputs.listId ?? '').trim();
                if (!listId) throw new Error('listId is required.');
                const data = await req('GET', `/list/${listId}/contacts`);
                return { output: { contacts: data.contacts ?? [], count: data.total_contacts ?? 0 } };
            }

            case 'createList': {
                const name = String(inputs.name ?? '').trim();
                if (!name) throw new Error('name is required.');
                const data = await req('POST', '/list', { name });
                return { output: { list: data, listId: data.list_id ?? '' } };
            }

            case 'listLists': {
                const data = await req('GET', '/lists');
                return { output: { lists: data.lists ?? data ?? [] } };
            }

            case 'triggerJourney': {
                const journeyId = String(inputs.journeyId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!journeyId) throw new Error('journeyId is required.');
                if (!email) throw new Error('email is required.');
                const data = await req('POST', `/journey/${journeyId}/contact/email/${encodeURIComponent(email)}`);
                return { output: { success: true, result: data } };
            }

            case 'listJourneys': {
                const data = await req('GET', '/journeys');
                return { output: { journeys: data.journeys ?? data ?? [] } };
            }

            default:
                return { error: `Autopilot action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Autopilot action failed.' };
    }
}
