'use server';

export async function executeReplicateEnhancedAction(actionName: string, inputs: any, user: any, logger: any) {
    const apiToken = inputs.apiToken;
    const baseUrl = 'https://api.replicate.com/v1';

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
        'Prefer': 'wait',
    };

    try {
        switch (actionName) {
            case 'runPrediction': {
                const { modelOwner, modelName, version, input: modelInput } = inputs;
                const body: any = { input: modelInput || {} };
                if (version) body.version = version;
                const url = version
                    ? `${baseUrl}/predictions`
                    : `${baseUrl}/models/${modelOwner}/${modelName}/predictions`;
                const res = await fetch(url, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createPrediction': {
                const body: any = {
                    input: inputs.input || {},
                };
                if (inputs.version) body.version = inputs.version;
                if (inputs.webhook) body.webhook = inputs.webhook;
                if (inputs.webhookEventsFilter) body.webhook_events_filter = inputs.webhookEventsFilter;
                if (inputs.stream !== undefined) body.stream = inputs.stream;
                const res = await fetch(`${baseUrl}/predictions`, {
                    method: 'POST',
                    headers: { ...headers, Prefer: '' },
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getPrediction': {
                const predictionId = inputs.predictionId;
                const res = await fetch(`${baseUrl}/predictions/${predictionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'cancelPrediction': {
                const predictionId = inputs.predictionId;
                const res = await fetch(`${baseUrl}/predictions/${predictionId}/cancel`, {
                    method: 'POST',
                    headers,
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listPredictions': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.append('cursor', inputs.cursor);
                const url = `${baseUrl}/predictions${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.append('cursor', inputs.cursor);
                const url = `${baseUrl}/models${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getModel': {
                const { modelOwner, modelName } = inputs;
                const res = await fetch(`${baseUrl}/models/${modelOwner}/${modelName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getModelVersion': {
                const { modelOwner, modelName, versionId } = inputs;
                const res = await fetch(`${baseUrl}/models/${modelOwner}/${modelName}/versions/${versionId}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listModelVersions': {
                const { modelOwner, modelName } = inputs;
                const params = new URLSearchParams();
                if (inputs.cursor) params.append('cursor', inputs.cursor);
                const url = `${baseUrl}/models/${modelOwner}/${modelName}/versions${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'runModel': {
                const { modelOwner, modelName } = inputs;
                const body: any = {
                    input: inputs.input || {},
                };
                if (inputs.webhook) body.webhook = inputs.webhook;
                const res = await fetch(`${baseUrl}/models/${modelOwner}/${modelName}/predictions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getCollection': {
                const collectionSlug = inputs.collectionSlug;
                const res = await fetch(`${baseUrl}/collections/${collectionSlug}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'listCollections': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.append('cursor', inputs.cursor);
                const url = `${baseUrl}/collections${params.toString() ? '?' + params.toString() : ''}`;
                const res = await fetch(url, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'createDeployment': {
                const body: any = {
                    name: inputs.name,
                    model: inputs.model,
                    version: inputs.version,
                    hardware: inputs.hardware || 'cpu',
                    min_instances: inputs.minInstances || 0,
                    max_instances: inputs.maxInstances || 1,
                };
                const res = await fetch(`${baseUrl}/deployments`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'getDeployment': {
                const { deploymentOwner, deploymentName } = inputs;
                const res = await fetch(`${baseUrl}/deployments/${deploymentOwner}/${deploymentName}`, { headers });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            case 'runDeployment': {
                const { deploymentOwner, deploymentName } = inputs;
                const body: any = {
                    input: inputs.input || {},
                };
                if (inputs.webhook) body.webhook = inputs.webhook;
                const res = await fetch(`${baseUrl}/deployments/${deploymentOwner}/${deploymentName}/predictions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                const data = await res.json();
                if (!res.ok) return { error: data.detail || data.title || `HTTP ${res.status}` };
                return { output: data };
            }

            default:
                return { error: `Unknown action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`ReplicateEnhanced error: ${err.message}`);
        return { error: err.message || 'Unknown error occurred' };
    }
}
