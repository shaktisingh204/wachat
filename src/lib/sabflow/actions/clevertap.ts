'use server';

export async function executeCleverTapAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = 'https://api.clevertap.com/1';
        const headers: Record<string, string> = {
            'X-CleverTap-Account-Id': inputs.accountId,
            'X-CleverTap-Passcode': inputs.passcode,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'uploadProfile': {
                const profileData = inputs.profileData || {};
                const res = await fetch(`${baseUrl}/upload`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        d: [{
                            identity: inputs.identity,
                            type: 'profile',
                            profileData,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to upload profile' };
                return { output: data };
            }

            case 'uploadEvent': {
                const evtData = inputs.evtData || {};
                const res = await fetch(`${baseUrl}/upload`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        d: [{
                            identity: inputs.identity,
                            type: 'event',
                            evtName: inputs.evtName,
                            evtData,
                        }],
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to upload event' };
                return { output: data };
            }

            case 'getProfile': {
                const params = new URLSearchParams();
                if (inputs.email) params.set('email', inputs.email);
                if (inputs.identity) params.set('identity', inputs.identity);
                const res = await fetch(`${baseUrl}/profile.json?${params.toString()}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get profile' };
                return { output: data };
            }

            case 'getCampaigns': {
                const res = await fetch(`${baseUrl}/campaigns.json`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get campaigns' };
                return { output: data };
            }

            case 'getCampaignStats': {
                const res = await fetch(`${baseUrl}/campaign.json?id=${encodeURIComponent(inputs.id)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get campaign stats' };
                return { output: data };
            }

            case 'listSegments': {
                const res = await fetch(`${baseUrl}/segments.json`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list segments' };
                return { output: data };
            }

            case 'getSegment': {
                const res = await fetch(`${baseUrl}/segment.json?id=${encodeURIComponent(inputs.id)}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to get segment' };
                return { output: data };
            }

            case 'listEvents': {
                const res = await fetch(`${baseUrl}/events.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        from: inputs.from,
                        to: inputs.to,
                        event_name: inputs.eventName,
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list events' };
                return { output: data };
            }

            case 'sendPush': {
                const res = await fetch(`${baseUrl}/push.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        target: { identity: inputs.identities || [] },
                        content: { title: inputs.title, body: inputs.body },
                        platform: inputs.platform || 'all',
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to send push' };
                return { output: data };
            }

            case 'sendSms': {
                const res = await fetch(`${baseUrl}/sms.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to send SMS' };
                return { output: data };
            }

            case 'sendEmail': {
                const res = await fetch(`${baseUrl}/email.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to send email' };
                return { output: data };
            }

            case 'createCampaign': {
                const res = await fetch(`${baseUrl}/campaign.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.payload || {}),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to create campaign' };
                return { output: data };
            }

            case 'listProfiles': {
                const res = await fetch(`${baseUrl}/profiles.json`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ filter: inputs.filter || {} }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.status || 'Failed to list profiles' };
                return { output: data };
            }

            default:
                return { error: `Unknown CleverTap action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`CleverTap action error: ${err.message}`);
        return { error: err.message || 'CleverTap action failed' };
    }
}
