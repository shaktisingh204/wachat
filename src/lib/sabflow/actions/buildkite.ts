
'use server';

const BK_BASE = 'https://api.buildkite.com/v2';

async function bkFetch(token: string, method: string, path: string, body?: any, logger?: any) {
    logger?.log(`[Buildkite] ${method} ${path}`);
    const options: RequestInit = {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
    if (body !== undefined) options.body = JSON.stringify(body);
    const res = await fetch(`${BK_BASE}${path}`, options);
    if (res.status === 204) return {};
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data?.message || `Buildkite API error: ${res.status}`);
    }
    return data;
}

export async function executeBuildkiteAction(actionName: string, inputs: any, user: any, logger: any): Promise<{ output?: any; error?: string }> {
    try {
        const token = String(inputs.apiToken ?? '').trim();
        if (!token) throw new Error('apiToken is required.');
        const bk = (method: string, path: string, body?: any) => bkFetch(token, method, path, body, logger);

        switch (actionName) {
            case 'listOrganizations': {
                const data = await bk('GET', '/organizations');
                return { output: { organizations: data } };
            }

            case 'listPipelines': {
                const org = String(inputs.orgSlug ?? '').trim();
                if (!org) throw new Error('orgSlug is required.');
                const data = await bk('GET', `/organizations/${org}/pipelines`);
                return { output: { pipelines: data } };
            }

            case 'getPipeline': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                if (!org || !pipeline) throw new Error('orgSlug and pipelineSlug are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}`);
                return { output: data };
            }

            case 'createPipeline': {
                const org = String(inputs.orgSlug ?? '').trim();
                if (!org) throw new Error('orgSlug is required.');
                const body: any = {
                    name: inputs.name,
                    repository: inputs.repository,
                };
                if (inputs.steps) body.steps = inputs.steps;
                if (inputs.description) body.description = inputs.description;
                const data = await bk('POST', `/organizations/${org}/pipelines`, body);
                return { output: { id: data.id, slug: data.slug, name: data.name, url: data.url } };
            }

            case 'updatePipeline': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                if (!org || !pipeline) throw new Error('orgSlug and pipelineSlug are required.');
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.description) body.description = inputs.description;
                if (inputs.repository) body.repository = inputs.repository;
                const data = await bk('PATCH', `/organizations/${org}/pipelines/${pipeline}`, body);
                return { output: data };
            }

            case 'deletePipeline': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                if (!org || !pipeline) throw new Error('orgSlug and pipelineSlug are required.');
                await bk('DELETE', `/organizations/${org}/pipelines/${pipeline}`);
                return { output: { deleted: true } };
            }

            case 'listBuilds': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                if (!org || !pipeline) throw new Error('orgSlug and pipelineSlug are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}/builds`);
                return { output: { builds: data } };
            }

            case 'getBuild': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!org || !pipeline || !buildNumber) throw new Error('orgSlug, pipelineSlug, and buildNumber are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}`);
                return { output: data };
            }

            case 'createBuild': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                if (!org || !pipeline) throw new Error('orgSlug and pipelineSlug are required.');
                const body: any = {
                    commit: inputs.commit ?? 'HEAD',
                    branch: inputs.branch ?? 'main',
                };
                if (inputs.message) body.message = inputs.message;
                if (inputs.env) body.env = inputs.env;
                if (inputs.metadata) body.meta_data = inputs.metadata;
                const data = await bk('POST', `/organizations/${org}/pipelines/${pipeline}/builds`, body);
                return { output: { id: data.id, number: data.number, state: data.state, url: data.url, web_url: data.web_url } };
            }

            case 'cancelBuild': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!org || !pipeline || !buildNumber) throw new Error('orgSlug, pipelineSlug, and buildNumber are required.');
                const data = await bk('PUT', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/cancel`);
                return { output: { state: data.state } };
            }

            case 'rebuildBuild': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!org || !pipeline || !buildNumber) throw new Error('orgSlug, pipelineSlug, and buildNumber are required.');
                const data = await bk('PUT', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/rebuild`);
                return { output: { id: data.id, number: data.number, state: data.state, url: data.url } };
            }

            case 'listJobs': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!org || !pipeline || !buildNumber) throw new Error('orgSlug, pipelineSlug, and buildNumber are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}`);
                return { output: { jobs: data.jobs ?? [] } };
            }

            case 'retryJob': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                const jobId = String(inputs.jobId ?? '').trim();
                if (!org || !pipeline || !buildNumber || !jobId) throw new Error('orgSlug, pipelineSlug, buildNumber, and jobId are required.');
                const data = await bk('PUT', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/jobs/${jobId}/retry`);
                return { output: data };
            }

            case 'listAgents': {
                const org = String(inputs.orgSlug ?? '').trim();
                if (!org) throw new Error('orgSlug is required.');
                const data = await bk('GET', `/organizations/${org}/agents`);
                return { output: { agents: data } };
            }

            case 'getAgent': {
                const org = String(inputs.orgSlug ?? '').trim();
                const agentId = String(inputs.agentId ?? '').trim();
                if (!org || !agentId) throw new Error('orgSlug and agentId are required.');
                const data = await bk('GET', `/organizations/${org}/agents/${agentId}`);
                return { output: data };
            }

            case 'stopAgent': {
                const org = String(inputs.orgSlug ?? '').trim();
                const agentId = String(inputs.agentId ?? '').trim();
                if (!org || !agentId) throw new Error('orgSlug and agentId are required.');
                await bk('PUT', `/organizations/${org}/agents/${agentId}/stop`, { force: inputs.force === true || inputs.force === 'true' });
                return { output: { stopped: true } };
            }

            case 'listArtifacts': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                if (!org || !pipeline || !buildNumber) throw new Error('orgSlug, pipelineSlug, and buildNumber are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/artifacts`);
                return { output: { artifacts: data } };
            }

            case 'downloadArtifact': {
                const org = String(inputs.orgSlug ?? '').trim();
                const pipeline = String(inputs.pipelineSlug ?? '').trim();
                const buildNumber = String(inputs.buildNumber ?? '').trim();
                const artifactId = String(inputs.artifactId ?? '').trim();
                if (!org || !pipeline || !buildNumber || !artifactId) throw new Error('orgSlug, pipelineSlug, buildNumber, and artifactId are required.');
                const data = await bk('GET', `/organizations/${org}/pipelines/${pipeline}/builds/${buildNumber}/artifacts/${artifactId}`);
                return { output: data };
            }

            default:
                throw new Error(`Unknown Buildkite action: ${actionName}`);
        }
    } catch (err: any) {
        logger?.log(`[Buildkite] Error in ${actionName}: ${err.message}`);
        return { error: err.message ?? 'Unknown Buildkite error' };
    }
}
