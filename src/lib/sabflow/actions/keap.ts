'use server';

const KEAP_BASE = 'https://api.infusionsoft.com/crm/rest/v1';

async function keapFetch(accessToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Keap] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${KEAP_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data?.message || `Keap API error: ${res.status}`);
    }
    return data;
}

export async function executeKeapAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');
        const kp = (method: string, path: string, body?: any) =>
            keapFetch(accessToken, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const limit = inputs.limit ? Number(inputs.limit) : 200;
                const offset = inputs.offset ? Number(inputs.offset) : 0;
                const email = inputs.email ? String(inputs.email).trim() : '';
                let qs = `?limit=${limit}&offset=${offset}`;
                if (email) qs += `&email=${encodeURIComponent(email)}`;
                const data = await kp('GET', `/contacts${qs}`);
                return {
                    output: {
                        contacts: data.contacts ?? [],
                        count: String(data.count ?? 0),
                        next: data.next ?? '',
                    },
                };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await kp('GET', `/contacts/${contactId}`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        email_addresses: data.email_addresses ?? [],
                        given_name: data.given_name ?? '',
                        family_name: data.family_name ?? '',
                        phone_numbers: data.phone_numbers ?? [],
                        company_name: data.company_name ?? '',
                    },
                };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = {
                    email_addresses: [{ email, field: 'EMAIL1' }],
                };
                if (inputs.firstName) body.given_name = String(inputs.firstName).trim();
                if (inputs.lastName) body.family_name = String(inputs.lastName).trim();
                if (inputs.phone) body.phone_numbers = [{ number: String(inputs.phone).trim(), field: 'PHONE1' }];
                if (inputs.company) body.company_name = String(inputs.company).trim();
                const data = await kp('POST', '/contacts', body);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        email_addresses: data.email_addresses ?? [],
                    },
                };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.firstName) body.given_name = String(inputs.firstName).trim();
                if (inputs.lastName) body.family_name = String(inputs.lastName).trim();
                if (inputs.phone) body.phone_numbers = [{ number: String(inputs.phone).trim(), field: 'PHONE1' }];
                const data = await kp('PATCH', `/contacts/${contactId}`, body);
                return { output: { id: String(data.id ?? contactId) } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await kp('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true', contactId } };
            }

            case 'listTags': {
                const data = await kp('GET', '/tags');
                return { output: { tags: data.tags ?? [] } };
            }

            case 'applyTag': {
                const contactId = String(inputs.contactId ?? '').trim();
                const tagId = Number(inputs.tagId);
                if (!contactId) throw new Error('contactId is required.');
                if (!tagId) throw new Error('tagId is required.');
                await kp('POST', `/contacts/${contactId}/tags`, { tagIds: [tagId] });
                return { output: { applied: 'true', contactId, tagId: String(tagId) } };
            }

            case 'removeTag': {
                const contactId = String(inputs.contactId ?? '').trim();
                const tagId = String(inputs.tagId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                if (!tagId) throw new Error('tagId is required.');
                await kp('DELETE', `/contacts/${contactId}/tags/${tagId}`);
                return { output: { removed: 'true', contactId, tagId } };
            }

            case 'listOrders': {
                const data = await kp('GET', '/orders');
                return { output: { orders: data.orders ?? [] } };
            }

            case 'getOrder': {
                const orderId = String(inputs.orderId ?? '').trim();
                if (!orderId) throw new Error('orderId is required.');
                const data = await kp('GET', `/orders/${orderId}`);
                return {
                    output: {
                        id: String(data.id ?? ''),
                        title: data.title ?? '',
                        total: String(data.total ?? ''),
                        status: data.status ?? '',
                    },
                };
            }

            case 'listProducts': {
                const data = await kp('GET', '/products');
                return { output: { products: data.products ?? [] } };
            }

            case 'listOpportunities': {
                const data = await kp('GET', '/opportunities');
                return { output: { opportunities: data.opportunities ?? [] } };
            }

            case 'createNote': {
                const contactId = String(inputs.contactId ?? '').trim();
                const body = String(inputs.body ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                if (!body) throw new Error('body is required.');
                const noteType = inputs.type ? String(inputs.type).trim() : 'Other';
                const data = await kp('POST', '/notes', {
                    contact_id: Number(contactId),
                    body,
                    note_type: noteType,
                });
                return { output: { id: String(data.id ?? '') } };
            }

            case 'listNotes': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await kp('GET', `/notes?contact_id=${contactId}`);
                return { output: { notes: data.notes ?? [] } };
            }

            default:
                return { error: `Keap action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Keap action failed.' };
    }
}
