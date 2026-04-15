'use server';

export async function executeNomadAction(actionName: string, inputs: any, user: any, logger: any) {
    const token = inputs.token;
    const baseUrl = (inputs.nomadAddr ?? 'http://localhost:4646').replace(/\/$/, '');

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };
    if (token) headers['X-Nomad-Token'] = token;

    try {
        switch (actionName) {
            case 'listJobs': {
                const { namespace, prefix } = inputs;
                const params = new URLSearchParams();
                if (namespace) params.set('namespace', namespace);
                if (prefix) params.set('prefix', prefix);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/v1/jobs${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { jobs: data } };
            }

            case 'getJob': {
                const { jobId, namespace } = inputs;
                const query = namespace ? `?namespace=${namespace}` : '';
                const res = await fetch(`${baseUrl}/v1/job/${jobId}${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { job: data } };
            }

            case 'createJob': {
                const { jobSpec } = inputs;
                const res = await fetch(`${baseUrl}/v1/jobs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ Job: jobSpec }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID, jobModifyIndex: data.JobModifyIndex } };
            }

            case 'updateJob': {
                const { jobId, jobSpec } = inputs;
                const res = await fetch(`${baseUrl}/v1/job/${jobId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ Job: jobSpec }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID, jobModifyIndex: data.JobModifyIndex } };
            }

            case 'stopJob': {
                const { jobId, purge = false, namespace } = inputs;
                const params = new URLSearchParams();
                if (purge) params.set('purge', 'true');
                if (namespace) params.set('namespace', namespace);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/v1/job/${jobId}${query}`, { method: 'DELETE', headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID } };
            }

            case 'listAllocations': {
                const { namespace, jobId } = inputs;
                const params = new URLSearchParams();
                if (namespace) params.set('namespace', namespace);
                if (jobId) params.set('job', jobId);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/v1/allocations${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { allocations: data } };
            }

            case 'getAllocation': {
                const { allocId } = inputs;
                const res = await fetch(`${baseUrl}/v1/allocation/${allocId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { allocation: data } };
            }

            case 'listNodes': {
                const { prefix } = inputs;
                const query = prefix ? `?prefix=${prefix}` : '';
                const res = await fetch(`${baseUrl}/v1/nodes${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { nodes: data } };
            }

            case 'getNode': {
                const { nodeId } = inputs;
                const res = await fetch(`${baseUrl}/v1/node/${nodeId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { node: data } };
            }

            case 'drainNode': {
                const { nodeId, enable, deadline, ignoreSystemJobs = false } = inputs;
                const body: any = {
                    NodeID: nodeId,
                    DrainSpec: enable ? { Deadline: deadline ?? -1, IgnoreSystemJobs: ignoreSystemJobs } : null,
                };
                const res = await fetch(`${baseUrl}/v1/node/${nodeId}/drain`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID, nodeModifyIndex: data.NodeModifyIndex } };
            }

            case 'listDeployments': {
                const { namespace, jobId } = inputs;
                const params = new URLSearchParams();
                if (namespace) params.set('namespace', namespace);
                if (jobId) params.set('job', jobId);
                const query = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/v1/deployments${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { deployments: data } };
            }

            case 'getDeployment': {
                const { deploymentId } = inputs;
                const res = await fetch(`${baseUrl}/v1/deployment/${deploymentId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { deployment: data } };
            }

            case 'promoteDeployment': {
                const { deploymentId, all = true, groups } = inputs;
                const body: any = { DeploymentID: deploymentId, All: all };
                if (groups) body.Groups = groups;
                const res = await fetch(`${baseUrl}/v1/deployment/promote/${deploymentId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID, deploymentModifyIndex: data.DeploymentModifyIndex } };
            }

            case 'failDeployment': {
                const { deploymentId } = inputs;
                const res = await fetch(`${baseUrl}/v1/deployment/fail/${deploymentId}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ DeploymentID: deploymentId }),
                });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { evalId: data.EvalID, deploymentModifyIndex: data.DeploymentModifyIndex } };
            }

            case 'listNamespaces': {
                const { prefix } = inputs;
                const query = prefix ? `?prefix=${prefix}` : '';
                const res = await fetch(`${baseUrl}/v1/namespaces${query}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data?.Description ?? `HTTP ${res.status}` };
                return { output: { namespaces: data } };
            }

            default:
                return { error: `Unknown Nomad action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Nomad action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in Nomad action' };
    }
}
