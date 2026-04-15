'use server';

export async function executeBambooCiAction(actionName: string, inputs: any, user: any, logger: any) {
    const baseUrl = `https://${inputs.domain}/rest/api/latest`;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${inputs.apiToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listProjects': {
                const res = await fetch(`${baseUrl}/project.json?max-results=${inputs.maxResults || 50}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list projects' };
                return { output: data };
            }
            case 'getProject': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectKey}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get project' };
                return { output: data };
            }
            case 'listPlans': {
                const params = new URLSearchParams({ 'max-results': String(inputs.maxResults || 50) });
                if (inputs.projectKey) params.set('projectKey', inputs.projectKey);
                const res = await fetch(`${baseUrl}/plan.json?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list plans' };
                return { output: data };
            }
            case 'getPlan': {
                const res = await fetch(`${baseUrl}/plan/${inputs.planKey}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get plan' };
                return { output: data };
            }
            case 'enablePlan': {
                const res = await fetch(`${baseUrl}/plan/${inputs.planKey}/enable`, { method: 'POST', headers });
                if (res.status === 204 || res.ok) return { output: { success: true, planKey: inputs.planKey, enabled: true } };
                const data = await res.json();
                return { error: data.message || 'Failed to enable plan' };
            }
            case 'disablePlan': {
                const res = await fetch(`${baseUrl}/plan/${inputs.planKey}/enable`, { method: 'DELETE', headers });
                if (res.status === 204 || res.ok) return { output: { success: true, planKey: inputs.planKey, enabled: false } };
                const data = await res.json();
                return { error: data.message || 'Failed to disable plan' };
            }
            case 'queueBuild': {
                const params = new URLSearchParams();
                if (inputs.executeAllStages !== undefined) params.set('executeAllStages', String(inputs.executeAllStages));
                if (inputs.customRevision) params.set('customRevision', inputs.customRevision);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/queue/${inputs.planKey}.json${query}`, { method: 'POST', headers, body: inputs.variables ? JSON.stringify({ variableSubstitutionList: { variable: inputs.variables } }) : undefined });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to queue build' };
                return { output: data };
            }
            case 'getBuild': {
                const res = await fetch(`${baseUrl}/result/${inputs.buildKey}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get build' };
                return { output: data };
            }
            case 'listBuildResults': {
                const params = new URLSearchParams({ 'max-results': String(inputs.maxResults || 25) });
                if (inputs.planKey) params.set('planKey', inputs.planKey);
                if (inputs.buildState) params.set('buildstate', inputs.buildState);
                const res = await fetch(`${baseUrl}/result.json?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list build results' };
                return { output: data };
            }
            case 'getLatestBuild': {
                const res = await fetch(`${baseUrl}/result/${inputs.planKey}/latest.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get latest build' };
                return { output: data };
            }
            case 'listBranches': {
                const res = await fetch(`${baseUrl}/plan/${inputs.planKey}/branch.json?max-results=${inputs.maxResults || 50}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list branches' };
                return { output: data };
            }
            case 'createBranch': {
                const params = new URLSearchParams({ vcsBranch: inputs.vcsBranch });
                if (inputs.enabled !== undefined) params.set('enabled', String(inputs.enabled));
                const res = await fetch(`${baseUrl}/plan/${inputs.planKey}/branch/${encodeURIComponent(inputs.branchName)}.json?${params.toString()}`, { method: 'PUT', headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create branch' };
                return { output: data };
            }
            case 'listDeploymentProjects': {
                const res = await fetch(`${baseUrl}/deploy/project/all.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list deployment projects' };
                return { output: data };
            }
            case 'triggerDeployment': {
                const body = {
                    deploymentVersionName: inputs.versionName,
                    planResultKey: { key: inputs.planResultKey },
                };
                const res = await fetch(`${baseUrl}/queue/deployment/?environmentId=${inputs.environmentId}&versionId=${inputs.versionId}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to trigger deployment' };
                return { output: data };
            }
            case 'getDeploymentResult': {
                const res = await fetch(`${baseUrl}/deploy/result/${inputs.deploymentResultId}.json`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get deployment result' };
                return { output: data };
            }
            default:
                return { error: `Unknown Bamboo CI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Bamboo CI action error: ${err.message}`);
        return { error: err.message || 'Bamboo CI action failed' };
    }
}
