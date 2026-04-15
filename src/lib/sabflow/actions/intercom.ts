
'use server';

const INTERCOM_BASE = 'https://api.intercom.io';

async function intercomFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Intercom] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'Intercom-Version': '2.11',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${INTERCOM_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.errors?.[0]?.message || data?.message || `Intercom API error: ${res.status}`);
    }
    return data;
}

export async function executeIntercomAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        if (!token) throw new Error('token is required.');
        const ic = (method: string, path: string, body?: any) => intercomFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'createContact': {
                const email = String(inputs.email ?? '').trim();
                const name = String(inputs.name ?? '').trim();
                const phone = String(inputs.phone ?? '').trim();
                const role = String(inputs.role ?? 'user').trim();
                if (!email) throw new Error('email is required.');
                const body: any = { role, email };
                if (name) body.name = name;
                if (phone) body.phone = phone;
                const data = await ic('POST', '/contacts', body);
                return { output: { id: data.id, email: data.email, name: data.name ?? '', role: data.role } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (contactId) {
                    const data = await ic('GET', `/contacts/${contactId}`);
                    return { output: { id: data.id, email: data.email, name: data.name ?? '', role: data.role } };
                } else if (email) {
                    const data = await ic('POST', '/contacts/search', { query: { field: 'email', operator: '=', value: email } });
                    const contact = data.data?.[0] ?? null;
                    return { output: { id: contact?.id ?? '', email: contact?.email ?? '', name: contact?.name ?? '', found: String(!!contact) } };
                } else {
                    throw new Error('contactId or email is required.');
                }
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                if (inputs.customAttributes) {
                    body.custom_attributes = typeof inputs.customAttributes === 'string' ? JSON.parse(inputs.customAttributes) : inputs.customAttributes;
                }
                const data = await ic('PUT', `/contacts/${contactId}`, body);
                return { output: { id: data.id, email: data.email, name: data.name ?? '' } };
            }

            case 'deleteContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                await ic('DELETE', `/contacts/${contactId}`);
                return { output: { deleted: 'true' } };
            }

            case 'createConversation': {
                const from = inputs.from;
                const body_text = String(inputs.body ?? '').trim();
                if (!from || !body_text) throw new Error('from and body are required.');
                const fromObj = typeof from === 'string' ? JSON.parse(from) : from;
                const data = await ic('POST', '/conversations', { from: fromObj, body: body_text });
                return { output: { id: data.id, state: data.state, type: data.type } };
            }

            case 'getConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await ic('GET', `/conversations/${conversationId}`);
                return { output: { id: data.id, state: data.state, type: data.type, subject: data.source?.subject ?? '' } };
            }

            case 'replyToConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const body_text = String(inputs.body ?? '').trim();
                const messageType = String(inputs.messageType ?? 'comment').trim();
                const adminId = String(inputs.adminId ?? '').trim();
                if (!conversationId || !body_text || !adminId) throw new Error('conversationId, body, and adminId are required.');
                const data = await ic('POST', `/conversations/${conversationId}/reply`, { message_type: messageType, type: 'admin', admin_id: adminId, body: body_text });
                return { output: { id: data.id, type: data.type } };
            }

            case 'assignConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const assigneeId = String(inputs.assigneeId ?? '').trim();
                const assigneeType = String(inputs.assigneeType ?? 'admin').trim();
                const adminId = String(inputs.adminId ?? '').trim();
                if (!conversationId || !assigneeId || !adminId) throw new Error('conversationId, assigneeId, and adminId are required.');
                const data = await ic('POST', `/conversations/${conversationId}/parts`, { type: 'admin', message_type: 'assignment', admin_id: adminId, assignee_id: assigneeId, assignee_type: assigneeType });
                return { output: { id: data.id } };
            }

            case 'closeConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const adminId = String(inputs.adminId ?? '').trim();
                if (!conversationId || !adminId) throw new Error('conversationId and adminId are required.');
                const data = await ic('POST', `/conversations/${conversationId}/parts`, { type: 'admin', message_type: 'close', admin_id: adminId });
                return { output: { state: 'closed' } };
            }

            case 'sendMessage': {
                const messageType = String(inputs.messageType ?? 'inapp').trim();
                const subject = String(inputs.subject ?? '').trim();
                const body_text = String(inputs.body ?? '').trim();
                const fromId = String(inputs.fromId ?? '').trim();
                const toId = String(inputs.toId ?? '').trim();
                const toType = String(inputs.toType ?? 'user').trim();
                if (!body_text || !fromId || !toId) throw new Error('body, fromId, and toId are required.');
                const msgBody: any = { message_type: messageType, subject: subject || undefined, body: body_text, from: { type: 'admin', id: fromId }, to: { type: toType, id: toId } };
                const data = await ic('POST', '/messages', msgBody);
                return { output: { id: data.id } };
            }

            case 'addTag': {
                const contactId = String(inputs.contactId ?? '').trim();
                const tagId = String(inputs.tagId ?? '').trim();
                if (!contactId || !tagId) throw new Error('contactId and tagId are required.');
                const data = await ic('POST', `/contacts/${contactId}/tags`, { id: tagId });
                return { output: { tagId: data.id, tagName: data.name } };
            }

            case 'searchContacts': {
                const query = inputs.query;
                if (!query) throw new Error('query is required.');
                const queryObj = typeof query === 'string' ? JSON.parse(query) : query;
                const data = await ic('POST', '/contacts/search', { query: queryObj });
                return { output: { contacts: data.data ?? [], total: data.total_count ?? 0 } };
            }

            default:
                return { error: `Intercom action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Intercom action failed.' };
    }
}
