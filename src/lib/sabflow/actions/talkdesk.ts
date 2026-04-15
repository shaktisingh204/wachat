'use server';

export async function executeTalkdeskAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    try {
        const base = 'https://api.talkdeskapp.com';

        switch (actionName) {
            case 'getToken': {
                const res = await fetch(`${base}/oauth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: new URLSearchParams({
                        grant_type: 'client_credentials',
                        client_id: inputs.clientId,
                        client_secret: inputs.clientSecret,
                    }).toString(),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listAgents': {
                const res = await fetch(`${base}/agents`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getAgent': {
                const res = await fetch(`${base}/agents/${inputs.agentId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listQueues': {
                const res = await fetch(`${base}/queues`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getQueue': {
                const res = await fetch(`${base}/queues/${inputs.queueId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listCalls': {
                const params = new URLSearchParams();
                if (inputs.from) params.set('from', inputs.from);
                if (inputs.to) params.set('to', inputs.to);
                if (inputs.page) params.set('page', inputs.page);
                const res = await fetch(`${base}/calls?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getCall': {
                const res = await fetch(`${base}/calls/${inputs.callId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'makeOutboundCall': {
                const res = await fetch(`${base}/calls`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        to: inputs.to,
                        from: inputs.from,
                        agent_id: inputs.agentId,
                        attributes: inputs.attributes || {},
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'hangUpCall': {
                const res = await fetch(`${base}/calls/${inputs.callId}/hangup`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'holdCall': {
                const res = await fetch(`${base}/calls/${inputs.callId}/hold`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'resumeCall': {
                const res = await fetch(`${base}/calls/${inputs.callId}/unhold`, {
                    method: 'POST',
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'transferCall': {
                const res = await fetch(`${base}/calls/${inputs.callId}/transfer`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        destination: inputs.destination,
                        destination_type: inputs.destinationType || 'agent',
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listContacts': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', inputs.page);
                if (inputs.per_page) params.set('per_page', inputs.per_page);
                const res = await fetch(`${base}/contacts?${params.toString()}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getContact': {
                const res = await fetch(`${base}/contacts/${inputs.contactId}`, {
                    headers: { Authorization: `Bearer ${inputs.accessToken}` },
                });
                const data = await res.json();
                return { output: data };
            }

            case 'createContact': {
                const res = await fetch(`${base}/contacts`, {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${inputs.accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        name: inputs.name,
                        phone: inputs.phone,
                        email: inputs.email,
                        company: inputs.company,
                        custom_attributes: inputs.customAttributes || {},
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Talkdesk action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Talkdesk action error: ${err.message}`);
        return { error: err.message || 'Talkdesk action failed' };
    }
}
