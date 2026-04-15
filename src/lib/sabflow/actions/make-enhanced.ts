'use server';

export async function executeMakeEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const BASE_URL = (inputs.baseUrl || 'https://us2.make.com/api/v2').replace(/\/$/, '');

    const headers = {
        Authorization: `Token ${inputs.apiKey}`,
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listScenarios': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', String(inputs.teamId));
                if (inputs.folderId) params.set('folderId', String(inputs.folderId));
                if (inputs.pg) params.set('pg', String(inputs.pg));
                const res = await fetch(`${BASE_URL}/scenarios?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list scenarios' };
                return { output: data };
            }

            case 'getScenario': {
                const res = await fetch(`${BASE_URL}/scenarios/${inputs.scenarioId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get scenario' };
                return { output: data };
            }

            case 'createScenario': {
                const body: Record<string, any> = {
                    teamId: inputs.teamId,
                    name: inputs.name,
                };
                if (inputs.blueprint) body.blueprint = inputs.blueprint;
                if (inputs.folderId) body.folderId = inputs.folderId;
                if (inputs.scheduling) body.scheduling = inputs.scheduling;
                const res = await fetch(`${BASE_URL}/scenarios`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create scenario' };
                return { output: data };
            }

            case 'runScenario': {
                const res = await fetch(`${BASE_URL}/scenarios/${inputs.scenarioId}/run`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ responsive: inputs.responsive !== false }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to run scenario' };
                return { output: data };
            }

            case 'stopScenario': {
                const res = await fetch(`${BASE_URL}/scenarios/${inputs.scenarioId}/stop`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to stop scenario' };
                return { output: data };
            }

            case 'deleteScenario': {
                const res = await fetch(`${BASE_URL}/scenarios/${inputs.scenarioId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete scenario' };
                return { output: data };
            }

            case 'listConnections': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', String(inputs.teamId));
                const res = await fetch(`${BASE_URL}/connections?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list connections' };
                return { output: data };
            }

            case 'getConnection': {
                const res = await fetch(`${BASE_URL}/connections/${inputs.connectionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get connection' };
                return { output: data };
            }

            case 'createConnection': {
                const res = await fetch(`${BASE_URL}/connections`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        teamId: inputs.teamId,
                        accountName: inputs.accountName,
                        accountType: inputs.accountType,
                        data: inputs.data || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create connection' };
                return { output: data };
            }

            case 'deleteConnection': {
                const res = await fetch(`${BASE_URL}/connections/${inputs.connectionId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to delete connection' };
                return { output: data };
            }

            case 'listTeams': {
                const params = new URLSearchParams();
                if (inputs.organizationId) params.set('organizationId', String(inputs.organizationId));
                const res = await fetch(`${BASE_URL}/teams?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list teams' };
                return { output: data };
            }

            case 'listOrganizations': {
                const res = await fetch(`${BASE_URL}/organizations`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list organizations' };
                return { output: data };
            }

            case 'getOrganization': {
                const res = await fetch(`${BASE_URL}/organizations/${inputs.organizationId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get organization' };
                return { output: data };
            }

            case 'listHooks': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', String(inputs.teamId));
                const res = await fetch(`${BASE_URL}/hooks?${params}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list hooks' };
                return { output: data };
            }

            case 'createHook': {
                const res = await fetch(`${BASE_URL}/hooks`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        teamId: inputs.teamId,
                        name: inputs.name,
                        type: inputs.type || 'web',
                        data: inputs.data || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create hook' };
                return { output: data };
            }

            default:
                return { error: `Unknown Make (Enhanced) action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Make Enhanced action error: ${err.message}`);
        return { error: err.message || 'Make Enhanced action failed' };
    }
}
