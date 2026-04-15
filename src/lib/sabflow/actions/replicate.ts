'use server';

const REPLICATE_BASE = 'https://api.replicate.com/v1';

async function repGet(apiToken: string, path: string, logger: any) {
    logger.log(`[Replicate] GET ${path}`);
    const res = await fetch(`${REPLICATE_BASE}${path}`, {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || `Replicate API error: ${res.status}`);
    return data;
}

async function repPost(apiToken: string, path: string, body: any, logger: any) {
    logger.log(`[Replicate] POST ${path}`);
    const res = await fetch(`${REPLICATE_BASE}${path}`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || `Replicate API error: ${res.status}`);
    return data;
}

async function repDelete(apiToken: string, path: string, logger: any) {
    logger.log(`[Replicate] DELETE ${path}`);
    const res = await fetch(`${REPLICATE_BASE}${path}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiToken}` },
    });
    if (res.status === 204) return { success: true };
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `Replicate API error: ${res.status}`);
    return data;
}

export async function executeReplicateAction(actionName: string, inputs: any, user: any, logger: any) {
    try {
        const apiToken: string = inputs.apiToken;
        if (!apiToken) throw new Error('Replicate apiToken is required');

        switch (actionName) {
            case 'createPrediction': {
                const { version, input, webhook, webhookEventsFilter } = inputs;
                if (!version) throw new Error('version is required');
                const body: any = { version, input: input || {} };
                if (webhook) body.webhook = webhook;
                if (webhookEventsFilter) body.webhook_events_filter = webhookEventsFilter;
                const data = await repPost(apiToken, '/predictions', body, logger);
                return { output: data };
            }
            case 'getPrediction': {
                const { predictionId } = inputs;
                if (!predictionId) throw new Error('predictionId is required');
                const data = await repGet(apiToken, `/predictions/${predictionId}`, logger);
                return { output: data };
            }
            case 'listPredictions': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const qs = params.toString() ? `?${params}` : '';
                const data = await repGet(apiToken, `/predictions${qs}`, logger);
                return { output: data };
            }
            case 'cancelPrediction': {
                const { predictionId } = inputs;
                if (!predictionId) throw new Error('predictionId is required');
                const data = await repPost(apiToken, `/predictions/${predictionId}/cancel`, {}, logger);
                return { output: data };
            }
            case 'createDeploymentPrediction': {
                const { deploymentOwner, deploymentName, input, webhook } = inputs;
                if (!deploymentOwner || !deploymentName) throw new Error('deploymentOwner and deploymentName are required');
                const body: any = { input: input || {} };
                if (webhook) body.webhook = webhook;
                const data = await repPost(apiToken, `/deployments/${deploymentOwner}/${deploymentName}/predictions`, body, logger);
                return { output: data };
            }
            case 'getDeploymentPrediction': {
                const { deploymentOwner, deploymentName, predictionId } = inputs;
                if (!deploymentOwner || !deploymentName || !predictionId) throw new Error('deploymentOwner, deploymentName, and predictionId are required');
                const data = await repGet(apiToken, `/deployments/${deploymentOwner}/${deploymentName}/predictions/${predictionId}`, logger);
                return { output: data };
            }
            case 'listModels': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const qs = params.toString() ? `?${params}` : '';
                const data = await repGet(apiToken, `/models${qs}`, logger);
                return { output: data };
            }
            case 'getModel': {
                const { modelOwner, modelName } = inputs;
                if (!modelOwner || !modelName) throw new Error('modelOwner and modelName are required');
                const data = await repGet(apiToken, `/models/${modelOwner}/${modelName}`, logger);
                return { output: data };
            }
            case 'listModelVersions': {
                const { modelOwner, modelName } = inputs;
                if (!modelOwner || !modelName) throw new Error('modelOwner and modelName are required');
                const data = await repGet(apiToken, `/models/${modelOwner}/${modelName}/versions`, logger);
                return { output: data };
            }
            case 'getModelVersion': {
                const { modelOwner, modelName, versionId } = inputs;
                if (!modelOwner || !modelName || !versionId) throw new Error('modelOwner, modelName, and versionId are required');
                const data = await repGet(apiToken, `/models/${modelOwner}/${modelName}/versions/${versionId}`, logger);
                return { output: data };
            }
            case 'deleteModelVersion': {
                const { modelOwner, modelName, versionId } = inputs;
                if (!modelOwner || !modelName || !versionId) throw new Error('modelOwner, modelName, and versionId are required');
                const data = await repDelete(apiToken, `/models/${modelOwner}/${modelName}/versions/${versionId}`, logger);
                return { output: data };
            }
            case 'createTraining': {
                const { modelOwner, modelName, versionId, destination, input, webhook } = inputs;
                if (!modelOwner || !modelName || !versionId || !destination) throw new Error('modelOwner, modelName, versionId, and destination are required');
                const body: any = { destination, input: input || {} };
                if (webhook) body.webhook = webhook;
                const data = await repPost(apiToken, `/models/${modelOwner}/${modelName}/versions/${versionId}/trainings`, body, logger);
                return { output: data };
            }
            case 'getTraining': {
                const { trainingId } = inputs;
                if (!trainingId) throw new Error('trainingId is required');
                const data = await repGet(apiToken, `/trainings/${trainingId}`, logger);
                return { output: data };
            }
            case 'cancelTraining': {
                const { trainingId } = inputs;
                if (!trainingId) throw new Error('trainingId is required');
                const data = await repPost(apiToken, `/trainings/${trainingId}/cancel`, {}, logger);
                return { output: data };
            }
            case 'listTrainings': {
                const params = new URLSearchParams();
                if (inputs.cursor) params.set('cursor', inputs.cursor);
                const qs = params.toString() ? `?${params}` : '';
                const data = await repGet(apiToken, `/trainings${qs}`, logger);
                return { output: data };
            }
            default:
                return { error: `Replicate action "${actionName}" is not implemented.` };
        }
    } catch (err: any) {
        logger.log(`[Replicate] Error: ${err.message}`);
        return { error: err.message };
    }
}
