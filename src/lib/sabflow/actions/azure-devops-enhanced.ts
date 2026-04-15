'use server';

export async function executeAzureDevOpsEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const pat = String(inputs.personalAccessToken ?? '').trim();
        const organization = String(inputs.organization ?? '').trim();
        const project = String(inputs.project ?? '').trim();
        const authHeader = `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
        const baseUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis`;
        const headers: Record<string, string> = {
            'Authorization': authHeader,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        };

        switch (actionName) {
            case 'listWorkItems': {
                const ids = Array.isArray(inputs.ids) ? inputs.ids.join(',') : String(inputs.ids ?? '');
                const res = await fetch(
                    `${baseUrl}/wit/workitems?ids=${ids}&api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { workItems: data.value ?? data } };
            }
            case 'getWorkItem': {
                const id = Number(inputs.id);
                const res = await fetch(
                    `${baseUrl}/wit/workitems/${id}?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { workItem: data } };
            }
            case 'createWorkItem': {
                const workItemType = String(inputs.workItemType ?? 'Task').trim();
                const patchBody = [
                    { op: 'add', path: '/fields/System.Title', value: String(inputs.title ?? '').trim() },
                ];
                if (inputs.description) {
                    patchBody.push({ op: 'add', path: '/fields/System.Description', value: inputs.description });
                }
                if (inputs.assignedTo) {
                    patchBody.push({ op: 'add', path: '/fields/System.AssignedTo', value: inputs.assignedTo });
                }
                if (inputs.priority !== undefined) {
                    patchBody.push({ op: 'add', path: '/fields/Microsoft.VSTS.Common.Priority', value: inputs.priority });
                }
                const res = await fetch(
                    `${baseUrl}/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.1`,
                    {
                        method: 'POST',
                        headers: { ...headers, 'Content-Type': 'application/json-patch+json' },
                        body: JSON.stringify(patchBody),
                    }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { workItem: data } };
            }
            case 'updateWorkItem': {
                const id = Number(inputs.id);
                const patchBody: Array<{ op: string; path: string; value: any }> = [];
                if (inputs.title !== undefined) patchBody.push({ op: 'add', path: '/fields/System.Title', value: inputs.title });
                if (inputs.description !== undefined) patchBody.push({ op: 'add', path: '/fields/System.Description', value: inputs.description });
                if (inputs.state !== undefined) patchBody.push({ op: 'add', path: '/fields/System.State', value: inputs.state });
                if (inputs.assignedTo !== undefined) patchBody.push({ op: 'add', path: '/fields/System.AssignedTo', value: inputs.assignedTo });
                const res = await fetch(
                    `${baseUrl}/wit/workitems/${id}?api-version=7.1`,
                    {
                        method: 'PATCH',
                        headers: { ...headers, 'Content-Type': 'application/json-patch+json' },
                        body: JSON.stringify(patchBody),
                    }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { workItem: data } };
            }
            case 'listPipelines': {
                const res = await fetch(
                    `${baseUrl}/pipelines?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { pipelines: data.value ?? data } };
            }
            case 'getPipeline': {
                const pipelineId = Number(inputs.pipelineId);
                const res = await fetch(
                    `${baseUrl}/pipelines/${pipelineId}?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { pipeline: data } };
            }
            case 'runPipeline': {
                const pipelineId = Number(inputs.pipelineId);
                const body: Record<string, any> = {};
                if (inputs.branch) body.resources = { repositories: { self: { refName: `refs/heads/${inputs.branch}` } } };
                if (inputs.variables) body.variables = inputs.variables;
                const res = await fetch(
                    `${baseUrl}/pipelines/${pipelineId}/runs?api-version=7.1`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { run: data } };
            }
            case 'listBuilds': {
                const queryParams = new URLSearchParams({ 'api-version': '7.1' });
                if (inputs.definitionId) queryParams.set('definitions', String(inputs.definitionId));
                if (inputs.statusFilter) queryParams.set('statusFilter', inputs.statusFilter);
                if (inputs.top) queryParams.set('$top', String(inputs.top));
                const res = await fetch(
                    `${baseUrl}/build/builds?${queryParams.toString()}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { builds: data.value ?? data } };
            }
            case 'getBuild': {
                const buildId = Number(inputs.buildId);
                const res = await fetch(
                    `${baseUrl}/build/builds/${buildId}?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { build: data } };
            }
            case 'queueBuild': {
                const body: Record<string, any> = {
                    definition: { id: Number(inputs.definitionId) },
                };
                if (inputs.sourceBranch) body.sourceBranch = inputs.sourceBranch;
                if (inputs.parameters) body.parameters = typeof inputs.parameters === 'string' ? inputs.parameters : JSON.stringify(inputs.parameters);
                const res = await fetch(
                    `${baseUrl}/build/builds?api-version=7.1`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { build: data } };
            }
            case 'listRepos': {
                const repoBaseUrl = `https://dev.azure.com/${encodeURIComponent(organization)}/${encodeURIComponent(project)}/_apis`;
                const res = await fetch(
                    `${repoBaseUrl}/git/repositories?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { repositories: data.value ?? data } };
            }
            case 'getRepo': {
                const repoId = String(inputs.repoId ?? inputs.repositoryId ?? '').trim();
                const res = await fetch(
                    `${baseUrl}/git/repositories/${encodeURIComponent(repoId)}?api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { repository: data } };
            }
            case 'listPullRequests': {
                const repoId = String(inputs.repoId ?? inputs.repositoryId ?? '').trim();
                const queryParams = new URLSearchParams({ 'api-version': '7.1' });
                if (inputs.status) queryParams.set('searchCriteria.status', inputs.status);
                const res = await fetch(
                    `${baseUrl}/git/repositories/${encodeURIComponent(repoId)}/pullrequests?${queryParams.toString()}`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { pullRequests: data.value ?? data } };
            }
            case 'createPullRequest': {
                const repoId = String(inputs.repoId ?? inputs.repositoryId ?? '').trim();
                const body: Record<string, any> = {
                    title: String(inputs.title ?? '').trim(),
                    sourceRefName: `refs/heads/${String(inputs.sourceBranch ?? '').trim()}`,
                    targetRefName: `refs/heads/${String(inputs.targetBranch ?? 'main').trim()}`,
                    description: inputs.description ?? '',
                };
                if (inputs.reviewers) body.reviewers = inputs.reviewers;
                const res = await fetch(
                    `${baseUrl}/git/repositories/${encodeURIComponent(repoId)}/pullrequests?api-version=7.1`,
                    { method: 'POST', headers, body: JSON.stringify(body) }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { pullRequest: data } };
            }
            case 'listBranches': {
                const repoId = String(inputs.repoId ?? inputs.repositoryId ?? '').trim();
                const res = await fetch(
                    `${baseUrl}/git/repositories/${encodeURIComponent(repoId)}/refs?filter=heads&api-version=7.1`,
                    { headers }
                );
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `Azure DevOps API error: ${res.status}`);
                return { output: { branches: data.value ?? data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
