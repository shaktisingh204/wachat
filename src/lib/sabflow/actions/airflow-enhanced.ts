'use server';

export async function executeAirflowEnhancedAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = `${inputs.baseUrl}/api/v1`;
        const basicAuth = Buffer.from(`${inputs.username}:${inputs.password}`).toString('base64');
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${basicAuth}`,
        };

        switch (actionName) {
            case 'listDags': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.onlyActive !== undefined) params.set('only_active', String(inputs.onlyActive));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/dags${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow listDags failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getDag': {
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow getDag failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateDag': {
                const body: any = {};
                if (inputs.isPaused !== undefined) body.is_paused = inputs.isPaused;
                if (inputs.tags) body.tags = inputs.tags;
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow updateDag failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'pauseDag': {
                const body = { is_paused: true };
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow pauseDag failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'unpauseDag': {
                const body = { is_paused: false };
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}`, { method: 'PATCH', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow unpauseDag failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'triggerDag': {
                const body: any = {
                    dag_run_id: inputs.dagRunId || `manual_${Date.now()}`,
                };
                if (inputs.conf) body.conf = inputs.conf;
                if (inputs.logicalDate) body.logical_date = inputs.logicalDate;
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow triggerDag failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listDagRuns': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.state) params.set('state', inputs.state);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow listDagRuns failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getDagRun': {
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns/${inputs.dagRunId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow getDagRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'clearDagRun': {
                const body: any = { dry_run: inputs.dryRun !== false };
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns/${inputs.dagRunId}/clear`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow clearDagRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTasks': {
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/tasks`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow listTasks failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTask': {
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/tasks/${inputs.taskId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow getTask failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTaskInstances': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.state) params.set('state', inputs.state);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns/${inputs.dagRunId}/taskInstances${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow listTaskInstances failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getTaskInstance': {
                const res = await fetch(`${baseUrl}/dags/${inputs.dagId}/dagRuns/${inputs.dagRunId}/taskInstances/${inputs.taskId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow getTaskInstance failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listVariables': {
                const params = new URLSearchParams();
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/variables${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Airflow listVariables failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'setVariable': {
                const body = { key: inputs.key, value: inputs.value, description: inputs.description || '' };
                const method = inputs.update ? 'PATCH' : 'POST';
                const url = inputs.update ? `${baseUrl}/variables/${inputs.key}` : `${baseUrl}/variables`;
                const res = await fetch(url, { method, headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Airflow setVariable failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Airflow Enhanced: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Airflow Enhanced action failed' };
    }
}
