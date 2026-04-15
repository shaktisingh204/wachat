'use server';

export async function executeIntercomV3Action(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        const BASE = 'https://api.intercom.io';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Intercom-Version': '2.10',
        };

        switch (actionName) {
            case 'listContacts': {
                const res = await fetch(`${BASE}/contacts?per_page=${inputs.perPage ?? 50}&page=${inputs.page ?? 1}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { contacts: data.data, total: data.total_count, pages: data.pages } };
            }

            case 'getContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const body: Record<string, any> = { role: inputs.role ?? 'user' };
                if (inputs.email) body.email = inputs.email;
                if (inputs.name) body.name = inputs.name;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.externalId) body.external_id = inputs.externalId;
                if (inputs.customAttributes) body.custom_attributes = inputs.customAttributes;
                const res = await fetch(`${BASE}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'updateContact': {
                const body: Record<string, any> = {};
                if (inputs.email) body.email = inputs.email;
                if (inputs.name) body.name = inputs.name;
                if (inputs.phone) body.phone = inputs.phone;
                if (inputs.customAttributes) body.custom_attributes = inputs.customAttributes;
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'deleteContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { deleted: true, id: inputs.contactId } };
            }

            case 'searchContacts': {
                const res = await fetch(`${BASE}/contacts/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: inputs.query,
                        pagination: { per_page: inputs.perPage ?? 50, page: inputs.page ?? 1 },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { contacts: data.data, total: data.total_count } };
            }

            case 'listConversations': {
                const params = new URLSearchParams({
                    per_page: String(inputs.perPage ?? 20),
                    page: String(inputs.page ?? 1),
                });
                if (inputs.open !== undefined) params.set('open', String(inputs.open));
                const res = await fetch(`${BASE}/conversations?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversations: data.conversations, total: data.total_count, pages: data.pages } };
            }

            case 'getConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'createConversation': {
                const res = await fetch(`${BASE}/conversations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        from: { type: inputs.fromType ?? 'user', id: inputs.fromId },
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'replyToConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/reply`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: inputs.messageType ?? 'comment',
                        type: inputs.type ?? 'admin',
                        admin_id: inputs.adminId,
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'assignConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/parts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: 'assignment',
                        type: 'admin',
                        admin_id: inputs.adminId,
                        assignee_id: inputs.assigneeId,
                        body: inputs.body ?? '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'closeConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/parts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: 'close',
                        type: 'admin',
                        admin_id: inputs.adminId,
                        body: inputs.body ?? '',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'listTags': {
                const res = await fetch(`${BASE}/tags`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { tags: data.data } };
            }

            case 'createTag': {
                const res = await fetch(`${BASE}/tags`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { tag: data } };
            }

            case 'tagContact': {
                const res = await fetch(`${BASE}/tags`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.tagName,
                        users: [{ id: inputs.contactId }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.errors?.[0]?.message || `API error: ${res.status}`);
                return { output: { tag: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
