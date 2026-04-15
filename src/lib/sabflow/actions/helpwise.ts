'use server';

export async function executeHelpwiseAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');

        const BASE_URL = 'https://app.helpwise.io/api/v1';

        const hwFetch = async (method: string, path: string, body?: any) => {
            logger?.log(`[Helpwise] ${method} ${path}`);
            const options: RequestInit = {
                method,
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                },
            };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(`${BASE_URL}${path}`, options);
            if (res.status === 204) return {};
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || data?.error || `Helpwise API error: ${res.status}`);
            return data;
        };

        switch (actionName) {
            case 'listInboxes': {
                const data = await hwFetch('GET', '/inboxes');
                return { output: { inboxes: data.data ?? data ?? [], count: (data.data ?? data ?? []).length } };
            }

            case 'listConversations': {
                const inboxId = String(inputs.inboxId ?? '').trim();
                const page = Number(inputs.page ?? 1);
                const params = new URLSearchParams({ page: String(page) });
                if (inboxId) params.set('inbox_id', inboxId);
                if (inputs.status) params.set('status', String(inputs.status));
                const data = await hwFetch('GET', `/conversations?${params.toString()}`);
                return { output: { conversations: data.data ?? [], total: String(data.total ?? 0) } };
            }

            case 'getConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await hwFetch('GET', `/conversations/${conversationId}`);
                const conv = data.data ?? data;
                return { output: { id: String(conv.id ?? ''), subject: conv.subject ?? '', status: conv.status ?? '', assignee: conv.assignee?.name ?? '' } };
            }

            case 'createConversation': {
                const inboxId = String(inputs.inboxId ?? '').trim();
                const subject = String(inputs.subject ?? '').trim();
                if (!inboxId || !subject) throw new Error('inboxId and subject are required.');
                const body: any = { inbox_id: inboxId, subject };
                if (inputs.message) body.message = String(inputs.message);
                if (inputs.contactEmail) body.contact = { email: String(inputs.contactEmail) };
                const data = await hwFetch('POST', '/conversations', body);
                return { output: { id: String((data.data ?? data)?.id ?? ''), subject } };
            }

            case 'sendReply': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const message = String(inputs.message ?? '').trim();
                if (!conversationId || !message) throw new Error('conversationId and message are required.');
                const body: any = { message };
                if (inputs.private !== undefined) body.private = inputs.private === true || inputs.private === 'true';
                const data = await hwFetch('POST', `/conversations/${conversationId}/reply`, body);
                return { output: { id: String((data.data ?? data)?.id ?? ''), conversationId, sent: 'true' } };
            }

            case 'addNote': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const note = String(inputs.note ?? '').trim();
                if (!conversationId || !note) throw new Error('conversationId and note are required.');
                const data = await hwFetch('POST', `/conversations/${conversationId}/notes`, { note });
                return { output: { id: String((data.data ?? data)?.id ?? ''), conversationId } };
            }

            case 'assignConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const assigneeId = String(inputs.assigneeId ?? '').trim();
                if (!conversationId || !assigneeId) throw new Error('conversationId and assigneeId are required.');
                const data = await hwFetch('POST', `/conversations/${conversationId}/assign`, { assignee_id: assigneeId });
                return { output: { conversationId, assigneeId, assigned: 'true' } };
            }

            case 'reopenConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                const data = await hwFetch('POST', `/conversations/${conversationId}/reopen`);
                return { output: { conversationId, status: 'open' } };
            }

            case 'archiveConversation': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                if (!conversationId) throw new Error('conversationId is required.');
                await hwFetch('POST', `/conversations/${conversationId}/archive`);
                return { output: { conversationId, status: 'archived' } };
            }

            case 'listContacts': {
                const page = Number(inputs.page ?? 1);
                const data = await hwFetch('GET', `/contacts?page=${page}`);
                return { output: { contacts: data.data ?? [], total: String(data.total ?? 0) } };
            }

            case 'getContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const data = await hwFetch('GET', `/contacts/${contactId}`);
                const contact = data.data ?? data;
                return { output: { id: String(contact.id ?? ''), name: contact.name ?? '', email: contact.email ?? '', phone: contact.phone ?? '' } };
            }

            case 'createContact': {
                const name = String(inputs.name ?? '').trim();
                const email = String(inputs.email ?? '').trim();
                if (!name || !email) throw new Error('name and email are required.');
                const body: any = { name, email };
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await hwFetch('POST', '/contacts', body);
                return { output: { id: String((data.data ?? data)?.id ?? ''), name, email } };
            }

            case 'updateContact': {
                const contactId = String(inputs.contactId ?? '').trim();
                if (!contactId) throw new Error('contactId is required.');
                const body: any = {};
                if (inputs.name) body.name = String(inputs.name);
                if (inputs.email) body.email = String(inputs.email);
                if (inputs.phone) body.phone = String(inputs.phone);
                const data = await hwFetch('PUT', `/contacts/${contactId}`, body);
                return { output: { id: contactId, updated: 'true' } };
            }

            case 'listTags': {
                const data = await hwFetch('GET', '/tags');
                return { output: { tags: data.data ?? data ?? [] } };
            }

            case 'addTag': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!conversationId || !tag) throw new Error('conversationId and tag are required.');
                const data = await hwFetch('POST', `/conversations/${conversationId}/tags`, { tag });
                return { output: { conversationId, tag, added: 'true' } };
            }

            case 'removeTag': {
                const conversationId = String(inputs.conversationId ?? '').trim();
                const tag = String(inputs.tag ?? '').trim();
                if (!conversationId || !tag) throw new Error('conversationId and tag are required.');
                await hwFetch('DELETE', `/conversations/${conversationId}/tags/${encodeURIComponent(tag)}`);
                return { output: { conversationId, tag, removed: 'true' } };
            }

            case 'listTeamMembers': {
                const data = await hwFetch('GET', '/team-members');
                return { output: { members: data.data ?? data ?? [], count: (data.data ?? data ?? []).length } };
            }

            default:
                return { error: `Helpwise action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Helpwise action failed.' };
    }
}
