'use server';

export async function executeChimeAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const BASE = 'https://service.chime.aws.amazon.com';

        const chimeFetch = async (method: string, path: string, body?: any) => {
            const res = await fetch(`${BASE}${path}`, {
                method,
                headers: {
                    Authorization: `Bearer ${inputs.accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: body ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Chime API error ${res.status}: ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'createMeeting': {
                const body: any = {
                    ClientRequestToken: inputs.clientRequestToken || `sabflow-${Date.now()}`,
                    MediaRegion: inputs.mediaRegion || 'us-east-1',
                    ExternalMeetingId: inputs.externalMeetingId,
                    MeetingFeatures: inputs.meetingFeatures,
                    NotificationsConfiguration: inputs.notificationsConfiguration,
                    Tags: inputs.tags,
                };
                const data = await chimeFetch('POST', '/meetings', body);
                return { output: data };
            }
            case 'getMeeting': {
                const data = await chimeFetch('GET', `/meetings/${inputs.meetingId}`);
                return { output: data };
            }
            case 'deleteMeeting': {
                await chimeFetch('DELETE', `/meetings/${inputs.meetingId}`);
                return { output: { success: true, meetingId: inputs.meetingId } };
            }
            case 'createAttendee': {
                const body: any = {
                    ExternalUserId: inputs.externalUserId,
                    Capabilities: inputs.capabilities,
                    Tags: inputs.tags,
                };
                const data = await chimeFetch('POST', `/meetings/${inputs.meetingId}/attendees`, body);
                return { output: data };
            }
            case 'getAttendee': {
                const data = await chimeFetch('GET', `/meetings/${inputs.meetingId}/attendees/${inputs.attendeeId}`);
                return { output: data };
            }
            case 'deleteAttendee': {
                await chimeFetch('DELETE', `/meetings/${inputs.meetingId}/attendees/${inputs.attendeeId}`);
                return { output: { success: true, attendeeId: inputs.attendeeId } };
            }
            case 'listAttendees': {
                const params = new URLSearchParams();
                if (inputs.maxResults) params.set('max-results', inputs.maxResults);
                if (inputs.nextToken) params.set('next-token', inputs.nextToken);
                const data = await chimeFetch('GET', `/meetings/${inputs.meetingId}/attendees?${params}`);
                return { output: data };
            }
            case 'createChannel': {
                const body: any = {
                    AppInstanceArn: inputs.appInstanceArn,
                    Name: inputs.name,
                    Mode: inputs.mode || 'UNRESTRICTED',
                    Privacy: inputs.privacy || 'PUBLIC',
                    Metadata: inputs.metadata,
                    ClientRequestToken: inputs.clientRequestToken || `sabflow-${Date.now()}`,
                    Tags: inputs.tags,
                };
                const data = await chimeFetch('POST', '/channels', body);
                return { output: data };
            }
            case 'deleteChannel': {
                await chimeFetch('DELETE', `/channels/${encodeURIComponent(inputs.channelArn)}`);
                return { output: { success: true, channelArn: inputs.channelArn } };
            }
            case 'sendChannelMessage': {
                const body: any = {
                    Content: inputs.content,
                    Type: inputs.type || 'STANDARD',
                    Persistence: inputs.persistence || 'PERSISTENT',
                    Metadata: inputs.metadata,
                    ClientRequestToken: inputs.clientRequestToken || `sabflow-${Date.now()}`,
                };
                const data = await chimeFetch('POST', `/channels/${encodeURIComponent(inputs.channelArn)}/messages`, body);
                return { output: data };
            }
            case 'listChannelMessages': {
                const params = new URLSearchParams();
                if (inputs.sortOrder) params.set('sort-order', inputs.sortOrder);
                if (inputs.notBefore) params.set('not-before', inputs.notBefore);
                if (inputs.notAfter) params.set('not-after', inputs.notAfter);
                if (inputs.maxResults) params.set('max-results', inputs.maxResults);
                if (inputs.nextToken) params.set('next-token', inputs.nextToken);
                const data = await chimeFetch('GET', `/channels/${encodeURIComponent(inputs.channelArn)}/messages?${params}`);
                return { output: data };
            }
            case 'createRoom': {
                const body: any = {
                    Name: inputs.name,
                    ClientRequestToken: inputs.clientRequestToken || `sabflow-${Date.now()}`,
                };
                const data = await chimeFetch('POST', `/accounts/${inputs.accountId}/rooms`, body);
                return { output: data };
            }
            case 'deleteRoom': {
                await chimeFetch('DELETE', `/accounts/${inputs.accountId}/rooms/${inputs.roomId}`);
                return { output: { success: true, roomId: inputs.roomId } };
            }
            case 'createRoomMembership': {
                const body: any = {
                    MemberId: inputs.memberId,
                    Role: inputs.role || 'Member',
                };
                const data = await chimeFetch('POST', `/accounts/${inputs.accountId}/rooms/${inputs.roomId}/memberships`, body);
                return { output: data };
            }
            case 'deleteRoomMembership': {
                await chimeFetch('DELETE', `/accounts/${inputs.accountId}/rooms/${inputs.roomId}/memberships/${inputs.memberId}`);
                return { output: { success: true, memberId: inputs.memberId } };
            }
            default:
                return { error: `Chime: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Chime action error: ${err.message}`);
        return { error: err.message };
    }
}
