'use server';

export async function executeMageAIAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const baseUrl = inputs.baseUrl;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
        };
        if (inputs.token) {
            headers['Authorization'] = `Bearer ${inputs.token}`;
            headers['Cookie'] = `oauth_token=${inputs.token}`;
        }

        switch (actionName) {
            case 'listPipelines': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.includeSchedules !== undefined) params.set('include_schedules', String(inputs.includeSchedules));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/api/pipelines${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI listPipelines failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getPipeline': {
                const params = new URLSearchParams();
                if (inputs.includeContent !== undefined) params.set('include_content', String(inputs.includeContent));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI getPipeline failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createPipeline': {
                const body: any = { pipeline: { name: inputs.name, type: inputs.type || 'python' } };
                if (inputs.description) body.pipeline.description = inputs.description;
                const res = await fetch(`${baseUrl}/api/pipelines`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI createPipeline failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updatePipeline': {
                const body: any = { pipeline: {} };
                if (inputs.name) body.pipeline.name = inputs.name;
                if (inputs.description) body.pipeline.description = inputs.description;
                if (inputs.type) body.pipeline.type = inputs.type;
                if (inputs.status) body.pipeline.status = inputs.status;
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI updatePipeline failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'deletePipeline': {
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}`, { method: 'DELETE', headers });
                if (!res.ok) return { error: `Mage AI deletePipeline failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'runPipeline': {
                const body: any = {
                    pipeline_run: {
                        pipeline_uuid: inputs.pipelineUuid,
                        variables: inputs.variables || {},
                    },
                };
                if (inputs.executionPartition) body.pipeline_run.execution_partition = inputs.executionPartition;
                const res = await fetch(`${baseUrl}/api/pipeline_schedules/${inputs.pipelineScheduleId || 1}/pipeline_runs`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(body),
                });
                if (!res.ok) return { error: `Mage AI runPipeline failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listBlocks': {
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/blocks`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI listBlocks failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getBlock': {
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/blocks/${inputs.blockUuid}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI getBlock failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createBlock': {
                const body: any = {
                    block: {
                        name: inputs.name,
                        type: inputs.blockType || 'transformer',
                        language: inputs.language || 'python',
                    },
                };
                if (inputs.content) body.block.content = inputs.content;
                if (inputs.upstreamBlocks) body.block.upstream_blocks = inputs.upstreamBlocks;
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/blocks`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI createBlock failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'updateBlock': {
                const body: any = { block: {} };
                if (inputs.name) body.block.name = inputs.name;
                if (inputs.content) body.block.content = inputs.content;
                if (inputs.upstreamBlocks) body.block.upstream_blocks = inputs.upstreamBlocks;
                if (inputs.configuration) body.block.configuration = inputs.configuration;
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/blocks/${inputs.blockUuid}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI updateBlock failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listRuns': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                if (inputs.status) params.set('status', inputs.status);
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/api/pipeline_runs${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI listRuns failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'getRun': {
                const res = await fetch(`${baseUrl}/api/pipeline_runs/${inputs.runId}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI getRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'cancelRun': {
                const body = { pipeline_run: { status: 'cancelled' } };
                const res = await fetch(`${baseUrl}/api/pipeline_runs/${inputs.runId}`, { method: 'PUT', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI cancelRun failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'listTriggers': {
                const params = new URLSearchParams();
                if (inputs.page) params.set('page', String(inputs.page));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/pipeline_schedules${qs}`, { method: 'GET', headers });
                if (!res.ok) return { error: `Mage AI listTriggers failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            case 'createTrigger': {
                const body: any = {
                    pipeline_schedule: {
                        name: inputs.name,
                        schedule_type: inputs.scheduleType || 'time',
                        start_time: inputs.startTime,
                        status: inputs.status || 'active',
                    },
                };
                if (inputs.scheduleInterval) body.pipeline_schedule.schedule_interval = inputs.scheduleInterval;
                if (inputs.variables) body.pipeline_schedule.variables = inputs.variables;
                const res = await fetch(`${baseUrl}/api/pipelines/${inputs.pipelineUuid}/pipeline_schedules`, { method: 'POST', headers, body: JSON.stringify(body) });
                if (!res.ok) return { error: `Mage AI createTrigger failed: ${res.status} ${await res.text()}` };
                return { output: await res.json() };
            }
            default:
                return { error: `Mage AI: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        return { error: err?.message || 'Mage AI action failed' };
    }
}
