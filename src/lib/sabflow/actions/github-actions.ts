'use server';

export async function executeGithubActionsAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://api.github.com';
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${inputs.token}`,
            'Accept': 'application/vnd.github+json',
            'Content-Type': 'application/json',
            'X-GitHub-Api-Version': '2022-11-28',
        };
        const owner = inputs.owner;
        const repo = inputs.repo;

        switch (actionName) {
            case 'listWorkflows': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/workflows?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getWorkflow': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/workflows/${inputs.workflowId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listWorkflowRuns': {
                const params = new URLSearchParams();
                if (inputs.branch) params.set('branch', inputs.branch);
                if (inputs.status) params.set('status', inputs.status);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/workflows/${inputs.workflowId}/runs?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getWorkflowRun': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/runs/${inputs.runId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'triggerWorkflowDispatch': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/workflows/${inputs.workflowId}/dispatches`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ ref: inputs.ref, inputs: inputs.workflowInputs || {} }),
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'rerunWorkflow': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/runs/${inputs.runId}/rerun`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ enable_debug_logging: inputs.enableDebugLogging || false }),
                });
                if (res.status === 201) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'cancelWorkflowRun': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/runs/${inputs.runId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                if (res.status === 202) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'listWorkflowJobs': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/runs/${inputs.runId}/jobs?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getWorkflowJob': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/jobs/${inputs.jobId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'downloadJobLogs': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/jobs/${inputs.jobId}/logs`, { headers });
                if (res.status === 302) {
                    const location = res.headers.get('location');
                    return { output: { logsUrl: location } };
                }
                const text = await res.text();
                return { output: { logs: text } };
            }

            case 'listArtifacts': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.name) params.set('name', inputs.name);
                const url = inputs.runId
                    ? `${baseUrl}/repos/${owner}/${repo}/actions/runs/${inputs.runId}/artifacts?${params}`
                    : `${baseUrl}/repos/${owner}/${repo}/actions/artifacts?${params}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getArtifact': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/artifacts/${inputs.artifactId}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'deleteArtifact': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/artifacts/${inputs.artifactId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }

            case 'listSecrets': {
                const params = new URLSearchParams();
                if (inputs.perPage) params.set('per_page', String(inputs.perPage));
                if (inputs.page) params.set('page', String(inputs.page));
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/secrets?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createOrUpdateSecret': {
                const res = await fetch(`${baseUrl}/repos/${owner}/${repo}/actions/secrets/${inputs.secretName}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({
                        encrypted_value: inputs.encryptedValue,
                        key_id: inputs.keyId,
                    }),
                });
                if (res.status === 201 || res.status === 204) return { output: { success: true } };
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown GitHub Actions action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`GitHub Actions action error: ${err.message}`);
        return { error: err.message };
    }
}
