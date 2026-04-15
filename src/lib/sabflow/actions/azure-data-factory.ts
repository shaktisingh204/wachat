'use server';

export async function executeAzureDataFactoryAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = inputs.accessToken;
        const subscriptionId = inputs.subscriptionId;
        const resourceGroupName = inputs.resourceGroupName;
        const factoryName = inputs.factoryName;
        const apiVersion = '2018-06-01';
        const baseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroupName}/providers/Microsoft.DataFactory/factories/${factoryName}`;
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
        };

        switch (actionName) {
            case 'listPipelines': {
                const res = await fetch(`${baseUrl}/pipelines?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { pipelines: data.value, nextLink: data.nextLink } };
            }
            case 'getPipeline': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineName}?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { pipeline: data } };
            }
            case 'createPipeline': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineName}?api-version=${apiVersion}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.pipelineBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { pipeline: data } };
            }
            case 'deletePipeline': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineName}?api-version=${apiVersion}`, { method: 'DELETE', headers });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.error?.message || `API error: ${res.status}`);
                }
                return { output: { deleted: true, pipelineName: inputs.pipelineName } };
            }
            case 'runPipeline': {
                const res = await fetch(`${baseUrl}/pipelines/${inputs.pipelineName}/createRun?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(inputs.parameters || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { runId: data.runId } };
            }
            case 'listPipelineRuns': {
                const body = {
                    lastUpdatedAfter: inputs.lastUpdatedAfter || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
                    lastUpdatedBefore: inputs.lastUpdatedBefore || new Date().toISOString(),
                    filters: inputs.filters || [],
                };
                const res = await fetch(`${baseUrl}/queryPipelineRuns?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { runs: data.value, continuationToken: data.continuationToken } };
            }
            case 'getPipelineRun': {
                const res = await fetch(`${baseUrl}/pipelineruns/${inputs.runId}?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { run: data } };
            }
            case 'cancelPipelineRun': {
                const res = await fetch(`${baseUrl}/pipelineruns/${inputs.runId}/cancel?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.error?.message || `API error: ${res.status}`);
                }
                return { output: { cancelled: true, runId: inputs.runId } };
            }
            case 'listDatasets': {
                const res = await fetch(`${baseUrl}/datasets?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { datasets: data.value, nextLink: data.nextLink } };
            }
            case 'getDataset': {
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetName}?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { dataset: data } };
            }
            case 'createDataset': {
                const res = await fetch(`${baseUrl}/datasets/${inputs.datasetName}?api-version=${apiVersion}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(inputs.datasetBody || {}),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { dataset: data } };
            }
            case 'listLinkedServices': {
                const res = await fetch(`${baseUrl}/linkedservices?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { linkedServices: data.value, nextLink: data.nextLink } };
            }
            case 'getLinkedService': {
                const res = await fetch(`${baseUrl}/linkedservices/${inputs.linkedServiceName}?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { linkedService: data } };
            }
            case 'listTriggers': {
                const res = await fetch(`${baseUrl}/triggers?api-version=${apiVersion}`, { method: 'GET', headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.error?.message || `API error: ${res.status}`);
                return { output: { triggers: data.value, nextLink: data.nextLink } };
            }
            case 'startTrigger': {
                const res = await fetch(`${baseUrl}/triggers/${inputs.triggerName}/start?api-version=${apiVersion}`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({}),
                });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data?.error?.message || `API error: ${res.status}`);
                }
                return { output: { started: true, triggerName: inputs.triggerName } };
            }
            default:
                return { error: `Action "${actionName}" is not implemented.` };
        }
    } catch (e: any) {
        return { error: e.message || 'Action failed.' };
    }
}
