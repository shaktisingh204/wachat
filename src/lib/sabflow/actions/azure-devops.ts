'use server';

export async function executeAzureDevOpsAction(actionName: string, inputs: any, user: any, logger: any) {
    const base64 = Buffer.from(':' + inputs.pat).toString('base64');
    const baseUrl = `https://dev.azure.com/${inputs.organization}/${inputs.project}/_apis`;
    const headers: Record<string, string> = {
        'Authorization': `Basic ${base64}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
    };
    const apiVersion = inputs.apiVersion || '7.1';

    try {
        switch (actionName) {
            case 'listRepositories': {
                const res = await fetch(`${baseUrl}/git/repositories?api-version=${apiVersion}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list repositories' };
                return { output: data };
            }
            case 'getRepository': {
                const res = await fetch(`${baseUrl}/git/repositories/${inputs.repositoryId}?api-version=${apiVersion}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get repository' };
                return { output: data };
            }
            case 'listPullRequests': {
                const params = new URLSearchParams({ 'api-version': apiVersion });
                if (inputs.status) params.set('searchCriteria.status', inputs.status);
                if (inputs.targetRefName) params.set('searchCriteria.targetRefName', inputs.targetRefName);
                const res = await fetch(`${baseUrl}/git/repositories/${inputs.repositoryId}/pullrequests?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list pull requests' };
                return { output: data };
            }
            case 'getPullRequest': {
                const res = await fetch(`${baseUrl}/git/repositories/${inputs.repositoryId}/pullrequests/${inputs.pullRequestId}?api-version=${apiVersion}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get pull request' };
                return { output: data };
            }
            case 'createPullRequest': {
                const body = {
                    title: inputs.title,
                    description: inputs.description || '',
                    sourceRefName: inputs.sourceRefName,
                    targetRefName: inputs.targetRefName,
                    reviewers: inputs.reviewers || [],
                    isDraft: inputs.isDraft || false,
                };
                const res = await fetch(`${baseUrl}/git/repositories/${inputs.repositoryId}/pullrequests?api-version=${apiVersion}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create pull request' };
                return { output: data };
            }
            case 'listWorkItems': {
                const wiql = { query: inputs.wiql || `SELECT [System.Id],[System.Title],[System.State] FROM WorkItems WHERE [System.TeamProject] = '${inputs.project}'` };
                const res = await fetch(`${baseUrl}/wit/wiql?api-version=${apiVersion}`, { method: 'POST', headers, body: JSON.stringify(wiql) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list work items' };
                return { output: data };
            }
            case 'getWorkItem': {
                const res = await fetch(`${baseUrl}/wit/workitems/${inputs.id}?api-version=${apiVersion}&$expand=${inputs.expand || 'all'}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get work item' };
                return { output: data };
            }
            case 'createWorkItem': {
                const patchBody = [
                    { op: 'add', path: '/fields/System.Title', value: inputs.title },
                    ...(inputs.description ? [{ op: 'add', path: '/fields/System.Description', value: inputs.description }] : []),
                    ...(inputs.assignedTo ? [{ op: 'add', path: '/fields/System.AssignedTo', value: inputs.assignedTo }] : []),
                    ...(inputs.priority ? [{ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: inputs.priority }] : []),
                ];
                const patchHeaders = { ...headers, 'Content-Type': 'application/json-patch+json' };
                const res = await fetch(`${baseUrl}/wit/workitems/$${encodeURIComponent(inputs.type || 'Task')}?api-version=${apiVersion}`, { method: 'POST', headers: patchHeaders, body: JSON.stringify(patchBody) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to create work item' };
                return { output: data };
            }
            case 'updateWorkItem': {
                const patchHeaders = { ...headers, 'Content-Type': 'application/json-patch+json' };
                const patchBody = inputs.fields || [];
                const res = await fetch(`${baseUrl}/wit/workitems/${inputs.id}?api-version=${apiVersion}`, { method: 'PATCH', headers: patchHeaders, body: JSON.stringify(patchBody) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to update work item' };
                return { output: data };
            }
            case 'listBuilds': {
                const params = new URLSearchParams({ 'api-version': apiVersion });
                if (inputs.definitionId) params.set('definitions', String(inputs.definitionId));
                if (inputs.top) params.set('$top', String(inputs.top));
                const res = await fetch(`${baseUrl}/build/builds?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list builds' };
                return { output: data };
            }
            case 'getBuild': {
                const res = await fetch(`${baseUrl}/build/builds/${inputs.buildId}?api-version=${apiVersion}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to get build' };
                return { output: data };
            }
            case 'triggerBuild': {
                const body = {
                    definition: { id: inputs.definitionId },
                    sourceBranch: inputs.sourceBranch || 'refs/heads/main',
                    parameters: inputs.parameters ? JSON.stringify(inputs.parameters) : undefined,
                };
                const res = await fetch(`${baseUrl}/build/builds?api-version=${apiVersion}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to trigger build' };
                return { output: data };
            }
            case 'listReleases': {
                const rmBase = `https://vsrm.dev.azure.com/${inputs.organization}/${inputs.project}/_apis`;
                const params = new URLSearchParams({ 'api-version': apiVersion });
                if (inputs.definitionId) params.set('definitionId', String(inputs.definitionId));
                const res = await fetch(`${rmBase}/release/releases?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list releases' };
                return { output: data };
            }
            case 'listPipelines': {
                const res = await fetch(`${baseUrl}/pipelines?api-version=${apiVersion}&$top=${inputs.top || 100}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to list pipelines' };
                return { output: data };
            }
            case 'triggerPipeline': {
                const body = {
                    resources: inputs.resources || {},
                    variables: inputs.variables || {},
                    stagesToSkip: inputs.stagesToSkip || [],
                };
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineId}/runs?api-version=${apiVersion}`, { method: 'POST', headers, body: JSON.stringify(body) });
                const data = await res.json();
                if (!res.ok) return { error: data.message || 'Failed to trigger pipeline' };
                return { output: data };
            }
            default:
                return { error: `Unknown Azure DevOps action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Azure DevOps action error: ${err.message}`);
        return { error: err.message || 'Azure DevOps action failed' };
    }
}
