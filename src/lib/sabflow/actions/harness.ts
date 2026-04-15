'use server';

export async function executeHarnessAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const baseUrl = 'https://app.harness.io';
        const headers: Record<string, string> = {
            'x-api-key': inputs.apiKey,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listPipelines': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.size) params.set('size', String(inputs.size));
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipeline': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines/${inputs.pipelineId}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createPipeline': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines?${params}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ pipeline: inputs.pipelineYaml ?? inputs.pipeline }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'updatePipeline': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines/${inputs.pipelineId}?${params}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify({ pipeline: inputs.pipelineYaml ?? inputs.pipeline }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'deletePipeline': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines/${inputs.pipelineId}?${params}`, {
                    method: 'DELETE',
                    headers,
                });
                const text = await res.text();
                return { output: { success: res.ok, status: res.status, body: text } };
            }

            case 'executePipeline': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const body: Record<string, any> = {};
                if (inputs.inputSetReferences) body.inputSetReferences = inputs.inputSetReferences;
                if (inputs.runtimeInputYaml) body.runtimeInputYaml = inputs.runtimeInputYaml;
                if (inputs.branch) body.branch = inputs.branch;
                const res = await fetch(`${baseUrl}/pipeline/api/pipeline/execute/${inputs.pipelineId}?${params}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'getPipelineExecution': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines/execution/${inputs.planExecutionId}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'listPipelineExecutions': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                if (inputs.pipelineIdentifier) params.set('pipelineIdentifier', inputs.pipelineIdentifier);
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.size) params.set('size', String(inputs.size));
                const res = await fetch(`${baseUrl}/pipeline/api/pipelines/execution/summary?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'abortExecution': {
                const params = new URLSearchParams({
                    accountIdentifier: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/pipeline/api/pipeline/execute/interrupt/${inputs.planExecutionId}?${params}&interruptType=AbortAll`, {
                    method: 'PUT',
                    headers,
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listServices': {
                const params = new URLSearchParams({
                    accountId: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.size) params.set('size', String(inputs.size));
                const res = await fetch(`${baseUrl}/ng/api/servicesV2?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getService': {
                const params = new URLSearchParams({
                    accountId: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/ng/api/servicesV2/${inputs.serviceId}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createService': {
                const params = new URLSearchParams({ accountId: inputs.accountId });
                const res = await fetch(`${baseUrl}/ng/api/servicesV2?${params}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        identifier: inputs.identifier,
                        name: inputs.name,
                        orgIdentifier: inputs.orgId,
                        projectIdentifier: inputs.projectId,
                        description: inputs.description,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            case 'listEnvironments': {
                const params = new URLSearchParams({
                    accountId: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.size) params.set('size', String(inputs.size));
                const res = await fetch(`${baseUrl}/ng/api/environmentsV2?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'getEnvironment': {
                const params = new URLSearchParams({
                    accountId: inputs.accountId,
                    orgIdentifier: inputs.orgId,
                    projectIdentifier: inputs.projectId,
                });
                const res = await fetch(`${baseUrl}/ng/api/environmentsV2/${inputs.environmentId}?${params}`, { headers });
                const data = await res.json();
                return { output: data };
            }

            case 'createEnvironment': {
                const params = new URLSearchParams({ accountId: inputs.accountId });
                const res = await fetch(`${baseUrl}/ng/api/environmentsV2?${params}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        identifier: inputs.identifier,
                        name: inputs.name,
                        orgIdentifier: inputs.orgId,
                        projectIdentifier: inputs.projectId,
                        type: inputs.type ?? 'PreProduction',
                        description: inputs.description,
                    }),
                });
                const data = await res.json();
                return { output: data };
            }

            default:
                return { error: `Unknown Harness action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`Harness action error: ${err.message}`);
        return { error: err.message };
    }
}
