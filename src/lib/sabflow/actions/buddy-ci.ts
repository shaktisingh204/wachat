'use server';

export async function executeBuddyCiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.buddy.works';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listWorkspaces': {
                const res = await fetch(`${baseUrl}/workspaces`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listProjects': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getProject': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createProject': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        display_name: inputs.displayName,
                        name: inputs.name,
                        integration: inputs.integration || undefined,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listPipelines': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipeline': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createPipeline': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        on: inputs.on || 'CLICK',
                        refs: inputs.refs || [],
                        actions: inputs.actions || [],
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'updatePipeline': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        on: inputs.on,
                        refs: inputs.refs,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deletePipeline': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { deleted: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'runPipeline': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}/runs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        to_revision: inputs.toRevision || 'HEAD',
                        comment: inputs.comment || '',
                        refresh: inputs.refresh || false,
                        clear_cache: inputs.clearCache || false,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelRun': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}/runs/${inputs.runId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({ operation: 'CANCEL' }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listRuns': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}/runs?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getRun': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/projects/${inputs.projectName}/pipelines/${inputs.pipelineId}/runs/${inputs.runId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listMembers': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/members`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'addMember': {
                const res = await fetch(`${baseUrl}/workspaces/${inputs.workspace}/members`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ email: inputs.email }),
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Buddy CI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Buddy CI action error: ${err.message}`);
        return { error: err.message };
    }
}
