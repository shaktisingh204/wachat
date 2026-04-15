'use server';

export async function executeMicrosoftTeamsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        switch (actionName) {
            case 'listTeams': {
                const res = await fetch('https://graph.microsoft.com/v1.0/me/joinedTeams', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { teams: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getTeam': {
                const teamId = String(inputs.teamId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { team: data } };
            }
            case 'createTeam': {
                const body = {
                    displayName: String(inputs.displayName ?? ''),
                    description: String(inputs.description ?? ''),
                    visibility: inputs.visibility ?? 'Private',
                    'template@odata.bind': "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
                };
                const res = await fetch('https://graph.microsoft.com/v1.0/teams', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                if (res.status === 202) {
                    const location = res.headers.get('Location') ?? '';
                    return { output: { status: 'provisioning', location } };
                }
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { team: data } };
            }
            case 'listChannels': {
                const teamId = String(inputs.teamId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { channels: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { channel: data } };
            }
            case 'createChannel': {
                const teamId = String(inputs.teamId ?? '').trim();
                const body = {
                    displayName: String(inputs.displayName ?? ''),
                    description: String(inputs.description ?? ''),
                    membershipType: inputs.membershipType ?? 'standard',
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { channel: data } };
            }
            case 'sendChannelMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const body = {
                    body: {
                        contentType: inputs.contentType ?? 'text',
                        content: String(inputs.content ?? ''),
                    },
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }
            case 'listMessages': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const top = inputs.top ? `?$top=${inputs.top}` : '';
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages${top}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { messages: data.value, count: data.value?.length ?? 0 } };
            }
            case 'getMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages/${messageId}`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { message: data } };
            }
            case 'replyToMessage': {
                const teamId = String(inputs.teamId ?? '').trim();
                const channelId = String(inputs.channelId ?? '').trim();
                const messageId = String(inputs.messageId ?? '').trim();
                const body = {
                    body: {
                        contentType: inputs.contentType ?? 'text',
                        content: String(inputs.content ?? ''),
                    },
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { reply: data } };
            }
            case 'listMembers': {
                const teamId = String(inputs.teamId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/members`, {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { members: data.value, count: data.value?.length ?? 0 } };
            }
            case 'addMember': {
                const teamId = String(inputs.teamId ?? '').trim();
                const userId = String(inputs.userId ?? '').trim();
                const body = {
                    '@odata.type': '#microsoft.graph.aadUserConversationMember',
                    roles: inputs.roles ?? [],
                    'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userId}`,
                };
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/members`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { member: data } };
            }
            case 'removeMember': {
                const teamId = String(inputs.teamId ?? '').trim();
                const membershipId = String(inputs.membershipId ?? '').trim();
                const res = await fetch(`https://graph.microsoft.com/v1.0/teams/${teamId}/members/${membershipId}`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.error?.message || `API error: ${res.status}`);
                }
                return { output: { success: true, membershipId } };
            }
            case 'createMeeting': {
                const body: Record<string, any> = {
                    subject: String(inputs.subject ?? ''),
                    startDateTime: String(inputs.startDateTime ?? ''),
                    endDateTime: String(inputs.endDateTime ?? ''),
                };
                if (inputs.participants) body.participants = inputs.participants;
                const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { meeting: data } };
            }
            case 'listMeetings': {
                const res = await fetch('https://graph.microsoft.com/v1.0/me/onlineMeetings', {
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { meetings: data.value, count: data.value?.length ?? 0 } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
