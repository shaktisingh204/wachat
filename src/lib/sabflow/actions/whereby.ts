'use server';

export async function executeWherebyAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://api.whereby.dev/v1';

        const wherebyFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${inputs.apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Whereby API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createMeeting': {
                const data = await wherebyFetch('POST', '/meetings', {
                    endDate: inputs.endDate,
                    fields: inputs.fields,
                    isLocked: inputs.isLocked,
                    roomNamePrefix: inputs.roomNamePrefix,
                    roomMode: inputs.roomMode || 'normal',
                    startDate: inputs.startDate,
                    templateRoomId: inputs.templateRoomId,
                });
                return { output: data };
            }
            case 'getMeeting': {
                const data = await wherebyFetch('GET', `/meetings/${inputs.meetingId}`);
                return { output: data };
            }
            case 'deleteMeeting': {
                await wherebyFetch('DELETE', `/meetings/${inputs.meetingId}`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'listMeetings': {
                const qs = new URLSearchParams();
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                if (inputs.offset) qs.set('offset', String(inputs.offset));
                const data = await wherebyFetch('GET', `/meetings?${qs}`);
                return { output: data };
            }
            case 'createRoom': {
                const data = await wherebyFetch('POST', '/rooms', {
                    roomName: inputs.roomName,
                    isLocked: inputs.isLocked ?? false,
                    roomMode: inputs.roomMode || 'normal',
                    templateRoomId: inputs.templateRoomId,
                });
                return { output: data };
            }
            case 'getRoom': {
                const data = await wherebyFetch('GET', `/rooms/${inputs.roomName}`);
                return { output: data };
            }
            case 'updateRoom': {
                const data = await wherebyFetch('PATCH', `/rooms/${inputs.roomName}`, {
                    isLocked: inputs.isLocked,
                    roomMode: inputs.roomMode,
                });
                return { output: data };
            }
            case 'deleteRoom': {
                await wherebyFetch('DELETE', `/rooms/${inputs.roomName}`);
                return { output: { success: true, roomName: inputs.roomName } };
            }
            case 'listRooms': {
                const qs = new URLSearchParams();
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                if (inputs.offset) qs.set('offset', String(inputs.offset));
                const data = await wherebyFetch('GET', `/rooms?${qs}`);
                return { output: data };
            }
            case 'getOrganization': {
                const data = await wherebyFetch('GET', '/organization');
                return { output: data };
            }
            case 'updateOrganization': {
                const data = await wherebyFetch('PATCH', '/organization', inputs.settings);
                return { output: data };
            }
            case 'getRoomTheme': {
                const data = await wherebyFetch('GET', `/rooms/${inputs.roomName}/theme`);
                return { output: data };
            }
            case 'updateRoomTheme': {
                const data = await wherebyFetch('PUT', `/rooms/${inputs.roomName}/theme`, inputs.theme);
                return { output: data };
            }
            case 'listRecordings': {
                const qs = new URLSearchParams();
                if (inputs.roomName) qs.set('roomName', inputs.roomName);
                if (inputs.limit) qs.set('limit', String(inputs.limit));
                const data = await wherebyFetch('GET', `/recordings?${qs}`);
                return { output: data };
            }
            case 'deleteRecording': {
                await wherebyFetch('DELETE', `/recordings/${inputs.recordingId}`);
                return { output: { success: true, recordingId: inputs.recordingId } };
            }
            default:
                return { error: `Unknown Whereby action: ${actionName}` };
        }
    } catch (e: any) {
        logger.log(`Whereby action error: ${e.message}`);
        return { error: e.message };
    }
}
