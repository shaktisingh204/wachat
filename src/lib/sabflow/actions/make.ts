
'use server';

function getMakeBase(region?: string): string {
    const r = String(region ?? 'us').toLowerCase().trim();
    if (r === 'eu') return 'https://eu1.make.com/api/v2';
    return 'https://us1.make.com/api/v2';
}

async function makeFetch(apiKey: string, region: string | undefined, method: string, path: string, body?: any, logger?: any): Promise<any> {
    const base = getMakeBase(region);
    logger?.log(`[Make] ${method} ${base}${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Token ${apiKey}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${base}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || data?.detail || `Make API error: ${res.status}`);
    }
    return data;
}

export async function executeMakeAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const apiKey = String(inputs.apiKey ?? '').trim();
        if (!apiKey) throw new Error('apiKey is required.');
        const region = inputs.region;
        const make = (method: string, path: string, body?: any) => makeFetch(apiKey, region, method, path, body, logger);

        switch (actionName) {
            case 'listScenarios': {
                const teamId = inputs.teamId ? `?teamId=${encodeURIComponent(String(inputs.teamId))}` : '';
                const data = await make('GET', `/scenarios${teamId}`);
                return { output: { scenarios: data.scenarios ?? [], count: (data.scenarios ?? []).length } };
            }

            case 'getScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const data = await make('GET', `/scenarios/${scenarioId}`);
                return { output: { id: data.scenario?.id ?? scenarioId, name: data.scenario?.name ?? '', isActive: String(data.scenario?.isActive ?? false) } };
            }

            case 'activateScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const data = await make('POST', `/scenarios/${scenarioId}/activate`);
                return { output: { scenarioId, activated: 'true', isActive: String(data.scenario?.isActive ?? true) } };
            }

            case 'deactivateScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const data = await make('POST', `/scenarios/${scenarioId}/deactivate`);
                return { output: { scenarioId, deactivated: 'true', isActive: String(data.scenario?.isActive ?? false) } };
            }

            case 'runScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const body: any = { responsive: 1 };
                if (inputs.data) body.data = inputs.data;
                const data = await make('POST', `/scenarios/${scenarioId}/run`, body);
                return { output: { scenarioId, executionId: data.executionId ?? '', status: data.status ?? 'triggered' } };
            }

            case 'cloneScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const body: any = {};
                if (inputs.teamId) body.teamId = Number(inputs.teamId);
                const data = await make('POST', `/scenarios/${scenarioId}/clone`, body);
                return { output: { id: data.scenario?.id ?? '', name: data.scenario?.name ?? '' } };
            }

            case 'deleteScenario': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                await make('DELETE', `/scenarios/${scenarioId}`);
                return { output: { deleted: 'true', scenarioId } };
            }

            case 'listExecutions': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const limit = inputs.limit ? `&pg[limit]=${Number(inputs.limit)}` : '';
                const data = await make('GET', `/scenarios/${scenarioId}/logs?pg[sortBy]=id&pg[sortDir]=desc${limit}`);
                return { output: { executions: data.scenarioLogs ?? [], count: (data.scenarioLogs ?? []).length } };
            }

            case 'getExecution': {
                const executionId = String(inputs.executionId ?? '').trim();
                if (!executionId) throw new Error('executionId is required.');
                const data = await make('GET', `/logs/${executionId}`);
                return { output: { id: executionId, status: data.log?.status ?? '', duration: data.log?.duration ?? 0 } };
            }

            case 'triggerWebhook': {
                const webhookUrl = String(inputs.webhookUrl ?? '').trim();
                if (!webhookUrl) throw new Error('webhookUrl is required.');
                const payload = inputs.payload && typeof inputs.payload === 'object' ? inputs.payload : { data: inputs.payload ?? {} };
                logger?.log(`[Make] POST ${webhookUrl}`);
                const res = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const text = await res.text();
                let result: any = { raw: text };
                try { result = JSON.parse(text); } catch {}
                if (!res.ok) throw new Error(`Make webhook error: ${res.status} - ${text}`);
                return { output: { triggered: 'true', status: String(res.status), result } };
            }

            case 'listConnections': {
                const teamId = inputs.teamId ? `?teamId=${encodeURIComponent(String(inputs.teamId))}` : '';
                const data = await make('GET', `/connections${teamId}`);
                return { output: { connections: data.connections ?? [], count: (data.connections ?? []).length } };
            }

            case 'listTeams': {
                const organizationId = inputs.organizationId ? `?organizationId=${encodeURIComponent(String(inputs.organizationId))}` : '';
                const data = await make('GET', `/teams${organizationId}`);
                return { output: { teams: data.teams ?? [], count: (data.teams ?? []).length } };
            }

            case 'listUsers': {
                const teamId = inputs.teamId ? `?teamId=${encodeURIComponent(String(inputs.teamId))}` : '';
                const data = await make('GET', `/users${teamId}`);
                return { output: { users: data.users ?? [], count: (data.users ?? []).length } };
            }

            case 'getUsage': {
                const scenarioId = String(inputs.scenarioId ?? '').trim();
                if (!scenarioId) throw new Error('scenarioId is required.');
                const data = await make('GET', `/scenarios/${scenarioId}/usage`);
                return { output: { scenarioId, usage: data.usage ?? {}, operations: data.usage?.operations ?? 0 } };
            }

            default:
                return { error: `Make action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Make action failed.' };
    }
}
