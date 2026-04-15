'use server';

export async function executeRundeckAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any
): Promise<{ output?: any; error?: string }> {
    try {
        const { serverUrl, apiToken } = inputs;

        if (!serverUrl) return { error: 'Rundeck: serverUrl is required.' };
        if (!apiToken) return { error: 'Rundeck: apiToken is required.' };

        const base = `${serverUrl.replace(/\/$/, '')}/api/44`;

        const headers: Record<string, string> = {
            'X-Rundeck-Auth-Token': apiToken,
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };

        const rdGet = async (path: string): Promise<any> => {
            logger.log(`Rundeck GET ${path}`);
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const text = await res.text();
            if (!res.ok) throw new Error(`Rundeck GET ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        const rdPost = async (path: string, body?: any, extraHeaders?: Record<string, string>): Promise<any> => {
            logger.log(`Rundeck POST ${path}`);
            const mergedHeaders = { ...headers, ...(extraHeaders ?? {}) };
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers: mergedHeaders,
                body: body !== undefined ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
            });
            const text = await res.text();
            if (!res.ok) throw new Error(`Rundeck POST ${path} failed (${res.status}): ${text}`);
            return text ? JSON.parse(text) : {};
        };

        switch (actionName) {
            case 'listProjects': {
                const data: any[] = await rdGet('/projects');
                const projects = (Array.isArray(data) ? data : []).map((p: any) => ({
                    name: p.name,
                    description: p.description,
                    url: p.url,
                }));
                return { output: { projects } };
            }

            case 'getProject': {
                const { project } = inputs;
                if (!project) return { error: 'Rundeck getProject: project is required.' };
                const data = await rdGet(`/project/${encodeURIComponent(project)}`);
                return { output: { name: data.name, description: data.description, config: data.config ?? {} } };
            }

            case 'listJobs': {
                const { project, groupPath, idList } = inputs;
                if (!project) return { error: 'Rundeck listJobs: project is required.' };
                const params = new URLSearchParams();
                params.set('groupPath', groupPath ?? '*');
                if (idList) params.set('idList', idList);
                const data: any[] = await rdGet(`/project/${encodeURIComponent(project)}/jobs?${params.toString()}`);
                const jobs = (Array.isArray(data) ? data : []).map((j: any) => ({
                    id: j.id,
                    name: j.name,
                    group: j.group,
                    description: j.description,
                    project: j.project,
                }));
                return { output: { jobs } };
            }

            case 'getJob': {
                const { jobId } = inputs;
                if (!jobId) return { error: 'Rundeck getJob: jobId is required.' };
                const data = await rdGet(`/job/${jobId}`);
                return { output: { id: data.id, name: data.name, group: data.group, description: data.description, project: data.project } };
            }

            case 'runJob': {
                const { jobId, options, filter, logLevel, runAs } = inputs;
                if (!jobId) return { error: 'Rundeck runJob: jobId is required.' };
                const body: any = {
                    options: options ?? {},
                    loglevel: logLevel ?? 'INFO',
                };
                if (filter) body.filter = filter;
                if (runAs) body.asUser = runAs;
                const data = await rdPost(`/job/${jobId}/run`, body);
                return {
                    output: {
                        id: data.id,
                        href: data.href,
                        status: data.status,
                        job: { id: data.job?.id, name: data.job?.name },
                    },
                };
            }

            case 'getExecution': {
                const { executionId } = inputs;
                if (!executionId) return { error: 'Rundeck getExecution: executionId is required.' };
                const data = await rdGet(`/execution/${executionId}`);
                return {
                    output: {
                        id: data.id,
                        status: data.status,
                        dateStarted: data['date-started']?.date,
                        dateEnded: data['date-ended']?.date,
                        job: { id: data.job?.id, name: data.job?.name },
                        successfulNodes: data.successfulNodes ?? [],
                        failedNodes: data.failedNodes ?? [],
                    },
                };
            }

            case 'getExecutionOutput': {
                const { executionId, offset, maxLines } = inputs;
                if (!executionId) return { error: 'Rundeck getExecutionOutput: executionId is required.' };
                const params = new URLSearchParams();
                params.set('offset', String(offset ?? 0));
                params.set('maxLines', String(maxLines ?? 50));
                const data = await rdGet(`/execution/${executionId}/output?${params.toString()}`);
                return {
                    output: {
                        id: data.id,
                        offset: data.offset,
                        completed: data.completed,
                        entries: (data.entries ?? []).map((e: any) => ({
                            time: e.time,
                            level: e.level,
                            log: e.log,
                            node: e.node,
                            command: e.command,
                        })),
                    },
                };
            }

            case 'listExecutions': {
                const { project, statusFilter, jobFilter, max } = inputs;
                if (!project) return { error: 'Rundeck listExecutions: project is required.' };
                const params = new URLSearchParams();
                if (statusFilter) params.set('statusFilter', statusFilter);
                if (jobFilter) params.set('jobFilter', jobFilter);
                params.set('max', String(max ?? 20));
                const data = await rdGet(`/project/${encodeURIComponent(project)}/executions?${params.toString()}`);
                return { output: { executions: data.executions ?? [], paging: data.paging ?? {} } };
            }

            case 'abortExecution': {
                const { executionId } = inputs;
                if (!executionId) return { error: 'Rundeck abortExecution: executionId is required.' };
                const data = await rdPost(`/execution/${executionId}/abort`);
                return {
                    output: {
                        abort: { status: data.abort?.status, reason: data.abort?.reason },
                        execution: { id: data.execution?.id, status: data.execution?.status },
                    },
                };
            }

            case 'listSystemInfo': {
                const data = await rdGet('/system/info');
                return {
                    output: {
                        system: {
                            rundeck: {
                                version: data.system?.rundeck?.version,
                                apiversion: data.system?.rundeck?.apiversion,
                            },
                            stats: data.system?.stats ?? {},
                        },
                    },
                };
            }

            case 'importJob': {
                const { project, jobContent, fileType, uuidOption } = inputs;
                if (!project) return { error: 'Rundeck importJob: project is required.' };
                if (!jobContent) return { error: 'Rundeck importJob: jobContent is required.' };
                const ft = fileType ?? 'xml';
                const uo = uuidOption ?? 'preserve';
                const data = await rdPost(
                    `/project/${encodeURIComponent(project)}/jobs/import?fileType=${ft}&uuidOption=${uo}`,
                    jobContent,
                    { 'Content-Type': ft === 'yaml' ? 'text/yaml' : 'text/xml' }
                );
                return {
                    output: {
                        succeeded: (data.succeeded ?? []).map((j: any) => ({ id: j.id, name: j.name })),
                        failed: data.failed ?? [],
                        skipped: data.skipped ?? [],
                    },
                };
            }

            case 'exportJob': {
                const { jobId, format } = inputs;
                if (!jobId) return { error: 'Rundeck exportJob: jobId is required.' };
                const fmt = format ?? 'xml';
                logger.log(`Rundeck GET /job/${jobId}/${fmt}`);
                const res = await fetch(`${base}/job/${jobId}/${fmt}`, {
                    method: 'GET',
                    headers: { 'X-Rundeck-Auth-Token': apiToken, Accept: '*/*' },
                });
                const content = await res.text();
                if (!res.ok) throw new Error(`Rundeck exportJob failed (${res.status}): ${content}`);
                return { output: { content } };
            }

            default:
                return { error: `Rundeck: unknown action "${actionName}".` };
        }
    } catch (err: any) {
        logger.log(`Rundeck action error: ${err?.message}`);
        return { error: err?.message ?? 'Rundeck action failed.' };
    }
}
