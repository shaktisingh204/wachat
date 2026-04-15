'use server';

export async function executeCircleciEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://circleci.com/api/v2';
        const headers: Record<string, string> = {
            'Circle-Token': inputs.apiToken,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listPipelines': {
                const params = new URLSearchParams();
                if (inputs.orgSlug) params.set('org-slug', inputs.orgSlug);
                if (inputs.pageToken) params.set('page-token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/pipeline?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipeline': {
                const res = await fetch(`${baseUrl}/pipeline/${inputs.pipelineId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'triggerPipeline': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/pipeline`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        branch: inputs.branch,
                        tag: inputs.tag,
                        parameters: inputs.parameters || {},
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipelineWorkflows': {
                const params = new URLSearchParams();
                if (inputs.pageToken) params.set('page-token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/pipeline/${inputs.pipelineId}/workflow?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listWorkflows': {
                const params = new URLSearchParams();
                if (inputs.pageToken) params.set('page-token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/pipeline/${inputs.pipelineId}/workflow?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getWorkflow': {
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'retryWorkflow': {
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}/rerun`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ enable_ssh: inputs.enableSsh || false, from_failed: inputs.fromFailed || false }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelWorkflow': {
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listJobs': {
                const params = new URLSearchParams();
                if (inputs.pageToken) params.set('page-token', inputs.pageToken);
                const res = await fetch(`${baseUrl}/workflow/${inputs.workflowId}/job?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getJob': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/job/${inputs.jobNumber}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'cancelJob': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/job/${inputs.jobNumber}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getArtifacts': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/${inputs.jobNumber}/artifacts`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listEnvVars': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/envvar`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createEnvVar': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/envvar`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ name: inputs.name, value: inputs.value }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteEnvVar': {
                const res = await fetch(`${baseUrl}/project/${inputs.projectSlug}/envvar/${inputs.name}`, {
                    method: 'DELETE',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown CircleCI action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`CircleCI Enhanced action error: ${err.message}`);
        return { error: err.message };
    }
}
