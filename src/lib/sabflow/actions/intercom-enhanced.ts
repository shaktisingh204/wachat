'use server';

export async function executeIntercomEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://api.intercom.io';
    const token = inputs.accessToken;
    const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Intercom-Version': '2.11',
    };

    try {
        switch (actionName) {
            case 'createContact': {
                const res = await fetch(`${BASE}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        role: inputs.role || 'user',
                        email: inputs.email,
                        name: inputs.name,
                        phone: inputs.phone,
                        custom_attributes: inputs.customAttributes,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create contact' };
                return { output: data };
            }

            case 'getContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get contact' };
                return { output: data };
            }

            case 'updateContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        email: inputs.email,
                        name: inputs.name,
                        phone: inputs.phone,
                        custom_attributes: inputs.customAttributes,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to update contact' };
                return { output: data };
            }

            case 'searchContacts': {
                const res = await fetch(`${BASE}/contacts/search`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: inputs.query || { field: 'email', operator: '=', value: inputs.email },
                        pagination: { per_page: inputs.perPage || 25 },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to search contacts' };
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${BASE}/contacts?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list contacts' };
                return { output: data };
            }

            case 'createConversation': {
                const res = await fetch(`${BASE}/conversations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        from: { type: inputs.fromType || 'user', id: inputs.fromId },
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create conversation' };
                return { output: data };
            }

            case 'getConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to get conversation' };
                return { output: data };
            }

            case 'replyToConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/reply`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: inputs.messageType || 'comment',
                        type: inputs.type || 'admin',
                        admin_id: inputs.adminId,
                        intercom_user_id: inputs.intercomUserId,
                        body: inputs.body,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to reply to conversation' };
                return { output: data };
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
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to assign conversation' };
                return { output: data };
            }

            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.open !== undefined) params.set('open', String(inputs.open));
                const res = await fetch(`${BASE}/conversations?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list conversations' };
                return { output: data };
            }

            case 'createNote': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}/notes`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ body: inputs.body, admin_id: inputs.adminId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create note' };
                return { output: data };
            }

            case 'listNotes': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}/notes`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list notes' };
                return { output: data };
            }

            case 'sendOutboundEmail': {
                const res = await fetch(`${BASE}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message_type: 'email',
                        subject: inputs.subject,
                        body: inputs.body,
                        template: inputs.template || 'plain',
                        from: { type: 'admin', id: inputs.adminId },
                        to: { type: inputs.toType || 'user', id: inputs.toId },
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to send outbound email' };
                return { output: data };
            }

            case 'createEvent': {
                const res = await fetch(`${BASE}/events`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        event_name: inputs.eventName,
                        created_at: inputs.createdAt || Math.floor(Date.now() / 1000),
                        user_id: inputs.userId,
                        email: inputs.email,
                        metadata: inputs.metadata,
                    }),
                });
                if (res.status === 202) return { output: { success: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to create event' };
                return { output: data };
            }

            case 'listTags': {
                const res = await fetch(`${BASE}/tags`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.errors?.[0]?.message || 'Failed to list tags' };
                return { output: data };
            }

            default:
                return { error: `Unknown Intercom Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Intercom Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Intercom Enhanced action' };
    }
}
