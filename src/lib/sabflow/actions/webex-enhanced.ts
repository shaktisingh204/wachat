'use server';

export async function executeWebexEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE = 'https://webexapis.com/v1';
    const token = inputs.accessToken;

    try {
        switch (actionName) {
            case 'sendMessage': {
                const res = await fetch(`${BASE}/messages`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toPersonId: inputs.personId, text: inputs.text, markdown: inputs.markdown }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send message' };
                return { output: data };
            }

            case 'sendRoomMessage': {
                const res = await fetch(`${BASE}/messages`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: inputs.roomId, text: inputs.text, markdown: inputs.markdown }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send room message' };
                return { output: data };
            }

            case 'createRoom': {
                const res = await fetch(`${BASE}/rooms`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: inputs.title, teamId: inputs.teamId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create room' };
                return { output: data };
            }

            case 'listRooms': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.max) params.set('max', String(inputs.max));
                const res = await fetch(`${BASE}/rooms?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list rooms' };
                return { output: data };
            }

            case 'getRoomDetails': {
                const res = await fetch(`${BASE}/rooms/${inputs.roomId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get room details' };
                return { output: data };
            }

            case 'addMember': {
                const res = await fetch(`${BASE}/memberships`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ roomId: inputs.roomId, personEmail: inputs.personEmail, personId: inputs.personId, isModerator: inputs.isModerator }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to add member' };
                return { output: data };
            }

            case 'listMembers': {
                const params = new URLSearchParams({ roomId: inputs.roomId });
                if (inputs.max) params.set('max', String(inputs.max));
                const res = await fetch(`${BASE}/memberships?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list members' };
                return { output: data };
            }

            case 'removeMember': {
                const res = await fetch(`${BASE}/memberships/${inputs.membershipId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to remove member' };
                }
                return { output: { success: true } };
            }

            case 'sendDirectMessage': {
                const res = await fetch(`${BASE}/messages`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ toPersonEmail: inputs.personEmail, text: inputs.text, markdown: inputs.markdown }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to send direct message' };
                return { output: data };
            }

            case 'listMessages': {
                const params = new URLSearchParams({ roomId: inputs.roomId });
                if (inputs.max) params.set('max', String(inputs.max));
                if (inputs.before) params.set('before', inputs.before);
                const res = await fetch(`${BASE}/messages?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list messages' };
                return { output: data };
            }

            case 'deleteMessage': {
                const res = await fetch(`${BASE}/messages/${inputs.messageId}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` },
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    return { error: data.message || 'Failed to delete message' };
                }
                return { output: { success: true } };
            }

            case 'createMeeting': {
                const res = await fetch(`${BASE}/meetings`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: inputs.title,
                        start: inputs.start,
                        end: inputs.end,
                        invitees: inputs.invitees,
                        password: inputs.password,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create meeting' };
                return { output: data };
            }

            case 'getMeeting': {
                const res = await fetch(`${BASE}/meetings/${inputs.meetingId}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get meeting' };
                return { output: data };
            }

            case 'listMeetings': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.max) params.set('max', String(inputs.max));
                const res = await fetch(`${BASE}/meetings?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list meetings' };
                return { output: data };
            }

            case 'listPeople': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.displayName) params.set('displayName', inputs.displayName);
                if (inputs.max) params.set('max', String(inputs.max));
                const res = await fetch(`${BASE}/people?${params}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list people' };
                return { output: data };
            }

            default:
                return { error: `Unknown Webex Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Webex Enhanced action error: ${err.message}`);
        return { error: err.message || 'Unexpected error in Webex Enhanced action' };
    }
}
