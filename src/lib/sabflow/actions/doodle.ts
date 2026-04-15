'use server';

export async function executeDoodleAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = inputs.accessToken;
        const baseUrl = 'https://doodle.com/api/v2.0';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'createPoll': {
                const body = {
                    title: inputs.title,
                    type: inputs.type || 'date',
                    options: inputs.options || [],
                    timeZone: inputs.timeZone,
                    hidden: inputs.hidden || false,
                    inviteesCount: inputs.inviteesCount,
                };
                const res = await fetch(`${baseUrl}/polls`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `createPoll failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getPoll': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}`, { headers });
                if (!res.ok) return { error: `getPoll failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deletePoll': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `deletePoll failed: ${res.status} ${await res.text()}` };
                return { output: { success: true } };
            }
            case 'inviteParticipants': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}/invitees`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ participants: inputs.participants || [] }),
                });
                if (!res.ok) return { error: `inviteParticipants failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getInvitees': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}/invitees`, { headers });
                if (!res.ok) return { error: `getInvitees failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'vote': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}/participation`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        participantKey: inputs.participantKey,
                        options: inputs.options || [],
                    }),
                });
                if (!res.ok) return { error: `vote failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getResults': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}/participation`, { headers });
                if (!res.ok) return { error: `getResults failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'closePoll': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ closed: true }),
                });
                if (!res.ok) return { error: `closePoll failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listMyPolls': {
                const userKey = inputs.userKey;
                const res = await fetch(`${baseUrl}/polls?userKey=${userKey}`, { headers });
                if (!res.ok) return { error: `listMyPolls failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updatePoll': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.poll || {}),
                });
                if (!res.ok) return { error: `updatePoll failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getSurvey': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}?type=survey`, { headers });
                if (!res.ok) return { error: `getSurvey failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'addSurveyQuestion': {
                const pollId = inputs.pollId;
                const res = await fetch(`${baseUrl}/polls/${pollId}/survey`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.question || {}),
                });
                if (!res.ok) return { error: `addSurveyQuestion failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Unknown Doodle action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeDoodleAction error: ${err.message}`);
        return { error: err.message || 'Doodle action failed' };
    }
}
