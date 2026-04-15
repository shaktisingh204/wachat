'use server';

export async function executeRenderAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = 'https://api.render.com/v1';
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listServices': {
                const params = new URLSearchParams();
                if (inputs.type) params.set('type', inputs.type);
                if (inputs.name) params.set('name', inputs.name);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/services?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list services: ${res.statusText}` };
                const data = await res.json();
                return { output: { services: data } };
            }

            case 'getService': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}`, { headers });
                if (!res.ok) return { error: `Failed to get service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'createService': {
                const body: any = {
                    type: inputs.type,
                    name: inputs.name,
                    ownerId: inputs.ownerId,
                };
                if (inputs.repo) body.repo = inputs.repo;
                if (inputs.branch) body.autoDeploy = inputs.autoDeploy;
                if (inputs.serviceDetails) body.serviceDetails = inputs.serviceDetails;
                const res = await fetch(`${baseUrl}/services`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'updateService': {
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.autoDeploy !== undefined) body.autoDeploy = inputs.autoDeploy;
                if (inputs.branch) body.branch = inputs.branch;
                if (inputs.serviceDetails) body.serviceDetails = inputs.serviceDetails;
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to update service: ${res.statusText}` };
                const data = await res.json();
                return { output: { service: data } };
            }

            case 'deleteService': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete service: ${res.statusText}` };
                return { output: { deleted: true } };
            }

            case 'listDeploys': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/deploys?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list deploys: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploys: data } };
            }

            case 'getDeploy': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/deploys/${inputs.deployId}`, { headers });
                if (!res.ok) return { error: `Failed to get deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'createDeploy': {
                const body: any = {};
                if (inputs.clearCache) body.clearCache = inputs.clearCache;
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/deploys`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to create deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'cancelDeploy': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/deploys/${inputs.deployId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `Failed to cancel deploy: ${res.statusText}` };
                const data = await res.json();
                return { output: { deploy: data } };
            }

            case 'listEnvVars': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/env-vars?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list env vars: ${res.statusText}` };
                const data = await res.json();
                return { output: { envVars: data } };
            }

            case 'addEnvVar': {
                const body = [{ key: inputs.key, value: inputs.value }];
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/env-vars`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to add env var: ${res.statusText}` };
                const data = await res.json();
                return { output: { envVars: data } };
            }

            case 'updateEnvVar': {
                const body = [{ key: inputs.key, value: inputs.value }];
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/env-vars`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Failed to update env var: ${res.statusText}` };
                const data = await res.json();
                return { output: { envVars: data } };
            }

            case 'deleteEnvVar': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/env-vars/${inputs.envVarId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) return { error: `Failed to delete env var: ${res.statusText}` };
                return { output: { deleted: true } };
            }

            case 'listCustomDomains': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/custom-domains?${params.toString()}`, { headers });
                if (!res.ok) return { error: `Failed to list custom domains: ${res.statusText}` };
                const data = await res.json();
                return { output: { customDomains: data } };
            }

            case 'verifyCustomDomain': {
                const res = await fetch(`${baseUrl}/services/${inputs.serviceId}/custom-domains/${inputs.customDomainId}/verify`, {
                    method: 'POST',
                    headers,
                });
                if (!res.ok) return { error: `Failed to verify custom domain: ${res.statusText}` };
                const data = await res.json();
                return { output: { customDomain: data } };
            }

            default:
                return { error: `Unknown Render action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Render action error: ${err.message}`);
        return { error: err.message || 'Render action failed' };
    }
}
