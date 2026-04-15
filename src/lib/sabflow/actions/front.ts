'use server';

export async function executeFrontAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        const BASE = 'https://api2.frontapp.com';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                if (inputs.status) params.set('q', `is:${inputs.status}`);
                const res = await fetch(`${BASE}/conversations?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversations: data._results, pagination: data._pagination } };
            }

            case 'getConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'createConversation': {
                const res = await fetch(`${BASE}/inboxes/${inputs.inboxId}/imported_messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        sender: { handle: inputs.senderHandle },
                        to: inputs.to,
                        subject: inputs.subject,
                        body: inputs.body,
                        body_format: inputs.bodyFormat ?? 'html',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'archiveConversation': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ status: 'archived' }),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { archived: true, conversationId: inputs.conversationId } };
            }

            case 'listMessages': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/messages`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { messages: data._results, pagination: data._pagination } };
            }

            case 'getMessage': {
                const res = await fetch(`${BASE}/messages/${inputs.messageId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'sendMessage': {
                const res = await fetch(`${BASE}/channels/${inputs.channelId}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        author_id: inputs.authorId,
                        subject: inputs.subject,
                        body: inputs.body,
                        to: inputs.to,
                        cc: inputs.cc ?? [],
                        bcc: inputs.bcc ?? [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'replyToMessage': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        author_id: inputs.authorId,
                        body: inputs.body,
                        to: inputs.to ?? [],
                        cc: inputs.cc ?? [],
                        bcc: inputs.bcc ?? [],
                        channel_id: inputs.channelId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.pageToken) params.set('page_token', inputs.pageToken);
                const res = await fetch(`${BASE}/contacts?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data._results, pagination: data._pagination } };
            }

            case 'getContact': {
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const res = await fetch(`${BASE}/contacts`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        handles: inputs.handles ?? [],
                        links: inputs.links ?? [],
                        group_names: inputs.groupNames ?? [],
                        custom_fields: inputs.customFields ?? {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'updateContact': {
                const body: Record<string, any> = {};
                if (inputs.name !== undefined) body.name = inputs.name;
                if (inputs.description !== undefined) body.description = inputs.description;
                if (inputs.links !== undefined) body.links = inputs.links;
                if (inputs.customFields !== undefined) body.custom_fields = inputs.customFields;
                const res = await fetch(`${BASE}/contacts/${inputs.contactId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.message || `API error: ${res.status}`);
                }
                return { output: { updated: true, contactId: inputs.contactId } };
            }

            case 'listInboxes': {
                const res = await fetch(`${BASE}/inboxes`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { inboxes: data._results } };
            }

            case 'getInbox': {
                const res = await fetch(`${BASE}/inboxes/${inputs.inboxId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { inbox: data } };
            }

            case 'listTeammates': {
                const res = await fetch(`${BASE}/teammates`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { teammates: data._results } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
