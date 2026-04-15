'use server';

export async function executeDatabricksEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const token = String(inputs.token ?? '').trim();
        const workspaceUrl = String(inputs.workspaceUrl ?? '').trim().replace(/\/$/, '');

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listClusters': {
                const res = await fetch(`${workspaceUrl}/api/2.0/clusters/list`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { clusters: data.clusters ?? [] } };
            }
            case 'getCluster': {
                const clusterId = String(inputs.clusterId ?? '').trim();
                const res = await fetch(`${workspaceUrl}/api/2.0/clusters/get?cluster_id=${encodeURIComponent(clusterId)}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { cluster: data } };
            }
            case 'createCluster': {
                const body: Record<string, any> = {
                    cluster_name: inputs.clusterName,
                    spark_version: inputs.sparkVersion,
                    node_type_id: inputs.nodeTypeId,
                    num_workers: inputs.numWorkers ?? 1,
                };
                if (inputs.autoscale) body.autoscale = inputs.autoscale;
                if (inputs.awsAttributes) body.aws_attributes = inputs.awsAttributes;
                const res = await fetch(`${workspaceUrl}/api/2.0/clusters/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { clusterId: data.cluster_id } };
            }
            case 'startCluster': {
                const res = await fetch(`${workspaceUrl}/api/2.0/clusters/start`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ cluster_id: inputs.clusterId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { success: true } };
            }
            case 'terminateCluster': {
                const res = await fetch(`${workspaceUrl}/api/2.0/clusters/delete`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ cluster_id: inputs.clusterId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { success: true } };
            }
            case 'listJobs': {
                const limit = inputs.limit ?? 25;
                const offset = inputs.offset ?? 0;
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/list?limit=${limit}&offset=${offset}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { jobs: data.jobs ?? [], hasMore: data.has_more ?? false } };
            }
            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/get?job_id=${encodeURIComponent(jobId)}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { job: data } };
            }
            case 'createJob': {
                const body: Record<string, any> = {
                    name: inputs.name,
                    tasks: inputs.tasks,
                };
                if (inputs.schedule) body.schedule = inputs.schedule;
                if (inputs.tags) body.tags = inputs.tags;
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/create`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { jobId: data.job_id } };
            }
            case 'runJob': {
                const body: Record<string, any> = { job_id: inputs.jobId };
                if (inputs.jarParams) body.jar_params = inputs.jarParams;
                if (inputs.notebookParams) body.notebook_params = inputs.notebookParams;
                if (inputs.pythonParams) body.python_params = inputs.pythonParams;
                if (inputs.sparkSubmitParams) body.spark_submit_params = inputs.sparkSubmitParams;
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/run-now`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { runId: data.run_id, numberInJob: data.number_in_job } };
            }
            case 'cancelJob': {
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/runs/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ run_id: inputs.runId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { success: true } };
            }
            case 'listJobRuns': {
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('job_id', String(inputs.jobId));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/runs/list?${params.toString()}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { runs: data.runs ?? [], hasMore: data.has_more ?? false } };
            }
            case 'getJobRun': {
                const runId = String(inputs.runId ?? '').trim();
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/runs/get?run_id=${encodeURIComponent(runId)}`, {
                    method: 'GET',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { run: data } };
            }
            case 'submitRun': {
                const body: Record<string, any> = {
                    tasks: inputs.tasks,
                };
                if (inputs.runName) body.run_name = inputs.runName;
                if (inputs.gitSource) body.git_source = inputs.gitSource;
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/runs/submit`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { runId: data.run_id } };
            }
            case 'cancelRun': {
                const res = await fetch(`${workspaceUrl}/api/2.1/jobs/runs/cancel`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ run_id: inputs.runId }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.message || `API error: ${res.status}`);
                return { output: { success: true } };
            }
            case 'listNotebooks': {
                const path = String(inputs.path ?? '/').trim();
                const res = await fetch(`${workspaceUrl}/api/2.0/workspace/list`, {
                    method: 'GET',
                    headers,
                });
                // Workspace list requires POST with body per Databricks API
                const postRes = await fetch(`${workspaceUrl}/api/2.0/workspace/list`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ path }),
                });
                const data = await postRes.json();
                if (!postRes.ok) throw new Error(data?.message || `API error: ${postRes.status}`);
                const notebooks = (data.objects ?? []).filter((o: any) => o.object_type === 'NOTEBOOK');
                return { output: { notebooks, total: notebooks.length } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
