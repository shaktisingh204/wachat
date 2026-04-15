'use server';

export async function executeDatabricksAction(
    actionName: string,
    inputs: any,
    user: any,
    logger: any,
): Promise<{ output: Record<string, any> } | { error: string }> {
    try {
        const { workspaceUrl, token } = inputs;

        if (!workspaceUrl) return { error: 'Databricks: workspaceUrl is required.' };
        if (!token) return { error: 'Databricks: token is required.' };

        const base = workspaceUrl.replace(/\/$/, '');
        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };

        const get = async (path: string) => {
            const res = await fetch(`${base}${path}`, { method: 'GET', headers });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message ?? body.error ?? JSON.stringify(body));
            return body;
        };

        const post = async (path: string, payload: Record<string, any>) => {
            const res = await fetch(`${base}${path}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message ?? body.error ?? JSON.stringify(body));
            return body;
        };

        switch (actionName) {
            case 'listClusters': {
                const data = await get('/api/2.0/clusters/list');
                const clusters = (data.clusters ?? []).map((c: any) => ({
                    cluster_id: c.cluster_id,
                    cluster_name: c.cluster_name,
                    state: c.state,
                    spark_version: c.spark_version,
                }));
                return { output: { clusters } };
            }

            case 'getCluster': {
                const { clusterId } = inputs;
                if (!clusterId) return { error: 'Databricks getCluster: clusterId is required.' };
                const data = await get(`/api/2.0/clusters/get?cluster_id=${encodeURIComponent(clusterId)}`);
                return {
                    output: {
                        cluster_id: data.cluster_id,
                        cluster_name: data.cluster_name,
                        state: data.state,
                        num_workers: data.num_workers,
                    },
                };
            }

            case 'startCluster': {
                const { clusterId } = inputs;
                if (!clusterId) return { error: 'Databricks startCluster: clusterId is required.' };
                await post('/api/2.0/clusters/start', { cluster_id: clusterId });
                return { output: { started: true } };
            }

            case 'terminateCluster': {
                const { clusterId } = inputs;
                if (!clusterId) return { error: 'Databricks terminateCluster: clusterId is required.' };
                await post('/api/2.0/clusters/delete', { cluster_id: clusterId });
                return { output: { terminated: true } };
            }

            case 'createCluster': {
                const { clusterName, sparkVersion, nodeTypeId, numWorkers, autoterminationMinutes } = inputs;
                if (!clusterName) return { error: 'Databricks createCluster: clusterName is required.' };
                if (!sparkVersion) return { error: 'Databricks createCluster: sparkVersion is required.' };
                if (!nodeTypeId) return { error: 'Databricks createCluster: nodeTypeId is required.' };
                if (numWorkers === undefined || numWorkers === null) return { error: 'Databricks createCluster: numWorkers is required.' };
                const data = await post('/api/2.0/clusters/create', {
                    cluster_name: clusterName,
                    spark_version: sparkVersion,
                    node_type_id: nodeTypeId,
                    num_workers: numWorkers,
                    autotermination_minutes: autoterminationMinutes ?? 60,
                });
                return { output: { cluster_id: data.cluster_id } };
            }

            case 'submitJob': {
                const { name, tasks } = inputs;
                if (!name) return { error: 'Databricks submitJob: name is required.' };
                if (!tasks) return { error: 'Databricks submitJob: tasks is required.' };
                const data = await post('/api/2.1/jobs/runs/submit', { run_name: name, tasks });
                return { output: { run_id: data.run_id } };
            }

            case 'getRunStatus': {
                const { runId } = inputs;
                if (!runId) return { error: 'Databricks getRunStatus: runId is required.' };
                const data = await get(`/api/2.1/jobs/runs/get?run_id=${encodeURIComponent(runId)}`);
                return {
                    output: {
                        run_id: data.run_id,
                        state: data.state,
                        start_time: data.start_time,
                        end_time: data.end_time,
                    },
                };
            }

            case 'listJobs': {
                const data = await get('/api/2.1/jobs/list');
                const jobs = (data.jobs ?? []).map((j: any) => ({
                    job_id: j.job_id,
                    settings: { name: j.settings?.name },
                }));
                return { output: { jobs } };
            }

            case 'triggerJob': {
                const { jobId, parameters } = inputs;
                if (!jobId) return { error: 'Databricks triggerJob: jobId is required.' };
                const data = await post('/api/2.1/jobs/run-now', {
                    job_id: jobId,
                    notebook_params: parameters,
                });
                return { output: { run_id: data.run_id } };
            }

            case 'executeSql': {
                const { statement, warehouseId, catalog, schema } = inputs;
                if (!statement) return { error: 'Databricks executeSql: statement is required.' };
                if (!warehouseId) return { error: 'Databricks executeSql: warehouseId is required.' };
                const data = await post('/api/2.0/sql/statements', {
                    statement,
                    warehouse_id: warehouseId,
                    catalog,
                    schema,
                    wait_timeout: '50s',
                });
                return {
                    output: {
                        statement_id: data.statement_id,
                        status: data.status,
                        result: data.result ?? { data_array: [], schema: { columns: [] } },
                    },
                };
            }

            case 'listFiles': {
                const { path } = inputs;
                if (!path) return { error: 'Databricks listFiles: path is required.' };
                const data = await get(`/api/2.0/dbfs/list?path=${encodeURIComponent(path)}`);
                const files = (data.files ?? []).map((f: any) => ({
                    path: f.path,
                    isDir: f.is_dir,
                    fileSize: f.file_size,
                }));
                return { output: { files } };
            }

            case 'readFile': {
                const { path } = inputs;
                if (!path) return { error: 'Databricks readFile: path is required.' };
                const data = await get(
                    `/api/2.0/dbfs/read?path=${encodeURIComponent(path)}&length=1000000`,
                );
                return { output: { data: data.data } };
            }

            case 'listNotebooks': {
                const { path } = inputs;
                if (!path) return { error: 'Databricks listNotebooks: path is required.' };
                const data = await get(`/api/2.0/workspace/list?path=${encodeURIComponent(path)}`);
                const objects = (data.objects ?? []).map((o: any) => ({
                    path: o.path,
                    objectType: o.object_type,
                    language: o.language,
                }));
                return { output: { objects } };
            }

            default:
                logger.log(`Databricks: unknown action "${actionName}"`);
                return { error: `Databricks: unknown action "${actionName}"` };
        }
    } catch (err: any) {
        logger.log(`Databricks action "${actionName}" error: ${err.message}`);
        return { error: err.message ?? 'Databricks: unknown error' };
    }
}
