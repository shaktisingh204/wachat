'use server';

async function vertexFetch(
    accessToken: string,
    method: string,
    url: string,
    logger: any,
    body?: any,
): Promise<any> {
    logger.log(`[VertexAI] ${method} ${url}`);
    const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };
    const options: RequestInit = { method, headers };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(url, options);
    const text = await res.text();
    let data: any;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!res.ok) throw new Error(data?.error?.message || data?.message || `Vertex AI API error: ${res.status}`);
    return data;
}

export async function executeVertexAiAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const accessToken = String(inputs.accessToken ?? '').trim();
        if (!accessToken) throw new Error('accessToken is required.');

        const projectId = String(inputs.projectId ?? '').trim();
        if (!projectId) throw new Error('projectId is required.');

        const location = String(inputs.location ?? 'us-central1').trim();
        const BASE = `https://${location}-aiplatform.googleapis.com/v1`;

        const api = (method: string, url: string, body?: any) =>
            vertexFetch(accessToken, method, url, logger, body);

        switch (actionName) {
            case 'predict': {
                const endpoint = String(inputs.endpoint ?? '').trim();
                if (!endpoint) throw new Error('endpoint is required (format: projects/{project}/locations/{location}/endpoints/{endpoint}).');
                const instances = inputs.instances ?? [];
                const body: any = { instances };
                if (inputs.parameters) body.parameters = inputs.parameters;
                const data = await api('POST', `${BASE}/${endpoint}:predict`, body);
                return { output: { predictions: data.predictions ?? [], deployedModelId: data.deployedModelId, metadata: data.metadata } };
            }

            case 'generateContent': {
                const model = String(inputs.model ?? 'gemini-1.0-pro').trim();
                const contents = inputs.contents ?? [{ role: 'user', parts: [{ text: String(inputs.prompt ?? inputs.text ?? '') }] }];
                const body: any = { contents };
                if (inputs.generationConfig) body.generationConfig = inputs.generationConfig;
                if (inputs.safetySettings) body.safetySettings = inputs.safetySettings;
                if (inputs.systemInstruction) body.systemInstruction = inputs.systemInstruction;
                const url = `${BASE}/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
                logger.log(`[VertexAI] generateContent: model=${model}`);
                const data = await api('POST', url, body);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                return { output: { text, candidates: data.candidates, usageMetadata: data.usageMetadata } };
            }

            case 'chat': {
                const model = String(inputs.model ?? 'gemini-1.0-pro').trim();
                const messages = inputs.messages ?? [{ role: 'user', parts: [{ text: String(inputs.message ?? inputs.prompt ?? '') }] }];
                const body: any = { contents: messages };
                if (inputs.generationConfig) body.generationConfig = inputs.generationConfig;
                if (inputs.safetySettings) body.safetySettings = inputs.safetySettings;
                const url = `${BASE}/projects/${projectId}/locations/${location}/publishers/google/models/${model}:generateContent`;
                const data = await api('POST', url, body);
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
                return { output: { text, candidates: data.candidates, usageMetadata: data.usageMetadata } };
            }

            case 'createEndpoint': {
                const displayName = String(inputs.displayName ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const body: any = { displayName };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.labels) body.labels = inputs.labels;
                if (inputs.encryptionSpec) body.encryptionSpec = inputs.encryptionSpec;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/endpoints`, body);
                return { output: { operation: data.name, metadata: data.metadata } };
            }

            case 'getEndpoint': {
                const endpointId = String(inputs.endpointId ?? '').trim();
                if (!endpointId) throw new Error('endpointId is required.');
                const data = await api('GET', `${BASE}/projects/${projectId}/locations/${location}/endpoints/${endpointId}`);
                return { output: data };
            }

            case 'listEndpoints': {
                const pageSize = Number(inputs.pageSize ?? 50);
                const pageToken = inputs.pageToken ? `&pageToken=${encodeURIComponent(String(inputs.pageToken))}` : '';
                const filter = inputs.filter ? `&filter=${encodeURIComponent(String(inputs.filter))}` : '';
                const data = await api('GET', `${BASE}/projects/${projectId}/locations/${location}/endpoints?pageSize=${pageSize}${pageToken}${filter}`);
                return { output: { endpoints: data.endpoints ?? [], nextPageToken: data.nextPageToken } };
            }

            case 'deployModel': {
                const endpointId = String(inputs.endpointId ?? '').trim();
                const modelId = String(inputs.modelId ?? '').trim();
                if (!endpointId) throw new Error('endpointId is required.');
                if (!modelId) throw new Error('modelId is required.');
                const deployedModel: any = {
                    model: `projects/${projectId}/locations/${location}/models/${modelId}`,
                };
                if (inputs.displayName) deployedModel.displayName = String(inputs.displayName);
                if (inputs.dedicatedResources) deployedModel.dedicatedResources = inputs.dedicatedResources;
                if (inputs.automaticResources) deployedModel.automaticResources = inputs.automaticResources;
                const body: any = { deployedModel };
                if (inputs.trafficSplit) body.trafficSplit = inputs.trafficSplit;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/endpoints/${endpointId}:deployModel`, body);
                return { output: { operation: data.name, metadata: data.metadata } };
            }

            case 'undeployModel': {
                const endpointId = String(inputs.endpointId ?? '').trim();
                const deployedModelId = String(inputs.deployedModelId ?? '').trim();
                if (!endpointId) throw new Error('endpointId is required.');
                if (!deployedModelId) throw new Error('deployedModelId is required.');
                const body: any = { deployedModelId };
                if (inputs.trafficSplit) body.trafficSplit = inputs.trafficSplit;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/endpoints/${endpointId}:undeployModel`, body);
                return { output: { operation: data.name, metadata: data.metadata } };
            }

            case 'createModel': {
                const displayName = String(inputs.displayName ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                const body: any = { displayName };
                if (inputs.description) body.description = String(inputs.description);
                if (inputs.containerSpec) body.containerSpec = inputs.containerSpec;
                if (inputs.artifactUri) body.artifactUri = String(inputs.artifactUri);
                if (inputs.labels) body.labels = inputs.labels;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/models`, body);
                return { output: { operation: data.name, metadata: data.metadata } };
            }

            case 'getModel': {
                const modelId = String(inputs.modelId ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await api('GET', `${BASE}/projects/${projectId}/locations/${location}/models/${modelId}`);
                return { output: data };
            }

            case 'listModels': {
                const pageSize = Number(inputs.pageSize ?? 50);
                const pageToken = inputs.pageToken ? `&pageToken=${encodeURIComponent(String(inputs.pageToken))}` : '';
                const filter = inputs.filter ? `&filter=${encodeURIComponent(String(inputs.filter))}` : '';
                const data = await api('GET', `${BASE}/projects/${projectId}/locations/${location}/models?pageSize=${pageSize}${pageToken}${filter}`);
                return { output: { models: data.models ?? [], nextPageToken: data.nextPageToken } };
            }

            case 'deleteModel': {
                const modelId = String(inputs.modelId ?? '').trim();
                if (!modelId) throw new Error('modelId is required.');
                const data = await api('DELETE', `${BASE}/projects/${projectId}/locations/${location}/models/${modelId}`);
                return { output: { operation: data.name, deleted: true } };
            }

            case 'batchPredict': {
                const modelId = String(inputs.modelId ?? '').trim();
                const displayName = String(inputs.displayName ?? 'batch-prediction').trim();
                const inputConfig = inputs.inputConfig ?? {};
                const outputConfig = inputs.outputConfig ?? {};
                if (!modelId) throw new Error('modelId is required.');
                const body: any = {
                    displayName,
                    model: `projects/${projectId}/locations/${location}/models/${modelId}`,
                    inputConfig,
                    outputConfig,
                };
                if (inputs.modelParameters) body.modelParameters = inputs.modelParameters;
                if (inputs.dedicatedResources) body.dedicatedResources = inputs.dedicatedResources;
                if (inputs.labels) body.labels = inputs.labels;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/batchPredictionJobs`, body);
                return { output: data };
            }

            case 'createBatchPredictionJob': {
                const displayName = String(inputs.displayName ?? '').trim();
                const modelId = String(inputs.modelId ?? '').trim();
                if (!displayName) throw new Error('displayName is required.');
                if (!modelId) throw new Error('modelId is required.');
                const body: any = {
                    displayName,
                    model: `projects/${projectId}/locations/${location}/models/${modelId}`,
                    inputConfig: inputs.inputConfig ?? {},
                    outputConfig: inputs.outputConfig ?? {},
                };
                if (inputs.modelParameters) body.modelParameters = inputs.modelParameters;
                if (inputs.dedicatedResources) body.dedicatedResources = inputs.dedicatedResources;
                if (inputs.machineType) {
                    body.dedicatedResources = body.dedicatedResources ?? {};
                    body.dedicatedResources.machineSpec = { machineType: String(inputs.machineType) };
                }
                if (inputs.labels) body.labels = inputs.labels;
                const data = await api('POST', `${BASE}/projects/${projectId}/locations/${location}/batchPredictionJobs`, body);
                return { output: data };
            }

            case 'getJob': {
                const jobId = String(inputs.jobId ?? '').trim();
                const jobType = String(inputs.jobType ?? 'batchPredictionJobs').trim();
                if (!jobId) throw new Error('jobId is required.');
                const data = await api('GET', `${BASE}/projects/${projectId}/locations/${location}/${jobType}/${jobId}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Vertex AI action: "${actionName}"`);
        }
    } catch (err: any) {
        logger.log(`[VertexAI] Error in action "${actionName}": ${err.message}`);
        return { error: err.message ?? 'Unknown Vertex AI error' };
    }
}
