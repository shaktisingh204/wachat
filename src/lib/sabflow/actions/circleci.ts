
'use server';

const CIRCLECI_BASE = 'https://circleci.com/api/v2';

async function circleciFetch(apiToken: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[CircleCI] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            'Circle-Token': apiToken,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${CIRCLECI_BASE}${path}`, options);
    if (res.status === 204) return {};
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.message || `CircleCI API error: ${res.status}`);
    return data;
}

export async function executeCircleciAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken = String(inputs.apiToken ?? '').trim();
        if (!apiToken) throw new Error('apiToken is required.');
        const cci = (method: string, path: string, body?: any) => circleciFetch(apiToken, method, path, body, logger);

        switch (actionName) {
            case 'getPipeline': {
                const pipelineId = String(inputs.pipelineId ?? '').trim();
                if (!pipelineId) throw new Error('pipelineId is required.');
                const data = await cci('GET', `/pipeline/${pipelineId}`);
                return { output: { id: data.id, state: data.state, number: data.number, trigger: data.trigger } };
            }

            case 'listPipelines': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!projectSlug) throw new Error('projectSlug is required.');
                const branch = String(inputs.branch ?? '').trim();
                const qs = branch ? `?branch=${encodeURIComponent(branch)}` : '';
                const data = await cci('GET', `/project/${projectSlug}/pipeline${qs}`);
                return { output: { items: data.items ?? [] } };
            }

            case 'triggerPipeline': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                if (!projectSlug) throw new Error('projectSlug is required.');
                const branch = String(inputs.branch ?? '').trim();
                const parameters = inputs.parameters && typeof inputs.parameters === 'object' ? inputs.parameters : undefined;
                const body: any = {};
                if (branch) body.branch = branch;
                if (parameters) body.parameters = parameters;
                const data = await cci('POST', `/project/${projectSlug}/pipeline`, body);
                return { output: { id: data.id, number: data.number, state: data.state } };
            }

            case 'getWorkflow': {
                const workflowId = String(inputs.workflowId ?? '').trim();
                if (!workflowId) throw new Error('workflowId is required.');
                const data = await cci('GET', `/workflow/${workflowId}`);
                return { output: { id: data.id, name: data.name, status: data.status } };
            }

            case 'listWorkflows': {
                const pipelineId = String(inputs.pipelineId ?? '').trim();
                if (!pipelineId) throw new Error('pipelineId is required.');
                const data = await cci('GET', `/pipeline/${pipelineId}/workflow`);
                return { output: { items: data.items ?? [] } };
            }

            case 'rerunWorkflow': {
                const workflowId = String(inputs.workflowId ?? '').trim();
                if (!workflowId) throw new Error('workflowId is required.');
                const data = await cci('POST', `/workflow/${workflowId}/rerun`);
                return { output: { workflow_id: data.workflow_id } };
            }

            case 'cancelWorkflow': {
                const workflowId = String(inputs.workflowId ?? '').trim();
                if (!workflowId) throw new Error('workflowId is required.');
                const data = await cci('POST', `/workflow/${workflowId}/cancel`);
                return { output: { message: data.message ?? 'Workflow cancellation requested.' } };
            }

            case 'listJobs': {
                const workflowId = String(inputs.workflowId ?? '').trim();
                if (!workflowId) throw new Error('workflowId is required.');
                const data = await cci('GET', `/workflow/${workflowId}/job`);
                return { output: { items: data.items ?? [] } };
            }

            case 'getJob': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                const jobNumber = String(inputs.jobNumber ?? '').trim();
                if (!projectSlug || !jobNumber) throw new Error('projectSlug and jobNumber are required.');
                const data = await cci('GET', `/project/${projectSlug}/job/${jobNumber}`);
                return { output: { id: data.id, name: data.name, status: data.status, duration: data.duration } };
            }

            case 'cancelJob': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                const jobNumber = String(inputs.jobNumber ?? '').trim();
                if (!projectSlug || !jobNumber) throw new Error('projectSlug and jobNumber are required.');
                const data = await cci('POST', `/project/${projectSlug}/job/${jobNumber}/cancel`);
                return { output: { message: data.message ?? 'Job cancellation requested.' } };
            }

            case 'getArtifacts': {
                const projectSlug = String(inputs.projectSlug ?? '').trim();
                const jobNumber = String(inputs.jobNumber ?? '').trim();
                if (!projectSlug || !jobNumber) throw new Error('projectSlug and jobNumber are required.');
                const data = await cci('GET', `/project/${projectSlug}/job/${jobNumber}/artifacts`);
                return { output: { items: data.items ?? [] } };
            }

            case 'listContexts': {
                const ownerId = String(inputs.ownerId ?? '').trim();
                if (!ownerId) throw new Error('ownerId is required.');
                const ownerType = String(inputs.ownerType ?? 'organization').trim();
                const data = await cci('GET', `/context?owner-id=${encodeURIComponent(ownerId)}&owner-type=${encodeURIComponent(ownerType)}`);
                return { output: { items: data.items ?? [] } };
            }

            case 'getContext': {
                const contextId = String(inputs.contextId ?? '').trim();
                if (!contextId) throw new Error('contextId is required.');
                const data = await cci('GET', `/context/${contextId}`);
                return { output: { id: data.id, name: data.name } };
            }

            case 'listContextVariables': {
                const contextId = String(inputs.contextId ?? '').trim();
                if (!contextId) throw new Error('contextId is required.');
                const data = await cci('GET', `/context/${contextId}/environment-variable`);
                return { output: { items: data.items ?? [] } };
            }

            default:
                return { error: `CircleCI action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'CircleCI action failed.' };
    }
}
