'use server';

export async function executeDbtCloudAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output: any } | { error: string }> {
    try {
        logger.log(`Executing dbt Cloud action: ${actionName}`);

        if (!inputs.apiToken) return { error: 'Missing required input: apiToken' };

        const baseUrl = 'https://cloud.getdbt.com/api/v2';

        async function dbtFetch(method: string, path: string, body?: any): Promise<any> {
            const url = `${baseUrl}${path}`;
            const res = await fetch(url, {
                method,
                headers: {
                    'Authorization': `Token ${inputs.apiToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: body !== undefined ? JSON.stringify(body) : undefined,
            });
            const text = await res.text();
            let data: any;
            try { data = JSON.parse(text); } catch { data = { raw: text }; }
            if (!res.ok) {
                throw new Error(data?.status?.user_message ?? data?.message ?? data?.error ?? `dbt Cloud API error ${res.status}: ${text}`);
            }
            return data;
        }

        switch (actionName) {

            case 'listAccounts': {
                const data = await dbtFetch('GET', '/accounts/');
                return { output: { accounts: data.data ?? data } };
            }

            case 'getAccount': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/`);
                return { output: { account: data.data ?? data } };
            }

            case 'listProjects': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const params = new URLSearchParams();
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/projects/${query}`);
                return { output: { projects: data.data ?? data, extra: data.extra } };
            }

            case 'getProject': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.projectId) return { error: 'Missing required input: projectId' };
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/projects/${inputs.projectId}/`);
                return { output: { project: data.data ?? data } };
            }

            case 'listEnvironments': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.projectId) return { error: 'Missing required input: projectId' };
                const params = new URLSearchParams();
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/projects/${inputs.projectId}/environments/${query}`);
                return { output: { environments: data.data ?? data } };
            }

            case 'getEnvironment': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.projectId) return { error: 'Missing required input: projectId' };
                if (!inputs.environmentId) return { error: 'Missing required input: environmentId' };
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/projects/${inputs.projectId}/environments/${inputs.environmentId}/`);
                return { output: { environment: data.data ?? data } };
            }

            case 'listJobs': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const params = new URLSearchParams();
                if (inputs.projectId) params.set('project_id', String(inputs.projectId));
                if (inputs.environmentId) params.set('environment_id', String(inputs.environmentId));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/jobs/${query}`);
                return { output: { jobs: data.data ?? data, extra: data.extra } };
            }

            case 'getJob': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.jobId) return { error: 'Missing required input: jobId' };
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/jobs/${inputs.jobId}/`);
                return { output: { job: data.data ?? data } };
            }

            case 'createJob': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.projectId) return { error: 'Missing required input: projectId' };
                if (!inputs.environmentId) return { error: 'Missing required input: environmentId' };
                if (!inputs.name) return { error: 'Missing required input: name' };
                const body: any = {
                    account_id: inputs.accountId,
                    project_id: inputs.projectId,
                    environment_id: inputs.environmentId,
                    name: inputs.name,
                    execute_steps: inputs.executeSteps ?? ['dbt run'],
                    dbt_version: inputs.dbtVersion ?? null,
                    triggers: inputs.triggers ?? { github_webhook: false, schedule: false, custom_branch_only: false },
                    settings: inputs.settings ?? { threads: 4, target_name: 'default' },
                    schedule: inputs.schedule ?? { date: { type: 'every_day' }, time: { type: 'every_hour', interval: 1 } },
                };
                if (inputs.description) body.description = inputs.description;
                const data = await dbtFetch('POST', `/accounts/${inputs.accountId}/jobs/`, body);
                return { output: { job: data.data ?? data } };
            }

            case 'updateJob': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.jobId) return { error: 'Missing required input: jobId' };
                const body: any = {};
                if (inputs.name) body.name = inputs.name;
                if (inputs.executeSteps) body.execute_steps = inputs.executeSteps;
                if (inputs.triggers) body.triggers = inputs.triggers;
                if (inputs.settings) body.settings = inputs.settings;
                if (inputs.schedule) body.schedule = inputs.schedule;
                if (inputs.description !== undefined) body.description = inputs.description;
                const data = await dbtFetch('POST', `/accounts/${inputs.accountId}/jobs/${inputs.jobId}/`, body);
                return { output: { job: data.data ?? data } };
            }

            case 'triggerJob': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.jobId) return { error: 'Missing required input: jobId' };
                const body: any = {
                    cause: inputs.cause ?? 'Triggered via SabFlow',
                };
                if (inputs.gitBranch) body.git_branch = inputs.gitBranch;
                if (inputs.gitSha) body.git_sha = inputs.gitSha;
                if (inputs.stepsOverride) body.steps_override = inputs.stepsOverride;
                const data = await dbtFetch('POST', `/accounts/${inputs.accountId}/jobs/${inputs.jobId}/run/`, body);
                return { output: { run: data.data ?? data } };
            }

            case 'getJobRun': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.runId) return { error: 'Missing required input: runId' };
                const params = new URLSearchParams();
                if (inputs.includeRelated) params.set('include_related', inputs.includeRelated);
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/runs/${inputs.runId}/${query}`);
                return { output: { run: data.data ?? data } };
            }

            case 'listJobRuns': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                const params = new URLSearchParams();
                if (inputs.jobId) params.set('job_definition_id', String(inputs.jobId));
                if (inputs.projectId) params.set('project_id', String(inputs.projectId));
                if (inputs.offset) params.set('offset', String(inputs.offset));
                if (inputs.limit) params.set('limit', String(inputs.limit));
                if (inputs.status) params.set('status', String(inputs.status));
                const query = params.toString() ? `?${params.toString()}` : '';
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/runs/${query}`);
                return { output: { runs: data.data ?? data, extra: data.extra } };
            }

            case 'cancelJobRun': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.runId) return { error: 'Missing required input: runId' };
                const data = await dbtFetch('POST', `/accounts/${inputs.accountId}/runs/${inputs.runId}/cancel/`);
                return { output: { run: data.data ?? data } };
            }

            case 'getArtifacts': {
                if (!inputs.accountId) return { error: 'Missing required input: accountId' };
                if (!inputs.runId) return { error: 'Missing required input: runId' };
                const data = await dbtFetch('GET', `/accounts/${inputs.accountId}/runs/${inputs.runId}/artifacts/`);
                return { output: { artifacts: data.data ?? data } };
            }

            default:
                return { error: `Unknown dbt Cloud action: ${actionName}` };
        }
    } catch (err: any) {
        logger.log(`dbt Cloud action error: ${err.message}`);
        return { error: err.message ?? 'Unknown error in dbt Cloud action' };
    }
}
