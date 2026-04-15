'use server';

export async function executeTwilioVideoAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accountSid = inputs.accountSid;
        const authToken = inputs.authToken;
        const basicAuth = Buffer.from(accountSid + ':' + authToken).toString('base64');
        const baseUrl = 'https://video.twilio.com/v1';

        const headers: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
        };

        const jsonHeaders: Record<string, string> = {
            'Authorization': `Basic ${basicAuth}`,
            'Accept': 'application/json',
        };

        function toFormData(obj: Record<string, any>): string {
            return Object.entries(obj)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join('&');
        }

        switch (actionName) {
            case 'listRooms': {
                const params = new URLSearchParams();
                if (inputs.status) params.append('Status', inputs.status);
                if (inputs.uniqueName) params.append('UniqueName', inputs.uniqueName);
                if (inputs.pageSize) params.append('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Rooms?${params.toString()}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getRoom': {
                const roomSid = inputs.roomSid;
                const res = await fetch(`${baseUrl}/Rooms/${roomSid}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: { room: await res.json() } };
            }

            case 'createRoom': {
                const body: Record<string, any> = {};
                if (inputs.uniqueName) body['UniqueName'] = inputs.uniqueName;
                if (inputs.type) body['Type'] = inputs.type;
                if (inputs.maxParticipants) body['MaxParticipants'] = inputs.maxParticipants;
                if (inputs.recordParticipantsOnConnect !== undefined) body['RecordParticipantsOnConnect'] = inputs.recordParticipantsOnConnect;
                if (inputs.statusCallback) body['StatusCallback'] = inputs.statusCallback;
                const res = await fetch(`${baseUrl}/Rooms`, {
                    method: 'POST',
                    headers,
                    body: toFormData(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { room: await res.json() } };
            }

            case 'completeRoom': {
                const roomSid = inputs.roomSid;
                const res = await fetch(`${baseUrl}/Rooms/${roomSid}`, {
                    method: 'POST',
                    headers,
                    body: toFormData({ Status: 'completed' }),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { room: await res.json() } };
            }

            case 'listParticipants': {
                const roomSid = inputs.roomSid;
                const params = new URLSearchParams();
                if (inputs.status) params.append('Status', inputs.status);
                if (inputs.identity) params.append('Identity', inputs.identity);
                const res = await fetch(`${baseUrl}/Rooms/${roomSid}/Participants?${params.toString()}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getParticipant': {
                const roomSid = inputs.roomSid;
                const participantSid = inputs.participantSid;
                const res = await fetch(`${baseUrl}/Rooms/${roomSid}/Participants/${participantSid}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: { participant: await res.json() } };
            }

            case 'listRecordings': {
                const params = new URLSearchParams();
                if (inputs.status) params.append('Status', inputs.status);
                if (inputs.sourceSid) params.append('SourceSid', inputs.sourceSid);
                if (inputs.groupingSid) params.append('GroupingSid', inputs.groupingSid);
                if (inputs.pageSize) params.append('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Recordings?${params.toString()}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getRecording': {
                const recordingSid = inputs.recordingSid;
                const res = await fetch(`${baseUrl}/Recordings/${recordingSid}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: { recording: await res.json() } };
            }

            case 'deleteRecording': {
                const recordingSid = inputs.recordingSid;
                const res = await fetch(`${baseUrl}/Recordings/${recordingSid}`, {
                    method: 'DELETE',
                    headers: jsonHeaders,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, recordingSid } };
            }

            case 'listCompositions': {
                const params = new URLSearchParams();
                if (inputs.status) params.append('Status', inputs.status);
                if (inputs.roomSid) params.append('RoomSid', inputs.roomSid);
                if (inputs.pageSize) params.append('PageSize', String(inputs.pageSize));
                const res = await fetch(`${baseUrl}/Compositions?${params.toString()}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'getComposition': {
                const compositionSid = inputs.compositionSid;
                const res = await fetch(`${baseUrl}/Compositions/${compositionSid}`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: { composition: await res.json() } };
            }

            case 'createComposition': {
                const body: Record<string, any> = {
                    RoomSid: inputs.roomSid,
                };
                if (inputs.audioSources) body['AudioSources'] = inputs.audioSources;
                if (inputs.videoLayout) body['VideoLayout'] = JSON.stringify(inputs.videoLayout);
                if (inputs.resolution) body['Resolution'] = inputs.resolution;
                if (inputs.format) body['Format'] = inputs.format;
                if (inputs.statusCallback) body['StatusCallback'] = inputs.statusCallback;
                const res = await fetch(`${baseUrl}/Compositions`, {
                    method: 'POST',
                    headers,
                    body: toFormData(body),
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { composition: await res.json() } };
            }

            case 'deleteComposition': {
                const compositionSid = inputs.compositionSid;
                const res = await fetch(`${baseUrl}/Compositions/${compositionSid}`, {
                    method: 'DELETE',
                    headers: jsonHeaders,
                });
                if (!res.ok) return { error: await res.text() };
                return { output: { success: true, compositionSid } };
            }

            case 'listTracks': {
                const roomSid = inputs.roomSid;
                const participantSid = inputs.participantSid;
                const params = new URLSearchParams();
                if (inputs.kind) params.append('Kind', inputs.kind);
                const res = await fetch(
                    `${baseUrl}/Rooms/${roomSid}/Participants/${participantSid}/PublishedTracks?${params.toString()}`,
                    { headers: jsonHeaders }
                );
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            case 'listRecordingRules': {
                const roomSid = inputs.roomSid;
                const res = await fetch(`${baseUrl}/Rooms/${roomSid}/RecordingRules`, { headers: jsonHeaders });
                if (!res.ok) return { error: await res.text() };
                return { output: await res.json() };
            }

            default:
                return { error: `Unknown Twilio Video action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Twilio Video action error: ${err.message}`);
        return { error: err.message || 'Twilio Video action failed' };
    }
}
