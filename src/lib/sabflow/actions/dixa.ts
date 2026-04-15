'use server';

export async function executeDixaAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const BASE = 'https://dev.dixa.io/v1';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listConversations': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.pageKey) params.set('page_key', inputs.pageKey);
                if (inputs.status) params.set('status', inputs.status);
                const res = await fetch(`${BASE}/conversations?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversations: data.data, nextPageKey: data.next_page_key } };
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
                const res = await fetch(`${BASE}/conversations`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        channel: inputs.channel ?? 'email',
                        direction: inputs.direction ?? 'inbound',
                        contact_endpoint: inputs.contactEndpoint,
                        subject: inputs.subject,
                        language: inputs.language ?? 'en',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'updateConversation': {
                const body: Record<string, any> = {};
                if (inputs.status !== undefined) body.status = inputs.status;
                if (inputs.assignedAgentId !== undefined) body.assigned_agent_id = inputs.assignedAgentId;
                if (inputs.assignedQueueId !== undefined) body.assigned_queue_id = inputs.assignedQueueId;
                if (inputs.tags !== undefined) body.tags = inputs.tags;
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { conversation: data } };
            }

            case 'listMessages': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/messages`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { messages: data.data } };
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

            case 'createMessage': {
                const res = await fetch(`${BASE}/conversations/${inputs.conversationId}/messages`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        message: inputs.message,
                        author_id: inputs.authorId,
                        direction: inputs.direction ?? 'outbound',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'listAgents': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.pageKey) params.set('page_key', inputs.pageKey);
                const res = await fetch(`${BASE}/agents?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { agents: data.data, nextPageKey: data.next_page_key } };
            }

            case 'getAgent': {
                const res = await fetch(`${BASE}/agents/${inputs.agentId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { agent: data } };
            }

            case 'listQueues': {
                const res = await fetch(`${BASE}/queues`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { queues: data.data } };
            }

            case 'getQueue': {
                const res = await fetch(`${BASE}/queues/${inputs.queueId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { queue: data } };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.pageKey) params.set('page_key', inputs.pageKey);
                const res = await fetch(`${BASE}/endusers?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data.data, nextPageKey: data.next_page_key } };
            }

            case 'getContact': {
                const res = await fetch(`${BASE}/endusers/${inputs.contactId}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'createContact': {
                const res = await fetch(`${BASE}/endusers`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        display_name: inputs.displayName,
                        email: inputs.email,
                        phone_number: inputs.phoneNumber,
                        external_id: inputs.externalId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contact: data } };
            }

            case 'searchContacts': {
                const params = new URLSearchParams();
                if (inputs.query) params.set('query', inputs.query);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${BASE}/endusers/search?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { contacts: data.data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
