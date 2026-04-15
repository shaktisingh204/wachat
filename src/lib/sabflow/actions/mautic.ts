
'use server';

async function mauticFetch(
    baseUrl: string,
    authHeader: string,
    method: string,
    path: string,
    body?: any,
    logger?: any
): Promise<any> {
    logger?.log(`[Mautic] ${method} ${path}`);
    const url = `${baseUrl}${path}`;
    const options: RequestInit = {
        method,
        headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        const msg = data?.errors?.[0]?.message || data?.message || `Mautic API error: ${res.status}`;
        throw new Error(msg);
    }
    return data;
}

export async function executeMauticAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const serverUrl = String(inputs.serverUrl ?? '').trim().replace(/\/$/, '');
        if (!serverUrl) throw new Error('serverUrl is required.');

        const baseUrl = `${serverUrl}/api`;

        let authHeader: string;
        if (inputs.accessToken) {
            authHeader = `Bearer ${String(inputs.accessToken).trim()}`;
        } else {
            const username = String(inputs.username ?? '').trim();
            const password = String(inputs.password ?? '').trim();
            if (!username || !password) throw new Error('username and password (or accessToken) are required.');
            authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
        }

        const mautic = (method: string, path: string, body?: any) =>
            mauticFetch(baseUrl, authHeader, method, path, body, logger);

        switch (actionName) {
            case 'listContacts': {
                const start = Number(inputs.start ?? 0);
                const limit = Number(inputs.limit ?? 30);
                let path = `/contacts?start=${start}&limit=${limit}`;
                if (inputs.search) path += `&search=${encodeURIComponent(String(inputs.search))}`;
                if (inputs.orderBy) path += `&orderBy=${encodeURIComponent(String(inputs.orderBy))}`;
                const data = await mautic('GET', path);
                return { output: { contacts: data.contacts ?? {}, total: String(data.total ?? 0) } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await mautic('GET', `/contacts/${contactId}`);
                const c = data.contact ?? {};
                return {
                    output: {
                        contact: {
                            id: String(c.id ?? ''),
                            fields: c.fields ?? {},
                        },
                    },
                };
            }

            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { email };
                if (inputs.firstName) body.firstname = String(inputs.firstName);
                if (inputs.lastName) body.lastname = String(inputs.lastName);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.company) body.company = String(inputs.company);
                const data = await mautic('POST', '/contacts/new', body);
                const c = data.contact ?? {};
                return { output: { contact: { id: String(c.id ?? ''), email: c.fields?.core?.email ?? email } } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data object is required.');
                const data = await mautic('PATCH', `/contacts/${contactId}/edit`, inputs.data);
                return { output: { contact: { id: String(data.contact?.id ?? contactId) } } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await mautic('DELETE', `/contacts/${contactId}/delete`);
                return { output: { contact: null } };
            }

            case 'addDoNotContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const channel = String(inputs.channel ?? 'email').trim();
                const body: any = {};
                if (inputs.comments) body.comments = String(inputs.comments);
                const data = await mautic('POST', `/contacts/${contactId}/dnc/${channel}/add`, body);
                return { output: { contact: data.contact ?? {} } };
            }

            case 'listSegments': {
                const data = await mautic('GET', '/segments?limit=200');
                return { output: { lists: data.lists ?? {}, total: String(data.total ?? 0) } };
            }

            case 'addContactToSegment': {
                const contactId = String(inputs.contactId ?? '').trim();
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!contactId || !segmentId) throw new Error('contactId and segmentId are required.');
                const data = await mautic('POST', `/segments/${segmentId}/contact/${contactId}/add`);
                return { output: { success: String(data.success ?? 1) } };
            }

            case 'removeContactFromSegment': {
                const contactId = String(inputs.contactId ?? '').trim();
                const segmentId = String(inputs.segmentId ?? '').trim();
                if (!contactId || !segmentId) throw new Error('contactId and segmentId are required.');
                const data = await mautic('POST', `/segments/${segmentId}/contact/${contactId}/remove`);
                return { output: { success: String(data.success ?? 1) } };
            }

            case 'listCampaigns': {
                const data = await mautic('GET', '/campaigns?limit=200');
                return { output: { campaigns: data.campaigns ?? {}, total: String(data.total ?? 0) } };
            }

            case 'addContactToCampaign': {
                const contactId = String(inputs.contactId ?? '').trim();
                const campaignId = String(inputs.campaignId ?? '').trim();
                if (!contactId || !campaignId) throw new Error('contactId and campaignId are required.');
                const data = await mautic('POST', `/campaigns/${campaignId}/contact/${contactId}/add`);
                return { output: { success: String(data.success ?? 1) } };
            }

            case 'listForms': {
                const data = await mautic('GET', '/forms?limit=200');
                return { output: { forms: data.forms ?? {}, total: String(data.total ?? 0) } };
            }

            case 'submitForm': {
                const formId = String(inputs.formId ?? '').trim();
                if (!formId) throw new Error('formId is required.');
                if (!inputs.data || typeof inputs.data !== 'object') throw new Error('data object is required.');
                await mautic('POST', `/form/submit?formId=${formId}`, inputs.data);
                return { output: { submitted: true } };
            }

            case 'listEmails': {
                const data = await mautic('GET', '/emails?limit=200');
                return { output: { emails: data.emails ?? {}, total: String(data.total ?? 0) } };
            }

            case 'sendEmail': {
                const emailId = String(inputs.emailId ?? '').trim();
                const contactId = String(inputs.contactId ?? '').trim();
                if (!emailId || !contactId) throw new Error('emailId and contactId are required.');
                await mautic('POST', `/emails/${emailId}/contact/${contactId}/send`);
                return { output: { sent: true } };
            }

            default:
                return { error: `Mautic action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Mautic action failed.' };
    }
}
