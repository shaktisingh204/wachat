'use server';

export async function executePrefectEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `https://api.prefect.cloud/api/accounts/${inputs.accountId}/workspaces/${inputs.workspaceId}`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${inputs.apiKey}`,
        };

        switch (actionName) {
            case 'listFlows': {
                const body: any = {};
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.offset) body.offset = inputs.offset;
                if (inputs.name) body.flows = { name: { any_: [inputs.name] } };
                const res = await fetch(`${baseUrl}/flows/filter`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect listFlows failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getFlow': {
                const res = await fetch(`${baseUrl}/flows/${inputs.flowId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Prefect getFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createFlow': {
                const body = { name: inputs.name, tags: inputs.tags || [] };
                const res = await fetch(`${baseUrl}/flows/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect createFlow failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listFlowRuns': {
                const body: any = {};
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.offset) body.offset = inputs.offset;
                if (inputs.flowId) body.flow_runs = { flow_id: { any_: [inputs.flowId] } };
                const res = await fetch(`${baseUrl}/flow_runs/filter`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect listFlowRuns failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getFlowRun': {
                const res = await fetch(`${baseUrl}/flow_runs/${inputs.flowRunId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Prefect getFlowRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createFlowRun': {
                const body: any = {
                    name: inputs.name,
                    flow_id: inputs.flowId,
                    parameters: inputs.parameters || {},
                    tags: inputs.tags || [],
                };
                if (inputs.state) body.state = inputs.state;
                const res = await fetch(`${baseUrl}/flow_runs/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect createFlowRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'cancelFlowRun': {
                const body = { state: { type: 'CANCELLED', message: inputs.message || 'Cancelled via SabFlow' } };
                const res = await fetch(`${baseUrl}/flow_runs/${inputs.flowRunId}/set_state`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect cancelFlowRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listDeployments': {
                const body: any = {};
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.offset) body.offset = inputs.offset;
                const res = await fetch(`${baseUrl}/deployments/filter`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect listDeployments failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getDeployment': {
                const res = await fetch(`${baseUrl}/deployments/${inputs.deploymentId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Prefect getDeployment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createDeployment': {
                const body: any = {
                    name: inputs.name,
                    flow_id: inputs.flowId,
                    entrypoint: inputs.entrypoint,
                    work_pool_name: inputs.workPoolName,
                    parameters: inputs.parameters || {},
                    tags: inputs.tags || [],
                };
                if (inputs.schedules) body.schedules = inputs.schedules;
                const res = await fetch(`${baseUrl}/deployments/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect createDeployment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'runDeployment': {
                const body: any = { parameters: inputs.parameters || {} };
                if (inputs.name) body.name = inputs.name;
                if (inputs.tags) body.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/deployments/${inputs.deploymentId}/create_flow_run`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect runDeployment failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listWorkPools': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/work_pools/${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Prefect listWorkPools failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getWorkPool': {
                const res = await fetch(`${baseUrl}/work_pools/${inputs.workPoolName}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Prefect getWorkPool failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createWorkPool': {
                const body: any = {
                    name: inputs.name,
                    type: inputs.type || 'process',
                };
                if (inputs.description) body.description = inputs.description;
                if (inputs.basejobTemplate) body.base_job_template = inputs.basejobTemplate;
                const res = await fetch(`${baseUrl}/work_pools/`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect createWorkPool failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listBlocks': {
                const body: any = {};
                if (inputs.limit) body.limit = inputs.limit;
                if (inputs.offset) body.offset = inputs.offset;
                if (inputs.blockTypeSlug) body.block_documents = { block_type_slug: { any_: [inputs.blockTypeSlug] } };
                const res = await fetch(`${baseUrl}/block_documents/filter`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Prefect listBlocks failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Prefect Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Prefect Enhanced action failed' };
    }
}
