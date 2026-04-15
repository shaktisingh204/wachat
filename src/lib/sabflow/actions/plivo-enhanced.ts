'use server';

export async function executePlivoEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const authId = inputs.authId || '';
    const authToken = inputs.authToken || '';
    const baseUrl = `https://api.plivo.com/v1/Account/${authId}`;
    const basicAuth = Buffer.from(`${authId}:${authToken}`).toString('base64');
    const headers: Record<string, string> = {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'sendSMS': {
                const res = await fetch(`${baseUrl}/Message/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ src: inputs.src, dst: inputs.dst, text: inputs.text }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'sendBulkSMS': {
                const destinations = Array.isArray(inputs.destinations) ? inputs.destinations.join('<') : inputs.destinations;
                const res = await fetch(`${baseUrl}/Message/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ src: inputs.src, dst: destinations, text: inputs.text }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'getCallDetails': {
                const res = await fetch(`${baseUrl}/Call/${inputs.callUuid}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/Call/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'makeCall': {
                const res = await fetch(`${baseUrl}/Call/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ from: inputs.from, to: inputs.to, answer_url: inputs.answerUrl, answer_method: inputs.answerMethod || 'GET' }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'hangUpCall': {
                const res = await fetch(`${baseUrl}/Call/${inputs.callUuid}/`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'transferCall': {
                const res = await fetch(`${baseUrl}/Call/${inputs.callUuid}/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ legs: inputs.legs || 'aleg', aleg_url: inputs.alegUrl, bleg_url: inputs.blegUrl }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listMessages': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/Message/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getMessage': {
                const res = await fetch(`${baseUrl}/Message/${inputs.messageUuid}/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listNumbers': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', inputs.limit);
                if (inputs.offset) params.set('offset', inputs.offset);
                const res = await fetch(`${baseUrl}/Number/?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getBuyNumber': {
                const res = await fetch(`${baseUrl}/PhoneNumber/${inputs.number}/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listApplications': {
                const res = await fetch(`${baseUrl}/Application/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createApplication': {
                const res = await fetch(`${baseUrl}/Application/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ app_name: inputs.appName, answer_url: inputs.answerUrl, hangup_url: inputs.hangupUrl }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listEndpoints': {
                const res = await fetch(`${baseUrl}/Endpoint/`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createEndpoint': {
                const res = await fetch(`${baseUrl}/Endpoint/`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ username: inputs.username, password: inputs.password, alias: inputs.alias }),
                });
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`PlivoEnhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
