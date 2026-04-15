'use server';

export async function executeOctopusDeployAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = `${inputs.serverUrl}/api`;
    const headers: Record<string, string> = {
        'X-Octopus-ApiKey': inputs.apiKey,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
    const spaceId = inputs.spaceId || 'Spaces-1';

    try {
        switch (actionName) {
            case 'listSpaces': {
                const res = await fetch(`${baseUrl}/spaces?take=${inputs.take || 30}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list spaces' };
                return { output: data };
            }
            case 'listProjects': {
                const res = await fetch(`${baseUrl}/${spaceId}/projects?take=${inputs.take || 30}&skip=${inputs.skip || 0}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list projects' };
                return { output: data };
            }
            case 'getProject': {
                const res = await fetch(`${baseUrl}/${spaceId}/projects/${inputs.projectId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get project' };
                return { output: data };
            }
            case 'listEnvironments': {
                const res = await fetch(`${baseUrl}/${spaceId}/environments?take=${inputs.take || 30}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list environments' };
                return { output: data };
            }
            case 'getEnvironment': {
                const res = await fetch(`${baseUrl}/${spaceId}/environments/${inputs.environmentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get environment' };
                return { output: data };
            }
            case 'createRelease': {
                const body: Record<string, any> = {
                    ProjectId: inputs.projectId,
                    Version: inputs.version,
                    ReleaseNotes: inputs.releaseNotes || '',
                    SelectedPackages: inputs.selectedPackages || [],
                };
                if (inputs.channelId) body.ChannelId = inputs.channelId;
                const res = await fetch(`${baseUrl}/${spaceId}/releases`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to create release' };
                return { output: data };
            }
            case 'getRelease': {
                const res = await fetch(`${baseUrl}/${spaceId}/releases/${inputs.releaseId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get release' };
                return { output: data };
            }
            case 'listReleases': {
                const params = new URLSearchParams({ take: String(inputs.take || 30), skip: String(inputs.skip || 0) });
                const res = await fetch(`${baseUrl}/${spaceId}/projects/${inputs.projectId}/releases?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list releases' };
                return { output: data };
            }
            case 'deployRelease': {
                const body: Record<string, any> = {
                    ReleaseId: inputs.releaseId,
                    EnvironmentId: inputs.environmentId,
                    FormValues: inputs.formValues || {},
                    ForcePackageDownload: inputs.forcePackageDownload || false,
                };
                if (inputs.tenantId) body.TenantId = inputs.tenantId;
                if (inputs.comments) body.Comments = inputs.comments;
                const res = await fetch(`${baseUrl}/${spaceId}/deployments`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to deploy release' };
                return { output: data };
            }
            case 'getDeployment': {
                const res = await fetch(`${baseUrl}/${spaceId}/deployments/${inputs.deploymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get deployment' };
                return { output: data };
            }
            case 'listDeployments': {
                const params = new URLSearchParams({ take: String(inputs.take || 30), skip: String(inputs.skip || 0) });
                if (inputs.projectId) params.set('projects', inputs.projectId);
                if (inputs.environmentId) params.set('environments', inputs.environmentId);
                const res = await fetch(`${baseUrl}/${spaceId}/deployments?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list deployments' };
                return { output: data };
            }
            case 'listMachines': {
                const params = new URLSearchParams({ take: String(inputs.take || 30), skip: String(inputs.skip || 0) });
                if (inputs.environmentId) params.set('environmentIds', inputs.environmentId);
                const res = await fetch(`${baseUrl}/${spaceId}/machines?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list machines' };
                return { output: data };
            }
            case 'getMachine': {
                const res = await fetch(`${baseUrl}/${spaceId}/machines/${inputs.machineId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to get machine' };
                return { output: data };
            }
            case 'listTenants': {
                const params = new URLSearchParams({ take: String(inputs.take || 30), skip: String(inputs.skip || 0) });
                if (inputs.projectId) params.set('projectId', inputs.projectId);
                const res = await fetch(`${baseUrl}/${spaceId}/tenants?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to list tenants' };
                return { output: data };
            }
            case 'createRunbook': {
                const body = {
                    ProjectId: inputs.projectId,
                    Name: inputs.name,
                    Description: inputs.description || '',
                    RunRetentionPolicy: inputs.runRetentionPolicy || { QuantityToKeep: 100, ShouldKeepForever: false },
                    ConnectivityPolicy: inputs.connectivityPolicy || {},
                };
                const res = await fetch(`${baseUrl}/${spaceId}/runbooks`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.ErrorMessage || 'Failed to create runbook' };
                return { output: data };
            }
            default:
                return { error: `Unknown Octopus Deploy action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Octopus Deploy action error: ${err.message}`);
        return { error: err.message || 'Octopus Deploy action failed' };
    }
}
