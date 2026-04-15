'use server';

async function voFetch(apiId: string, apiKey: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[VictorOps] ${method} ${path}`);
    const url = `https://api.victorops.com/api-public/v1${path}`;
    const options: RequestInit = {
        method,
        headers: {
            'X-VO-Api-Id': apiId,
            'X-VO-Api-Key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.error || `VictorOps API error: ${res.status}`);
    }
    return data;
}

export async function executeVictorOpsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiId = String(inputs.apiId ?? '').trim();
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiId) throw new Error('apiId is required.');
        if (!apiKey) throw new Error('apiKey is required.');
        const vo = (method: string, path: string, body?: any) => voFetch(apiId, apiKey, method, path, body, logger);

        switch (actionName) {
            case 'getOnCallUser': {
                if (!inputs.team) throw new Error('team is required.');
                const data = await vo('GET', `/team/${inputs.team}/oncall/schedule`);
                return { output: data };
            }

            case 'getTeams': {
                const data = await vo('GET', '/team');
                return { output: data };
            }

            case 'getTeam': {
                if (!inputs.team) throw new Error('team is required.');
                const data = await vo('GET', `/team/${inputs.team}`);
                return { output: data };
            }

            case 'listSchedules': {
                if (!inputs.team) throw new Error('team is required.');
                const params = new URLSearchParams();
                if (inputs.daysForward) params.set('daysForward', String(inputs.daysForward));
                if (inputs.daysSkip) params.set('daysSkip', String(inputs.daysSkip));
                if (inputs.step) params.set('step', String(inputs.step));
                const data = await vo('GET', `/team/${inputs.team}/oncall/schedule?${params.toString()}`);
                return { output: data };
            }

            case 'getSchedule': {
                if (!inputs.team) throw new Error('team is required.');
                if (!inputs.scheduleSlug) throw new Error('scheduleSlug is required.');
                const data = await vo('GET', `/team/${inputs.team}/policies`);
                return { output: data };
            }

            case 'listPolicies': {
                const data = await vo('GET', '/policies');
                return { output: data };
            }

            case 'getPolicy': {
                if (!inputs.policy) throw new Error('policy is required.');
                const data = await vo('GET', `/policies/${inputs.policy}`);
                return { output: data };
            }

            case 'getIncidents': {
                const params = new URLSearchParams();
                if (inputs.currentPhase) params.set('currentPhase', inputs.currentPhase);
                if (inputs.limitFields) params.set('limitFields', inputs.limitFields);
                if (inputs.maxRows) params.set('maxRows', String(inputs.maxRows));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.entityId) params.set('entityId', inputs.entityId);
                const data = await vo('GET', `/incidents?${params.toString()}`);
                return { output: data };
            }

            case 'getIncident': {
                if (!inputs.incidentNumber) throw new Error('incidentNumber is required.');
                const data = await vo('GET', `/incidents/${inputs.incidentNumber}`);
                return { output: data };
            }

            case 'createIncident': {
                if (!inputs.summary) throw new Error('summary is required.');
                if (!inputs.userName) throw new Error('userName is required.');
                const body: any = {
                    summary: inputs.summary,
                    userName: inputs.userName,
                };
                if (inputs.details) body.details = inputs.details;
                if (inputs.targets) body.targets = typeof inputs.targets === 'string' ? JSON.parse(inputs.targets) : inputs.targets;
                const data = await vo('POST', '/incidents', body);
                return { output: data };
            }

            case 'acknowledgeIncident': {
                if (!inputs.incidentNumber) throw new Error('incidentNumber is required.');
                if (!inputs.userName) throw new Error('userName is required.');
                const body = {
                    userName: inputs.userName,
                    incidentNames: [inputs.incidentNumber],
                };
                const data = await vo('PATCH', '/incidents/ack', body);
                return { output: data };
            }

            case 'resolveIncident': {
                if (!inputs.incidentNumber) throw new Error('incidentNumber is required.');
                if (!inputs.userName) throw new Error('userName is required.');
                const body = {
                    userName: inputs.userName,
                    incidentNames: [inputs.incidentNumber],
                };
                const data = await vo('PATCH', '/incidents/resolve', body);
                return { output: data };
            }

            case 'listRoutingKeys': {
                const data = await vo('GET', '/org/routing-keys');
                return { output: data };
            }

            case 'createRoutingKey': {
                if (!inputs.routingKey) throw new Error('routingKey is required.');
                if (!inputs.targets) throw new Error('targets is required.');
                const body = {
                    routingKey: inputs.routingKey,
                    targets: typeof inputs.targets === 'string' ? JSON.parse(inputs.targets) : inputs.targets,
                };
                const data = await vo('POST', '/org/routing-keys', body);
                return { output: data };
            }

            case 'getWebhooks': {
                const data = await vo('GET', '/webhooks');
                return { output: data };
            }

            default:
                throw new Error(`Unknown VictorOps action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[VictorOps] Error: ${err.message}`);
        return { error: err.message || 'Unknown error' };
    }
}
