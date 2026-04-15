'use server';

const BASE_URL = 'https://api.render.com/v1';

export async function executeRenderEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiKey = inputs.apiKey;
        if (!apiKey) return { error: 'Missing apiKey in inputs' };

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listServices': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${BASE_URL}/services?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createService': {
                if (!inputs.type || !inputs.name) return { error: 'Missing type or name for service' };
                const body: any = {
                    type: inputs.type,
                    name: inputs.name,
                };
                if (inputs.ownerId) body.ownerId = inputs.ownerId;
                if (inputs.repo) body.repo = inputs.repo;
                if (inputs.branch) body.branch = inputs.branch;
                if (inputs.autoDeploy) body.autoDeploy = inputs.autoDeploy;
                if (inputs.serviceDetails) body.serviceDetails = inputs.serviceDetails;
                if (inputs.envVars) body.envVars = inputs.envVars;
                const res = await fetch(`${BASE_URL}/services`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.autoDeploy) body.autoDeploy = inputs.autoDeploy;
                if (inputs.branch) body.branch = inputs.branch;
                if (inputs.serviceDetails) body.serviceDetails = inputs.serviceDetails;
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            case 'deployService': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const body: any = {};
                if (inputs.clearCache) body.clearCache = inputs.clearCache;
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/deploys`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'retrieveDeployment': {
                if (!inputs.serviceId || !inputs.deployId) return { error: 'Missing serviceId or deployId' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/deploys/${inputs.deployId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listDeploys': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/deploys?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'listEnvGroups': {
                const params = new URLSearchParams();
                if (inputs.ownerId) params.set('ownerId', inputs.ownerId);
                const res = await fetch(`${BASE_URL}/env-groups?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'getEnvGroup': {
                if (!inputs.envGroupId) return { error: 'Missing envGroupId' };
                const res = await fetch(`${BASE_URL}/env-groups/${inputs.envGroupId}`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'createEnvGroup': {
                if (!inputs.name || !inputs.ownerId) return { error: 'Missing name or ownerId for env group' };
                const body: any = { name: inputs.name, ownerId: inputs.ownerId };
                if (inputs.envVars) body.envVars = inputs.envVars;
                const res = await fetch(`${BASE_URL}/env-groups`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'updateEnvGroup': {
                if (!inputs.envGroupId) return { error: 'Missing envGroupId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.envVars) body.envVars = inputs.envVars;
                const res = await fetch(`${BASE_URL}/env-groups/${inputs.envGroupId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'listCustomDomains': {
                if (!inputs.serviceId) return { error: 'Missing serviceId' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/custom-domains`, { headers });
                const data = await res.json();
                return { output: data };
            }
            case 'addCustomDomain': {
                if (!inputs.serviceId || !inputs.name) return { error: 'Missing serviceId or domain name' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/custom-domains`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name }),
                });
                const data = await res.json();
                return { output: data };
            }
            case 'deleteCustomDomain': {
                if (!inputs.serviceId || !inputs.customDomainId) return { error: 'Missing serviceId or customDomainId' };
                const res = await fetch(`${BASE_URL}/services/${inputs.serviceId}/custom-domains/${inputs.customDomainId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }
            default:
                return { error: `Unknown Render Enhanced action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`executeRenderEnhancedAction error: ${err.message}`);
        return { error: err.message || 'Unknown error in Render Enhanced action' };
    }
}
