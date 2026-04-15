'use server';

export async function executeChantyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        const baseUrl = 'https://api.chanty.com/v1';

        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${baseUrl}/teambook/channels/${inputs.channelId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: inputs.message,
                        attachments: inputs.attachments || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'listTeams': {
                const res = await fetch(`${baseUrl}/teambook/teams`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { teams: data } };
            }

            case 'getTeam': {
                const res = await fetch(`${baseUrl}/teambook/teams/${inputs.teamId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { team: data } };
            }

            case 'listChannels': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('team_id', inputs.teamId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString();
                const res = await fetch(`${baseUrl}/teambook/channels${query ? `?${query}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { channels: data } };
            }

            case 'getChannel': {
                const res = await fetch(`${baseUrl}/teambook/channels/${inputs.channelId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { channel: data } };
            }

            case 'createChannel': {
                const res = await fetch(`${baseUrl}/teambook/channels`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: inputs.name,
                        type: inputs.type || 'public',
                        team_id: inputs.teamId,
                        members: inputs.members || [],
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { channel: data } };
            }

            case 'listMembers': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('team_id', inputs.teamId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString();
                const res = await fetch(`${baseUrl}/teambook/members${query ? `?${query}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { members: data } };
            }

            case 'getMember': {
                const res = await fetch(`${baseUrl}/teambook/members/${inputs.memberId}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { member: data } };
            }

            case 'sendDirectMessage': {
                const res = await fetch(`${baseUrl}/teambook/dm`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        recipient_id: inputs.recipientId,
                        message: inputs.message,
                        team_id: inputs.teamId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }

            case 'listMessages': {
                const params = new URLSearchParams({ limit: String(inputs.limit || 50) });
                if (inputs.before) params.set('before', inputs.before);
                if (inputs.after) params.set('after', inputs.after);
                const res = await fetch(`${baseUrl}/teambook/channels/${inputs.channelId}/messages?${params}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { messages: data } };
            }

            case 'searchMessages': {
                const params = new URLSearchParams({ query: inputs.query });
                if (inputs.channelId) params.set('channel_id', inputs.channelId);
                if (inputs.teamId) params.set('team_id', inputs.teamId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const res = await fetch(`${baseUrl}/teambook/search/messages?${params}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { results: data } };
            }

            case 'uploadFile': {
                const res = await fetch(`${baseUrl}/teambook/files`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        channel_id: inputs.channelId,
                        filename: inputs.filename,
                        content: inputs.content,
                        content_type: inputs.contentType || 'text/plain',
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { file: data } };
            }

            case 'createTask': {
                const res = await fetch(`${baseUrl}/teambook/tasks`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        assignee_id: inputs.assigneeId,
                        due_date: inputs.dueDate,
                        team_id: inputs.teamId,
                        channel_id: inputs.channelId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { task: data } };
            }

            case 'listTasks': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('team_id', inputs.teamId);
                if (inputs.assigneeId) params.set('assignee_id', inputs.assigneeId);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString();
                const res = await fetch(`${baseUrl}/teambook/tasks${query ? `?${query}` : ''}`, {
                    headers: { 'Authorization': `Bearer ${apiKey}` },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { tasks: data } };
            }

            case 'updateTask': {
                const res = await fetch(`${baseUrl}/teambook/tasks/${inputs.taskId}`, {
                    method: 'PATCH',
                    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        description: inputs.description,
                        assignee_id: inputs.assigneeId,
                        due_date: inputs.dueDate,
                        status: inputs.status,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error || data?.message || `API error: ${res.status}`);
                return { output: { task: data } };
            }

            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
