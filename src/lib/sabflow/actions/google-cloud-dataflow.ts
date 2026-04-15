'use server';

export async function executeGoogleCloudDataflowAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const projectId = inputs.projectId;
        const location = inputs.location || 'us-central1';
        const baseUrl = `https://dataflow.googleapis.com/v1b3/projects/${projectId}/locations/${location}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listJobs': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/jobs?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { jobs: data.jobs, nextPageToken: data.nextPageToken } };
            }
            case 'getJob': {
                const params = new URLSearchParams();
                if (inputs.view) params.set('view', inputs.view);
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const res = await fetch(`${baseUrl}/jobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.jobBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'updateJob': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.jobBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'cancelJob': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ requestedState: 'JOB_STATE_CANCELLED' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'drainJob': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ requestedState: 'JOB_STATE_DRAINING' }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'listJobMessages': {
                const params = new URLSearchParams();
                if (inputs.minimumImportance) params.set('minimumImportance', inputs.minimumImportance);
                if (inputs.pageSize) params.set('pageSize', String(inputs.pageSize));
                if (inputs.pageToken) params.set('pageToken', inputs.pageToken);
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}/messages?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { jobMessages: data.jobMessages, nextPageToken: data.nextPageToken } };
            }
            case 'getJobMetrics': {
                const res = await fetch(`${baseUrl}/jobs/${inputs.jobId}/metrics`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { metrics: data } };
            }
            case 'createJobFromTemplate': {
                const res = await fetch(`${baseUrl}/templates`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        jobName: inputs.jobName,
                        gcsPath: inputs.gcsPath,
                        parameters: inputs.parameters || {},
                        environment: inputs.environment || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'launchTemplate': {
                const params = new URLSearchParams();
                params.set('gcsPath', inputs.gcsPath);
                params.set('validateOnly', String(inputs.validateOnly || false));
                const res = await fetch(`${baseUrl}/templates:launch?${params.toString()}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        jobName: inputs.jobName,
                        parameters: inputs.parameters || {},
                        environment: inputs.environment || {},
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data.job, templateMetadata: data.templateMetadata } };
            }
            case 'listTemplates': {
                const params = new URLSearchParams();
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/templates?${params.toString()}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { templates: data } };
            }
            case 'createFlexTemplate': {
                const res = await fetch(`https://dataflow.googleapis.com/v1b3/projects/${projectId}/locations/${location}/flexTemplates:build`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.flexTemplateBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { template: data } };
            }
            case 'launchFlexTemplate': {
                const res = await fetch(`${baseUrl}/flexTemplates:launch`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        launchParameter: {
                            jobName: inputs.jobName,
                            containerSpecGcsPath: inputs.containerSpecGcsPath,
                            parameters: inputs.parameters || {},
                            environment: inputs.environment || {},
                        },
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { job: data.job } };
            }
            case 'listSnapshots': {
                const res = await fetch(`${baseUrl}/snapshots`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { snapshots: data.snapshots } };
            }
            case 'getSnapshot': {
                const res = await fetch(`${baseUrl}/snapshots/${inputs.snapshotId}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { snapshot: data } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
