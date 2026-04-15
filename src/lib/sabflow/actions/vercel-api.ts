'use server';

export async function executeVercelApiAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output?: any; error?: string }> {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) return { error: 'accessToken is required' };

        const BASE_URL = 'https://api.vercel.com';

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
        };

        // Optional team scoping
        const teamParam = inputs.teamId ? `?teamId=${inputs.teamId}` : '';
        const appendTeam = (qs: string) => {
            if (!inputs.teamId) return qs;
            return qs ? `${qs}&teamId=${inputs.teamId}` : `?teamId=${inputs.teamId}`;
        };

        const get = async (path: string) => {
            const res = await fetch(`${BASE_URL}${path}`, { method: 'GET', headers });
            if (!res.ok) return { error: `GET ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const post = async (path: string, body: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) return { error: `POST ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const patch = async (path: string, body: any) => {
            const res = await fetch(`${BASE_URL}${path}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify(body),
            });
            if (!res.ok) return { error: `PATCH ${path} failed: ${res.status} ${await res.text()}` };
            return { output: await res.json() };
        };

        const del = async (path: string) => {
            const res = await fetch(`${BASE_URL}${path}`, { method: 'DELETE', headers });
            if (!res.ok) return { error: `DELETE ${path} failed: ${res.status} ${await res.text()}` };
            const text = await res.text();
            return { output: text ? JSON.parse(text) : { success: true } };
        };

        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', inputs.teamId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.since) params.set('since', String(inputs.since));
                if (inputs.until) params.set('until', String(inputs.until));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/v9/projects${qs}`);
            }

            case 'getProject': {
                const projectId = inputs.projectId || inputs.projectName;
                if (!projectId) return { error: 'projectId or projectName is required' };
                return get(`/v9/projects/${projectId}${teamParam}`);
            }

            case 'createProject': {
                if (!inputs.name) return { error: 'name is required' };
                const body: any = { name: inputs.name };
                if (inputs.framework) body.framework = inputs.framework;
                if (inputs.gitRepository) body.gitRepository = inputs.gitRepository;
                if (inputs.rootDirectory) body.rootDirectory = inputs.rootDirectory;
                if (inputs.buildCommand) body.buildCommand = inputs.buildCommand;
                if (inputs.outputDirectory) body.outputDirectory = inputs.outputDirectory;
                if (inputs.installCommand) body.installCommand = inputs.installCommand;
                return post(`/v9/projects${teamParam}`, body);
            }

            case 'deleteProject': {
                const projectId = inputs.projectId || inputs.projectName;
                if (!projectId) return { error: 'projectId or projectName is required' };
                return del(`/v9/projects/${projectId}${teamParam}`);
            }

            case 'listDeployments': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', inputs.teamId);
                if (inputs.projectId) params.set('projectId', inputs.projectId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.state) params.set('state', inputs.state);
                if (inputs.target) params.set('target', inputs.target);
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/v6/deployments${qs}`);
            }

            case 'getDeployment': {
                const deploymentId = inputs.deploymentId;
                if (!deploymentId) return { error: 'deploymentId is required' };
                return get(`/v13/deployments/${deploymentId}${teamParam}`);
            }

            case 'createDeployment': {
                if (!inputs.name) return { error: 'name is required' };
                const body: any = { name: inputs.name };
                if (inputs.files) body.files = inputs.files;
                if (inputs.projectSettings) body.projectSettings = inputs.projectSettings;
                if (inputs.target) body.target = inputs.target;
                if (inputs.meta) body.meta = inputs.meta;
                if (inputs.gitSource) body.gitSource = inputs.gitSource;
                return post(`/v13/deployments${teamParam}`, body);
            }

            case 'cancelDeployment': {
                const deploymentId = inputs.deploymentId;
                if (!deploymentId) return { error: 'deploymentId is required' };
                return patch(`/v12/deployments/${deploymentId}/cancel${teamParam}`, {});
            }

            case 'listDomains': {
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', inputs.teamId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.since) params.set('since', String(inputs.since));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/v5/domains${qs}`);
            }

            case 'getDomain': {
                const domain = inputs.domain;
                if (!domain) return { error: 'domain is required' };
                return get(`/v5/domains/${domain}${teamParam}`);
            }

            case 'addDomain': {
                if (!inputs.name) return { error: 'name is required' };
                const body: any = { name: inputs.name };
                if (inputs.buyDomain !== undefined) body.buyDomain = inputs.buyDomain;
                return post(`/v5/domains${teamParam}`, body);
            }

            case 'removeDomain': {
                const domain = inputs.domain;
                if (!domain) return { error: 'domain is required' };
                return del(`/v6/domains/${domain}${teamParam}`);
            }

            case 'listEnvironmentVariables': {
                const projectId = inputs.projectId || inputs.projectName;
                if (!projectId) return { error: 'projectId or projectName is required' };
                const params = new URLSearchParams();
                if (inputs.teamId) params.set('teamId', inputs.teamId);
                if (inputs.decrypt !== undefined) params.set('decrypt', String(inputs.decrypt));
                const qs = params.toString() ? `?${params.toString()}` : '';
                return get(`/v9/projects/${projectId}/env${qs}`);
            }

            case 'createEnvironmentVariable': {
                const projectId = inputs.projectId || inputs.projectName;
                if (!projectId) return { error: 'projectId or projectName is required' };
                if (!inputs.key || !inputs.value) return { error: 'key and value are required' };
                const body: any = {
                    key: inputs.key,
                    value: inputs.value,
                    type: inputs.type ?? 'plain',
                    target: inputs.target ?? ['production', 'preview', 'development'],
                };
                if (inputs.gitBranch) body.gitBranch = inputs.gitBranch;
                return post(`/v10/projects/${projectId}/env${teamParam}`, body);
            }

            case 'deleteEnvironmentVariable': {
                const projectId = inputs.projectId || inputs.projectName;
                const envId = inputs.envId;
                if (!projectId || !envId) return { error: 'projectId and envId are required' };
                return del(`/v9/projects/${projectId}/env/${envId}${teamParam}`);
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        return { error: err?.message ?? String(err) };
    }
}
