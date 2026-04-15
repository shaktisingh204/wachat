'use server';

export async function executeDailyCoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.daily.co/v1';

        const dailyFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${inputs.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Daily.co API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createRoom': {
                const data = await dailyFetch('POST', '/rooms', {
                    name: inputs.name,
                    privacy: inputs.privacy || 'public',
                    properties: inputs.properties,
                });
                return { output: data };
            }
            case 'getRoom': {
                const data = await dailyFetch('GET', `/rooms/${inputs.name}`);
                return { output: data };
            }
            case 'updateRoom': {
                const data = await dailyFetch('POST', `/rooms/${inputs.name}`, {
                    privacy: inputs.privacy,
                    properties: inputs.properties,
                });
                return { output: data };
            }
            case 'deleteRoom': {
                await dailyFetch('DELETE', `/rooms/${inputs.name}`);
                return { output: { success: true, name: inputs.name } };
            }
            case 'listRooms': {
                const qs = new URLSearchParams();
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                if (inputs.endingBefore) qs.set('ending_before', inputs.endingBefore);
                const data = await dailyFetch('GET', `/rooms?${qs}`);
                return { output: data };
            }
            case 'createMeetingToken': {
                const data = await dailyFetch('POST', '/meeting-tokens', {
                    properties: {
                        room_name: inputs.roomName,
                        user_name: inputs.userName,
                        user_id: inputs.userId,
                        is_owner: inputs.isOwner ?? false,
                        enable_recording: inputs.enableRecording,
                        exp: inputs.exp,
                        nbf: inputs.nbf,
                        eject_at_token_exp: inputs.ejectAtTokenExp,
                        close_tab_on_exit: inputs.closeTabOnExit,
                    },
                });
                return { output: data };
            }
            case 'listMeetings': {
                const qs = new URLSearchParams();
                if (inputs.room) qs.set('room', inputs.room);
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await dailyFetch('GET', `/meetings?${qs}`);
                return { output: data };
            }
            case 'getMeeting': {
                const data = await dailyFetch('GET', `/meetings/${inputs.meetingId}`);
                return { output: data };
            }
            case 'getMeetingParticipants': {
                const qs = new URLSearchParams();
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await dailyFetch('GET', `/meetings/${inputs.meetingId}/participants?${qs}`);
                return { output: data };
            }
            case 'listDomains': {
                const data = await dailyFetch('GET', '/domains');
                return { output: data };
            }
            case 'getDomainConfig': {
                const data = await dailyFetch('GET', '/domains/me');
                return { output: data };
            }
            case 'updateDomainConfig': {
                const data = await dailyFetch('POST', '/domains/me', inputs.config);
                return { output: data };
            }
            case 'listRecordings': {
                const qs = new URLSearchParams();
                if (inputs.roomName) qs.set('room_name', inputs.roomName);
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await dailyFetch('GET', `/recordings?${qs}`);
                return { output: data };
            }
            case 'getRecording': {
                const data = await dailyFetch('GET', `/recordings/${inputs.recordingId}`);
                return { output: data };
            }
            case 'deleteRecording': {
                await dailyFetch('DELETE', `/recordings/${inputs.recordingId}`);
                return { output: { success: true, recordingId: inputs.recordingId } };
            }
            default:
                return { error: `Unknown Daily.co action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`Daily.co action error: ${e.message}`);
        return { error: e.message };
    }
}
