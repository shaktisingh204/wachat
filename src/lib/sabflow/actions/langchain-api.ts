'use server';

export async function executeLangChainApiAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
) {
    const baseUrl = 'https://api.smith.langchain.com';
    const apiKey = inputs.apiKey;
    const headers: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    };

    try {
        switch (actionName) {
            case 'listProjects': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.name) params.set('name', inputs.name);
                const res = await fetch(`${baseUrl}/api/v1/sessions?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: { projects: data } };
            }

            case 'getProject': {
                const res = await fetch(`${baseUrl}/api/v1/sessions/${inputs.projectId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createProject': {
                const res = await fetch(`${baseUrl}/api/v1/sessions`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        extra: inputs.extra,
                        default_dataset_id: inputs.defaultDatasetId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'deleteProject': {
                const res = await fetch(`${baseUrl}/api/v1/sessions/${inputs.projectId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                }
                return { output: { success: true, projectId: inputs.projectId } };
            }

            case 'listRuns': {
                const params = new URLSearchParams();
                if (inputs.sessionId) params.set('session', inputs.sessionId);
                if (inputs.runType) params.set('run_type', inputs.runType);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.filter) params.set('filter', inputs.filter);
                const res = await fetch(`${baseUrl}/api/v1/runs?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: { runs: data } };
            }

            case 'getRun': {
                const res = await fetch(`${baseUrl}/api/v1/runs/${inputs.runId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createRun': {
                const res = await fetch(`${baseUrl}/api/v1/runs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        run_type: inputs.runType || 'chain',
                        inputs: inputs.runInputs,
                        outputs: inputs.runOutputs,
                        session_name: inputs.sessionName,
                        session_id: inputs.sessionId,
                        start_time: inputs.startTime || new Date().toISOString(),
                        end_time: inputs.endTime,
                        extra: inputs.extra,
                        tags: inputs.tags,
                        error: inputs.error,
                        parent_run_id: inputs.parentRunId,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'updateRun': {
                const res = await fetch(`${baseUrl}/api/v1/runs/${inputs.runId}`, {
                    method: 'PATCH',
                    headers,
                    body: JSON.stringify({
                        outputs: inputs.runOutputs,
                        error: inputs.error,
                        end_time: inputs.endTime || new Date().toISOString(),
                        extra: inputs.extra,
                        events: inputs.events,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'listFeedback': {
                const params = new URLSearchParams();
                if (inputs.runId) params.set('run', inputs.runId);
                if (inputs.key) {
                    const keys = Array.isArray(inputs.key) ? inputs.key : [inputs.key];
                    keys.forEach((k: string) => params.append('key', k));
                }
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const res = await fetch(`${baseUrl}/api/v1/feedback?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: { feedback: data } };
            }

            case 'createFeedback': {
                const res = await fetch(`${baseUrl}/api/v1/feedback`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        run_id: inputs.runId,
                        key: inputs.key,
                        score: inputs.score,
                        value: inputs.value,
                        comment: inputs.comment,
                        correction: inputs.correction,
                        feedback_source: inputs.feedbackSource,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'listDatasets': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.name) params.set('name', inputs.name);
                const res = await fetch(`${baseUrl}/api/v1/datasets?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: { datasets: data } };
            }

            case 'getDataset': {
                const res = await fetch(`${baseUrl}/api/v1/datasets/${inputs.datasetId}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'createDataset': {
                const res = await fetch(`${baseUrl}/api/v1/datasets`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        name: inputs.name,
                        description: inputs.description,
                        data_type: inputs.dataType || 'kv',
                        extra: inputs.extra,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: data };
            }

            case 'deleteDataset': {
                const res = await fetch(`${baseUrl}/api/v1/datasets/${inputs.datasetId}`, {
                    method: 'DELETE',
                    headers,
                });
                if (!res.ok) {
                    const data = await res.json().catch(() => ({}));
                    throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                }
                return { output: { success: true, datasetId: inputs.datasetId } };
            }

            case 'listExamples': {
                const params = new URLSearchParams();
                if (inputs.datasetId) params.set('dataset', inputs.datasetId);
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.splits) {
                    const splits = Array.isArray(inputs.splits) ? inputs.splits : [inputs.splits];
                    splits.forEach((s: string) => params.append('splits', s));
                }
                const res = await fetch(`${baseUrl}/api/v1/examples?${params.toString()}`, { headers });
                const data = await res.json();
                if (!res.ok) throw new Error(data?.detail || data?.message || `HTTP ${res.status}`);
                return { output: { examples: data } };
            }

            default:
                return { error: `Unknown action "${actionName}" for langchain_api.` };
        }
    } catch (err: any) {
        logger.log(`LangChain API error [${actionName}]: ${err.message}`);
        return { error: err.message || 'LangChain API action failed.' };
    }
}
