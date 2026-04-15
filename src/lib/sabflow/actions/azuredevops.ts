
'use server';

export async function executeAzureDevOpsAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const organization = String(inputs.organization ?? '').trim();
        const personalAccessToken = String(inputs.personalAccessToken ?? '').trim();
        if (!organization) throw new Error('organization is required.');
        if (!personalAccessToken) throw new Error('personalAccessToken is required.');

        const authHeader = `Basic ${Buffer.from(':' + personalAccessToken).toString('base64')}`;
        const baseUrl = `https://dev.azure.com/${encodeURIComponent(organization)}`;

        async function adoFetch(method: string, url: string, body?: any, contentType?: string) {
            logger?.log(`[AzureDevOps] ${method} ${url}`);
            const headers: Record<string, string> = {
                Authorization: authHeader,
                Accept: 'application/json',
                'Content-Type': contentType ?? 'application/json',
            };
            const options: RequestInit = { method, headers };
            if (body !== undefined) options.body = JSON.stringify(body);
            const res = await fetch(url, options);
            if (res.status === 204) return {};
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) throw new Error(data?.message || data?.value || `Azure DevOps API error: ${res.status}`);
            return data;
        }

        switch (actionName) {
            case 'listProjects': {
                const data = await adoFetch('GET', `${baseUrl}/_apis/projects?api-version=7.1`);
                return { output: { projects: data?.value ?? data } };
            }
            case 'getProject': {
                const projectId = String(inputs.projectId ?? '').trim();
                if (!projectId) throw new Error('projectId is required.');
                const data = await adoFetch('GET', `${baseUrl}/_apis/projects/${encodeURIComponent(projectId)}?api-version=7.1`);
                return { output: { project: data } };
            }
            case 'listRepos': {
                const project = String(inputs.project ?? '').trim();
                if (!project) throw new Error('project is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories?api-version=7.1`);
                return { output: { repositories: data?.value ?? data } };
            }
            case 'getRepo': {
                const project = String(inputs.project ?? '').trim();
                const repoId = String(inputs.repoId ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!repoId) throw new Error('repoId is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoId)}?api-version=7.1`);
                return { output: { repository: data } };
            }
            case 'listWorkItems': {
                const project = String(inputs.project ?? '').trim();
                const wiqlQuery = String(inputs.wiqlQuery ?? `Select [System.Id], [System.Title], [System.State] From WorkItems`).trim();
                if (!project) throw new Error('project is required.');
                const data = await adoFetch('POST', `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/wiql?api-version=7.1`, { query: wiqlQuery });
                return { output: { workItems: data?.workItems ?? data } };
            }
            case 'getWorkItem': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const data = await adoFetch('GET', `${baseUrl}/_apis/wit/workitems/${encodeURIComponent(id)}?api-version=7.1`);
                return { output: { workItem: data } };
            }
            case 'createWorkItem': {
                const project = String(inputs.project ?? '').trim();
                const workItemType = String(inputs.workItemType ?? 'Task').trim();
                if (!project) throw new Error('project is required.');
                const operations = inputs.operations ?? [
                    { op: 'add', path: '/fields/System.Title', value: inputs.title ?? 'New Work Item' },
                ];
                const data = await adoFetch(
                    'POST',
                    `${baseUrl}/${encodeURIComponent(project)}/_apis/wit/workitems/$${encodeURIComponent(workItemType)}?api-version=7.1`,
                    operations,
                    'application/json-patch+json',
                );
                return { output: { workItem: data } };
            }
            case 'updateWorkItem': {
                const id = String(inputs.id ?? '').trim();
                if (!id) throw new Error('id is required.');
                const operations = inputs.operations ?? [];
                const data = await adoFetch(
                    'PATCH',
                    `${baseUrl}/_apis/wit/workitems/${encodeURIComponent(id)}?api-version=7.1`,
                    operations,
                    'application/json-patch+json',
                );
                return { output: { workItem: data } };
            }
            case 'listPipelines': {
                const project = String(inputs.project ?? '').trim();
                if (!project) throw new Error('project is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/pipelines?api-version=7.1`);
                return { output: { pipelines: data?.value ?? data } };
            }
            case 'getPipeline': {
                const project = String(inputs.project ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!id) throw new Error('id is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/pipelines/${encodeURIComponent(id)}?api-version=7.1`);
                return { output: { pipeline: data } };
            }
            case 'runPipeline': {
                const project = String(inputs.project ?? '').trim();
                const id = String(inputs.id ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!id) throw new Error('id is required.');
                const resources = inputs.resources ?? {};
                const data = await adoFetch('POST', `${baseUrl}/${encodeURIComponent(project)}/_apis/pipelines/${encodeURIComponent(id)}/runs?api-version=7.1`, { resources });
                return { output: { run: data } };
            }
            case 'getPipelineRun': {
                const project = String(inputs.project ?? '').trim();
                const pipelineId = String(inputs.pipelineId ?? '').trim();
                const runId = String(inputs.runId ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!pipelineId) throw new Error('pipelineId is required.');
                if (!runId) throw new Error('runId is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/pipelines/${encodeURIComponent(pipelineId)}/runs/${encodeURIComponent(runId)}?api-version=7.1`);
                return { output: { run: data } };
            }
            case 'listPullRequests': {
                const project = String(inputs.project ?? '').trim();
                const repoId = String(inputs.repoId ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!repoId) throw new Error('repoId is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoId)}/pullrequests?api-version=7.1`);
                return { output: { pullRequests: data?.value ?? data } };
            }
            case 'createPullRequest': {
                const project = String(inputs.project ?? '').trim();
                const repoId = String(inputs.repoId ?? '').trim();
                if (!project) throw new Error('project is required.');
                if (!repoId) throw new Error('repoId is required.');
                const body = {
                    title: inputs.title ?? 'New Pull Request',
                    description: inputs.description ?? '',
                    sourceRefName: inputs.sourceRefName ?? 'refs/heads/feature',
                    targetRefName: inputs.targetRefName ?? 'refs/heads/main',
                    ...(inputs.reviewers ? { reviewers: inputs.reviewers } : {}),
                };
                const data = await adoFetch('POST', `${baseUrl}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repoId)}/pullrequests?api-version=7.1`, body);
                return { output: { pullRequest: data } };
            }
            case 'listBuilds': {
                const project = String(inputs.project ?? '').trim();
                if (!project) throw new Error('project is required.');
                const data = await adoFetch('GET', `${baseUrl}/${encodeURIComponent(project)}/_apis/build/builds?api-version=7.1`);
                return { output: { builds: data?.value ?? data } };
            }
            case 'queueBuild': {
                const project = String(inputs.project ?? '').trim();
                const definitionId = inputs.definitionId;
                if (!project) throw new Error('project is required.');
                if (!definitionId) throw new Error('definitionId is required.');
                const body = {
                    definition: { id: Number(definitionId) },
                    ...(inputs.sourceBranch ? { sourceBranch: inputs.sourceBranch } : {}),
                    ...(inputs.parameters ? { parameters: typeof inputs.parameters === 'string' ? inputs.parameters : JSON.stringify(inputs.parameters) } : {}),
                };
                const data = await adoFetch('POST', `${baseUrl}/${encodeURIComponent(project)}/_apis/build/builds?api-version=7.1`, body);
                return { output: { build: data } };
            }
            default:
                throw new Error(`Unknown action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[AzureDevOps] Error: ${err.message}`);
        return { error: err.message ?? 'Unknown error' };
    }
}
